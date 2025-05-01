/**
 * YOT Swap Database Setup Script
 * 
 * This script sets up the database schema and seeds initial data for the YOT Swap application.
 * It should be run once during the initial setup of the application.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Schema SQL
const schemaSql = `
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
`;

// Seed data SQL
const seedSql = `
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
`;

// Type fixing SQL (fixes common type issues)
const fixTypesSql = `
ALTER TABLE admin_settings 
  ALTER COLUMN liquidity_contribution_percentage TYPE integer USING liquidity_contribution_percentage::integer,
  ALTER COLUMN stake_threshold TYPE integer USING stake_threshold::integer,
  ALTER COLUMN unstake_threshold TYPE integer USING unstake_threshold::integer,
  ALTER COLUMN harvest_threshold TYPE integer USING harvest_threshold::integer,
  ALTER COLUMN max_slippage TYPE integer USING max_slippage::integer,
  ALTER COLUMN stake_rate_per_second TYPE float8 USING stake_rate_per_second::float8,
  ALTER COLUMN program_scaling_factor TYPE integer USING program_scaling_factor::integer;
`;

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Setting up database schema...');
    
    // Execute schema SQL
    await client.query(schemaSql);
    console.log('✅ Schema created successfully');
    
    // Execute seed SQL
    await client.query(seedSql);
    console.log('✅ Initial data seeded successfully');
    
    // Fix any potential type issues
    await client.query(fixTypesSql);
    console.log('✅ Column types fixed');
    
    // Verify setup
    const tableCount = await client.query(`
      SELECT count(*) FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(`Created ${tableCount.rows[0].count} tables`);
    
    // Check admin settings
    const settingsCheck = await client.query('SELECT * FROM admin_settings LIMIT 1');
    if (settingsCheck.rows.length > 0) {
      console.log('✅ Admin settings verified:', settingsCheck.rows[0]);
    } else {
      console.error('❌ Admin settings not found');
      throw new Error('Admin settings not found');
    }
    
    // Check token metadata
    const tokenCheck = await client.query('SELECT COUNT(*) FROM token_metadata');
    console.log(`✅ Token metadata records: ${tokenCheck.rows[0].count}`);
    
    // Check admin user
    const userCheck = await client.query('SELECT id, username, is_admin FROM users WHERE username = $1', ['admin']);
    if (userCheck.rows.length > 0) {
      console.log('✅ Admin user verified:', userCheck.rows[0]);
    } else {
      console.error('❌ Admin user not found');
      throw new Error('Admin user not found');
    }
    
    console.log('\n✅ Database setup completed successfully!');
    console.log('You can now run: node scripts/validate-database.js');
  } catch (err) {
    console.error('❌ Error setting up database:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run setup function
setupDatabase().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});