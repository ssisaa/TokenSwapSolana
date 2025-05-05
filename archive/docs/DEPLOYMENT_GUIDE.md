# YOT Swap Platform - Step-by-Step Deployment Guide

This comprehensive deployment guide provides detailed instructions with test cases to ensure a completely smooth deployment experience without any headaches. Follow each step carefully and run the validation tests to confirm success before proceeding to the next step.

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Environment Setup](#2-environment-setup)
3. [Database Setup](#3-database-setup)
4. [Repository Setup](#4-repository-setup)
5. [Configuration](#5-configuration)
6. [Database Migration](#6-database-migration)
7. [Application Startup](#7-application-startup)
8. [Validation and Testing](#8-validation-and-testing)
9. [Common Issues and Solutions](#9-common-issues-and-solutions)
10. [Production Deployment](#10-production-deployment)

## 1. Prerequisites

### Step 1.1: System Requirements Validation
```bash
# Verify that your system meets the minimum requirements
memory=$(free -m | awk '/^Mem:/{print $2}')
cpu_cores=$(nproc)
disk_space=$(df -h / | awk 'NR==2 {print $4}')

echo "Memory: ${memory}MB (Requirement: 8192MB+)"
echo "CPU Cores: ${cpu_cores} (Requirement: 4+)"
echo "Available Disk Space: ${disk_space} (Requirement: 50GB+)"

# Check if requirements are met
if [ $memory -lt 8192 ]; then
  echo "WARNING: Memory is below recommended minimum of 8GB"
fi
if [ $cpu_cores -lt 4 ]; then
  echo "WARNING: CPU core count is below recommended minimum of 4"
fi
```

**Expected Output:**
```
Memory: 16384MB (Requirement: 8192MB+)
CPU Cores: 8 (Requirement: 4+)
Available Disk Space: 100G (Requirement: 50GB+)
```

### Step 1.2: Install Required Software

```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y build-essential libssl-dev curl git nginx nodejs npm postgresql postgresql-contrib

# Check software versions
node -v  # Should be v16.x or higher
npm -v   # Should be v8.x or higher
psql --version  # Should be 14.x or higher
nginx -v  # Should be 1.18.x or higher

# Set up Node.js 20.x if needed
if [[ $(node -v) != v20* ]]; then
  echo "Upgrading Node.js to v20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
  node -v
fi
```

**Expected Output:**
```
node -v
v20.11.1

npm -v
10.2.4

psql --version
psql (PostgreSQL) 15.5

nginx -v
nginx version: nginx/1.18.0
```

### Step 1.3: Install Solana Tools

```bash
# Download and install Solana tools
sh -c "$(curl -sSfL https://release.solana.com/v1.16.19/install)"

# Add Solana to PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc

# Verify installation
solana --version

# Configure for devnet
solana config set --url https://api.devnet.solana.com

# Check configuration
solana config get
```

**Expected Output:**
```
solana --version
solana-cli 1.16.19

solana config get
Config File: ~/.config/solana/cli/config.yml
RPC URL: https://api.devnet.solana.com
WebSocket URL: wss://api.devnet.solana.com/ (computed)
Keypair Path: ~/.config/solana/id.json
Commitment: confirmed
```

## 2. Environment Setup

### Step 2.1: Create Directory Structure

```bash
# Create project directory
mkdir -p ~/yot-swap/migrations/manual
mkdir -p ~/yot-swap/scripts
cd ~/yot-swap

# Create staging directories
mkdir -p logs
mkdir -p backups
mkdir -p temp
```

**Validation:**
```bash
# Check directory structure
find . -type d -maxdepth 2 | sort
```

**Expected Output:**
```
.
./backups
./logs
./migrations
./migrations/manual
./scripts
./temp
```

### Step 2.2: Configure Global NPM

```bash
# Set global NPM settings
npm config set fund false
npm config set audit false
npm config set update-notifier false

# Install global utilities
npm install -g pm2 drizzle-kit typescript
```

**Validation:**
```bash
# Verify global installations
pm2 --version
npx drizzle-kit --version
tsc --version
```

**Expected Output:**
```
pm2 --version
5.3.0

npx drizzle-kit --version
0.20.10

tsc --version
Version 5.3.3
```

## 3. Database Setup

### Step 3.1: Configure PostgreSQL

```bash
# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl status postgresql

# Access PostgreSQL CLI as postgres user
sudo -u postgres psql

# Inside PostgreSQL CLI:
# Create database and user
CREATE DATABASE yot_swap;
CREATE USER yot_admin WITH ENCRYPTED PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE yot_swap TO yot_admin;
ALTER USER yot_admin WITH SUPERUSER;
\q

# Test connection with new user
PGPASSWORD=secure_password_here psql -U yot_admin -h localhost -d yot_swap -c "SELECT 'Connection successful!';"
```

**Expected Output:**
```
Connection successful!
(1 row)
```

### Step 3.2: Create Database Validation Script

Create a file called `scripts/test-db-connection.js`:

```javascript
// scripts/test-db-connection.js
const { Pool } = require('pg');
require('dotenv').config();

// Load from environment or use defaults
const connectionConfig = {
  user: process.env.PGUSER || 'yot_admin',
  password: process.env.PGPASSWORD || 'secure_password_here',
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'yot_swap'
};

async function testConnection() {
  const startTime = Date.now();
  console.log('Testing PostgreSQL connection...');
  console.log('Connection config:', {
    user: connectionConfig.user,
    host: connectionConfig.host,
    port: connectionConfig.port,
    database: connectionConfig.database,
    password: '********' // Hide actual password
  });
  
  const pool = new Pool(connectionConfig);
  
  try {
    // Test basic connection
    const result = await pool.query('SELECT version()');
    console.log('✅ Connection successful!');
    console.log('PostgreSQL Version:', result.rows[0].version);
    
    // Test database privileges
    try {
      await pool.query('CREATE TABLE _test_table (id SERIAL PRIMARY KEY, test_col TEXT)');
      await pool.query('INSERT INTO _test_table (test_col) VALUES ($1)', ['Test value']);
      const testResult = await pool.query('SELECT * FROM _test_table');
      console.log('✅ Write permissions confirmed:', testResult.rows[0]);
      await pool.query('DROP TABLE _test_table');
      console.log('✅ DROP TABLE permissions confirmed');
    } catch (err) {
      console.error('❌ Insufficient database privileges:', err.message);
      process.exit(1);
    }
    
    // Check if pg_crypto extension is available (needed for hashing)
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
      console.log('✅ pgcrypto extension is available');
    } catch (err) {
      console.error('❌ pgcrypto extension is not available:', err.message);
      console.error('Run: sudo apt install postgresql-contrib');
      process.exit(1);
    }
    
    console.log(`✅ All database tests passed in ${Date.now() - startTime}ms`);
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    console.error('Troubleshooting tips:');
    console.error('1. Check if PostgreSQL is running: sudo systemctl status postgresql');
    console.error('2. Verify credentials in .env file');
    console.error('3. Check if database exists: sudo -u postgres psql -c "\\l"');
    console.error('4. Ensure PostgreSQL is listening on right port: sudo netstat -plunt | grep postgres');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection().catch(console.error);
```

**Run the validation script:**
```bash
# Install required packages
npm install pg dotenv

# Run the script
node scripts/test-db-connection.js
```

**Expected Output:**
```
Testing PostgreSQL connection...
Connection config: {
  user: 'yot_admin',
  host: 'localhost',
  port: 5432,
  database: 'yot_swap',
  password: '********'
}
✅ Connection successful!
PostgreSQL Version: PostgreSQL 15.5 on x86_64-pc-linux-gnu...
✅ Write permissions confirmed: { id: 1, test_col: 'Test value' }
✅ DROP TABLE permissions confirmed
✅ pgcrypto extension is available
✅ All database tests passed in 235ms
```

## 4. Repository Setup

### Step 4.1: Clone Repository

```bash
# Navigate to project directory
cd ~/yot-swap

# Clone repository
git clone https://github.com/your-username/yot-swap.git .
```

**Validation:**
```bash
# Check repository contents
ls -la
git status
```

### Step 4.2: Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Check for missing peer dependencies
npm ls 2>&1 | grep "UNMET PEER DEPENDENCY"
```

**Validation:**
```bash
# Verify node_modules
ls -la node_modules | wc -l  # Should show large number of directories

# Verify package installation
npm list --depth=0
```

## 5. Configuration

### Step 5.1: Create Environment File

Copy the template file and edit with the proper values:

```bash
# Create .env file from template
cp .env.template .env

# Generate secure session secret
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

# Update .env file with proper values
sed -i "s/DATABASE_URL=.*/DATABASE_URL=postgresql:\/\/yot_admin:secure_password_here@localhost:5432\/yot_swap/" .env
sed -i "s/PGUSER=.*/PGUSER=yot_admin/" .env
sed -i "s/PGPASSWORD=.*/PGPASSWORD=secure_password_here/" .env
sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env
```

**Validation Script - `scripts/validate-env.js`:**

```javascript
// scripts/validate-env.js
require('dotenv').config();

// Required environment variables
const requiredVars = [
  'DATABASE_URL',
  'PGUSER',
  'PGPASSWORD',
  'PGHOST',
  'PGPORT',
  'PGDATABASE',
  'SESSION_SECRET',
  'YOT_PROGRAM_ID',
  'YOT_TOKEN_ADDRESS',
  'YOS_TOKEN_ADDRESS',
  'ADMIN_WALLET_ADDRESS',
  'PROGRAM_SCALING_FACTOR',
  'YOS_WALLET_DISPLAY_ADJUSTMENT',
  'CONFIRMATION_COUNT'
];

// Solana address validation regex
const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function validateEnv() {
  console.log('Validating environment variables...');
  
  let errorCount = 0;
  
  // Check for missing variables
  for (const variable of requiredVars) {
    if (!process.env[variable]) {
      console.error(`❌ Missing required environment variable: ${variable}`);
      errorCount++;
    }
  }
  
  // Validate database URL format
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
    console.error('❌ DATABASE_URL must start with postgresql://');
    errorCount++;
  }
  
  // Validate Solana addresses
  const addressVars = ['YOT_PROGRAM_ID', 'YOT_TOKEN_ADDRESS', 'YOS_TOKEN_ADDRESS', 'ADMIN_WALLET_ADDRESS'];
  for (const addressVar of addressVars) {
    if (process.env[addressVar] && !solanaAddressRegex.test(process.env[addressVar])) {
      console.error(`❌ Invalid Solana address format for ${addressVar}: ${process.env[addressVar]}`);
      errorCount++;
    }
  }
  
  // Validate numeric values
  const numericVars = ['PROGRAM_SCALING_FACTOR', 'YOS_WALLET_DISPLAY_ADJUSTMENT', 'CONFIRMATION_COUNT'];
  for (const numVar of numericVars) {
    if (process.env[numVar] && isNaN(Number(process.env[numVar]))) {
      console.error(`❌ Environment variable ${numVar} must be a number: ${process.env[numVar]}`);
      errorCount++;
    }
  }
  
  // Validate SESSION_SECRET length
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
    console.error('❌ SESSION_SECRET is too short. It should be at least 32 characters for security');
    errorCount++;
  }
  
  // Print masked summary of environment
  console.log('\nEnvironment Configuration Summary:');
  console.log('Database:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]*@/, ':****@') : 'Not Set');
  console.log('Solana Endpoint:', process.env.SOLANA_ENDPOINT || 'Not Set');
  console.log('YOT Program ID:', process.env.YOT_PROGRAM_ID || 'Not Set');
  console.log('YOT Token Address:', process.env.YOT_TOKEN_ADDRESS || 'Not Set');
  console.log('YOS Token Address:', process.env.YOS_TOKEN_ADDRESS || 'Not Set');
  console.log('Session Secret:', process.env.SESSION_SECRET ? `${process.env.SESSION_SECRET.substring(0, 5)}...` : 'Not Set');
  
  if (errorCount === 0) {
    console.log('\n✅ All environment variables validated successfully');
    return true;
  } else {
    console.error(`\n❌ Found ${errorCount} issue(s) with environment variables`);
    return false;
  }
}

// Run validation and exit with appropriate code
if (!validateEnv()) {
  process.exit(1);
}
```

**Run the validation:**
```bash
node scripts/validate-env.js
```

**Expected Output:**
```
Validating environment variables...

Environment Configuration Summary:
Database: postgresql://yot_admin:****@localhost:5432/yot_swap
Solana Endpoint: https://api.devnet.solana.com
YOT Program ID: 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6
YOT Token Address: 2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF
YOS Token Address: GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n
Session Secret: 3f7e8...

✅ All environment variables validated successfully
```

## 6. Database Migration

### Step 6.1: Create Migration Files

Create the following files:

1. `migrations/schema.sql`:

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

2. `migrations/seed.sql`:

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

3. `migrations/manual/fix-types.js`:

```javascript
// migrations/manual/fix-types.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixTypeIssues() {
  const client = await pool.connect();
  try {
    console.log('Starting database type fix operation...');
    
    // Get current column types for admin_settings
    const columnTypes = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'admin_settings'
      ORDER BY ordinal_position;
    `);
    
    console.log('Current column types:');
    columnTypes.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });
    
    // Fix admin_settings table column types
    console.log('\nFixing admin_settings column types...');
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
    
    // Verify type fixes
    const updatedColumnTypes = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'admin_settings'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nUpdated column types:');
    updatedColumnTypes.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n✅ Database type fixes completed successfully!');
  } catch (err) {
    console.error('❌ Error fixing database types:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

fixTypeIssues().catch(err => {
  console.error('Operation failed:', err);
  process.exit(1);
});
```

4. `migrations/manual/repair-sessions.js`:

```javascript
// migrations/manual/repair-sessions.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function repairSessionsTable() {
  const client = await pool.connect();
  try {
    console.log('Starting sessions table repair...');
    
    // Check if sessions table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'sessions'
      );
    `);
    
    const sessionTableExists = tableCheck.rows[0].exists;
    
    if (sessionTableExists) {
      console.log('Sessions table exists, dropping it to recreate...');
      await client.query('DROP TABLE IF EXISTS sessions CASCADE;');
    } else {
      console.log('Sessions table does not exist, will create it...');
    }
    
    // Create sessions table with correct schema
    console.log('Creating sessions table...');
    await client.query(`
      CREATE TABLE sessions (
        sid VARCHAR(255) NOT NULL PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS IDX_sessions_expire ON sessions (expire);
    `);
    
    // Verify sessions table structure
    const columnsCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'sessions'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nSessions table structure:');
    columnsCheck.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });
    
    // Check index
    const indexCheck = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'sessions';
    `);
    
    console.log('\nSessions table indexes:');
    indexCheck.rows.forEach(idx => {
      console.log(`- ${idx.indexname}: ${idx.indexdef}`);
    });
    
    console.log('\n✅ Sessions table repair completed successfully!');
  } catch (err) {
    console.error('❌ Error repairing sessions table:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

repairSessionsTable().catch(err => {
  console.error('Operation failed:', err);
  process.exit(1);
});
```

5. `scripts/setup-database.js`:

```javascript
// scripts/setup-database.js
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
    console.log('Creating database schema...');
    const schemaSQL = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'schema.sql'), 'utf8');
    await client.query(schemaSQL);
    console.log('✅ Schema created successfully');
    
    // Read and execute initial data
    console.log('Seeding initial data...');
    const seedSQL = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'seed.sql'), 'utf8');
    await client.query(seedSQL);
    console.log('✅ Initial data seeded successfully');
    
    // Verify setup
    const tableCount = await client.query(`
      SELECT count(*) FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(`Created ${tableCount.rows[0].count} tables`);
    
    // Check admin settings
    const settingsCheck = await client.query('SELECT * FROM admin_settings LIMIT 1');
    if (settingsCheck.rows.length > 0) {
      console.log('✅ Admin settings verified:', settingsCheck.rows[0].id);
    } else {
      console.error('❌ Admin settings not found');
      throw new Error('Admin settings not found');
    }
    
    // Fix any type issues
    console.log('\nFixing any potential type issues...');
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
    console.log('✅ Type issues fixed');
    
    console.log('\n✅ Database setup completed successfully!');
  } catch (err) {
    console.error('❌ Error setting up database:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
```

6. `scripts/validate-database.js`:

```javascript
// scripts/validate-database.js
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
    
    // Expected tables
    const expectedTables = [
      'admin_settings',
      'liquidity_pools',
      'sessions',
      'staking_records',
      'token_metadata',
      'transactions',
      'users'
    ];
    
    // Check if all expected tables exist
    const missingTables = expectedTables.filter(
      table => !tables.rows.find(t => t.table_name === table)
    );
    
    if (missingTables.length > 0) {
      console.error('\n❌ Missing tables:', missingTables.join(', '));
    } else {
      console.log('\n✅ All expected tables exist');
    }
    
    // Check admin settings
    const settingsCheck = await client.query('SELECT * FROM admin_settings LIMIT 1');
    if (settingsCheck.rows.length > 0) {
      console.log('\n✅ Admin settings found:', settingsCheck.rows[0]);
    } else {
      console.error('\n❌ ERROR: No admin settings found!');
    }
    
    // Check admin user
    const userCheck = await client.query('SELECT id, username, is_admin FROM users WHERE username = $1', ['admin']);
    if (userCheck.rows.length > 0) {
      console.log('\n✅ Admin user found:', userCheck.rows[0]);
    } else {
      console.error('\n❌ ERROR: Admin user not found!');
    }
    
    // Check token metadata
    const tokenCheck = await client.query('SELECT COUNT(*) FROM token_metadata');
    console.log(`\n✅ Token metadata records: ${tokenCheck.rows[0].count}`);
    
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
      const colInfo = columnTypes.rows.find(r => r.column_name === col);
      if (!colInfo) {
        console.error(`❌ Column ${col} not found in admin_settings table`);
        typesCorrect = false;
      } else if (colInfo.data_type !== 'integer') {
        console.error(`❌ Column ${col} has incorrect type: ${colInfo.data_type}, should be integer`);
        typesCorrect = false;
      }
    });
    
    // Validate float column
    const floatColumn = columnTypes.rows.find(r => r.column_name === 'stake_rate_per_second');
    if (!floatColumn) {
      console.error('❌ Column stake_rate_per_second not found in admin_settings table');
      typesCorrect = false;
    } else if (!['double precision', 'real', 'float8'].includes(floatColumn.data_type)) {
      console.error(`❌ Column stake_rate_per_second has incorrect type: ${floatColumn.data_type}, should be float8`);
      typesCorrect = false;
    }
    
    if (typesCorrect) {
      console.log('\n✅ All column types are correct!');
    }
    
    // Check constraints
    const constraints = await client.query(`
      SELECT conname, contype, conrelid::regclass AS table_name,
             pg_get_constraintdef(oid) AS constraint_def
      FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace
      ORDER BY conrelid::regclass::text, contype;
    `);
    
    console.log('\nDatabase constraints:');
    constraints.rows.forEach(con => {
      console.log(`- ${con.table_name}: ${con.conname} (${con.constraint_def})`);
    });
    
    // Check indexes
    const indexes = await client.query(`
      SELECT indexname, tablename, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);
    
    console.log('\nDatabase indexes:');
    indexes.rows.forEach(idx => {
      console.log(`- ${idx.tablename}: ${idx.indexname}`);
    });
    
    // If we got here, it's looking good
    console.log('\n✅ Database validation complete!');
    if (missingTables.length === 0 && typesCorrect) {
      console.log('✅ All validation checks passed successfully!');
      return true;
    } else {
      console.error('❌ Some validation checks failed. Please review the output.');
      return false;
    }
  } catch (err) {
    console.error('Error during database validation:', err);
    return false;
  } finally {
    client.release();
    await pool.end();
  }
}

validateDatabase().then(success => {
  if (!success) {
    process.exit(1);
  }
}).catch(err => {
  console.error('Validation failed with error:', err);
  process.exit(1);
});
```

### Step 6.2: Run Database Setup

```bash
# Run database setup script
node scripts/setup-database.js
```

**Expected Output:**
```
Setting up database schema...
Creating database schema...
✅ Schema created successfully
Seeding initial data...
✅ Initial data seeded successfully
Created 7 tables
✅ Admin settings verified: 1

Fixing any potential type issues...
✅ Type issues fixed

✅ Database setup completed successfully!
```

### Step 6.3: Validate Database Setup

```bash
# Run database validation script
node scripts/validate-database.js
```

**Expected Output:**
```
Validating database...

Tables found: 7
- admin_settings
- liquidity_pools
- sessions
- staking_records
- token_metadata
- transactions
- users

✅ All expected tables exist

✅ Admin settings found: {
  id: 1,
  liquidity_contribution_percentage: 20,
  stake_threshold: 1000,
  unstake_threshold: 500,
  harvest_threshold: 100,
  max_slippage: 5,
  jupiter_api_version: 'v6',
  stake_rate_per_second: 0.00000125,
  program_scaling_factor: 9260,
  updated_at: 2023-05-01T00:00:00.000Z
}

✅ Admin user found: { id: 1, username: 'admin', is_admin: true }

✅ Token metadata records: 8

Admin settings column types:
- id: integer (nullable: NO)
- liquidity_contribution_percentage: integer (nullable: NO)
- stake_threshold: integer (nullable: YES)
- unstake_threshold: integer (nullable: YES)
- harvest_threshold: integer (nullable: YES)
- max_slippage: integer (nullable: YES)
- jupiter_api_version: character varying (nullable: YES)
- stake_rate_per_second: double precision (nullable: YES)
- program_scaling_factor: integer (nullable: YES)
- updated_at: timestamp with time zone (nullable: YES)

✅ All column types are correct!

Database constraints:
- admin_settings: admin_settings_pkey (PRIMARY KEY (id))
- liquidity_pools: liquidity_pools_pkey (PRIMARY KEY (id))
- liquidity_pools: liquidity_pools_pool_address_key (UNIQUE (pool_address))
- sessions: sessions_pkey (PRIMARY KEY (sid))
- staking_records: staking_records_pkey (PRIMARY KEY (id))
- staking_records: staking_records_user_id_fkey (FOREIGN KEY (user_id) REFERENCES users(id))
- token_metadata: token_metadata_pkey (PRIMARY KEY (token_address))
- transactions: transactions_pkey (PRIMARY KEY (id))
- transactions: transactions_user_id_fkey (FOREIGN KEY (user_id) REFERENCES users(id))
- users: users_pkey (PRIMARY KEY (id))
- users: users_username_key (UNIQUE (username))

Database indexes:
- admin_settings: admin_settings_pkey
- liquidity_pools: idx_liquidity_pools_token_a
- liquidity_pools: idx_liquidity_pools_token_b
- liquidity_pools: liquidity_pools_pkey
- liquidity_pools: liquidity_pools_pool_address_key
- sessions: idx_sessions_expire
- sessions: sessions_pkey
- staking_records: idx_staking_records_user_id
- staking_records: staking_records_pkey
- token_metadata: token_metadata_pkey
- transactions: idx_transactions_tx_hash
- transactions: idx_transactions_user_id
- transactions: transactions_pkey
- users: idx_users_username
- users: users_pkey
- users: users_username_key

✅ Database validation complete!
✅ All validation checks passed successfully!
```

## 7. Application Startup

### Step 7.1: Set Up PM2 Ecosystem File

Create a file called `ecosystem.config.js`:

```javascript
// ecosystem.config.js
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
    },
    env_development: {
      NODE_ENV: 'development',
    }
  }]
};
```

### Step 7.2: Build Frontend

```bash
# Build frontend for production
npm run build
```

**Expected Output:**
```
> yot-swap@1.0.0 build
> vite build

vite v4.5.0 building for production...
✓ 1283 modules transformed.
rendering chunks (283)...
computing gzip size...
dist/index.html                     5.40 kB │ gzip:  2.14 kB
dist/assets/index-a1b2c3d4.css     134.82 kB │ gzip: 18.56 kB
dist/assets/index-e5f6g7h8.js      1567.24 kB │ gzip: 512.43 kB
...
```

### Step 7.3: Start Application with PM2

```bash
# Start application with PM2
pm2 start ecosystem.config.js

# Check status
pm2 status
```

**Expected Output:**
```
┌────┬────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name           │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0  │ yot-swap       │ default     │ 1.0.0   │ cluster │ 12345    │ 5s     │ 0    │ online    │ 0%       │ 85.5mb   │ user     │ disabled │
└────┴────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

### Step 7.4: Nginx Configuration (Production Only)

Create a file called `/etc/nginx/sites-available/yot-swap`:

```conf
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
```

Enable the site and restart Nginx:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/yot-swap /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## 8. Validation and Testing

### Step 8.1: Create Application Health Check Script

Create a file called `scripts/health-check.js`:

```javascript
// scripts/health-check.js
const http = require('http');
require('dotenv').config();

// Configuration
const PORT = process.env.PORT || 5000;
const TIMEOUT = 10000; // 10 seconds
const ENDPOINTS = [
  '/',              // Main app
  '/api/health',    // Backend health
  '/api/user'       // Authentication check (should return 401 if not logged in)
];

async function checkEndpoint(endpoint) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const req = http.get(`http://localhost:${PORT}${endpoint}`, {
      timeout: TIMEOUT
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        let status = 'UNKNOWN';
        
        // For /api/user, 401 is expected when not logged in
        if (endpoint === '/api/user' && res.statusCode === 401) {
          status = 'OK';
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          status = 'OK';
        } else if (res.statusCode >= 300 && res.statusCode < 400) {
          status = 'REDIRECT';
        } else if (res.statusCode >= 400) {
          status = 'ERROR';
        }
        
        resolve({
          endpoint,
          statusCode: res.statusCode,
          responseTime,
          status,
          headers: res.headers,
          contentLength: data.length
        });
      });
    });
    
    req.on('error', (error) => {
      reject({
        endpoint,
        error: error.message,
        status: 'FAILED'
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject({
        endpoint,
        error: 'Request timed out',
        status: 'TIMEOUT'
      });
    });
  });
}

async function checkHealth() {
  console.log(`\n🏥 YOT Swap Health Check - ${new Date().toISOString()}`);
  console.log(`Checking application on port ${PORT}...\n`);
  
  let allHealthy = true;
  
  for (const endpoint of ENDPOINTS) {
    try {
      const result = await checkEndpoint(endpoint);
      
      if (result.status === 'OK') {
        console.log(`✅ ${endpoint}: Status ${result.statusCode} (${result.responseTime}ms)`);
      } else if (result.status === 'REDIRECT') {
        console.log(`↩️ ${endpoint}: Redirected ${result.statusCode} (${result.responseTime}ms)`);
      } else {
        console.error(`❌ ${endpoint}: Error ${result.statusCode} (${result.responseTime}ms)`);
        allHealthy = false;
      }
    } catch (error) {
      console.error(`❌ ${error.endpoint}: ${error.error}`);
      allHealthy = false;
    }
  }
  
  console.log('\nSummary:');
  if (allHealthy) {
    console.log('✅ Application is healthy and responding properly');
  } else {
    console.error('❌ Application health check failed');
  }
  
  return allHealthy;
}

checkHealth().then(healthy => {
  process.exit(healthy ? 0 : 1);
}).catch(error => {
  console.error('Health check failed with error:', error);
  process.exit(1);
});
```

Run the health check:

```bash
node scripts/health-check.js
```

**Expected Output:**
```
🏥 YOT Swap Health Check - 2023-05-01T12:00:00.000Z
Checking application on port 5000...

✅ /: Status 200 (37ms)
✅ /api/health: Status 200 (12ms)
✅ /api/user: Status 401 (15ms)

Summary:
✅ Application is healthy and responding properly
```

### Step 8.2: Test Solana Connection

Create a file called `scripts/test-solana-connection.js`:

```javascript
// scripts/test-solana-connection.js
const { Connection, PublicKey } = require('@solana/web3.js');
require('dotenv').config();

// Configuration
const SOLANA_ENDPOINT = process.env.SOLANA_ENDPOINT || 'https://api.devnet.solana.com';
const YOT_TOKEN_ADDRESS = process.env.YOT_TOKEN_ADDRESS || '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
const YOS_TOKEN_ADDRESS = process.env.YOS_TOKEN_ADDRESS || 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';

async function testSolanaConnection() {
  console.log(`\n🚀 Testing Solana connection to ${SOLANA_ENDPOINT}`);
  
  try {
    // Create connection
    const connection = new Connection(SOLANA_ENDPOINT);
    
    // Test basic connection
    console.log('Connecting to Solana...');
    const version = await connection.getVersion();
    console.log(`✅ Connected to Solana ${version['solana-core']} (Feature set: ${version['feature-set']})`);
    
    // Get network stats
    const slot = await connection.getSlot();
    const blockTime = await connection.getBlockTime(slot);
    const blockHeight = await connection.getBlockHeight();
    
    console.log(`Current slot: ${slot}`);
    console.log(`Current block time: ${new Date(blockTime * 1000).toISOString()}`);
    console.log(`Current block height: ${blockHeight}`);
    
    // Test token lookups
    console.log('\nTesting token addresses...');
    
    // YOT Token
    try {
      const yotAddress = new PublicKey(YOT_TOKEN_ADDRESS);
      const yotAccountInfo = await connection.getAccountInfo(yotAddress);
      console.log(`✅ YOT Token (${YOT_TOKEN_ADDRESS}): Account found (${yotAccountInfo.owner.toBase58()})`);
    } catch (err) {
      console.error(`❌ YOT Token (${YOT_TOKEN_ADDRESS}): ${err.message}`);
      throw err;
    }
    
    // YOS Token
    try {
      const yosAddress = new PublicKey(YOS_TOKEN_ADDRESS);
      const yosAccountInfo = await connection.getAccountInfo(yosAddress);
      console.log(`✅ YOS Token (${YOS_TOKEN_ADDRESS}): Account found (${yosAccountInfo.owner.toBase58()})`);
    } catch (err) {
      console.error(`❌ YOS Token (${YOS_TOKEN_ADDRESS}): ${err.message}`);
      throw err;
    }
    
    console.log('\n✅ Solana connection test completed successfully');
    return true;
  } catch (error) {
    console.error(`\n❌ Solana connection test failed: ${error.message}`);
    return false;
  }
}

testSolanaConnection().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Solana test failed with error:', error);
  process.exit(1);
});
```

Run the Solana connection test:

```bash
node scripts/test-solana-connection.js
```

**Expected Output:**
```
🚀 Testing Solana connection to https://api.devnet.solana.com
Connecting to Solana...
✅ Connected to Solana 1.16.19 (Feature set: 2497436535)
Current slot: 238487120
Current block time: 2023-05-01T12:00:00.000Z
Current block height: 237120456

Testing token addresses...
✅ YOT Token (2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF): Account found (TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA)
✅ YOS Token (GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n): Account found (TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA)

✅ Solana connection test completed successfully
```

## 9. Common Issues and Solutions

### Issue 9.1: Type Mismatch in Database Columns

**Symptom:** 
Applications fails to start with errors about wrong column types or type conversion errors.

**Solution:** 
Run the type fixing script:

```bash
node migrations/manual/fix-types.js
```

### Issue 9.2: Session Errors

**Symptom:**
Authentication issues, "Cannot serialize session" errors, or other session-related issues.

**Solution:**
Run the session repair script:

```bash
node migrations/manual/repair-sessions.js
```

### Issue 9.3: Database Connection Problems

**Symptom:**
"ECONNREFUSED" errors or other database connection failures.

**Solution:**
1. Check PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   ```

2. Verify database credentials in .env file:
   ```bash
   node scripts/test-db-connection.js
   ```

3. If needed, recreate the database:
   ```bash
   sudo -u postgres psql -c "DROP DATABASE IF EXISTS yot_swap;"
   sudo -u postgres psql -c "CREATE DATABASE yot_swap;"
   node scripts/setup-database.js
   ```

### Issue 9.4: Solana Connection Issues

**Symptom:**
Errors about connecting to Solana RPC, timeouts, or "Call to token program failed".

**Solution:**
1. Check Solana RPC endpoint in your .env file
2. Test Solana connection using the test script:
   ```bash
   node scripts/test-solana-connection.js
   ```
3. Try alternative RPC endpoints if needed:
   ```
   # Alternative endpoints to try
   SOLANA_ENDPOINT=https://api.devnet.solana.com
   SOLANA_ENDPOINT=https://devnet.genesysgo.net
   SOLANA_ENDPOINT=https://devnet.api.metaplex.solana.com
   ```

### Issue 9.5: Application Won't Start

**Symptom:**
PM2 shows the application as "errored" or continually restarting.

**Solution:**
1. Check PM2 logs:
   ```bash
   pm2 logs yot-swap
   ```

2. Check for port conflicts:
   ```bash
   sudo netstat -tulpn | grep 5000
   ```

3. Try starting in development mode to see console output directly:
   ```bash
   npm run dev
   ```

4. If port is in use, change the port in your .env file:
   ```
   PORT=5001
   ```

## 10. Production Deployment

### Step 10.1: Security Checklist

Before going to production, verify the following:

1. All passwords and secrets are secure:
   ```bash
   # Check SESSION_SECRET length
   node -e "require('dotenv').config(); console.log(process.env.SESSION_SECRET.length >= 64 ? '✅ Session secret length ok' : '❌ Session secret too short');"
   ```

2. Enable SSL with Certbot:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

3. Set up a firewall:
   ```bash
   sudo apt install -y ufw
   sudo ufw allow 22/tcp  # SSH
   sudo ufw allow 80/tcp  # HTTP
   sudo ufw allow 443/tcp # HTTPS
   sudo ufw enable
   ```

4. Set proper file permissions:
   ```bash
   # Secure .env file
   chmod 600 .env
   ```

### Step 10.2: Set Up Monitoring

```bash
# Install pm2-logrotate
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:retain 7

# Set up monitoring dashboard
pm2 monitor
```

### Step 10.3: Set Up Regular Backups

Create a file called `scripts/backup-database.sh`:

```bash
#!/bin/bash
# scripts/backup-database.sh

# Load environment variables
source ~/.bashrc
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Define backup directory and create if it doesn't exist
BACKUP_DIR="$HOME/yot-swap/backups"
mkdir -p $BACKUP_DIR

# Timestamp for the backup file
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/yot_swap_backup_$TIMESTAMP.sql"

# Perform backup
echo "Creating database backup at $BACKUP_FILE..."
PGPASSWORD=$PGPASSWORD pg_dump -h $PGHOST -U $PGUSER -d $PGDATABASE -f $BACKUP_FILE

# Compress the backup
gzip $BACKUP_FILE
echo "Backup compressed to ${BACKUP_FILE}.gz"

# Clean up old backups (keep last 7 days)
find $BACKUP_DIR -name "yot_swap_backup_*.gz" -type f -mtime +7 -delete
echo "Cleanup completed - removed backups older than 7 days"

echo "Backup process completed successfully!"
```

Make the script executable and schedule it:

```bash
# Make executable
chmod +x scripts/backup-database.sh

# Create a cron job to run daily at 3 AM
(crontab -l 2>/dev/null; echo "0 3 * * * $HOME/yot-swap/scripts/backup-database.sh >> $HOME/yot-swap/logs/backup.log 2>&1") | crontab -
```

### Step 10.4: Final Validation

Run a complete system check:

```bash
# Database validation
node scripts/validate-database.js

# Environment validation
node scripts/validate-env.js

# Solana connection test
node scripts/test-solana-connection.js

# Application health check
node scripts/health-check.js
```

---

Congratulations! By following this comprehensive step-by-step guide, you should now have a fully functional YOT Swap platform deployed without any issues. This guide has covered every aspect of the deployment process and included test cases, validation steps, and solutions to common problems.

If you encounter any issues not covered in this guide, please refer to the project repository or contact the development team for support.