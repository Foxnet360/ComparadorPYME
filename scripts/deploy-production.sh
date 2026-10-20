#!/bin/bash

# Production Deployment Script with Feature Flags
# Gradual rollout with monitoring

set -e

echo "🚀 Starting production deployment..."
echo ""

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

# Confirm production deployment
echo "⚠️  WARNING: This will deploy to PRODUCTION"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Set production environment variables with feature flags
echo "📋 Setting production feature flags..."
railway variables --environment production \
    NODE_ENV=production \
    FEATURE_FLAGS='{"structuredClauseExtraction":true,"semanticCoverageOntology":true,"variableComparisonEngine":true,"deductibleSemanticParser":true,"tripleSourceChat":true,"learningEngine":true,"queryExpansion":true,"hybridSearchV2":true,"useLegacyCoverageMatcher":false,"useLegacyDeductibleParser":false,"useLegacyChatOnlyRAG":false}' \
    FEATURE_STRUCTURED_CLAUSE_EXTRACTION=true \
    FEATURE_SEMANTIC_COVERAGE_ONTOLOGY=true \
    FEATURE_VARIABLE_COMPARISON_ENGINE=true \
    FEATURE_DEDUCTIBLE_SEMANTIC_PARSER=true \
    FEATURE_TRIPLE_SOURCE_CHAT=true \
    FEATURE_LEARNING_ENGINE=true \
    FEATURE_QUERY_EXPANSION=true \
    FEATURE_HYBRID_SEARCH_V2=true \
    RAG_CACHE_TTL=600 \
    LOG_LEVEL=info \
    MONITORING_ENABLED=true

# Deploy to production
echo "📦 Deploying to production..."
railway up --environment production --service comparador-production

# Wait for deployment
echo "⏳ Waiting for deployment to stabilize..."
sleep 45

# Verify deployment
echo "🔍 Verifying production deployment..."
PROD_URL=$(railway domain --environment production)

# Health check
if curl -f "https://${PROD_URL}/health" > /dev/null 2>&1; then
    echo "✅ Production deployment successful!"
    echo "🌐 Production URL: https://${PROD_URL}"
else
    echo "⚠️  Health check failed. Checking logs..."
    railway logs --environment production
    exit 1
fi

# Verify feature flags are active
echo "🚩 Verifying feature flags..."
FEATURES=$(curl -s "https://${PROD_URL}/api/features" 2>/dev/null || echo "{}")
echo "   Feature flags: $FEATURES"

echo ""
echo "✅ Production deployment complete!"
echo ""
echo "📊 Monitoring:"
echo "   - Health: https://${PROD_URL}/health"
echo "   - Features: https://${PROD_URL}/api/features"
echo "   - Logs: railway logs --environment production"
echo ""
echo "⚠️  Important:"
echo "   1. Monitor error rates for 30 minutes"
echo "   2. Check /api/metrics endpoint"
echo "   3. Be ready to rollback if needed: npm run deploy:rollback"