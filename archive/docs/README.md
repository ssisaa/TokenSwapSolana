# YOT Swap Platform: Complete Deployment Guide

This guide provides comprehensive, step-by-step instructions for deploying and running the YOT Swap platform without encountering any issues.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [System Requirements](#system-requirements)
4. [Complete Installation Process](#complete-installation-process)
5. [Database Configuration](#database-configuration)
6. [Environment Setup](#environment-setup)
7. [Solana Setup](#solana-setup)
8. [Starting the Application](#starting-the-application)
9. [Troubleshooting Common Issues](#troubleshooting-common-issues)
10. [Maintenance](#maintenance)
11. [Security Best Practices](#security-best-practices)
12. [Important Token Addresses](#important-token-addresses)

## Overview

YOT Swap is a sophisticated Solana-based token ecosystem with multi-hub swap infrastructure, supporting:

- Multi-hub token swaps with auto-routing between Jupiter and Raydium
- Bidirectional swaps (any token → SOL → YOT and YOT → SOL → any token)
- Automatic 20% liquidity contribution to SOL-YOT pool
- YOS token rewards and staking with 100% APR
- Real-time blockchain data with no simulations
- Multiple wallet support (Phantom, Solflare)

## Prerequisites

Before starting, ensure you have:

- Access to a Unix-like environment (Linux/macOS preferred, WSL for Windows)
- Admin privileges on your machine
- Basic knowledge of PostgreSQL and Node.js
- Solana CLI tools installed
- Git installed

## System Requirements

- **CPU**: 4+ cores recommended
- **RAM**: 8GB+ (16GB recommended)
- **Storage**: 50GB+ SSD
- **Node.js**: v18.x or v20.x (LTS versions)
- **PostgreSQL**: v14+ (v15 recommended)
- **OS**: Ubuntu 20.04+ or similar Linux distro (recommended)
- **Network**: Stable internet connection

## Complete Installation Process

### 1. Prepare Your Environment

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install necessary dependencies
sudo apt install -y build-essential libssl-dev curl git

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Solana tools
sh -c "$(curl -sSfL https://release.solana.com/v1.16.19/install)"
export PATH="/home/$USER/.local/share/solana/install/active_release/bin:$PATH"

# Verify installations
node --version  # Should show v20.x
npm --version   # Should show 9.x or 10.x
solana --version  # Should show 1.16.19 or later
psql --version  # Should show 14.x or 15.x
```

### 2. Clone and Set Up Repository

```bash
# Clone repository
git clone https://github.com/your-username/yot-swap.git
cd yot-swap

# Install dependencies
npm install

# We've created a template .env file you can use
cp .env.template .env
# Now edit the .env file with your specific configuration
```

### 3. Set Up PostgreSQL Database

```bash
# Start PostgreSQL service if not running
sudo service postgresql start

# Log in as postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE yot_swap;
CREATE USER yot_admin WITH ENCRYPTED PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE yot_swap TO yot_admin;
ALTER USER yot_admin WITH SUPERUSER;

# Exit PostgreSQL
\q

# Test connection
psql -U yot_admin -d yot_swap -h localhost
```

## Database Configuration

### 1. Create Schema and Initial Data

Create a file named `setup-database.js` in the project root:

```javascript
// setup-database.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function setupDatabase() {
  const client = await pool.connect();
  try {
    console.log('Setting up database schema...');
    
    // Read and execute schema.sql
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'migrations', 'schema.sql'), 'utf8');
    await client.query(schemaSQL);
    console.log('Schema created successfully');
    
    // Read and execute initial data
    const seedSQL = fs.readFileSync(path.join(__dirname, 'migrations', 'seed.sql'), 'utf8');
    await client.query(seedSQL);
    console.log('Initial data seeded successfully');
    
    // Verify setup
    const tableCount = await client.query(`
      SELECT count(*) FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(`Created ${tableCount.rows[0].count} tables`);
    
    const settingsCheck = await client.query('SELECT * FROM admin_settings LIMIT 1');
    if (settingsCheck.rows.length > 0) {
      console.log('Admin settings verified:', settingsCheck.rows[0].id);
    }
    
    console.log('Database setup completed successfully!');
  } catch (err) {
    console.error('Error setting up database:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase().catch(console.error);
```

Create a file named `migrations/schema.sql`:

```sql
-- migrations/schema.sql

-- Drop tables if they exist (use with caution in production)
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS staking_records CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS token_metadata CASCADE;
DROP TABLE IF EXISTS liquidity_pools CASCADE;
DROP TABLE IF EXISTS admin_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  is_founder BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  wallet_address VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create admin_settings table
CREATE TABLE admin_settings (
  id SERIAL PRIMARY KEY,
  liquidity_contribution_percentage INTEGER NOT NULL DEFAULT 20,
  stake_threshold INTEGER DEFAULT 1000,
  unstake_threshold INTEGER DEFAULT 500,
  harvest_threshold INTEGER DEFAULT 100,
  max_slippage INTEGER DEFAULT 5,
  jupiter_api_version VARCHAR(10) DEFAULT 'v6',
  stake_rate_per_second FLOAT8 DEFAULT 0.00000125,
  program_scaling_factor INTEGER DEFAULT 9260,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  tx_hash VARCHAR(255) NOT NULL,
  tx_type VARCHAR(50) NOT NULL,
  token_address VARCHAR(255),
  amount NUMERIC,
  fee NUMERIC,
  status VARCHAR(50) DEFAULT 'confirmed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create staking_records table
CREATE TABLE staking_records (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  stake_tx_hash VARCHAR(255),
  amount NUMERIC NOT NULL,
  rewards NUMERIC DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  staked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  unstaked_at TIMESTAMP WITH TIME ZONE
);

-- Create token_metadata table
CREATE TABLE token_metadata (
  token_address VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(255) NOT NULL,
  decimals INTEGER DEFAULT 9,
  logo_uri VARCHAR(255),
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create liquidity_pools table
CREATE TABLE liquidity_pools (
  id SERIAL PRIMARY KEY,
  pool_address VARCHAR(255) NOT NULL UNIQUE,
  token_a_address VARCHAR(255) NOT NULL,
  token_b_address VARCHAR(255) NOT NULL,
  token_a_reserves NUMERIC,
  token_b_reserves NUMERIC,
  fee_percent NUMERIC DEFAULT 0.3,
  platform VARCHAR(50) DEFAULT 'raydium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create sessions table for Express session
CREATE TABLE sessions (
  sid VARCHAR(255) NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

-- Create indexes
CREATE INDEX IDX_sessions_expire ON sessions (expire);
CREATE INDEX IDX_users_username ON users (username);
CREATE INDEX IDX_transactions_tx_hash ON transactions (tx_hash);
CREATE INDEX IDX_transactions_user_id ON transactions (user_id);
CREATE INDEX IDX_staking_records_user_id ON staking_records (user_id);
CREATE INDEX IDX_liquidity_pools_token_a ON liquidity_pools (token_a_address);
CREATE INDEX IDX_liquidity_pools_token_b ON liquidity_pools (token_b_address);
```

Create a file named `migrations/seed.sql`:

```sql
-- migrations/seed.sql

-- Insert admin user (password: admin)
INSERT INTO users (username, password, is_founder, is_admin) 
VALUES ('admin', '5fa06128c7881e27be04f89839be7dce4104ea66adacba984e3b244af9e7f8a50105a705c14a42c25e5ef4b86f82c9ed9bb07c32eda6adc66b90ad5dc43c0f21.4ba917075e27086fb682a38c69a6cf94', true, true);

-- Insert admin settings
INSERT INTO admin_settings (
  liquidity_contribution_percentage,
  stake_threshold,
  unstake_threshold,
  harvest_threshold,
  max_slippage,
  jupiter_api_version,
  stake_rate_per_second,
  program_scaling_factor
) VALUES (
  20,
  1000,
  500,
  100,
  5,
  'v6',
  0.00000125,
  9260
);

-- Insert token metadata
INSERT INTO token_metadata (token_address, name, symbol, decimals, is_verified)
VALUES
('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF', 'YOT Token', 'YOT', 9, true),
('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n', 'YOS Token', 'YOS', 9, true),
('MTAwhynnxuZPWeRaKdZNgCiLgv8qTzhMV7SE6cuvjLf', 'Meta Token', 'MTA', 9, true),
('SAMXtxdXUeRHkeFp3JbCJcDtVPM18tqcEFmhsJtUYU7', 'Samurai X', 'SAMX', 9, true),
('XARMztsUvnKamdA2TgSEEib7H7zCUwF3jgChMGHXXSp', 'Xenon AR', 'XAR', 9, true),
('XMPuiiydZfyYNSXY894NucMmFZyEwuK7i1uHLmDyDN1', 'Xample Token', 'XMP', 9, true),
('RAMXriMbBGpXU8FMj2Y7WEcTXNfWGhkmkYdgZZ26i5F', 'RAM X', 'RAMX', 9, true),
('TRAXXapnMX3NYpuYpXuRJjpH7Vop8YZtxRrPEAVTJhY', 'Traxx', 'TRAXX', 9, true);
```

### 2. Run Database Setup

```bash
# Run database setup script
node setup-database.js
```

### 3. Validate Database

Create a file named `validate-database.js`:

```javascript
// validate-database.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function validateDatabase() {
  const client = await pool.connect();
  try {
    console.log('Validating database...');
    
    // Check tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('\nTables found:', tables.rows.length);
    tables.rows.forEach(t => console.log(`- ${t.table_name}`));
    
    // Check admin settings
    const settingsCheck = await client.query('SELECT * FROM admin_settings LIMIT 1');
    if (settingsCheck.rows.length > 0) {
      console.log('\nAdmin settings found:', settingsCheck.rows[0]);
    } else {
      console.error('\nERROR: No admin settings found!');
    }
    
    // Check admin user
    const userCheck = await client.query('SELECT id, username, is_admin FROM users WHERE username = $1', ['admin']);
    if (userCheck.rows.length > 0) {
      console.log('\nAdmin user found:', userCheck.rows[0]);
    } else {
      console.error('\nERROR: Admin user not found!');
    }
    
    // Check column types in admin_settings
    const columnTypes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'admin_settings'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nAdmin settings column types:');
    columnTypes.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Validate integer columns
    const integerColumns = [
      'liquidity_contribution_percentage',
      'stake_threshold',
      'unstake_threshold',
      'harvest_threshold',
      'max_slippage',
      'program_scaling_factor'
    ];
    
    let typesCorrect = true;
    integerColumns.forEach(col => {
      const colType = columnTypes.rows.find(r => r.column_name === col)?.data_type;
      if (colType !== 'integer') {
        console.error(`ERROR: Column ${col} has incorrect type: ${colType}, should be integer`);
        typesCorrect = false;
      }
    });
    
    // Validate float columns
    const floatColumn = columnTypes.rows.find(r => r.column_name === 'stake_rate_per_second')?.data_type;
    if (!['double precision', 'real', 'float8'].includes(floatColumn)) {
      console.error(`ERROR: Column stake_rate_per_second has incorrect type: ${floatColumn}, should be float8`);
      typesCorrect = false;
    }
    
    if (typesCorrect) {
      console.log('\nSUCCESS: All column types are correct!');
    }
    
    console.log('\nDatabase validation complete!');
  } catch (err) {
    console.error('Error during database validation:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

validateDatabase().catch(console.error);
```

Run the validation:

```bash
node validate-database.js
```

## Environment Setup

### 1. Configure All Environment Variables

Edit your `.env` file with ALL required variables:

```
# Database connection
DATABASE_URL=postgresql://yot_admin:secure_password_here@localhost:5432/yot_swap
PGUSER=yot_admin
PGPASSWORD=secure_password_here
PGHOST=localhost
PGPORT=5432
PGDATABASE=yot_swap

# Server configuration
PORT=5000
NODE_ENV=production
SESSION_SECRET=generate_a_secure_random_string_here

# Solana configuration
SOLANA_ENDPOINT=https://api.devnet.solana.com
SOL_RPC_RATE_LIMIT=100
YOT_PROGRAM_ID=6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6
YOT_TOKEN_ADDRESS=2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF
YOS_TOKEN_ADDRESS=GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n
ADMIN_WALLET_ADDRESS=AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ

# Token constants
PROGRAM_SCALING_FACTOR=9260
YOS_WALLET_DISPLAY_ADJUSTMENT=9260
CONFIRMATION_COUNT=1
DEFAULT_MAX_RETRIES=3
DEFAULT_TIMEOUT_MS=30000

# Feature flags
ENABLE_JUPITER_INTEGRATION=true
ENABLE_RAYDIUM_INTEGRATION=true
ENABLE_STAKING=true
ENABLE_TOKEN_CREATION=true

# Test token addresses (optional)
MTA_TOKEN_ADDRESS=MTAwhynnxuZPWeRaKdZNgCiLgv8qTzhMV7SE6cuvjLf
SAMX_TOKEN_ADDRESS=SAMXtxdXUeRHkeFp3JbCJcDtVPM18tqcEFmhsJtUYU7
XAR_TOKEN_ADDRESS=XARMztsUvnKamdA2TgSEEib7H7zCUwF3jgChMGHXXSp
XMP_TOKEN_ADDRESS=XMPuiiydZfyYNSXY894NucMmFZyEwuK7i1uHLmDyDN1
RAMX_TOKEN_ADDRESS=RAMXriMbBGpXU8FMj2Y7WEcTXNfWGhkmkYdgZZ26i5F
TRAXX_TOKEN_ADDRESS=TRAXXapnMX3NYpuYpXuRJjpH7Vop8YZtxRrPEAVTJhY

# Logging configuration
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
```

### 2. Generate a Secure Session Secret

```bash
# Option 1: Using OpenSSL
openssl rand -base64 64

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and use it as your SESSION_SECRET in the .env file.

## Solana Setup

### 1. Configure Solana CLI for Devnet

```bash
# Set Solana to use devnet
solana config set --url https://api.devnet.solana.com

# Generate a new keypair for testing
solana-keygen new -o test-wallet.json

# Request SOL from devnet faucet
solana airdrop 2 $(solana address -k test-wallet.json)

# Verify balance
solana balance $(solana address -k test-wallet.json)
```

### 2. Verify Program Keypair

Ensure the `program-keypair.json` file is in the project root. If not, you need to obtain it from a team member who has deployed the program.

## Starting the Application

### 1. Build the Frontend

```bash
# Build optimized frontend
npm run build
```

### 2. Setup Process Manager (PM2)

```bash
# Install PM2 globally
npm install -g pm2

# Create PM2 ecosystem config
cat > ecosystem.config.js << 'EOL'
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
```

### 3. Start Application with PM2

```bash
# Start the application
pm2 start ecosystem.config.js

# Save PM2 config to start on system boot
pm2 save
pm2 startup

# Monitor application
pm2 logs
pm2 monit
```

### 4. Verify Application is Running

```bash
# Check application status
pm2 list

# Test HTTP endpoint
curl http://localhost:5000/api/health
```

## Troubleshooting Common Issues

### 1. Fix Type Mismatch Errors

If you encounter data type mismatch errors:

```bash
# Create the fix script
cat > fix-types.js << 'EOL'
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixTypes() {
  const client = await pool.connect();
  try {
    console.log('Fixing column types...');
    
    // Fix admin_settings table types
    await client.query(`
      ALTER TABLE admin_settings
        ALTER COLUMN liquidity_contribution_percentage TYPE integer USING liquidity_contribution_percentage::integer,
        ALTER COLUMN stake_threshold TYPE integer USING stake_threshold::integer,
        ALTER COLUMN unstake_threshold TYPE integer USING unstake_threshold::integer,
        ALTER COLUMN harvest_threshold TYPE integer USING harvest_threshold::integer,
        ALTER COLUMN max_slippage TYPE integer USING max_slippage::integer,
        ALTER COLUMN stake_rate_per_second TYPE float8 USING stake_rate_per_second::float8,
        ALTER COLUMN program_scaling_factor TYPE integer USING program_scaling_factor::integer;
    `);
    
    console.log('Column types fixed successfully');
    
    // Validate fix
    const columnTypes = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'admin_settings'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nUpdated admin_settings column types:');
    columnTypes.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (err) {
    console.error('Error fixing column types:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

fixTypes().catch(console.error);
EOL

# Run the fix script
node fix-types.js
```

### 2. Database Connection Issues

If you cannot connect to the database:

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL if needed
sudo systemctl start postgresql

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Verify permissions
sudo -u postgres psql -c "SELECT usename, usecreatedb, usesuper FROM pg_user WHERE usename = 'yot_admin';"

# Grant superuser if needed
sudo -u postgres psql -c "ALTER USER yot_admin WITH SUPERUSER;"
```

### 3. Nginx Configuration for Production

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx config
sudo tee /etc/nginx/sites-available/yot-swap << 'EOL'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOL

# Enable site
sudo ln -s /etc/nginx/sites-available/yot-swap /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Set up SSL with Certbot
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Maintenance

### 1. Regular Database Backups

```bash
# Create backup script
cat > backup-db.sh << 'EOL'
#!/bin/bash
BACKUP_DIR="/path/to/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/yot_swap_$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Backup database
PGPASSWORD=$PGPASSWORD pg_dump -h localhost -U yot_admin -d yot_swap -f $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

echo "Backup created: $BACKUP_FILE.gz"
EOL

# Make script executable
chmod +x backup-db.sh

# Set up daily cron job
(crontab -l 2>/dev/null; echo "0 2 * * * /path/to/backup-db.sh") | crontab -
```

### 2. Monitoring and Logging

```bash
# Install monitoring tools
npm install -g pm2-logrotate

# Configure log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

# Set up basic monitoring dashboard
pm2 monitor
```

## Security Best Practices

1. **Firewall Configuration**:
   ```bash
   # Install UFW (Uncomplicated Firewall)
   sudo apt install -y ufw
   
   # Allow SSH, HTTP, and HTTPS
   sudo ufw allow ssh
   sudo ufw allow http
   sudo ufw allow https
   
   # Enable firewall
   sudo ufw enable
   ```

2. **Secure PostgreSQL**:
   ```bash
   # Edit PostgreSQL configuration
   sudo nano /etc/postgresql/*/main/pg_hba.conf
   
   # Limit access to localhost only
   # Make sure only these lines are uncommented:
   # local   all   postgres   peer
   # local   all   all        md5
   # host    all   all        127.0.0.1/32   md5
   # host    all   all        ::1/128        md5
   
   # Restart PostgreSQL
   sudo systemctl restart postgresql
   ```

3. **Regular Updates**:
   ```bash
   # Create update script
   cat > update-app.sh << 'EOL'
   #!/bin/bash
   cd /path/to/yot-swap
   
   # Pull latest changes
   git pull
   
   # Install dependencies
   npm install
   
   # Build frontend
   npm run build
   
   # Restart application
   pm2 restart yot-swap
   
   echo "Application updated successfully!"
   EOL
   
   # Make script executable
   chmod +x update-app.sh
   ```

## Important Token Addresses

These addresses are crucial for application functionality:

- **YOT Token**: `2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF`
- **YOS Token**: `GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n`
- **Program ID**: `6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6`
- **Admin Wallet**: `AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ`
- **Pool Authority**: `7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK`

**Test Tokens:**
- MTA: `MTAwhynnxuZPWeRaKdZNgCiLgv8qTzhMV7SE6cuvjLf`
- SAMX: `SAMXtxdXUeRHkeFp3JbCJcDtVPM18tqcEFmhsJtUYU7`
- XAR: `XARMztsUvnKamdA2TgSEEib7H7zCUwF3jgChMGHXXSp`
- XMP: `XMPuiiydZfyYNSXY894NucMmFZyEwuK7i1uHLmDyDN1`
- RAMX: `RAMXriMbBGpXU8FMj2Y7WEcTXNfWGhkmkYdgZZ26i5F`
- TRAXX: `TRAXXapnMX3NYpuYpXuRJjpH7Vop8YZtxRrPEAVTJhY`

---

By following these comprehensive instructions, you should be able to successfully set up and deploy the YOT Swap application without encountering any issues. If you do run into problems, the troubleshooting sections provide solutions for the most common issues.