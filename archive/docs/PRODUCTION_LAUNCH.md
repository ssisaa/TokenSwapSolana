# YOT Swap Production Launch Guide

This guide provides the specific steps needed to launch YOT Swap in a production environment securely and reliably.

## Prerequisites
- Complete all steps in the `DEPLOYMENT_GUIDE.md` through the database configuration phase
- A Linux server running Ubuntu 20.04 LTS or higher with root/sudo access
- Domain name pointing to your server's IP address
- SSL certificate (we'll obtain via Let's Encrypt)

## 1. Production Server Setup

```bash
# Update and harden the server
sudo apt update && sudo apt upgrade -y
sudo apt install -y fail2ban ufw

# Configure basic firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

## 2. Install Required Software (Production Stack)

```bash
# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx for reverse proxy
sudo apt install -y nginx certbot python3-certbot-nginx

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install PM2 process manager
sudo npm install -g pm2

# Verify installations
node -v  # Should be v20.x
npm -v   # Should be v10.x or higher
psql --version
nginx -v
pm2 -v
```

## 3. Configure Production Database

```bash
# Create production database with secure credentials
sudo -u postgres psql

# In PostgreSQL:
CREATE DATABASE yot_swap_production;
CREATE USER yot_prod WITH ENCRYPTED PASSWORD 'generate_a_strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE yot_swap_production TO yot_prod;
\q

# Test database connection
PGPASSWORD=generate_a_strong_password_here psql -U yot_prod -d yot_swap_production -h localhost -c "SELECT 'Connected to Production DB';"
```

## 4. Deploy Application Code

```bash
# Create application directory
sudo mkdir -p /var/www/yot-swap
sudo chown $USER:$USER /var/www/yot-swap

# Clone repository
cd /var/www/yot-swap
git clone https://github.com/your-username/yot-swap.git .

# Install dependencies
npm ci --production  # Uses package-lock.json for deterministic builds

# Create production .env file
cp .env.template .env

# Generate secure session secret
SESSION_SECRET=$(openssl rand -hex 64)
echo "SESSION_SECRET=$SESSION_SECRET" >> .env

# Edit production environment variables
nano .env
```

Update the `.env` file with production values:

```
# Database connection
DATABASE_URL=postgresql://yot_prod:generate_a_strong_password_here@localhost:5432/yot_swap_production
PGUSER=yot_prod
PGPASSWORD=generate_a_strong_password_here
PGHOST=localhost
PGPORT=5432
PGDATABASE=yot_swap_production

# Server configuration
PORT=5000
NODE_ENV=production
SESSION_SECRET=your_generated_session_secret

# Solana configuration
SOLANA_ENDPOINT=https://api.devnet.solana.com
YOT_PROGRAM_ID=6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6
YOT_TOKEN_ADDRESS=2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF
YOS_TOKEN_ADDRESS=GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n
ADMIN_WALLET_ADDRESS=AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ

# Token constants
PROGRAM_SCALING_FACTOR=9260
YOS_WALLET_DISPLAY_ADJUSTMENT=9260
CONFIRMATION_COUNT=1
```

## 5. Database Migration for Production

```bash
# Create database schema and seed data
node scripts/setup-database.js

# Verify database setup
node scripts/validate-database.js
```

## 6. Build Frontend for Production

```bash
# Build frontend assets
npm run build

# Verify build succeeded
ls -la dist/
```

## 7. Configure PM2 for Production

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'yot-swap',
    script: 'server/index.js',
    instances: 'max',    // Uses all available CPUs
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    combine_logs: true,
    error_file: '/var/www/yot-swap/logs/error.log',
    out_file: '/var/www/yot-swap/logs/output.log'
  }]
};
```

Start the application:

```bash
# Create logs directory
mkdir -p /var/www/yot-swap/logs

# Start application with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration to survive server restarts
pm2 save

# Set up PM2 to start on system boot
pm2 startup
```

## 8. Configure Nginx as Reverse Proxy

Create `/etc/nginx/sites-available/yot-swap`:

```nginx
server {
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Increase client max body size for large uploads (if needed)
    client_max_body_size 10M;

    # Optional: Enable gzip compression
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
```

