#!/bin/bash
# Manual deployment script for Minecraft Server Functions

set -e

# Your actual configuration based on VM and firewall JSON
PROJECT_ID="linear-skill-471411-n9"
REGION="${REGION:-europe-west1}"
MINECRAFT_ZONE="us-central1-f"
MINECRAFT_INSTANCE="instance-20250920-120747"
MINECRAFT_FIREWALL_RULE="minecraft-server-ingress"

echo "Deploying Minecraft Server Functions to project: $PROJECT_ID"
echo "Region: $REGION"
echo "Minecraft Zone: $MINECRAFT_ZONE"
echo "Minecraft Instance: $MINECRAFT_INSTANCE"
echo "Minecraft Firewall Rule: $MINECRAFT_FIREWALL_RULE"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Deploy functions
echo ""
echo "🚀 Deploying Start Server Function..."
gcloud run deploy minecraft-start-server \
    --source . \
    --function startServer \
    --base-image nodejs20 \
    --region "$REGION" \
    --allow-unauthenticated \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GCP_PROJECT=$PROJECT_ID,MINECRAFT_ZONE=$MINECRAFT_ZONE,MINECRAFT_INSTANCE=$MINECRAFT_INSTANCE" \
    --max-instances=1 \
    --timeout=300 \
    --memory=512Mi \
    --project="$PROJECT_ID"

echo ""
echo "🛑 Deploying Stop Server Function..."
gcloud run deploy minecraft-stop-server \
    --source . \
    --function stopServer \
    --base-image nodejs20 \
    --region "$REGION" \
    --allow-unauthenticated \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GCP_PROJECT=$PROJECT_ID,MINECRAFT_ZONE=$MINECRAFT_ZONE,MINECRAFT_INSTANCE=$MINECRAFT_INSTANCE" \
    --max-instances=1 \
    --timeout=300 \
    --memory=512Mi \
    --project="$PROJECT_ID"

echo ""
echo "👥 Deploying Add Friend Function..."
gcloud run deploy minecraft-add-friend \
    --source . \
    --function addFriend \
    --base-image nodejs20 \
    --region "$REGION" \
    --allow-unauthenticated \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GCP_PROJECT=$PROJECT_ID,MINECRAFT_ZONE=$MINECRAFT_ZONE,MINECRAFT_INSTANCE=$MINECRAFT_INSTANCE,MINECRAFT_FIREWALL_RULE=$MINECRAFT_FIREWALL_RULE" \
    --max-instances=5 \
    --timeout=180 \
    --memory=512Mi \
    --project="$PROJECT_ID"

# Get function URLs
echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📋 Function URLs:"
echo "  Start Server: $(gcloud run services describe minecraft-start-server --region="$REGION" --format='value(status.url)' --project="$PROJECT_ID")"
echo "  Stop Server:  $(gcloud run services describe minecraft-stop-server --region="$REGION" --format='value(status.url)' --project="$PROJECT_ID")"
echo "  Add Friend:   $(gcloud run services describe minecraft-add-friend --region="$REGION" --format='value(status.url)' --project="$PROJECT_ID")"
echo ""
echo "🔧 Test your functions:"
echo "  curl -X POST [START_SERVER_URL]"
echo "  curl -X POST [STOP_SERVER_URL]"
echo "  curl -X POST [ADD_FRIEND_URL] -H \"Content-Type: application/json\" -d '{\"name\": \"TestFriend\"}'"
echo ""
echo "🎮 Your Minecraft server functions are ready!"