// Main entry point for Gen 2 Cloud Run Functions
// This file exports all the function entry points

// Import individual function files
require('./start-server');
require('./stop-server');
require('./add-friend');

console.log('Minecraft Server Cloud Functions loaded successfully');