Enable site and set up SSL:

```bash
# Enable site configuration
sudo ln -s /etc/nginx/sites-available/yot-swap /etc/nginx/sites-enabled/

# Remove default Nginx site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# If test passes, restart Nginx
sudo systemctl restart nginx

# Set up SSL with Let's Encrypt
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

## 9. Secure the Production Environment

```bash
# Secure .env file
chmod 600 /var/www/yot-swap/.env

# Set proper ownership and permissions
sudo chown -R $USER:www-data /var/www/yot-swap
find /var/www/yot-swap -type d -exec chmod 750 {} \;
find /var/www/yot-swap -type f -exec chmod 640 {} \;
chmod 750 /var/www/yot-swap/scripts/*.sh

# Set up log rotation for PM2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## 10. Set Up Monitoring and Backups

```bash
# Create backup script
cat > /var/www/yot-swap/scripts/backup.sh << 'EOL'
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/www/yot-swap/backups"
DB_NAME="yot_swap_production"
DB_USER="yot_prod"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Export database
export PGPASSWORD=$(grep PGPASSWORD /var/www/yot-swap/.env | cut -d '=' -f2)
pg_dump -U $DB_USER -h localhost $DB_NAME > "$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

# Compress backup
gzip "$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

# Remove backups older than 14 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -type f -mtime +14 -delete

echo "Backup completed: $BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"
EOL

# Make backup script executable
chmod +x /var/www/yot-swap/scripts/backup.sh

# Add to crontab to run daily at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/yot-swap/scripts/backup.sh >> /var/www/yot-swap/logs/backup.log 2>&1") | crontab -

# Set up basic monitoring with PM2
pm2 monit
```

## 11. Final Validation Checks

Run a comprehensive validation check before going live:

```bash
# 1. Database validation
node scripts/validate-database.js

# 2. Application health check
curl -I http://localhost:5000

# 3. Check SSL certificate
curl -I https://your-domain.com

# 4. Check PM2 status
pm2 status

# 5. Verify Nginx logs
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

## 12. Post-Deployment Tasks

1. Set up a monitoring system (e.g., UptimeRobot, Datadog)
2. Configure server alerts for high CPU/memory usage
3. Document the production setup for your team
4. Implement a proper CI/CD pipeline for future deployments

## Production Deployment Checklist

Before announcing your site is live, verify:

- [ ] SSL is properly configured and cert is valid
- [ ] All pages load correctly with proper styling
- [ ] Registration and login processes work
- [ ] Database connections function correctly
- [ ] Solana blockchain integration works properly
- [ ] Admin dashboard is accessible and functional
- [ ] Swapping functionality works as expected
- [ ] Monitoring and alerts are set up
- [ ] Backup system is tested and working

## Troubleshooting Common Production Issues

### Application not accessible
```bash
# Check if the application is running
pm2 status

# Check Nginx status
sudo systemctl status nginx

# Check for port conflicts
sudo netstat -tulpn | grep 5000

# Restart application and Nginx
pm2 restart all
sudo systemctl restart nginx
```

### Database connection issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Validate database connection
PGPASSWORD=$(grep PGPASSWORD /var/www/yot-swap/.env | cut -d '=' -f2) psql -U $(grep PGUSER /var/www/yot-swap/.env | cut -d '=' -f2) -h localhost -d $(grep PGDATABASE /var/www/yot-swap/.env | cut -d '=' -f2) -c "SELECT 'Connection working';"
```

### SSL certificate issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificates manually if needed
sudo certbot renew --force-renewal
```

### Application errors
```bash
# Check application logs
pm2 logs

# If needed, restart with more verbose logging
pm2 stop all
NODE_ENV=production DEBUG=* pm2 start ecosystem.config.js
```

## Important Security Notes

1. Never store private keys or sensitive credentials directly in your codebase
2. Keep your production environment updated with security patches
3. Regularly audit your system for potential vulnerabilities
4. Implement rate limiting to prevent abuse
5. Consider implementing a Web Application Firewall (WAF)

By following this comprehensive production launch guide, you should have a robust, secure, and properly configured YOT Swap platform running in a production environment.