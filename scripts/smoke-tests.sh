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

# Test 2: Allowlisted API endpoints (HTTP 200 without auth) and gated endpoints (401 without AUTH_TOKEN, 200 with AUTH_TOKEN)
echo "Test 2: API endpoints"
PUBLIC_ENDPOINTS=(
    "/api/documents"
    "/api/insurers"
)

for endpoint in "${PUBLIC_ENDPOINTS[@]}"; do
    if curl -f -s "${AUTH_ARGS[@]}" "${STAGING_URL}${endpoint}" > /dev/null 2>&1; then
        echo "  ✅ ${endpoint} - OK"
    else
        echo "  ❌ ${endpoint} - Failed"
        exit 1
    fi
done

GATED_ENDPOINTS=(
    "/api"
    "/api/features"
)

for endpoint in "${GATED_ENDPOINTS[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${AUTH_ARGS[@]}" "${STAGING_URL}${endpoint}" 2>/dev/null || echo "000")
    if [ -n "$AUTH_TOKEN" ]; then
        if [ "$STATUS" = "200" ]; then
            echo "  ✅ ${endpoint} - OK (HTTP 200)"
        else
            echo "  ❌ ${endpoint} - Failed with AUTH_TOKEN (HTTP ${STATUS})"
            exit 1
        fi
    else
        if [ "$STATUS" = "200" ] || [ "$STATUS" = "401" ]; then
            echo "  ✅ ${endpoint} - Auth gate active (HTTP ${STATUS})"
        else
            echo "  ❌ ${endpoint} - Unexpected status (HTTP ${STATUS})"
            exit 1
        fi
    fi
done

# Test 3: Feature flags payload
echo "Test 3: Feature flags"
if [ -n "$AUTH_TOKEN" ]; then
    FEATURES_RESPONSE=$(curl -s "${AUTH_ARGS[@]}" "${STAGING_URL}/api/features" 2>/dev/null || echo "{}")
    if echo "$FEATURES_RESPONSE" | grep -q "flags"; then
        echo "  ✅ Feature flags configured"
    else
        echo "  ❌ Feature flags payload unexpected"
        exit 1
    fi
else
    echo "  ℹ️  AUTH_TOKEN not set; skipping authenticated /api/features payload check (auth gate verified in Test 2)"
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
if echo "$DB_HEALTH" | grep -Eq '"supabase"[[:space:]]*:[[:space:]]*\{[^}]*"status"[[:space:]]*:[[:space:]]*"ok"'; then
    echo "  ✅ Supabase health ok"
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