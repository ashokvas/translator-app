#!/bin/bash

# ============================================
# Deployment Verification Script
# Compares local code with Coolify deployment
# ============================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Coolify deployment commit hash (update this when you check Coolify)
COOLIFY_COMMIT="ed85137"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Deployment Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo -e "${RED}✗ Error: Not in a git repository${NC}"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${YELLOW}Current branch:${NC} ${CURRENT_BRANCH}"
echo ""

# Fetch latest from remote
echo -e "${YELLOW}Fetching latest from GitHub...${NC}"
git fetch origin --quiet
echo -e "${GREEN}✓ Fetched${NC}"
echo ""

# Get commit hashes
LOCAL_COMMIT=$(git rev-parse HEAD)
LOCAL_COMMIT_SHORT=$(git rev-parse --short HEAD)
REMOTE_COMMIT=$(git rev-parse origin/main)
REMOTE_COMMIT_SHORT=$(git rev-parse --short origin/main)

# Expand Coolify commit to full hash if it's short
COOLIFY_COMMIT_FULL=$(git rev-parse "$COOLIFY_COMMIT" 2>/dev/null || echo "")

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Commit Hashes:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Local:     ${LOCAL_COMMIT_SHORT} (${LOCAL_COMMIT})"
echo -e "Remote:    ${REMOTE_COMMIT_SHORT} (${REMOTE_COMMIT})"
if [ -n "$COOLIFY_COMMIT_FULL" ]; then
    COOLIFY_SHORT=$(git rev-parse --short "$COOLIFY_COMMIT")
    echo -e "Coolify:   ${COOLIFY_SHORT} (${COOLIFY_COMMIT_FULL})"
else
    echo -e "Coolify:   ${COOLIFY_COMMIT} ${RED}(not found)${NC}"
fi
echo -e "${BLUE}Commit Messages:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Local:${NC}"
git log -1 --format='  %h - %s (%an, %ar)' HEAD
echo ""
echo -e "${YELLOW}Remote:${NC}"
git log -1 --format='  %h - %s (%an, %ar)' origin/main
echo ""
if [ -n "$COOLIFY_COMMIT_FULL" ]; then
    echo -e "${YELLOW}Coolify:${NC}"
    git log -1 --format='  %h - %s (%an, %ar)' "$COOLIFY_COMMIT"
fi
echo ""

# Compare Local vs Remote
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Comparison:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
    echo -e "${GREEN}✓ Local matches Remote (GitHub)${NC}"
    echo -e "${RED}✗ Local does NOT match Remote${NC}"
    echo ""
    echo -e "${YELLOW}Commits in Remote but not in Local:${NC}"
    git log --oneline HEAD..origin/main 2>/dev/null | head -5 || echo "  (none)"
    echo -e "${RED}✗Remote:${NC}"
    git log --oneline origin/main..HEAD 2>/dev/null | head -5 || echo "  (none)"
fi
echo ""

# Compare Local vs Coolify
if [ -n "$COOLIFY_COMMIT_FULL" ]; then
    if [ "$LOCAL_COMMIT" = "$COOLIFY_COMMIT_FULL" ]; then
        echo -e "${GREEN}✓ Local matches Coolify deployment${NC}"
    else
        echo -e "${RED}✗ Local does NOT match Coolify deployment${NC}"
        echo ""
        echo -e "${YELLOW}Commits in Coolify but not in Local:${NC}"
        git log --oneline HEAD.."$COOLIFY_COMMIT" 2>/dev/null | head -5 || echo "  (none)"
        echo ""
        echo -e "${YELLOW}Commits in Local but not in Coolify:${NC}"
        git log --oneline "$COOLIFY_COMMIT"..HEAD 2>/dev/null | head -5 || echo "  (none)"
        echo ""
        echo -e "${YELLOW}Files changed between Local and Coolify:${NC}"
        git diff --stat "$COOLIFY_COMMIT" HEAD | head -20
    fi
else
    echo -e "${YELLOW}⚠ Could not verify Coolify commit (not found locally)${NC}"
    echo -e "${YELLOW}  Make sure to fetch from first: git fetch origin${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Summary:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ALL_MATCH=true

if [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
    echo -e "${RED}✗ Local and Remote are out of sync${NC}"
    ALL_MATCH=false
fi

if [ -n "$COOLIFY_COMMIT_FULL" ] && [ "$LOCAL_COMMIT" != "$COOLIFY_COMMIT_FULL" ]; then
    echo -e "${RED}✗ Local and Coolify are out of sync${NC}"
    ALL_MATCH=false
fi

if [ "$ALL_MATCH" = true ]; then
    echo -e "${GREEN}✓ All environments are in sync!${NC}"
    echo -e "${GREEN}  Your local code matches GitHub and Coolify deployment.${NC}"
else
    echo -e "${YELLOW}To sync GitHub with Coolify:${NC}"
    echo -e "${YELLOW}To sync your local with GitHub:${NC}"
    echo -e "  git pull origin main"
    echo ""
    echo -e "${YELLfy"
fi
echo ""
