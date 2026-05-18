#!/bin/bash
# ============================================
# CHARON ULTIMATE — VPS Deployment Script
# ============================================
# Run on your VPS to deploy the bot
# ============================================

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Charon Ultimate — One-Command Deploy Script             ║"
echo "╚═══════════════════════════════════════════════════════════╝"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}✅ Starting deployment...${NC}"

# 1. Check prerequisites
echo -e "\n${YELLOW}[1/7] Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js not found. Installing...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo -e "${GREEN}✓ Node.js $(node -v) found${NC}"

if ! command -v pm2 &> /dev/null; then
  echo -e "${YELLOW}Installing PM2...${NC}"
  npm install -g pm2
fi
echo -e "${GREEN}✓ PM2 found${NC}"

# 2. Clone or update the repository
echo -e "\n${YELLOW}[2/7] Setting up project...${NC}"

CURRENT_DIR=$(pwd)
PROJECT_DIR="$CURRENT_DIR/charon-ultimate"

if [ -d "$PROJECT_DIR" ]; then
  echo -e "${YELLOW}Project exists. Pulling latest changes...${NC}"
  cd "$PROJECT_DIR"
  git pull
else
  echo -e "${YELLOW}Cloning repository...${NC}"
  git clone https://github.com/yohadrian889/charon-ultimate.git "$PROJECT_DIR"
  cd "$PROJECT_DIR"
fi

echo -e "${GREEN}✓ Project directory ready${NC}"

# 3. Install dependencies
echo -e "\n${YELLOW}[3/7] Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# 4. Setup environment file
echo -e "\n${YELLOW}[4/7] Setting up environment...${NC}"

if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo -e "${YELLOW}Copying .env.example to .env...${NC}"
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  echo -e "${RED}⚠️  Please edit .env and add your API keys!${NC}"
fi

# 5. Initialize database
echo -e "\n${YELLOW}[5/7] Testing database...${NC}"
node -e "
const { initDb } = require('./src/db/connection.js');
initDb();
console.log('✓ Database initialized');
process.exit(0);
" || {
  echo -e "${RED}❌ Database initialization failed${NC}"
  exit 1
}

# 6. Start with PM2
echo -e "\n${YELLOW}[6/7] Starting bot with PM2...${NC}"

pm2 stop charon-ultimate 2>/dev/null || true
pm2 delete charon-ultimate 2>/dev/null || true

pm2 start "$PROJECT_DIR/index.js" --name charon-ultimate
pm2 save
pm2 startup

echo -e "${GREEN}✓ Bot started with PM2${NC}"

# 7. Show status
echo -e "\n${YELLOW}[7/7] Deployment complete!${NC}"
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Charon Ultimate is now running!                       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "📊 Check status: pm2 status"
echo "📜 View logs:    pm2 logs charon-ultimate"
echo "🔄 Restart:      pm2 restart charon-ultimate"
echo ""
echo -e "${RED}⚠️  Remember to edit .env with your API keys!${NC}"
echo "   nano $PROJECT_DIR/.env"
echo ""