const functions = require('@google-cloud/functions-framework');
const {FirewallsClient} = require('@google-cloud/compute');

// Initialize the Firewall client
const firewallsClient = new FirewallsClient();

/**
 * Cloud Run Function to add a friend's IP to Minecraft server firewall
 * HTTP Function triggered by POST requests
 */
functions.http('addFriend', async (req, res) => {
  try {
    // Set CORS headers for web requests
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // Only accept POST requests for adding friends
    if (req.method !== 'POST') {
      res.status(405).json({
        success: false,
        message: 'Method not allowed. Use POST to add a friend.'
      });
      return;
    }

    // Configuration
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
    const firewallRuleName = process.env.MINECRAFT_FIREWALL_RULE || 'minecraft-server-allow';

    if (!projectId) {
      throw new Error('Project ID not found. Set GOOGLE_CLOUD_PROJECT environment variable.');
    }

    // Get the client IP or from request body
    let clientIp = req.body?.ip || 
                   req.query?.ip || 
                   req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
                   req.connection?.remoteAddress ||
                   req.socket?.remoteAddress ||
                   (req.connection?.socket ? req.connection.socket.remoteAddress : null);

    // Clean up IPv6 mapped IPv4 addresses
    if (clientIp && clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.substring(7);
    }

    const friendName = req.body?.name || req.query?.name || 'Anonymous';

    if (!clientIp || clientIp === '127.0.0.1' || clientIp === '::1') {
      res.status(400).json({
        success: false,
        message: 'Unable to determine client IP address. Please provide IP in request body.',
        detectedIp: clientIp
      });
      return;
    }

    console.log(`Adding friend ${friendName} with IP: ${clientIp}`);

    try {
      // Get existing firewall rule
      const [firewallRule] = await firewallsClient.get({
        project: projectId,
        firewall: firewallRuleName,
      });

      // Check if IP is already in the allowed list
      const currentIps = firewallRule.sourceRanges || [];
      const ipWithCidr = clientIp.includes('/') ? clientIp : `${clientIp}/32`;
      
      if (currentIps.includes(ipWithCidr) || currentIps.includes(clientIp)) {
        console.log(`IP ${clientIp} is already allowed`);
        res.status(200).json({
          success: true,
          message: `IP ${clientIp} is already allowed to access the Minecraft server`,
          ip: clientIp,
          friendName: friendName,
          alreadyExists: true
        });
        return;
      }

      // Add the new IP to the source ranges
      const updatedSourceRanges = [...currentIps, ipWithCidr];

      // Update the firewall rule
      const updatedRule = {
        ...firewallRule,
        sourceRanges: updatedSourceRanges,
      };

      const [operation] = await firewallsClient.patch({
        project: projectId,
        firewall: firewallRuleName,
        firewallResource: updatedRule,
      });

      console.log(`Firewall rule update operation initiated: ${operation.name}`);

      // Wait for the operation to complete
      let operationStatus = operation;
      const maxWaitTime = 60000; // 1 minute
      const startTime = Date.now();

      while (operationStatus.status !== 'DONE' && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const [updatedOperation] = await firewallsClient.getGlobalOperation({
          project: projectId,
          operation: operation.name,
        });
        operationStatus = updatedOperation;
      }

      if (operationStatus.status === 'DONE') {
        console.log(`Successfully added ${friendName} (${clientIp}) to firewall`);
        res.status(200).json({
          success: true,
          message: `Successfully added ${friendName} to Minecraft server whitelist`,
          ip: clientIp,
          friendName: friendName,
          operationId: operation.name,
          totalAllowedIPs: updatedSourceRanges.length
        });
      } else {
        console.log('Firewall update operation is still in progress');
        res.status(202).json({
          success: true,
          message: `Adding ${friendName} to Minecraft server whitelist (operation in progress)`,
          ip: clientIp,
          friendName: friendName,
          operationId: operation.name
        });
      }

    } catch (firewallError) {
      if (firewallError.code === 404) {
        // Firewall rule doesn't exist, create it
        console.log(`Firewall rule ${firewallRuleName} not found, creating new rule`);
        
        const newFirewallRule = {
          name: firewallRuleName,
          description: 'Allow access to Minecraft server for friends',
          direction: 'INGRESS',
          allowed: [
            {
              IPProtocol: 'tcp',
              ports: ['25565'], // Default Minecraft port
            },
          ],
          sourceRanges: [clientIp.includes('/') ? clientIp : `${clientIp}/32`],
          targetTags: ['minecraft-server'], // Tag your Minecraft server VM with this
        };

        const [createOperation] = await firewallsClient.insert({
          project: projectId,
          firewallResource: newFirewallRule,
        });

        console.log(`Firewall rule creation operation initiated: ${createOperation.name}`);
        
        res.status(201).json({
          success: true,
          message: `Created new firewall rule and added ${friendName} to Minecraft server whitelist`,
          ip: clientIp,
          friendName: friendName,
          operationId: createOperation.name,
          newRule: true
        });
      } else {
        throw firewallError;
      }
    }

  } catch (error) {
    console.error('Error adding friend to firewall:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add friend to Minecraft server whitelist',
      error: error.message
    });
  }
});