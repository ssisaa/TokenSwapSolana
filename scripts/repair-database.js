/**
 * YOT Swap Database Repair Tool
 * 
 * This script identifies and fixes common database issues:
 * 1. Missing tables or columns
 * 2. Incorrect column types
 * 3. Corrupted session data
 * 4. Missing indexes
 */

const { Pool } = require('pg');
require('dotenv').config();

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Expected schema definition
const expectedSchema = {
  users: {
    columns: {
      id: 'integer',
      username: 'character varying',
      password: 'character varying',
      is_founder: 'boolean',
      is_admin: 'boolean',
      wallet_address: 'character varying',
      created_at: 'timestamp with time zone'
    },
    indexes: ['users_pkey', 'idx_users_username', 'users_username_key']
  },
  admin_settings: {
    columns: {
      id: 'integer',
      liquidity_contribution_percentage: 'integer',
      stake_threshold: 'integer',
      unstake_threshold: 'integer',
      harvest_threshold: 'integer',
      max_slippage: 'integer',
      jupiter_api_version: 'character varying',
      stake_rate_per_second: 'double precision',
      program_scaling_factor: 'integer',
      updated_at: 'timestamp with time zone'
    },
    indexes: ['admin_settings_pkey']
  },
  token_metadata: {
    columns: {
      token_address: 'character varying',
      name: 'character varying',
      symbol: 'character varying',
      decimals: 'integer',
      logo_uri: 'character varying',
      is_verified: 'boolean',
      created_at: 'timestamp with time zone'
    },
    indexes: ['token_metadata_pkey']
  },
  transactions: {
    columns: {
      id: 'integer',
      user_id: 'integer',
      tx_hash: 'character varying',
      tx_type: 'character varying',
      token_address: 'character varying',
      amount: 'numeric',
      fee: 'numeric',
      status: 'character varying',
      created_at: 'timestamp with time zone'
    },
    indexes: ['transactions_pkey', 'idx_transactions_tx_hash', 'idx_transactions_user_id']
  },
  staking_records: {
    columns: {
      id: 'integer',
      user_id: 'integer',
      stake_tx_hash: 'character varying',
      amount: 'numeric',
      rewards: 'numeric',
      status: 'character varying',
      staked_at: 'timestamp with time zone',
      unstaked_at: 'timestamp with time zone'
    },
    indexes: ['staking_records_pkey', 'idx_staking_records_user_id']
  },
  liquidity_pools: {
    columns: {
      id: 'integer',
      pool_address: 'character varying',
      token_a_address: 'character varying',
      token_b_address: 'character varying',
      token_a_reserves: 'numeric',
      token_b_reserves: 'numeric',
      fee_percent: 'numeric',
      platform: 'character varying',
      created_at: 'timestamp with time zone',
      updated_at: 'timestamp with time zone'
    },
    indexes: ['liquidity_pools_pkey', 'liquidity_pools_pool_address_key', 'idx_liquidity_pools_token_a', 'idx_liquidity_pools_token_b']
  },
  sessions: {
    columns: {
      sid: 'character varying',
      sess: 'json',
      expire: 'timestamp without time zone'
    },
    indexes: ['sessions_pkey', 'idx_sessions_expire']
  }
};

// SQL scripts for fixing common issues
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

const repairSessionsSql = `
DROP TABLE IF EXISTS sessions CASCADE;
CREATE TABLE sessions (
  sid VARCHAR(255) NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS IDX_sessions_expire ON sessions (expire);
`;

/**
 * Gets the current database schema
 */
async function getCurrentSchema(client) {
  // Get all tables
  const tablesResult = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  
  const tables = tablesResult.rows.map(row => row.table_name);
  console.log(`Found ${tables.length} tables: ${tables.join(', ')}`);
  
  // Get all columns for each table
  const schema = {};
  
  for (const table of tables) {
    const columnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = $1
      ORDER BY ordinal_position;
    `, [table]);
    
    const columns = {};
    columnsResult.rows.forEach(row => {
      columns[row.column_name] = row.data_type;
    });
    
    // Get indexes for the table
    const indexesResult = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = $1;
    `, [table]);
    
    const indexes = indexesResult.rows.map(row => row.indexname);
    
    schema[table] = {
      columns,
      indexes
    };
  }
  
  return schema;
}

