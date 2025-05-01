# YOT Swap Platform

A sophisticated Solana-based token ecosystem application with advanced multi-hub swap infrastructure, focusing on seamless token discovery and flexible trading mechanisms.

## 🚀 Features

- Multi-hub swap infrastructure with automatic routing
- Bidirectional token swaps (any token → SOL → YOT and YOT → SOL → any token)
- Automatic 20% contribution to SOL-YOT liquidity pool
- Cashback rewards in YOS tokens
- Staking platform with up to 100% APR paid in YOS
- Comprehensive dashboard with real-time data
- Multiple wallet support (Phantom, Solflare)
- Admin controls and settings

## 📋 Requirements

- Node.js v18+ (recommended: v20.x)
- PostgreSQL 14+
- Git

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository_url> yot-swap
cd yot-swap
npm install
```

### 2. Database Setup

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE yot_swap;"

# Configure environment variables
cp .env.example .env
# Edit .env with your database credentials and Solana settings
```

### 3. Database Initialization & Migration

```bash
# Initialize the database schema
npm run db:push

# Run the database seed script
node migrations/seed.js
```

### 4. Start the Application

```bash
# Development mode
npm run dev

# Production build
npm start
```

## 💾 Database Migration Scripts

If you encounter database issues when running outside of Replit, use these scripts:

### Fix Type Mismatches

```sql
-- Fix admin_settings table column types
ALTER TABLE admin_settings 
  ALTER COLUMN liquidity_contribution_percentage TYPE integer USING liquidity_contribution_percentage::integer,
  ALTER COLUMN stake_threshold TYPE integer USING stake_threshold::integer,
  ALTER COLUMN unstake_threshold TYPE integer USING unstake_threshold::integer,
  ALTER COLUMN harvest_threshold TYPE integer USING harvest_threshold::integer,
  ALTER COLUMN max_slippage TYPE integer USING max_slippage::integer,
  ALTER COLUMN stake_rate_per_second TYPE float8 USING stake_rate_per_second::float8,
  ALTER COLUMN program_scaling_factor TYPE integer USING program_scaling_factor::integer;
```

### Complete Schema Creation

```sql
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

-- Create sessions table for Express session store
CREATE TABLE sessions (
  sid VARCHAR(255) NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IDX_sessions_expire ON sessions (expire);

-- Insert initial admin user (password: admin)
INSERT INTO users (username, password, is_founder, is_admin) 
VALUES ('admin', '5fa06128c7881e27be04f89839be7dce4104ea66adacba984e3b244af9e7f8a50105a705c14a42c25e5ef4b86f82c9ed9bb07c32eda6adc66b90ad5dc43c0f21.4ba917075e27086fb682a38c69a6cf94', true, true);

-- Insert initial admin settings
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
```

### Data Validation Script

```javascript
// Save as scripts/validate-database.js
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function validateDatabase() {
  const client = await pool.connect();
  try {
    console.log('Validating database structure...');
    
    // Check tables exist
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('\nTables found:', tables.rows.length);
    tables.rows.forEach(t => console.log(`- ${t.table_name}`));
    
    // Check admin_settings
    const settingsCheck = await client.query('SELECT * FROM admin_settings LIMIT 1');
    if (settingsCheck.rows.length > 0) {
      console.log('\nAdmin settings found:', settingsCheck.rows[0]);
    } else {
      console.warn('\nWARNING: No admin settings found!');
    }
    
    // Check column types
    const columnTypes = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'admin_settings'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nAdmin settings column types:');
    columnTypes.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\nDatabase validation complete!');
  } catch (err) {
    console.error('Error during database validation:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

validateDatabase();
```

## 🚨 Troubleshooting

### Database Connection Issues

If you're unable to connect to the database:

1. Verify PostgreSQL is running: `pg_isready`
2. Check that your connection string format is correct
3. Ensure database user has proper permissions
4. Test connection with: `psql -U postgres -d yot_swap -c "SELECT 1;"`

### Type Mismatch Errors

If you encounter errors like "Type mismatch when inserting decimal values":

1. Run the type fixing SQL script above
2. Update your code to use the correct types when inserting data
3. Verify your schema matches expected types

### Session Errors

If you encounter session-related errors:

```sql
-- Recreate the sessions table
DROP TABLE IF EXISTS sessions;
CREATE TABLE sessions (
  sid VARCHAR(255) NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IDX_sessions_expire ON sessions (expire);
```

### Complete Reset (Last Resort)

To completely reset your database:

```bash
psql -U postgres -c "DROP DATABASE IF EXISTS yot_swap;"
psql -U postgres -c "CREATE DATABASE yot_swap;"
npm run db:push
node migrations/seed.js
```

## 🌐 Environment Variables

Create a `.env` file with these variables:

```
# Database connection
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/yot_swap
PGUSER=postgres
PGPASSWORD=your_password
PGHOST=localhost
PGPORT=5432
PGDATABASE=yot_swap

# Session secret
SESSION_SECRET=a_random_secure_string

# Solana configuration
SOLANA_ENDPOINT=https://api.devnet.solana.com
YOT_PROGRAM_ID=6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6
YOT_TOKEN_ADDRESS=2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF
YOS_TOKEN_ADDRESS=GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n
ADMIN_WALLET_ADDRESS=AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ

# Constants
PROGRAM_SCALING_FACTOR=9260
YOS_WALLET_DISPLAY_ADJUSTMENT=9260
CONFIRMATION_COUNT=1

# Optional: For debugging
DEBUG=true
PORT=5000
NODE_ENV=development
```

## 📝 License

[License information]

## 🔗 Important Addresses

- YOT Token: `2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF`
- YOS Token: `GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n`  
- Program ID: `6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6`
- Admin Wallet: `AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ`