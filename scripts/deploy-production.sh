#!/bin/bash
# YOT Swap Production Deployment Script
# This script automates the process of deploying YOT Swap to a production environment

# Exit immediately if a command exits with a non-zero status
set -e

# ANSI color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="yot-swap"
APP_DIR="/var/www/${APP_NAME}"
BACKUP_DIR="${APP_DIR}/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.tar.gz"
LOG_FILE="${APP_DIR}/logs/deployment_${TIMESTAMP}.log"

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Start logging
exec > >(tee -a "$LOG_FILE") 2>&1

echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}YOT Swap Production Deployment - $(date)${NC}"
echo -e "${BLUE}=================================================${NC}"

# Function to display help
show_help() {
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  -h, --help     Display this help message"
  echo "  -s, --skip-backup    Skip database backup"
  echo "  -f, --force    Force deployment even if validation fails"
  echo ""
  exit 0
}

# Parse command line arguments
SKIP_BACKUP=false
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      show_help
      ;;
    -s|--skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    -f|--force)
      FORCE=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      show_help
      ;;
  esac
done

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo -e "${RED}Please don't run as root. Run as the user that manages the application.${NC}"
  exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
  echo -e "${RED}Error: .env file not found${NC}"
  echo "Please create a .env file with the required environment variables"
  exit 1
fi

# Load environment variables
source .env

# Check if environment variables are set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}Error: DATABASE_URL not set in .env file${NC}"
  exit 1
fi

# Check if NODE_ENV is set to production
if [ "$NODE_ENV" != "production" ]; then
  echo -e "${YELLOW}Warning: NODE_ENV is not set to production in .env file${NC}"
  read -p "Do you want to continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo -e "${BLUE}Step 1: Validating environment variables...${NC}"
node scripts/validate-env.js

if [ $? -ne 0 ] && [ "$FORCE" != "true" ]; then
  echo -e "${RED}Environment validation failed. Fix the issues or use --force to continue anyway.${NC}"
  exit 1
fi

echo -e "${BLUE}Step 2: Testing database connection...${NC}"
node scripts/test-db-connection.js

if [ $? -ne 0 ] && [ "$FORCE" != "true" ]; then
  echo -e "${RED}Database connection test failed. Fix the issues or use --force to continue anyway.${NC}"
  exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create database backup
if [ "$SKIP_BACKUP" != "true" ]; then
  echo -e "${BLUE}Step 3: Creating database backup...${NC}"
  
  # Export database
  echo -e "Exporting database to backup file..."
  PGPASSWORD=$PGPASSWORD pg_dump -U $PGUSER -h ${PGHOST:-localhost} $PGDATABASE > "${BACKUP_DIR}/db_${TIMESTAMP}.sql"
  
  # Compress backup
  gzip "${BACKUP_DIR}/db_${TIMESTAMP}.sql"
  echo -e "${GREEN}Database backup created: ${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz${NC}"
  
  # Also backup the codebase
  echo -e "Creating codebase backup..."
  tar -czf "$BACKUP_FILE" --exclude="node_modules" --exclude=".git" --exclude="backups" .
  echo -e "${GREEN}Codebase backup created: $BACKUP_FILE${NC}"
else
  echo -e "${YELLOW}Database backup skipped as requested${NC}"
fi

echo -e "${BLUE}Step 4: Pulling latest changes from git...${NC}"
git fetch --all
git pull

echo -e "${BLUE}Step 5: Installing dependencies...${NC}"
npm ci --production

echo -e "${BLUE}Step 6: Building the application...${NC}"
npm run build

# Make sure the nginx configuration exists
if [ ! -f /etc/nginx/sites-available/$APP_NAME ]; then
  echo -e "${YELLOW}Nginx configuration for $APP_NAME not found${NC}"
  echo -e "Creating default nginx configuration..."
  
  # Create nginx configuration
  cat > /tmp/$APP_NAME.nginx << EOL
server {
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:${PORT:-5000};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Enable gzip compression
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_proxied any;
    gzip_types
        application/javascript
        application/json
        application/x-javascript
        application/xml
        application/xml+rss
        image/svg+xml
        text/css
        text/javascript
        text/plain
        text/xml;
}
EOL
  
  echo -e "${YELLOW}Please review and install the nginx configuration:${NC}"
  echo -e "sudo cp /tmp/$APP_NAME.nginx /etc/nginx/sites-available/$APP_NAME"
  echo -e "sudo ln -s /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/"
  echo -e "sudo nginx -t && sudo systemctl reload nginx"
fi

# Check if PM2 is installed, install if not
if ! command -v pm2 &> /dev/null; then
  echo -e "${YELLOW}PM2 not found, installing...${NC}"
  npm install -g pm2
fi

# Create ecosystem.config.js if it doesn't exist
if [ ! -f ecosystem.config.js ]; then
  echo -e "${YELLOW}ecosystem.config.js not found, creating...${NC}"
  
  cat > ecosystem.config.js << EOL
module.exports = {
  apps: [{
    name: 'yot-swap',
    script: 'server/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: ${PORT:-5000}
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    combine_logs: true,
    error_file: 'logs/error.log',
    out_file: 'logs/output.log'
  }]
};
EOL
  
  echo -e "${GREEN}Created ecosystem.config.js${NC}"
fi

echo -e "${BLUE}Step 7: Restarting the application...${NC}"
# Check if app is already running in PM2
if pm2 list | grep -q "$APP_NAME"; then
  pm2 reload $APP_NAME
else
  pm2 start ecosystem.config.js
fi

# Save PM2 configuration
pm2 save

echo -e "${BLUE}Step 8: Validating deployment...${NC}"
# Wait a moment for the app to start
sleep 5

# Check if app is running
if pm2 list | grep -q "$APP_NAME"; then
  echo -e "${GREEN}Application is running in PM2${NC}"
else
  echo -e "${RED}Application failed to start in PM2${NC}"
  exit 1
fi

# Check if app is responding
if curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT:-5000}/ | grep -q "200\|301\|302"; then
  echo -e "${GREEN}Application is responding to HTTP requests${NC}"
else
  echo -e "${RED}Application is not responding to HTTP requests${NC}"
  echo -e "Check the application logs: pm2 logs $APP_NAME"
  exit 1
fi

# Set up automatic rotation for PM2 logs
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

echo -e "${GREEN}===================================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}===================================================${NC}"
echo ""
echo -e "Application: $APP_NAME"
echo -e "Environment: $NODE_ENV"
echo -e "Port: ${PORT:-5000}"
echo -e "Deployment time: $(date)"
echo -e "Backup location: $BACKUP_FILE"
echo -e "Log file: $LOG_FILE"
echo ""
echo -e "To view application logs: ${BLUE}pm2 logs $APP_NAME${NC}"
echo -e "To monitor application: ${BLUE}pm2 monit${NC}"
echo -e "To check status: ${BLUE}pm2 status${NC}"
echo ""
echo -e "${YELLOW}Don't forget to:${NC}"
echo -e "1. Set up SSL with certbot: ${BLUE}sudo certbot --nginx -d your-domain.com${NC}"
echo -e "2. Configure a firewall: ${BLUE}sudo ufw enable && sudo ufw allow http && sudo ufw allow https${NC}"
echo -e "3. Set up regular database backups: ${BLUE}crontab -e${NC} and add:"
echo -e "   ${BLUE}0 2 * * * ${APP_DIR}/scripts/deployment-utilities.sh backup > ${APP_DIR}/logs/backup.log 2>&1${NC}"
echo ""
echo -e "${GREEN}Thank you for using YOT Swap!${NC}"