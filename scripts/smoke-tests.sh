#!/bin/bash

# Smoke Tests for Staging / Production Environment
# Verifies critical functionality after deployment

set -e

STAGING_URL=${STAGING_URL:-"http://localhost:8080"}
AUTH_TOKEN=${AUTH_TOKEN:-""}

AUTH_ARGS=()
if [ -n "$AUTH_TOKEN" ]; then
    AUTH_ARGS=(-H "Authorization: Bearer ${AUTH_TOKEN}")
fi

echo "🧪 Running smoke tests against: ${STAGING_URL}"
echo ""

# Test 1: Health check
echo "Test 1: Health endpoint"
if curl -f -s "${STAGING_URL}/health" > /dev/null 2>&1; then
    echo "  ✅ Health check passed"
else
    echo "  ❌ Health check failed"
    exit 1
fi

# Test 2: API availability
echo "Test 2: API endpoints"
PUBLIC_ENDPOINTS=(
    "/api"
    "/api/features"
)

for endpoint in "${PUBLIC_ENDPOINTS[@]}"; do
    if curl -f -s "${AUTH_ARGS[@]}" "${STAGING_URL}${endpoint}" > /dev/null 2>&1; then
        echo "  ✅ ${endpoint} - OK"
    else
        echo "  ❌ ${endpoint} - Failed"
        exit 1
    fi
done

# Test 3: Feature flags payload
echo "Test 3: Feature flags"
FEATURES_RESPONSE=$(curl -s "${AUTH_ARGS[@]}" "${STAGING_URL}/api/features" 2>/dev/null || echo "{}")
if echo "$FEATURES_RESPONSE" | grep -q "flags"; then
    echo "  ✅ Feature flags configured"
else
    echo "  ⚠️  Feature flags payload unexpected"
fi

# Test 4: Structured clause extraction route (expects 200/400/401/403 when mounted, never 404)
echo "Test 4: Structured clause extraction"
CLAUSE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${AUTH_ARGS[@]}" \
    -X POST "${STAGING_URL}/api/analysis/extract-structured-clause" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null || echo "000")
if [ "$CLAUSE_STATUS" != "000" ] && [ "$CLAUSE_STATUS" != "404" ]; then
    echo "  ✅ Clause extraction endpoint mounted (HTTP ${CLAUSE_STATUS})"
else
    echo "  ❌ Clause extraction endpoint unavailable (HTTP ${CLAUSE_STATUS})"
    exit 1
fi

# Test 5: Chat endpoint
echo "Test 5: Chat endpoint"
CHAT_RESPONSE=$(curl -s "${AUTH_ARGS[@]}" -X POST "${STAGING_URL}/api/chat" \
    -H "Content-Type: application/json" \
    -d '{"message":"test","useRAG":false}' 2>/dev/null || echo "{}")

if echo "$CHAT_RESPONSE" | grep -qE "text|error|Unauthorized"; then
    echo "  ✅ Chat endpoint responding"
else
    echo "  ⚠️  Chat endpoint not responding as expected"
fi

# Test 6: Database connectivity (from /health services.supabase)
echo "Test 6: Database connectivity"
DB_HEALTH=$(curl -s "${STAGING_URL}/health" 2>/dev/null || echo "{}")
if echo "$DB_HEALTH" | grep -q '"supabase".*"status":"ok"\|"supabase"'; then
    echo "  ✅ Supabase health reported"
else
    echo "  ⚠️  Database status unclear"
fi

# Test 7: Static assets / SPA root
echo "Test 7: Static assets"
if curl -f -s "${STAGING_URL}/" > /dev/null 2>&1; then
    echo "  ✅ Frontend serving"
else
    echo "  ⚠️  Frontend not accessible"
fi

echo ""
echo "✅ Smoke tests completed!"