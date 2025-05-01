/**
 * YOT Swap Environment Variables Validation
 * 
 * This script validates that all required environment variables are set
 * and have sensible values.
 */

require('dotenv').config();

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

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

function validateEnvironment() {
  console.log(`${colors.blue}Validating environment variables...${colors.reset}\n`);
  
  let errorCount = 0;
  let warningCount = 0;
  
  // Check for missing required variables
  const missingVars = [];
  
  for (const variable of requiredVars) {
    if (!process.env[variable]) {
      missingVars.push(variable);
      errorCount++;
    }
  }
  
  if (missingVars.length > 0) {
    console.log(`${colors.red}Missing required environment variables:${colors.reset}`);
    missingVars.forEach(variable => {
      console.log(`- ${variable}`);
    });
    console.log('\nMake sure these variables are defined in your .env file.');
  } else {
    console.log(`${colors.green}✓ All required environment variables are defined${colors.reset}`);
  }
  
  // Validate database connection string
  if (process.env.DATABASE_URL) {
    if (!process.env.DATABASE_URL.startsWith('postgresql://')) {
      console.log(`\n${colors.red}✗ DATABASE_URL must start with postgresql://${colors.reset}`);
      console.log(`Current value: ${process.env.DATABASE_URL}`);
      errorCount++;
    } else {
      console.log(`\n${colors.green}✓ DATABASE_URL format is valid${colors.reset}`);
    }
  }
  
  // Validate Solana addresses
  const addressVars = [
    'YOT_PROGRAM_ID',
    'YOT_TOKEN_ADDRESS', 
    'YOS_TOKEN_ADDRESS',
    'ADMIN_WALLET_ADDRESS'
  ];
  
  console.log('\nValidating Solana addresses:');
  for (const addressVar of addressVars) {
    if (process.env[addressVar]) {
      if (solanaAddressRegex.test(process.env[addressVar])) {
        console.log(`${colors.green}✓ ${addressVar}: ${process.env[addressVar]}${colors.reset}`);
      } else {
        console.log(`${colors.red}✗ ${addressVar} has invalid format: ${process.env[addressVar]}${colors.reset}`);
        errorCount++;
      }
    }
  }
  
  // Validate numeric values
  const numericVars = [
    'PROGRAM_SCALING_FACTOR',
    'YOS_WALLET_DISPLAY_ADJUSTMENT',
    'CONFIRMATION_COUNT'
  ];
  
  console.log('\nValidating numeric values:');
  for (const numVar of numericVars) {
    if (process.env[numVar]) {
      if (!isNaN(Number(process.env[numVar]))) {
        console.log(`${colors.green}✓ ${numVar}: ${process.env[numVar]}${colors.reset}`);
      } else {
        console.log(`${colors.red}✗ ${numVar} must be a number: ${process.env[numVar]}${colors.reset}`);
        errorCount++;
      }
    }
  }
  
  // Validate SESSION_SECRET length
  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32) {
      console.log(`\n${colors.yellow}⚠️ SESSION_SECRET is too short (${process.env.SESSION_SECRET.length} chars)${colors.reset}`);
      console.log('It should be at least 32 characters for security');
      warningCount++;
    } else {
      console.log(`\n${colors.green}✓ SESSION_SECRET length is good (${process.env.SESSION_SECRET.length} chars)${colors.reset}`);
    }
  }
  
  // Check for optional but recommended variables
  const recommendedVars = [
    'PORT',
    'NODE_ENV',
    'SOLANA_ENDPOINT'
  ];
  
  console.log('\nChecking recommended variables:');
  for (const variable of recommendedVars) {
    if (process.env[variable]) {
      console.log(`${colors.green}✓ ${variable}: ${process.env[variable]}${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️ ${variable} is not set (optional but recommended)${colors.reset}`);
      warningCount++;
    }
  }
  
  // Show NODE_ENV specific warnings
  if (process.env.NODE_ENV === 'production') {
    console.log('\nProduction environment detected:');
    
    // Check for secure SESSION_SECRET in production
    if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 64) {
      console.log(`${colors.yellow}⚠️ In production, SESSION_SECRET should be at least 64 chars${colors.reset}`);
      warningCount++;
    }
    
    // Check for devnet in production
    if (process.env.SOLANA_ENDPOINT && process.env.SOLANA_ENDPOINT.includes('devnet')) {
      console.log(`${colors.yellow}⚠️ Using Solana devnet in production environment${colors.reset}`);
      warningCount++;
    }
  }
  
  // Print summary
  console.log('\n' + '-'.repeat(50));
  console.log('Environment validation summary:');
  
  if (errorCount === 0 && warningCount === 0) {
    console.log(`${colors.green}✓ All checks passed! Environment is properly configured.${colors.reset}`);
  } else {
    if (errorCount > 0) {
      console.log(`${colors.red}✗ ${errorCount} error(s) found${colors.reset}`);
    }
    if (warningCount > 0) {
      console.log(`${colors.yellow}⚠️ ${warningCount} warning(s) found${colors.reset}`);
    }
  }
  
  return { success: errorCount === 0, errorCount, warningCount };
}

// Run validation
const result = validateEnvironment();

// Exit with appropriate code
process.exit(result.success ? 0 : 1);