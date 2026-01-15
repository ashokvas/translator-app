#!/bin/bash

# ============================================
# VPS Setup Script for Translator App
# Run this script on your Ubuntu VPS
# ============================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Translator App - VPS Setup Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# Get domain from user
read -p "Enter your subdomain (e.g., translate.yourdomain.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Domain is required${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 1: Updating system...${NC}"
apt-get update && apt-get upgrade -y

echo ""
echo -e "${YELLOW}Step 2: Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}Docker installed successfully${NC}"
else
    echo -e "${GREEN}Docker already installed${NC}"
fi

echo ""
echo -e "${YELLOW}Step 3: Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    apt-get install -y docker-compose-plugin
    echo -e "${GREEN}Docker Compose installed successfully${NC}"
else
    echo -e "${GREEN}Docker Compose already installed${NC}"
fi

echo ""
echo -e "${YELLOW}Step 4: Installing Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
    echo -e "${GREEN}Nginx installed successfully${NC}"
else
    echo -e "${GREEN}Nginx already installed${NC}"
fi

echo ""
echo -e "${YELLOW}Step 5: Installing Certbot...${NC}"
if ! command -v certbot &> /dev/null; then
    apt-get install -y certbot python3-certbot-nginx
    echo -e "${GREEN}Certbot installed successfully${NC}"
else
    echo -e "${GREEN}Certbot already installed${NC}"
fi

echo ""
echo -e "${YELLOW}Step 6: Configuring firewall...${NC}"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo -e "${GREEN}Firewall configured${NC}"

echo ""
echo -e "${YELLOW}Step 7: Creating app directory...${NC}"
APP_DIR="/opt/translator-app"
mkdir -p $APP_DIR
cd $APP_DIR

echo ""
echo -e "${YELLOW}Step 8: Setting up Nginx configuration...${NC}"

# Create initial nginx config (HTTP only, for Certbot)
cat > /etc/nginx/sites-available/translator-app << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 50M;
        proxy_read_timeout 300s;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/translator-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
nginx -t && systemctl reload nginx
echo -e "${GREEN}Nginx configured${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Basic Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "1. Clone your repository:"
echo -e "   ${GREEN}cd $APP_DIR${NC}"
echo -e "   ${GREEN}git clone YOUR_REPO_URL .${NC}"
echo ""
echo "2. Create your .env.production file:"
echo -e "   ${GREEN}cp .env.production.example .env.production${NC}"
echo -e "   ${GREEN}nano .env.production${NC}"
echo ""
echo "3. Build and start the app:"
echo -e "   ${GREEN}docker compose --env-file .env.production up -d --build${NC}"
echo ""
echo "4. Get SSL certificate:"
echo -e "   ${GREEN}certbot --nginx -d $DOMAIN${NC}"
echo ""
echo "5. Update nginx with full config (copy from deploy/nginx.conf)"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  View logs:    docker compose logs -f"
echo "  Restart app:  docker compose restart"
echo "  Update app:   git pull && docker compose up -d --build"
echo ""