/**
 * Validates a table against expected schema
 */
function validateTable(table, currentSchema, expectedSchema) {
  const issues = [];
  
  // Check if table exists
  if (!currentSchema[table]) {
    issues.push(`Table '${table}' is missing`);
    return issues;
  }
  
  // Check columns
  const currentColumns = currentSchema[table].columns;
  const expectedColumns = expectedSchema[table].columns;
  
  for (const column in expectedColumns) {
    if (!currentColumns[column]) {
      issues.push(`Column '${column}' is missing in table '${table}'`);
    } else if (currentColumns[column] !== expectedColumns[column]) {
      issues.push(`Column '${column}' in table '${table}' has type '${currentColumns[column]}', expected '${expectedColumns[column]}'`);
    }
  }
  
  // Check indexes
  const currentIndexes = currentSchema[table].indexes;
  const expectedIndexes = expectedSchema[table].indexes;
  
  for (const index of expectedIndexes) {
    if (!currentIndexes.includes(index)) {
      issues.push(`Index '${index}' is missing in table '${table}'`);
    }
  }
  
  return issues;
}

/**
 * Creates a missing table
 */
async function createMissingTable(client, table) {
  console.log(`Creating missing table '${table}'...`);
  
  let sql = '';
  
  switch (table) {
    case 'users':
      sql = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          is_founder BOOLEAN DEFAULT false,
          is_admin BOOLEAN DEFAULT false,
          wallet_address VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
      `;
      break;
    case 'admin_settings':
      sql = `
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
      `;
      break;
    case 'token_metadata':
      sql = `
        CREATE TABLE token_metadata (
          token_address VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          symbol VARCHAR(255) NOT NULL,
          decimals INTEGER DEFAULT 9,
          logo_uri VARCHAR(255),
          is_verified BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      break;
    case 'transactions':
      sql = `
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
        CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions (tx_hash);
        CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
      `;
      break;
    case 'staking_records':
      sql = `
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
        CREATE INDEX IF NOT EXISTS idx_staking_records_user_id ON staking_records (user_id);
      `;
      break;
    case 'liquidity_pools':
      sql = `
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
        CREATE INDEX IF NOT EXISTS idx_liquidity_pools_token_a ON liquidity_pools (token_a_address);
        CREATE INDEX IF NOT EXISTS idx_liquidity_pools_token_b ON liquidity_pools (token_b_address);
      `;
      break;
    case 'sessions':
      sql = repairSessionsSql;
      break;
    default:
      throw new Error(`No creation SQL defined for table '${table}'`);
  }
  
  await client.query(sql);
  console.log(`✅ Created table '${table}'`);
}

/**
 * Adds a missing column to a table
 */
async function addMissingColumn(client, table, column, dataType) {
  console.log(`Adding missing column '${column}' to table '${table}'...`);
  
  const sql = `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${dataType};`;
  
  await client.query(sql);
  console.log(`✅ Added column '${column}' to table '${table}'`);
}

/**
 * Fixes column data type
 */
async function fixColumnType(client, table, column, expectedType) {
  console.log(`Fixing type of column '${column}' in table '${table}'...`);
  
  let conversionSql = '';
  
  // Specific conversions for known problematic types
  if (expectedType === 'integer') {
    conversionSql = `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE integer USING ${column}::integer;`;
  } else if (expectedType === 'double precision' || expectedType === 'float8') {
    conversionSql = `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE float8 USING ${column}::float8;`;
  } else if (expectedType === 'numeric') {
    conversionSql = `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE numeric USING ${column}::numeric;`;
  } else if (expectedType === 'boolean') {
    conversionSql = `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE boolean USING ${column}::boolean;`;
  } else if (expectedType.includes('timestamp')) {
    conversionSql = `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE ${expectedType} USING ${column}::${expectedType};`;
  } else {
    conversionSql = `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE ${expectedType};`;
  }
  
  await client.query(conversionSql);
  console.log(`✅ Fixed type of column '${column}' in table '${table}'`);
}

/**
 * Adds a missing index
 */
async function addMissingIndex(client, table, indexName) {
  console.log(`Adding missing index '${indexName}' to table '${table}'...`);
  
  let sql = '';
  
  if (indexName.endsWith('_pkey')) {
    console.log(`Cannot add primary key index '${indexName}'. Table needs to be recreated.`);
    return false;
  } else if (indexName === 'idx_sessions_expire') {
    sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON sessions (expire);`;
  } else if (indexName === 'idx_users_username') {
    sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON users (username);`;
  } else if (indexName === 'idx_transactions_tx_hash') {
    sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON transactions (tx_hash);`;
  } else if (indexName === 'idx_transactions_user_id') {
    sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON transactions (user_id);`;
  } else if (indexName === 'idx_staking_records_user_id') {
    sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON staking_records (user_id);`;
  } else if (indexName === 'idx_liquidity_pools_token_a') {
    sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON liquidity_pools (token_a_address);`;
  } else if (indexName === 'idx_liquidity_pools_token_b') {
    sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON liquidity_pools (token_b_address);`;
  } else if (indexName === 'liquidity_pools_pool_address_key') {
    sql = `ALTER TABLE liquidity_pools ADD CONSTRAINT ${indexName} UNIQUE (pool_address);`;
  } else if (indexName === 'users_username_key') {
    sql = `ALTER TABLE users ADD CONSTRAINT ${indexName} UNIQUE (username);`;
  } else {
    console.log(`No creation SQL defined for index '${indexName}'`);
    return false;
  }
  
  await client.query(sql);
  console.log(`✅ Added index '${indexName}' to table '${table}'`);
  return true;
}

/**
 * Special fix for admin_settings column types
 */
async function fixAdminSettingsTypes(client) {
  console.log('Applying special fix for admin_settings column types...');
  
  await client.query(fixTypesSql);
  
  console.log('✅ Fixed admin_settings column types');
}

/**
 * Repair corrupted sessions table
 */
async function repairSessions(client) {
  console.log('Repairing sessions table...');
  
  await client.query(repairSessionsSql);
  
  console.log('✅ Repaired sessions table');
}

/**
 * Add default admin user if missing
 */
async function addDefaultAdminIfMissing(client) {
  console.log('Checking for admin user...');
  
  const result = await client.query(`
    SELECT COUNT(*) FROM users WHERE username = 'admin' AND is_admin = true;
  `);
  
  if (parseInt(result.rows[0].count) === 0) {
    console.log('Admin user is missing, creating default admin...');
    
    await client.query(`
      INSERT INTO users (username, password, is_founder, is_admin) 
      VALUES ('admin', '5fa06128c7881e27be04f89839be7dce4104ea66adacba984e3b244af9e7f8a50105a705c14a42c25e5ef4b86f82c9ed9bb07c32eda6adc66b90ad5dc43c0f21.4ba917075e27086fb682a38c69a6cf94', true, true);
    `);
    
    console.log('✅ Created default admin user (username: admin, password: admin)');
  } else {
    console.log('✅ Admin user exists');
  }
}

/**
 * Add default admin settings if missing
 */
async function addDefaultAdminSettingsIfMissing(client) {
  console.log('Checking for admin settings...');
  
  const result = await client.query(`
    SELECT COUNT(*) FROM admin_settings;
  `);
  
  if (parseInt(result.rows[0].count) === 0) {
    console.log('Admin settings are missing, creating default settings...');
    
    await client.query(`
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
    `);
    
    console.log('✅ Created default admin settings');
  } else {
    console.log('✅ Admin settings exist');
  }
}

/**
 * Add default token metadata if missing
 */
async function addDefaultTokenMetadataIfMissing(client) {
  console.log('Checking for token metadata...');
  
  const result = await client.query(`
    SELECT COUNT(*) FROM token_metadata;
  `);
  
  if (parseInt(result.rows[0].count) === 0) {
    console.log('Token metadata is missing, creating default entries...');
    
    await client.query(`
      INSERT INTO token_metadata (token_address, name, symbol, decimals, is_verified)
      VALUES
      ('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF', 'YOT Token', 'YOT', 9, true),
      ('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n', 'YOS Token', 'YOS', 9, true);
    `);
    
    console.log('✅ Created default token metadata entries');
  } else {
    console.log('✅ Token metadata exists');
  }
}

/**
 * Main function to repair the database
 */
async function repairDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database repair process...');
    
    // Get current schema
    const currentSchema = await getCurrentSchema(client);
    
    // Check for known issue with admin_settings column types
    if (currentSchema.admin_settings) {
      await fixAdminSettingsTypes(client);
    }
    
    // Check for sessions table issue
    if (!currentSchema.sessions || !currentSchema.sessions.columns.sess || currentSchema.sessions.columns.sess !== 'json') {
      await repairSessions(client);
    }
    
    // Add missing tables
    for (const table in expectedSchema) {
      if (!currentSchema[table]) {
        await createMissingTable(client, table);
      }
    }
    
    // After fixing missing tables, get updated schema
    const updatedSchema = await getCurrentSchema(client);
    
    // Collect all issues
    const allIssues = {};
    let totalIssues = 0;
    
    for (const table in expectedSchema) {
      const issues = validateTable(table, updatedSchema, expectedSchema);
      
      if (issues.length > 0) {
        allIssues[table] = issues;
        totalIssues += issues.length;
      }
    }
    
    if (totalIssues > 0) {
      console.log(`Found ${totalIssues} issues in the database schema:`);
      
      // Fix column issues
      for (const table in allIssues) {
        for (const issue of allIssues[table]) {
          if (issue.includes('Column') && issue.includes('missing')) {
            const column = issue.match(/'([^']+)' is missing/)[1];
            const dataType = expectedSchema[table].columns[column];
            await addMissingColumn(client, table, column, dataType);
          } else if (issue.includes('Column') && issue.includes('has type')) {
            const column = issue.match(/'([^']+)' in table/)[1];
            const expectedType = expectedSchema[table].columns[column];
            await fixColumnType(client, table, column, expectedType);
          } else if (issue.includes('Index') && issue.includes('missing')) {
            const index = issue.match(/'([^']+)' is missing/)[1];
            await addMissingIndex(client, table, index);
          }
        }
      }
    } else {
      console.log('No schema issues found');
    }
    
    // Add default data if missing
    await addDefaultAdminIfMissing(client);
    await addDefaultAdminSettingsIfMissing(client);
    await addDefaultTokenMetadataIfMissing(client);
    
    // Final validation
    console.log('\nPerforming final validation...');
    const finalSchema = await getCurrentSchema(client);
    let finalIssues = 0;
    
    for (const table in expectedSchema) {
      const issues = validateTable(table, finalSchema, expectedSchema);
      finalIssues += issues.length;
      
      if (issues.length > 0) {
        console.log(`❌ Table '${table}' still has issues:`, issues);
      }
    }
    
    if (finalIssues === 0) {
      console.log('✅ Database repair completed successfully!');
    } else {
      console.log(`⚠️ Database repair completed with ${finalIssues} remaining issues.`);
      console.log('Some issues may require manual intervention.');
    }
    
  } catch (err) {
    console.error('Error during database repair:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the repair function
repairDatabase().catch(err => {
  console.error('Database repair failed with error:', err);
  process.exit(1);
});