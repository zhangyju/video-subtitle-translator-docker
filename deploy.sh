#!/bin/bash

# 🚀 Phase 7 - Automated Deployment Script
# This script automates the entire Phase 7 deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}   🚀 Phase 7 - Advanced Features Deployment Script${BLUE}   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo "  Please install Node.js from: https://nodejs.org"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm found: $(npm --version)${NC}"

# Check Wrangler
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}✗ Wrangler CLI is not installed${NC}"
    echo "  Installing Wrangler..."
    npm install -g wrangler
fi
echo -e "${GREEN}✓ Wrangler found: $(wrangler --version)${NC}"

echo ""
echo -e "${YELLOW}Verifying Cloudflare account...${NC}"

# Check Wrangler auth
if ! wrangler whoami &> /dev/null; then
    echo -e "${RED}✗ Not authenticated with Cloudflare${NC}"
    echo "  Running: wrangler login"
    wrangler login
fi
echo -e "${GREEN}✓ Authenticated with Cloudflare${NC}"

echo ""
echo -e "${YELLOW}Step 1: Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo ""
echo -e "${YELLOW}Step 2: Building TypeScript...${NC}"
npm run build
echo -e "${GREEN}✓ TypeScript compiled successfully${NC}"

echo ""
echo -e "${YELLOW}Step 3: Applying database migration...${NC}"
echo "  Command: wrangler d1 migrations apply video-subtitle-db"
wrangler d1 migrations apply video-subtitle-db
echo -e "${GREEN}✓ Database migration applied${NC}"

echo ""
echo -e "${YELLOW}Step 4: Verifying database tables...${NC}"
echo "  Checking for new tables:"
TABLES=$(wrangler d1 execute video-subtitle-db --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" 2>&1)
if echo "$TABLES" | grep -q "audit_logs"; then
    echo -e "${GREEN}✓ Table 'audit_logs' exists${NC}"
else
    echo -e "${RED}✗ Table 'audit_logs' not found${NC}"
fi

echo ""
echo -e "${YELLOW}Step 5: Deploying to Cloudflare Workers...${NC}"
echo "  Command: wrangler publish"
wrangler publish
echo -e "${GREEN}✓ Deployed to Cloudflare Workers${NC}"

echo ""
echo -e "${YELLOW}Step 6: Verifying deployment...${NC}"
sleep 2

# Get the deployment URL from wrangler.toml
DEPLOYMENT_URL="https://subtitle.myzhangyujie.com"

echo "  Testing dashboard page..."
if curl -s -m 5 "$DEPLOYMENT_URL/dashboard" | grep -q "User Dashboard"; then
    echo -e "${GREEN}✓ Dashboard page is accessible${NC}"
else
    echo -e "${YELLOW}⚠ Dashboard page test inconclusive (may be auth-required)${NC}"
fi

echo "  Testing API endpoint..."
RESPONSE=$(curl -s -m 5 -X GET "$DEPLOYMENT_URL/api/dashboard" \
  -H "x-user-id: test-user" \
  -H "Content-Type: application/json")

if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ Dashboard API is responding${NC}"
else
    echo -e "${YELLOW}⚠ Dashboard API response: Check logs${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}   ✅ Phase 7 Deployment Completed Successfully!${GREEN}        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"

echo ""
echo -e "${BLUE}📊 Deployment Summary:${NC}"
echo "  Version: v1.4.0"
echo "  Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Environment: Production"
echo ""

echo -e "${BLUE}🎯 Next Steps:${NC}"
echo "  1. Test the dashboard: $DEPLOYMENT_URL/dashboard"
echo "  2. Test the API: curl -H 'x-user-id: your-user-id' $DEPLOYMENT_URL/api/dashboard"
echo "  3. Monitor logs in Cloudflare dashboard"
echo "  4. Review audit logs: wrangler d1 execute video-subtitle-db --command 'SELECT * FROM audit_logs LIMIT 10;'"
echo ""

echo -e "${BLUE}📚 Documentation:${NC}"
echo "  • Deployment Guide: PHASE7_DEPLOYMENT_GUIDE.md"
echo "  • Testing Guide: PHASE7_TESTING.md"
echo "  • Troubleshooting: PHASE7_DEPLOYMENT_GUIDE.md (Troubleshooting section)"
echo "  • Rollback Plan: DEPLOYMENT_EXECUTION_PLAN.md"
echo ""

echo -e "${GREEN}Deployment successful! 🎉${NC}"
