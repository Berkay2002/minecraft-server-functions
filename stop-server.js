const functions = require('@google-cloud/functions-framework');
const {InstancesClient, ZoneOperationsClient} = require('@google-cloud/compute');

// Initialize the Compute Engine clients
const instancesClient = new InstancesClient();
const operationsClient = new ZoneOperationsClient();

/**
 * Cloud Run Function to stop the Minecraft server
 * HTTP Function triggered by GET/POST requests
 */
functions.http('stopServer', async (req, res) => {
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

    console.log(`Stopping Minecraft server: ${instanceName} in zone: ${zone}, project: ${projectId}`);

    // Check current instance status first
    const [instance] = await instancesClient.get({
      project: projectId,
      zone: zone,
      instance: instanceName,
    });

    console.log(`Current instance status: ${instance.status}`);

    if (instance.status === 'TERMINATED') {
      return res.json({
        success: true,
        message: 'Minecraft server is already stopped',
        status: instance.status
      });
    }

    if (instance.status === 'STOPPING') {
      return res.json({
        success: true,
        message: 'Minecraft server is currently stopping',
        status: instance.status
      });
    }

    if (instance.status !== 'RUNNING') {
      return res.json({
        success: false,
        message: `Cannot stop server in ${instance.status} state`,
        status: instance.status
      });
    }

    // Stop the instance
    console.log('Stopping instance...');
    const [operation] = await instancesClient.stop({
      project: projectId,
      zone: zone,
      instance: instanceName,
    });

    console.log(`Stop operation initiated: ${operation.name}`);

    // Wait for operation to complete using the correct client
    let operationStatus = operation;
    const maxWaitTime = 120000; // 2 minutes
    const startTime = Date.now();

    while (operationStatus.status !== 'DONE' && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      
      const [updatedOperation] = await operationsClient.get({
        project: projectId,
        zone: zone,
        operation: operation.name.split('/').pop(),
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

      console.log('Minecraft server stopped successfully');
      res.json({
        success: true,
        message: 'Minecraft server stopped successfully',
        status: updatedInstance.status,
        operationId: operation.name
      });
    } else {
      console.log('Stop operation is still in progress');
      res.status(202).json({
        success: true,
        message: 'Minecraft server stop operation initiated (may take a few minutes)',
        operationId: operation.name,
        status: 'STOPPING'
      });
    }

  } catch (error) {
    console.error('Error stopping Minecraft server:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop Minecraft server',
      error: error.message
    });
  }
});