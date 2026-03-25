---
description: Deploy updates to Cloud Run
---
# Deploy to Google Cloud Run

To update your production application with the latest code changes, you can use the npm script I added:

```bash
npm run deploy
```

Or run the full command manually:

// turbo
gcloud run deploy agent-comparador-csa --source . --region us-central1 --allow-unauthenticated

> **Note:** This command builds the new Docker container from your current directory and deploys it. It preserves existing environment variables (like your API Key).
