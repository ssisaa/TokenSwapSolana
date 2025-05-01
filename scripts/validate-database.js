/**
 * YOT Swap Database Validation Script
 * 
 * This script validates the database schema and provides detailed diagnostics
 * for any issues found.
 */

const { Pool } = require('pg');
require('dotenv').config();

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Expected tables and their columns
const expectedTables = [
  'users',
  'admin_settings',
  'token_metadata',
  'transactions',
  'staking_records',
  'liquidity_pools',
  'sessions'
];

// Expected structure for admin_settings
const adminSettingsColumns = {
  'id': 'integer',
  'liquidity_contribution_percentage': 'integer',
  'stake_threshold': 'integer',
  'unstake_threshold': 'integer', 
  'harvest_threshold': 'integer',
  'max_slippage': 'integer',
  'jupiter_api_version': 'character varying',
  'stake_rate_per_second': 'double precision',
  'program_scaling_factor': 'integer',
  'updated_at': 'timestamp with time zone'
};

async function validateDatabase() {
  const client = await pool.connect();
  let success = true;
  
  try {
    console.log(`${colors.blue}Validating database...${colors.reset}\n`);
    
    // Check if all expected tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    console.log(`Tables found: ${tables.length}`);
    tables.forEach(t => console.log(`- ${t}`));
    
    const missingTables = expectedTables.filter(table => !tables.includes(table));
    
    if (missingTables.length > 0) {
      console.log(`\n${colors.red}Missing tables: ${missingTables.join(', ')}${colors.reset}`);
      success = false;
    } else {
      console.log(`\n${colors.green}✓ All expected tables exist${colors.reset}`);
    }
    
    // Check admin_settings
    if (tables.includes('admin_settings')) {
      const settingsCheck = await client.query('SELECT * FROM admin_settings LIMIT 1');
      if (settingsCheck.rows.length > 0) {
        console.log(`\n${colors.green}✓ Admin settings found:${colors.reset}`, settingsCheck.rows[0]);
      } else {
        console.log(`\n${colors.yellow}⚠️ Admin settings table exists but has no data${colors.reset}`);
        success = false;
      }
      
      // Check column types
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
      
      // Check for incorrect column types
      let typesCorrect = true;
      for (const [colName, expectedType] of Object.entries(adminSettingsColumns)) {
        const column = columnTypes.rows.find(col => col.column_name === colName);
        
        if (!column) {
          console.log(`${colors.red}✗ Column ${colName} is missing${colors.reset}`);
          typesCorrect = false;
        } else if (column.data_type !== expectedType) {
          console.log(`${colors.red}✗ Column ${colName} has incorrect type: ${column.data_type}, should be ${expectedType}${colors.reset}`);
          typesCorrect = false;
        }
      }
      
      if (typesCorrect) {
        console.log(`\n${colors.green}✓ All column types are correct!${colors.reset}`);
      } else {
        console.log(`\n${colors.yellow}⚠️ Some column types need to be fixed${colors.reset}`);
        success = false;
      }
    } else {
      console.log(`\n${colors.red}✗ admin_settings table is missing${colors.reset}`);
      success = false;
    }
    
    // Check token_metadata
    if (tables.includes('token_metadata')) {
      const tokenCheck = await client.query('SELECT COUNT(*) FROM token_metadata');
      const tokenCount = parseInt(tokenCheck.rows[0].count);
      
      if (tokenCount > 0) {
        console.log(`\n${colors.green}✓ Token metadata records: ${tokenCount}${colors.reset}`);
        
        // Check if YOT and YOS tokens exist
        const criticalTokensCheck = await client.query(`
          SELECT token_address, symbol FROM token_metadata 
          WHERE token_address IN ('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF', 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n')
        `);
        
        if (criticalTokensCheck.rows.length === 2) {
          console.log(`${colors.green}✓ YOT and YOS tokens are properly configured${colors.reset}`);
        } else {
          console.log(`${colors.yellow}⚠️ One or both critical tokens (YOT, YOS) are missing${colors.reset}`);
          success = false;
        }
      } else {
        console.log(`\n${colors.yellow}⚠️ Token metadata table exists but has no data${colors.reset}`);
        success = false;
      }
    } else {
      console.log(`\n${colors.red}✗ token_metadata table is missing${colors.reset}`);
      success = false;
    }
    
    // Check users
    if (tables.includes('users')) {
      const adminCheck = await client.query(`
        SELECT id, username, is_admin, is_founder FROM users 
        WHERE username = 'admin' AND is_admin = true LIMIT 1
      `);
      
      if (adminCheck.rows.length > 0) {
        console.log(`\n${colors.green}✓ Admin user found:${colors.reset}`, adminCheck.rows[0]);
      } else {
        console.log(`\n${colors.yellow}⚠️ Admin user is missing${colors.reset}`);
        success = false;
      }
    } else {
      console.log(`\n${colors.red}✗ users table is missing${colors.reset}`);
      success = false;
    }
    
    // Check constraints and foreign keys
    const constraintsResult = await client.query(`
      SELECT conname, contype, conrelid::regclass AS table_name,
             pg_get_constraintdef(oid) AS constraint_def
      FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace
      ORDER BY conrelid::regclass::text, contype;
    `);
    
    console.log('\nDatabase constraints:');
    constraintsResult.rows.forEach(constraint => {
      console.log(`- ${constraint.table_name}: ${constraint.conname} (${constraint.constraint_def})`);
    });
    
    // Check indexes
    const indexesResult = await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);
    
    console.log('\nDatabase indexes:');
    indexesResult.rows.forEach(index => {
      console.log(`- ${index.tablename}: ${index.indexname}`);
    });
    
    // Final result
    if (success) {
      console.log(`\n${colors.green}✓ Database validation complete! No issues found.${colors.reset}`);
    } else {
      console.log(`\n${colors.yellow}⚠️ Database validation complete with issues.${colors.reset}`);
      console.log(`Run ${colors.blue}node scripts/repair-database.js${colors.reset} to fix issues automatically.`);
    }
    
    return success;
  } catch (error) {
    console.error(`${colors.red}Error during database validation:${colors.reset}`, error);
    return false;
  } finally {
    client.release();
    await pool.end();
  }
}

validateDatabase().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Validation failed with error:', error);
  process.exit(1);
});