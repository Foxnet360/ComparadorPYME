#!/bin/bash

# Lighthouse Audit Script for Comparador CSA
# Usage: ./scripts/lighthouse-audit.sh [url]

set -e

# Default URL
URL=${1:-"http://localhost:5173"}
OUTPUT_DIR="./lighthouse-reports"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Lighthouse Audit for Comparador CSA"
echo "======================================"
echo ""

# Check if lighthouse is installed
if ! command -v lighthouse &> /dev/null; then
    echo -e "${YELLOW}⚠️  Lighthouse CLI not found. Installing...${NC}"
    npm install -g lighthouse
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Run Lighthouse for desktop
echo -e "${GREEN}📱 Running Desktop Audit...${NC}"
lighthouse "$URL" \
    --output=html,json \
    --output-path="$OUTPUT_DIR/desktop-report" \
    --preset=desktop \
    --chrome-flags="--headless --no-sandbox" \
    --only-categories=performance,accessibility,best-practices,seo \
    --quiet

# Run Lighthouse for mobile
echo -e "${GREEN}📱 Running Mobile Audit...${NC}"
lighthouse "$URL" \
    --output=html,json \
    --output-path="$OUTPUT_DIR/mobile-report" \
    --chrome-flags="--headless --no-sandbox" \
    --only-categories=performance,accessibility,best-practices,seo \
    --quiet

# Extract scores from JSON reports
echo ""
echo "📊 Audit Results"
echo "================"

echo ""
echo "Desktop Scores:"
if [ -f "$OUTPUT_DIR/desktop-report.json" ]; then
    cat "$OUTPUT_DIR/desktop-report.json" | node -e '
        const data = JSON.parse(require("fs").readFileSync(0, "utf-8"));
        const categories = data.categories;
        console.log(`  Performance:    ${Math.round(categories.performance.score * 100)}%`);
        console.log(`  Accessibility:  ${Math.round(categories.accessibility.score * 100)}%`);
        console.log(`  Best Practices: ${Math.round(categories["best-practices"].score * 100)}%`);
        console.log(`  SEO:            ${Math.round(categories.seo.score * 100)}%`);
    '
fi

echo ""
echo "Mobile Scores:"
if [ -f "$OUTPUT_DIR/mobile-report.json" ]; then
    cat "$OUTPUT_DIR/mobile-report.json" | node -e '
        const data = JSON.parse(require("fs").readFileSync(0, "utf-8"));
        const categories = data.categories;
        console.log(`  Performance:    ${Math.round(categories.performance.score * 100)}%`);
        console.log(`  Accessibility:  ${Math.round(categories.accessibility.score * 100)}%`);
        console.log(`  Best Practices: ${Math.round(categories["best-practices"].score * 100)}%`);
        console.log(`  SEO:            ${Math.round(categories.seo.score * 100)}%`);
    '
fi

echo ""
echo -e "${GREEN}✅ Reports saved to: $OUTPUT_DIR/${NC}"
echo "   - Desktop: $OUTPUT_DIR/desktop-report.html"
echo "   - Mobile:  $OUTPUT_DIR/mobile-report.html"

# Check if scores meet thresholds
echo ""
echo "🎯 Threshold Checks"
echo "==================="

# Desktop thresholds
DESKTOP_PERF=$(cat "$OUTPUT_DIR/desktop-report.json" | node -e 'console.log(Math.round(JSON.parse(require("fs").readFileSync(0, "utf-8")).categories.performance.score * 100))')
DESKTOP_A11Y=$(cat "$OUTPUT_DIR/desktop-report.json" | node -e 'console.log(Math.round(JSON.parse(require("fs").readFileSync(0, "utf-8")).categories.accessibility.score * 100))')

if [ "$DESKTOP_PERF" -ge 90 ]; then
    echo -e "${GREEN}✅ Desktop Performance: $DESKTOP_PERF% (Target: ≥90%)${NC}"
else
    echo -e "${RED}❌ Desktop Performance: $DESKTOP_PERF% (Target: ≥90%)${NC}"
fi

if [ "$DESKTOP_A11Y" -ge 95 ]; then
    echo -e "${GREEN}✅ Desktop Accessibility: $DESKTOP_A11Y% (Target: ≥95%)${NC}"
else
    echo -e "${RED}❌ Desktop Accessibility: $DESKTOP_A11Y% (Target: ≥95%)${NC}"
fi

echo ""
echo -e "${GREEN}Audit complete!${NC}"
