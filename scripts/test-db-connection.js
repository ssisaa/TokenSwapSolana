/**
 * YOT Swap Database Connection Test
 * 
 * This script tests the connection to the PostgreSQL database and verifies
 * that the database is properly configured with sufficient permissions.
 */

const { Pool } = require('pg');
require('dotenv').config();

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Connection config from environment variables
const connectionConfig = {
  connectionString: process.env.DATABASE_URL,
  // Individual connection parameters (fallbacks if DATABASE_URL is not set)
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE
};

async function testDatabaseConnection() {
  console.log(`${colors.blue}Testing PostgreSQL database connection...${colors.reset}`);
  
  // Display connection info (hide password)
  const displayConfig = { ...connectionConfig };
  delete displayConfig.password;
  if (displayConfig.connectionString) {
    displayConfig.connectionString = displayConfig.connectionString.replace(/:[^:@]*@/, ':****@');
  }
  console.log('Connection config:', displayConfig);
  
  const startTime = Date.now();
  let pool;
  
  try {
    // Create connection pool
    pool = new Pool(connectionConfig);
    
    // Test basic connection
    const versionResult = await pool.query('SELECT version()');
    console.log(`\n${colors.green}✓ Connection successful!${colors.reset}`);
    console.log(`PostgreSQL Version: ${versionResult.rows[0].version}`);
    
    // Test write permissions with a temporary table
    try {
      console.log(`\n${colors.blue}Testing database permissions...${colors.reset}`);
      
      // Create temp table
      await pool.query(`
        CREATE TEMPORARY TABLE _db_test (
          id SERIAL PRIMARY KEY,
          test_value TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Insert test data
      await pool.query(`
        INSERT INTO _db_test (test_value) VALUES ($1)
      `, ['Connection test']);
      
      // Read back data
      const readResult = await pool.query('SELECT * FROM _db_test');
      
      console.log(`${colors.green}✓ Write permissions confirmed${colors.reset}`);
      console.log('Test data:', readResult.rows[0]);
      
      // Drop the temp table
      await pool.query('DROP TABLE _db_test');
      console.log(`${colors.green}✓ DROP TABLE permissions confirmed${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}✗ Permission test failed:${colors.reset}`, error.message);
      console.log(`\n${colors.yellow}⚠️ This may indicate insufficient database privileges.${colors.reset}`);
      console.log('Make sure your database user has sufficient permissions:');
      console.log('sudo -u postgres psql -c "ALTER USER your_user WITH SUPERUSER;"');
      return false;
    }
    
    // Test pgcrypto extension (needed for hashing)
    try {
      console.log(`\n${colors.blue}Testing pgcrypto extension...${colors.reset}`);
      await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
      const digest = await pool.query("SELECT encode(digest('test', 'sha256'), 'hex') as hash");
      console.log(`${colors.green}✓ pgcrypto extension is available${colors.reset}`);
      console.log('Test hash:', digest.rows[0].hash);
    } catch (error) {
      console.error(`${colors.red}✗ pgcrypto extension test failed:${colors.reset}`, error.message);
      console.log(`\n${colors.yellow}⚠️ The pgcrypto extension is needed for password hashing.${colors.reset}`);
      console.log('Install PostgreSQL contrib package:');
      console.log('sudo apt install -y postgresql-contrib');
      return false;
    }
    
    // Get database stats
    try {
      console.log(`\n${colors.blue}Checking database statistics...${colors.reset}`);
      
      // Database size
      const sizeResult = await pool.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);
      console.log(`Database size: ${sizeResult.rows[0].size}`);
      
      // Table count
      const tableCountResult = await pool.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      console.log(`Public tables: ${tableCountResult.rows[0].count}`);
      
      if (parseInt(tableCountResult.rows[0].count) === 0) {
        console.log(`${colors.yellow}⚠️ No tables found in the database${colors.reset}`);
        console.log('Run the database setup script to create tables:');
        console.log('node scripts/setup-database.js');
      }
    } catch (error) {
      console.error(`${colors.red}✗ Failed to get database statistics:${colors.reset}`, error.message);
    }
    
    // Check session storage compatibility
    try {
      console.log(`\n${colors.blue}Testing session table compatibility...${colors.reset}`);
      
      // Check if sessions table exists
      const sessionTableResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'sessions'
        ) as exists
      `);
      
      if (sessionTableResult.rows[0].exists) {
        // Check sessions table structure
        const sessionColumnsResult = await pool.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'sessions'
          ORDER BY ordinal_position
        `);
        
        console.log('Sessions table structure:');
        sessionColumnsResult.rows.forEach(col => {
          console.log(`- ${col.column_name}: ${col.data_type}`);
        });
        
        // Check for required columns
        const hasRequiredColumns = sessionColumnsResult.rows.some(col => col.column_name === 'sid' && col.data_type === 'character varying') &&
                                   sessionColumnsResult.rows.some(col => col.column_name === 'sess' && col.data_type === 'json') &&
                                   sessionColumnsResult.rows.some(col => col.column_name === 'expire' && col.data_type.includes('timestamp'));
        
        if (hasRequiredColumns) {
          console.log(`${colors.green}✓ Sessions table has correct structure${colors.reset}`);
        } else {
          console.log(`${colors.yellow}⚠️ Sessions table has incorrect structure${colors.reset}`);
          console.log('Run the session repair script:');
          console.log('node scripts/repair-database.js');
        }
      } else {
        console.log(`${colors.yellow}⚠️ Sessions table not found${colors.reset}`);
        console.log('This will be created automatically by the application');
      }
    } catch (error) {
      console.error(`${colors.red}✗ Failed to check session compatibility:${colors.reset}`, error.message);
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`\n${colors.green}✓ All database tests completed successfully in ${elapsed}ms${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Database connection failed:${colors.reset}`, error.message);
    
    // Provide helpful troubleshooting tips based on error
    console.log('\nTroubleshooting tips:');
    
    if (error.code === 'ECONNREFUSED') {
      console.log('1. Check if PostgreSQL is running:');
      console.log('   sudo systemctl status postgresql');
      console.log('2. Make sure PostgreSQL is listening on the specified host/port');
      console.log('3. Check firewall settings');
    } else if (error.code === '28P01') {
      console.log('1. Authentication failed - check username and password');
      console.log('2. Verify the connection string in your .env file');
    } else if (error.code === '3D000') {
      console.log('1. Database does not exist - create it first:');
      console.log('   sudo -u postgres psql -c "CREATE DATABASE your_database;"');
    } else if (error.code === '42P01') {
      console.log('1. Table does not exist - run the setup script:');
      console.log('   node scripts/setup-database.js');
    } else {
      console.log('1. Check if PostgreSQL is installed and running');
      console.log('2. Verify environment variables in .env file');
      console.log('3. Ensure database user has proper permissions');
    }
    
    return false;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

testDatabaseConnection().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});