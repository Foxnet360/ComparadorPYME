#!/bin/bash

# Rollback Script
# Reverts to previous stable version

set -e

echo "⚠️  EMERGENCY ROLLBACK"
echo ""
read -p "Rollback to previous deployment? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Rollback cancelled"
    exit 1
fi

echo "🔄 Rolling back..."
railway rollback --environment production

echo "⏳ Waiting for rollback to complete..."
sleep 30

# Verify rollback
PROD_URL=$(railway domain --environment production)
if curl -f "https://${PROD_URL}/health" > /dev/null 2>&1; then
    echo "✅ Rollback successful!"
    echo "🌐 Production URL: https://${PROD_URL}"
else
    echo "❌ Rollback failed. Manual intervention required."
    exit 1
fi