const functions = require('@google-cloud/functions-framework');
const {InstancesClient, ZoneOperationsClient} = require('@google-cloud/compute');

// Initialize the Compute Engine clients
const instancesClient = new InstancesClient();
const operationsClient = new ZoneOperationsClient();

/**
 * Cloud Run Function to start the Minecraft server
 * HTTP Function triggered by GET/POST requests
 */
functions.http('startServer', async (req, res) => {
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

    // Configuration from environment variables
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
    const zone = process.env.MINECRAFT_ZONE || 'us-central1-f';
    const instanceName = process.env.MINECRAFT_INSTANCE || 'instance-20250920-120747';

    if (!projectId) {
      throw new Error('Project ID not found. Set GOOGLE_CLOUD_PROJECT environment variable.');
    }

    console.log(`Starting Minecraft server: ${instanceName} in zone: ${zone}, project: ${projectId}`);

    // Check current instance status first
    const [instance] = await instancesClient.get({
      project: projectId,
      zone: zone,
      instance: instanceName,
    });

    console.log(`Current instance status: ${instance.status}`);

    if (instance.status === 'RUNNING') {
      const externalIp = instance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP;
      return res.json({
        success: true,
        message: 'Minecraft server is already running',
        status: instance.status,
        externalIp: externalIp || 'N/A'
      });
    }

    if (instance.status === 'STOPPING') {
      return res.json({
        success: false,
        message: 'Server is currently stopping, please wait and try again',
        status: instance.status
      });
    }

    // Start the instance
    console.log('Starting instance...');
    const [operation] = await instancesClient.start({
      project: projectId,
      zone: zone,
      instance: instanceName,
    });

    console.log(`Start operation initiated: ${operation.name}`);

    // Wait for operation to complete using the correct client
    let operationStatus = operation;
    const maxWaitTime = 120000; // 2 minutes
    const startTime = Date.now();

    while (operationStatus.status !== 'DONE' && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      
      const [updatedOperation] = await operationsClient.get({
        project: projectId,
        zone: zone,
        operation: operation.name.split('/').pop(), // Extract operation name
      });
      operationStatus = updatedOperation;
    }

    if (operationStatus.status === 'DONE') {
      // Get updated instance info
      const [updatedInstance] = await instancesClient.get({
        project: projectId,
        zone: zone,
        instance: instanceName,
      });

      const externalIp = updatedInstance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP;

      console.log('Minecraft server started successfully');
      res.json({
        success: true,
        message: 'Minecraft server started successfully',
        status: updatedInstance.status,
        externalIp: externalIp || 'N/A',
        operationId: operation.name
      });
    } else {
      console.log('Start operation is still in progress');
      res.status(202).json({
        success: true,
        message: 'Minecraft server start operation initiated (may take a few minutes)',
        operationId: operation.name,
        status: 'STARTING'
      });
    }

  } catch (error) {
    console.error('Error starting Minecraft server:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start Minecraft server',
      error: error.message
    });
  }
});