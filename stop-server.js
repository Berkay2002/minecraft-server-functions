const functions = require('@google-cloud/functions-framework');
const {InstancesClient} = require('@google-cloud/compute');

// Initialize the Compute Engine client
const instancesClient = new InstancesClient();

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

    // Configuration - you can also use environment variables
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
    const zone = process.env.MINECRAFT_ZONE || 'europe-west1-b';
    const instanceName = process.env.MINECRAFT_INSTANCE || 'minecraft-server';

    if (!projectId) {
      throw new Error('Project ID not found. Set GOOGLE_CLOUD_PROJECT environment variable.');
    }

    console.log(`Stopping Minecraft server: ${instanceName} in zone: ${zone}`);

    // Check if instance is already stopped
    const [instance] = await instancesClient.get({
      project: projectId,
      zone: zone,
      instance: instanceName,
    });

    if (instance.status === 'TERMINATED' || instance.status === 'STOPPED') {
      console.log('Minecraft server is already stopped');
      res.status(200).json({
        success: true,
        message: 'Minecraft server is already stopped',
        status: instance.status
      });
      return;
    }

    // Stop the instance
    const [operation] = await instancesClient.stop({
      project: projectId,
      zone: zone,
      instance: instanceName,
    });

    console.log(`Stop operation initiated: ${operation.name}`);

    // Wait for the operation to complete (optional, but recommended)
    let operationStatus = operation;
    const maxWaitTime = 120000; // 2 minutes
    const startTime = Date.now();

    while (operationStatus.status !== 'DONE' && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      
      const [updatedOperation] = await instancesClient.getOperation({
        project: projectId,
        zone: zone,
        operation: operation.name,
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
      res.status(200).json({
        success: true,
        message: 'Minecraft server stopped successfully',
        status: updatedInstance.status,
        operationId: operation.name
      });
    } else {
      console.log('Stop operation is still in progress');
      res.status(202).json({
        success: true,
        message: 'Minecraft server stop operation initiated',
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