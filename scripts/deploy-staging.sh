#!/bin/bash

# Staging Deployment Script
# Deploys the application to staging environment for testing

set -e

echo "🚀 Starting staging deployment..."

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install it first:"
    echo "   npm install -g @railway/cli"
    exit 1
fi

# Check if logged in to railway
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway. Run: railway login"
    exit 1
fi

# Set staging environment variables
echo "📋 Setting staging environment variables..."
railway variables --environment staging \
    NODE_ENV=staging \
    FEATURE_FLAGS_ENABLED=true \
    USE_FLUID_ARCHITECTURE=true \
    RAG_CACHE_TTL=300 \
    LOG_LEVEL=debug

# Deploy to staging
echo "📦 Deploying to staging..."
railway up --environment staging --service comparador-staging

# Wait for deployment to be ready
echo "⏳ Waiting for deployment to be ready..."
sleep 30

# Run health check
echo "🏥 Running health check..."
HEALTH_URL=$(railway domain --environment staging)
if curl -f "https://${HEALTH_URL}/health" > /dev/null 2>&1; then
    echo "✅ Staging deployment successful!"
    echo "🌐 Staging URL: https://${HEALTH_URL}"
else
    echo "⚠️  Health check failed. Check logs:"
    echo "   railway logs --environment staging"
    exit 1
fi

echo ""
echo "📝 Next steps:"
echo "   1. Run smoke tests: npm run test:smoke"
echo "   2. Verify feature flags: curl https://${HEALTH_URL}/api/features"
echo "   3. Check monitoring: https://${HEALTH_URL}/health"