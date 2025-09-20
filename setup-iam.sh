#!/bin/bash
# Script to set up IAM permissions for Minecraft Server Functions

set -e

# Configuration
PROJECT_ID="${1:-$GOOGLE_CLOUD_PROJECT}"
SERVICE_ACCOUNT_NAME="minecraft-functions-sa"
SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

if [ -z "$PROJECT_ID" ]; then
    echo "Error: Please provide PROJECT_ID as first argument or set GOOGLE_CLOUD_PROJECT environment variable"
    exit 1
fi

echo "Setting up IAM for Minecraft Server Functions in project: $PROJECT_ID"

# Create service account if it doesn't exist
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "Creating service account: $SERVICE_ACCOUNT_NAME"
    gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
        --project="$PROJECT_ID" \
        --display-name="Minecraft Server Functions Service Account" \
        --description="Service account for Cloud Run Functions managing Minecraft server"
else
    echo "Service account $SERVICE_ACCOUNT_NAME already exists"
fi

# Required roles for Minecraft server management
ROLES=(
    "roles/compute.instanceAdmin.v1"    # Start/stop instances
    "roles/compute.networkAdmin"        # Manage firewall rules  
    "roles/compute.viewer"              # View compute resources
    "roles/logging.logWriter"           # Write logs
)

# Grant roles to service account
for ROLE in "${ROLES[@]}"; do
    echo "Granting role: $ROLE"
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="$ROLE"
done

# Grant Cloud Run service account permission to use this service account
DEFAULT_COMPUTE_SA="$(gcloud projects describe $PROJECT_ID --format='value(defaultServiceAccount)')"
echo "Granting Cloud Run default service account permission to use custom service account"

gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT_EMAIL" \
    --member="serviceAccount:$DEFAULT_COMPUTE_SA" \
    --role="roles/iam.serviceAccountUser" \
    --project="$PROJECT_ID"

echo ""
echo "✅ IAM setup complete!"
echo ""
echo "Service Account: $SERVICE_ACCOUNT_EMAIL"
echo "Granted Roles:"
for ROLE in "${ROLES[@]}"; do
    echo "  - $ROLE"
done
echo ""
echo "To use this service account with your functions, add the following to your deployment command:"
echo "  --service-account=$SERVICE_ACCOUNT_EMAIL"