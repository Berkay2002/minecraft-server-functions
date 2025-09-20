const functions = require('@google-cloud/functions-framework');
const {InstancesClient, ZoneOperationsClient} = require('@google-cloud/compute');

// Initialize the Compute Engine clients
const instancesClient = new InstancesClient();
const operationsClient = new ZoneOperationsClient();

/**
 * Cloud Run Function to stop the Minecraft server VM instance
 * HTTP Function triggered by GET/POST requests
 * 
 * Environment Variables Required:
 * - GOOGLE_CLOUD_PROJECT: Your GCP project ID (linear-skill-471411-n9)
 * - MINECRAFT_ZONE: VM zone (us-central1-f) 
 * - MINECRAFT_INSTANCE: VM instance name (instance-20250920-120747)
 */
functions.http('stopServer', async (req, res) => {
  try {
    // Set CORS headers for web requests
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // Configuration from environment variables
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'linear-skill-471411-n9';
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
    console.log(`Machine type: ${instance.machineType?.split('/').pop()}`);
    console.log(`Network tags: ${instance.tags?.items?.join(', ') || 'none'}`);

    if (instance.status === 'TERMINATED') {
      return res.json({
        success: true,
        message: 'Minecraft server is already stopped',
        status: instance.status,
        lastStopped: instance.lastStopTimestamp || 'Unknown'
      });
    }

    if (instance.status === 'STOPPING') {
      return res.json({
        success: true,
        message: 'Minecraft server is currently stopping',
        status: instance.status,
        note: 'Stop operation already in progress'
      });
    }

    if (instance.status !== 'RUNNING') {
      return res.status(409).json({
        success: false,
        message: `Cannot stop server in ${instance.status} state. Expected RUNNING.`,
        status: instance.status
      });
    }

    // Get current IP addresses before stopping (for logging)
    const externalIp = instance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP;
    const internalIp = instance.networkInterfaces?.[0]?.networkIP;
    console.log(`Stopping server with IP: ${externalIp} (external), ${internalIp} (internal)`);

    // Stop the instance using the latest API pattern
    console.log('Stopping instance...');
    const [operation] = await instancesClient.stop({
      project: projectId,
      zone: zone,
      instance: instanceName,
    });

    console.log(`Stop operation initiated: ${operation.name}`);
    console.log(`Operation type: ${operation.operationType}`);

    // Use the improved operation waiting pattern from Google's documentation
    let currentOperation = operation.latestResponse || operation;
    const maxWaitTime = 120000; // 2 minutes (sufficient for graceful shutdown)
    const startTime = Date.now();
    const pollInterval = 3000; // 3 seconds

    // Wait for operation to complete using the ZoneOperationsClient.wait() method
    while (currentOperation.status !== 'DONE' && (Date.now() - startTime) < maxWaitTime) {
      console.log(`Operation status: ${currentOperation.status}, waiting ${pollInterval/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      try {
        const [updatedOperation] = await operationsClient.wait({
          operation: currentOperation.name.split('/').pop(), // Extract operation name
          project: projectId,
          zone: currentOperation.zone?.split('/').pop() || zone,
        });
        currentOperation = updatedOperation;
      } catch (waitError) {
        console.warn('Wait operation failed, falling back to get:', waitError.message);
        // Fallback to get operation if wait fails
        const [updatedOperation] = await operationsClient.get({
          project: projectId,
          zone: zone,
          operation: currentOperation.name.split('/').pop(),
        });
        currentOperation = updatedOperation;
      }
    }

    if (currentOperation.status === 'DONE') {
      // Check for operation errors
      if (currentOperation.error) {
        console.error('Stop operation completed with errors:', currentOperation.error);
        return res.status(500).json({
          success: false,
          message: 'Failed to stop Minecraft server',
          error: currentOperation.error.errors?.[0]?.message || 'Unknown error',
          operationId: operation.name
        });
      }

      // Get updated instance info after successful stop
      const [updatedInstance] = await instancesClient.get({
        project: projectId,
        zone: zone,
        instance: instanceName,
      });

      console.log('Minecraft server stopped successfully');
      console.log(`Final status: ${updatedInstance.status}`);
      console.log(`Stop completed at: ${updatedInstance.lastStopTimestamp}`);

      res.json({
        success: true,
        message: 'Minecraft server stopped successfully',
        status: updatedInstance.status,
        lastStoppedAt: updatedInstance.lastStopTimestamp,
        operationId: operation.name,
        note: 'Server data is preserved. Use startServer to restart.',
        costSaving: 'VM charges stopped, only persistent disk charges remain'
      });
    } else {
      console.log('Stop operation is still in progress after timeout');
      res.status(202).json({
        success: true,
        message: 'Minecraft server stop operation initiated (taking longer than expected)',
        operationId: operation.name,
        status: 'STOPPING',
        note: 'Shutdown scripts may still be running. Check the GCP Console for progress.'
      });
    }

  } catch (error) {
    console.error('Error stopping Minecraft server:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to stop Minecraft server';
    let statusCode = 500;
    
    if (error.code === 3) { // INVALID_ARGUMENT
      errorMessage = 'Invalid request parameters';
      statusCode = 400;
    } else if (error.code === 7) { // PERMISSION_DENIED
      errorMessage = 'Permission denied. Check IAM roles and service account permissions.';
      statusCode = 403;
    } else if (error.code === 5) { // NOT_FOUND
      errorMessage = 'VM instance not found. Check instance name and zone.';
      statusCode = 404;
    } else if (error.code === 8) { // RESOURCE_EXHAUSTED
      errorMessage = 'Quota exceeded. Check GCP quotas.';
      statusCode = 429;
    } else if (error.code === 9) { // FAILED_PRECONDITION
      errorMessage = 'Instance cannot be stopped in its current state.';
      statusCode = 409;
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message,
      code: error.code,
      details: error.details || 'Check Cloud Function logs for more details'
    });
  }
});
