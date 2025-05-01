# YOT Swap System Administrator Guide

This document provides system administrators with essential information for deploying, configuring, and maintaining the YOT Swap platform in a production environment.

## 🔑 Quick Reference

```bash
# Deploy application
./scripts/deploy-production.sh

# Check application status
pm2 status

# View logs
pm2 logs yot-swap

# Restart application
pm2 restart yot-swap

# Create database backup
./scripts/deployment-utilities.sh backup
```

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Initial Server Setup](#initial-server-setup)
3. [Application Deployment](#application-deployment)
4. [Database Management](#database-management)
5. [Configuration](#configuration)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)
9. [Disaster Recovery](#disaster-recovery)

## System Requirements

Minimum specifications:
- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 50GB SSD
- **OS**: Ubuntu 20.04 LTS or newer
- **Database**: PostgreSQL 14+
- **Node.js**: v18.x or v20.x LTS

## Initial Server Setup

### 1. Install Required Software

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required dependencies
sudo apt install -y build-essential curl git nginx postgresql postgresql-contrib

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
node --version    # Should be v20.x
npm --version     # Should be 9.x or 10.x
postgres --version
nginx -version

# Install PM2 globally
sudo npm install -g pm2
```

### 2. Configure Firewall

```bash
# Install UFW if not already installed
sudo apt install -y ufw

# Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### 3. Set Up PostgreSQL

```bash
# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Set up database and user
sudo -u postgres psql

# In PostgreSQL CLI:
CREATE DATABASE yot_swap_production;
CREATE USER yot_admin WITH ENCRYPTED PASSWORD 'use_a_strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE yot_swap_production TO yot_admin;
\q

# Test connection
PGPASSWORD=use_a_strong_password_here psql -U yot_admin -d yot_swap_production -h localhost -c "SELECT 'Connection successful!';"
```

## Application Deployment

### 1. Create Application Directory

```bash
# Create application directory
sudo mkdir -p /var/www/yot-swap
sudo chown $USER:$USER /var/www/yot-swap
cd /var/www/yot-swap

# Create necessary subdirectories
mkdir -p logs backups
```

### 2. Clone Repository & Set Up Environment

```bash
# Clone repository
git clone <repository_url> .

# Copy environment template
cp .env.template .env

# Edit .env file with production values
nano .env
```

Configure the following variables in `.env`:

```
# Database connection
DATABASE_URL=postgresql://yot_admin:use_a_strong_password_here@localhost:5432/yot_swap_production
PGUSER=yot_admin
PGPASSWORD=use_a_strong_password_here
PGHOST=localhost
PGPORT=5432
PGDATABASE=yot_swap_production

# Server configuration
PORT=5000
NODE_ENV=production
SESSION_SECRET=generate_very_long_random_string_here

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

Generate a secure session secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Initialize Database & Deploy

Run our automated deployment script which will:
- Install dependencies
- Set up the database
- Build the application
- Configure PM2
- Start the application

```bash
# Make deployment script executable
chmod +x scripts/deploy-production.sh

# Run deployment script
./scripts/deploy-production.sh
```

### 4. Configure Nginx

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/yot-swap
```

Add the following configuration:

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
```

Enable the site and reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/yot-swap /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Set Up SSL with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

## Database Management

### 1. Scheduled Backups

Set up daily backups:

```bash
# Open crontab editor
crontab -e

# Add this line to run backups at 2 AM every day
0 2 * * * /var/www/yot-swap/scripts/deployment-utilities.sh backup > /var/www/yot-swap/logs/backup.log 2>&1
```

### 2. Manual Backup & Restore

Backup:
```bash
cd /var/www/yot-swap
./scripts/deployment-utilities.sh backup
```

Restore from backup:
```bash
# Restore database from backup file
gunzip -c /var/www/yot-swap/backups/yot_swap_backup_YYYYMMDD_HHMMSS.sql.gz | psql -U yot_admin -d yot_swap_production
```

### 3. Database Maintenance

```bash
# Run database validation
cd /var/www/yot-swap
node scripts/validate-database.js

# Fix database issues
node scripts/repair-database.js
```

## Configuration

### 1. PM2 Configuration

PM2 configuration is stored in `ecosystem.config.js`:

```javascript
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
      PORT: 5000
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    combine_logs: true
  }]
};
```

To modify this configuration:

```bash
cd /var/www/yot-swap
nano ecosystem.config.js

# After editing, restart the application
pm2 restart yot-swap
```

### 2. Environment Configuration

To update environment variables:

```bash
cd /var/www/yot-swap
nano .env

# After editing, validate environment
node scripts/validate-env.js

# Restart the application to apply changes
pm2 restart yot-swap
```

## Monitoring & Maintenance

### 1. PM2 Monitoring

```bash
# Check application status
pm2 status

# View logs
pm2 logs yot-swap

# View all logs combined with timestamps
pm2 logs --timestamp

# Monitor CPU/memory usage
pm2 monit

# Setup PM2 dashboard
pm2 install pm2-server-monit
pm2 plus
```

### 2. Log Rotation

PM2 logs can grow large, so we set up log rotation:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### 3. Application Updates

To update the application:

```bash
cd /var/www/yot-swap

# Create backup before updating
./scripts/deployment-utilities.sh backup

# Pull latest changes
git pull

# Install dependencies
npm ci

# Build application
npm run build

# Restart application
pm2 restart yot-swap
```

Alternatively, use the deployment script:

```bash
./scripts/deploy-production.sh
```

## Security Best Practices

### 1. File Permissions

```bash
# Set proper ownership
sudo chown -R $USER:www-data /var/www/yot-swap

# Set proper permissions
find /var/www/yot-swap -type d -exec chmod 750 {} \;
find /var/www/yot-swap -type f -exec chmod 640 {} \;

# Make scripts executable
chmod 750 /var/www/yot-swap/scripts/*.sh

# Protect sensitive files
chmod 600 /var/www/yot-swap/.env
```

### 2. Database Security

```bash
# Revoke public access to the database
sudo -u postgres psql -c "REVOKE ALL ON DATABASE yot_swap_production FROM PUBLIC;"

# Use a strong password for the database user
sudo -u postgres psql -c "ALTER USER yot_admin WITH PASSWORD 'generate_a_strong_password_here';"
```

### 3. Secure Environment Variables

Never expose environment variables in public repositories. Use `.env` for local development and environment variables set by the deployment system in production.

### 4. Regular Updates

Keep all components updated:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js packages
npm audit fix

# Update PM2
npm update -g pm2
```

## Troubleshooting

### 1. Application Not Starting

```bash
# Check PM2 logs
pm2 logs yot-swap

# Check if port is already in use
sudo netstat -tulpn | grep 5000

# Check Node.js version
node --version

# Verify environment variables
node scripts/validate-env.js
```

### 2. Database Connection Issues

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Test database connection
node scripts/test-db-connection.js

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### 3. Nginx Issues

```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### 4. SSL Certificate Issues

```bash
# Check SSL certificates
sudo certbot certificates

# Renew certificates manually
sudo certbot renew --force-renewal
```

### 5. Performance Issues

```bash
# Monitor system resources
htop

# Check PM2 metrics
pm2 monit

# Check database performance
sudo -u postgres psql -d yot_swap_production -c "SELECT pg_size_pretty(pg_database_size('yot_swap_production')) as size;"
```

## Disaster Recovery

### 1. Backup Strategy

- **Database**: Daily automated backups using the script
- **Application Code**: Git repository
- **Environment Configuration**: Manual backup of `.env` file

### 2. System Recovery Steps

If the server needs to be rebuilt:

1. Set up a new server with required software (see [Initial Server Setup](#initial-server-setup))
2. Restore application code from Git repository
3. Restore environment configuration from backup
4. Restore database from the latest backup
5. Reconfigure Nginx and SSL certificates
6. Start the application

### 3. Recovery Testing

Periodically test the recovery process to ensure it works as expected:

```bash
# Test database restore
gunzip -c /var/www/yot-swap/backups/latest_backup.sql.gz | psql -U yot_admin -d yot_swap_test

# Validate restored database
PGDATABASE=yot_swap_test node scripts/validate-database.js
```

---

## Additional Resources

- [Node.js Documentation](https://nodejs.org/en/docs/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Solana Documentation](https://docs.solana.com/)

## Support Contacts

For support with this application, contact:
- **Technical Support**: [support@your-domain.com](mailto:support@your-domain.com)
- **Emergency Contact**: [emergency@your-domain.com](mailto:emergency@your-domain.com)