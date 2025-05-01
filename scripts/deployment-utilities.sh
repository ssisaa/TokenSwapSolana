#!/bin/bash
# YOT Swap Deployment Utilities
# This script provides useful commands for deploying and managing YOT Swap

# Check if we're running as root and exit if we are
if [ "$EUID" -eq 0 ]; then
  echo "Please don't run as root. Run as the user that will manage the application."
  exit 1
fi

# Load environment variables from .env file if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
  echo "Loaded environment variables from .env"
else
  echo "Warning: .env file not found."
fi

# Colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display help
show_help() {
  echo -e "${BLUE}YOT Swap Deployment Utilities${NC}"
  echo "Usage: $0 [command]"
  echo ""
  echo "Commands:"
  echo "  install      - Install dependencies and set up the environment"
  echo "  init-db      - Initialize the database schema and seed data"
  echo "  build        - Build the application for production"
  echo "  start        - Start the application with PM2"
  echo "  stop         - Stop the application"
  echo "  restart      - Restart the application"
  echo "  status       - Check application status"
  echo "  logs         - View application logs"
  echo "  backup       - Create a database backup"
  echo "  validate     - Run validation checks"
  echo "  update       - Update the application from git and restart"
  echo "  help         - Show this help message"
  echo ""
}

# Function to install dependencies
install_deps() {
  echo -e "${BLUE}Installing dependencies...${NC}"
  
  # Install Node.js dependencies
  npm ci
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Dependencies installed successfully!${NC}"
  else
    echo -e "${RED}Failed to install dependencies!${NC}"
    exit 1
  fi
  
  # Create necessary directories
  mkdir -p logs
  mkdir -p backups
  
  # Check if PM2 is installed globally, if not, install it
  if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 not found, installing...${NC}"
    npm install -g pm2
  fi
  
  echo -e "${GREEN}Installation complete!${NC}"
}

# Function to initialize the database
init_db() {
  echo -e "${BLUE}Initializing database...${NC}"
  
  # Check if database variables are set
  if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}DATABASE_URL environment variable not set!${NC}"
    exit 1
  fi
  
  # Run database setup script
  node scripts/setup-database.js
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Database initialized successfully!${NC}"
  else
    echo -e "${RED}Failed to initialize database!${NC}"
    exit 1
  fi
  
  # Validate database
  node scripts/validate-database.js
}

# Function to build application
build_app() {
  echo -e "${BLUE}Building application for production...${NC}"
  
  # Build frontend
  npm run build
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Application built successfully!${NC}"
  else
    echo -e "${RED}Failed to build application!${NC}"
    exit 1
  fi
}

# Function to start application with PM2
start_app() {
  echo -e "${BLUE}Starting application with PM2...${NC}"
  
  # Check if ecosystem.config.js exists
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
    }
  }]
};
EOL
  fi
  
  # Start with PM2
  pm2 start ecosystem.config.js
  
  # Save PM2 configuration
  pm2 save
  
  echo -e "${GREEN}Application started!${NC}"
  echo -e "Run ${YELLOW}pm2 status${NC} to check application status"
}

# Function to stop application
stop_app() {
  echo -e "${BLUE}Stopping application...${NC}"
  
  # Stop PM2 processes
  pm2 stop all
  
  echo -e "${GREEN}Application stopped!${NC}"
}

# Function to restart application
restart_app() {
  echo -e "${BLUE}Restarting application...${NC}"
  
  # Restart PM2 processes
  pm2 restart all
  
  echo -e "${GREEN}Application restarted!${NC}"
}

# Function to check status
check_status() {
  echo -e "${BLUE}Checking application status...${NC}"
  
  # Check PM2 status
  pm2 status
  
  # Check if application is responding
  echo ""
  echo -e "${BLUE}Testing application health...${NC}"
  curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT:-5000} > /dev/null
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Application is responding on port ${PORT:-5000}${NC}"
  else
    echo -e "${RED}Application is not responding on port ${PORT:-5000}${NC}"
  fi
}

# Function to view logs
view_logs() {
  echo -e "${BLUE}Viewing application logs...${NC}"
  
  # View PM2 logs
  pm2 logs
}

# Function to create database backup
create_backup() {
  echo -e "${BLUE}Creating database backup...${NC}"
  
  # Check if database variables are set
  if [ -z "$PGUSER" ] || [ -z "$PGDATABASE" ]; then
    echo -e "${RED}PGUSER or PGDATABASE environment variables not set!${NC}"
    exit 1
  fi
  
  # Create backup directory if it doesn't exist
  mkdir -p backups
  
  # Create timestamp for backup file
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  BACKUP_FILE="backups/yot_swap_backup_$TIMESTAMP.sql"
  
  # Export database
  echo -e "Exporting database to ${BACKUP_FILE}..."
  PGPASSWORD=$PGPASSWORD pg_dump -U $PGUSER -h ${PGHOST:-localhost} $PGDATABASE > $BACKUP_FILE
  
  if [ $? -eq 0 ]; then
    # Compress backup
    gzip $BACKUP_FILE
    echo -e "${GREEN}Backup created: ${BACKUP_FILE}.gz${NC}"
  else
    echo -e "${RED}Failed to create backup!${NC}"
    exit 1
  fi
}

# Function to validate application
validate_app() {
  echo -e "${BLUE}Running validation checks...${NC}"
  
  # Check database connection
  echo -e "${BLUE}Checking database connection...${NC}"
  node scripts/test-db-connection.js
  
  # Check environment variables
  echo -e "${BLUE}Checking environment variables...${NC}"
  node scripts/validate-env.js
  
  # Check application health
  echo -e "${BLUE}Checking application health...${NC}"
  curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT:-5000} > /dev/null
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Application is responding on port ${PORT:-5000}${NC}"
  else
    echo -e "${RED}Application is not responding on port ${PORT:-5000}${NC}"
  fi
}

# Function to update application
update_app() {
  echo -e "${BLUE}Updating application...${NC}"
  
  # Create backup before updating
  create_backup
  
  # Pull latest changes from git
  git pull
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to pull latest changes!${NC}"
    exit 1
  fi
  
  # Install dependencies
  npm ci
  
  # Build application
  build_app
  
  # Restart application
  restart_app
  
  echo -e "${GREEN}Application updated successfully!${NC}"
}

# Main function to handle commands
main() {
  case "$1" in
    install)
      install_deps
      ;;
    init-db)
      init_db
      ;;
    build)
      build_app
      ;;
    start)
      start_app
      ;;
    stop)
      stop_app
      ;;
    restart)
      restart_app
      ;;
    status)
      check_status
      ;;
    logs)
      view_logs
      ;;
    backup)
      create_backup
      ;;
    validate)
      validate_app
      ;;
    update)
      update_app
      ;;
    help)
      show_help
      ;;
    *)
      show_help
      ;;
  esac
}

# Execute main function with all arguments
main "$@"