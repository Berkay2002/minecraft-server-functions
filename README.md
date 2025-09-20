# Minecraft Server Cloud Functions (Gen 2)

Gen 2 Cloud Run Functions for managing a Minecraft server on Google Cloud Platform using Node.js 20.

## 🎯 Functions

- **`startServer`**: Starts the Minecraft server VM instance
- **`stopServer`**: Stops the Minecraft server VM instance  
- **`addFriend`**: Adds a friend's IP address to the firewall whitelist

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Berkay2002/minecraft-server-functions.git
cd minecraft-server-functions
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Google Cloud

```bash
# Set your project ID
export GOOGLE_CLOUD_PROJECT=your-project-id

# Enable required APIs
gcloud services enable compute.googleapis.com
gcloud services enable run.googleapis.com

# Set up IAM permissions
./setup-iam.sh your-project-id
```

### 4. Deploy Functions

```bash
# Manual deployment
./deploy.sh
```

**OR** use GitHub Actions for continuous deployment (see [CI/CD Setup](#cicd-setup) below).

## 📁 Project Structure

```
├── .github/workflows/deploy.yml  # GitHub Actions workflow
├── .env.example                  # Environment variables template
├── .gcloudignore                 # Files to exclude from deployment
├── .gitignore                    # Git ignore file
├── README.md                     # This file
├── add-friend.js                 # Add friend function
├── deploy.sh                     # Manual deployment script
├── index.js                      # Main entry point
├── package.json                  # Node.js dependencies
├── setup-iam.sh                  # IAM setup script
├── start-server.js               # Start server function
└── stop-server.js                # Stop server function
```

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_CLOUD_PROJECT` | - | Your Google Cloud project ID |
| `MINECRAFT_ZONE` | `europe-west1-b` | Zone where your Minecraft server is located |
| `MINECRAFT_INSTANCE` | `minecraft-server` | Name of your Minecraft server VM instance |
| `MINECRAFT_FIREWALL_RULE` | `minecraft-server-allow` | Name of the firewall rule for Minecraft |

### Setting Up Your Minecraft Server VM

1. **Create a VM instance** with the name specified in `MINECRAFT_INSTANCE`
2. **Add network tags**: Tag your VM with `minecraft-server` for firewall rules
3. **Install Minecraft server** on the VM
4. **Configure startup/shutdown scripts** (optional)

Example VM creation:

```bash
gcloud compute instances create minecraft-server \
    --zone=europe-west1-b \
    --machine-type=e2-standard-2 \
    --image-family=ubuntu-2004-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=20GB \
    --tags=minecraft-server \
    --metadata-from-file startup-script=startup.sh
```

## 🔧 Deployment Options

### Option 1: Manual Deployment

```bash
# One-time setup
./setup-iam.sh your-project-id

# Deploy functions
./deploy.sh
```

### Option 2: GitHub Actions (Recommended)

1. **Fork/clone this repository**
2. **Set up GitHub Secrets**:
   - `GCP_PROJECT_ID`: Your Google Cloud project ID
   - `GCP_SERVICE_ACCOUNT_KEY`: Service account JSON key (see below)
3. **Push to main branch** - deployment happens automatically!

#### Creating Service Account Key:

```bash
# Create service account
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions"

# Grant necessary roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudbuild.builds.builder"

# Create and download key
gcloud iam service-accounts keys create key.json \
    --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com

# Add the content of key.json to GitHub Secrets as GCP_SERVICE_ACCOUNT_KEY
```

## 📡 API Usage

Once deployed, you can use the functions via HTTP requests:

### Start Server

```bash
curl -X POST https://minecraft-start-server-[hash]-ew.a.run.app
```

**Response:**
```json
{
  "success": true,
  "message": "Minecraft server started successfully",
  "status": "RUNNING",
  "externalIp": "34.77.123.45",
  "operationId": "operation-123"
}
```

### Stop Server

```bash
curl -X POST https://minecraft-stop-server-[hash]-ew.a.run.app
```

**Response:**
```json
{
  "success": true,
  "message": "Minecraft server stopped successfully",
  "status": "TERMINATED",
  "operationId": "operation-456"
}
```

### Add Friend

```bash
# Auto-detect IP
curl -X POST https://minecraft-add-friend-[hash]-ew.a.run.app \
  -H "Content-Type: application/json" \
  -d '{"name": "John"}'

# Specify IP manually
curl -X POST https://minecraft-add-friend-[hash]-ew.a.run.app \
  -H "Content-Type: application/json" \
  -d '{"name": "John", "ip": "203.0.113.1"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully added John to Minecraft server whitelist",
  "ip": "203.0.113.1",
  "friendName": "John",
  "operationId": "operation-789",
  "totalAllowedIPs": 5
}
```

## 🔒 Security & IAM

### Required IAM Roles

The functions require these IAM permissions:

- `compute.instanceAdmin.v1` - Start/stop VM instances
- `compute.networkAdmin` - Manage firewall rules
- `compute.viewer` - View compute resources
- `logging.logWriter` - Write logs

### Security Best Practices

1. **Use HTTPS only** - Functions are deployed with HTTPS endpoints
2. **Restrict function access** - Consider adding authentication
3. **Monitor firewall rules** - Regularly audit allowed IPs
4. **Use network tags** - Tag your Minecraft VM for targeted firewall rules
5. **Enable logging** - Monitor function usage and errors

### Adding Authentication (Optional)

To secure your functions, you can:

1. **Remove `--allow-unauthenticated`** from deployment
2. **Use Cloud IAM** for access control
3. **Add API keys** in function code
4. **Use Google Identity** for user authentication

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Run individual functions locally
npx @google-cloud/functions-framework --target=startServer --port=8080
npx @google-cloud/functions-framework --target=stopServer --port=8081
npx @google-cloud/functions-framework --target=addFriend --port=8082

# Test locally
curl -X POST http://localhost:8080
```

## 🐛 Troubleshooting

### Common Issues

**1. "Project ID not found" Error**
```bash
# Set project ID environment variable
export GOOGLE_CLOUD_PROJECT=your-project-id
```

**2. "Instance not found" Error**
- Verify `MINECRAFT_INSTANCE` matches your VM name
- Check that VM exists in the specified zone

**3. "Permission denied" Error**
- Run `./setup-iam.sh` to configure permissions
- Ensure service account has required roles

**4. "Firewall rule not found" Error**
- The `addFriend` function will create the rule automatically
- Ensure your VM has the `minecraft-server` network tag

**5. Function timeout**
- VM operations can take time, functions wait up to 2 minutes
- Check Google Cloud Console for operation status

### Viewing Logs

```bash
# View function logs
gcloud logging read "resource.type=cloud_run_revision" --limit=50

# View logs for specific function
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=minecraft-start-server" --limit=20
```

## 🎮 Integration Ideas

### Discord Bot Integration

Create a Discord bot that calls these functions:

```javascript
// Example Discord.js command
client.on('messageCreate', async (message) => {
  if (message.content === '!start-server') {
    const response = await fetch('https://minecraft-start-server-[hash]-ew.a.run.app', {
      method: 'POST'
    });
    const data = await response.json();
    message.reply(`Server status: ${data.message}`);
  }
});
```

### Web Dashboard

Build a simple web interface:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Minecraft Server Control</title>
</head>
<body>
    <button onclick="startServer()">Start Server</button>
    <button onclick="stopServer()">Stop Server</button>
    <button onclick="addFriend()">Add Me as Friend</button>
    
    <script>
        async function startServer() {
            const response = await fetch('https://minecraft-start-server-[hash]-ew.a.run.app', {
                method: 'POST'
            });
            const data = await response.json();
            alert(data.message);
        }
        
        // Similar functions for stopServer and addFriend
    </script>
</body>
</html>
```

### Mobile App Integration

Use the HTTP endpoints in mobile apps for remote server management.

## 📊 Monitoring & Observability

### Cloud Monitoring

- Function invocations
- Error rates
- Execution times
- VM status changes

### Alerting

Set up alerts for:
- Function failures
- High execution times
- Unauthorized access attempts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review function logs in Cloud Console
3. Open an issue in this repository
4. Check Google Cloud documentation

## 🔗 Useful Links

- [Google Cloud Run Functions Documentation](https://cloud.google.com/run/docs/write-functions)
- [Google Compute Engine API](https://cloud.google.com/compute/docs/reference/rest/v1)
- [Node.js Functions Framework](https://github.com/GoogleCloudPlatform/functions-framework-nodejs)
- [Minecraft Server Setup Guide](https://minecraft.fandom.com/wiki/Tutorials/Setting_up_a_server)

---

**Happy Mining! ⛏️🎮**