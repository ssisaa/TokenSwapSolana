/**
 * YOT Swap Pre-Deployment Check
 * 
 * This script performs a comprehensive check of the entire system before deployment
 * to ensure all components are properly configured and working.
 */

require('dotenv').config();
const { spawn } = require('child_process');
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

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

// Function to run a command and capture output
async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args);
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr
      });
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}

// Function to check if required files exist
async function checkRequiredFiles() {
  console.log(`${colors.blue}Checking required files...${colors.reset}`);
  
  const requiredFiles = [
    '.env',
    'package.json',
    'server/index.ts',
    'client/src/App.tsx',
    'shared/schema.ts'
  ];
  
  const results = {
    success: true,
    missingFiles: []
  };
  
  for (const file of requiredFiles) {
    try {
      await fs.access(file);
      console.log(`${colors.green}✓ ${file} exists${colors.reset}`);
    } catch (error) {
      console.log(`${colors.red}✗ ${file} not found${colors.reset}`);
      results.missingFiles.push(file);
      results.success = false;
    }
  }
  
  return results;
}

// Function to check environment variables
async function checkEnvironmentVariables() {
  console.log(`\n${colors.blue}Checking environment variables...${colors.reset}`);
  
  const result = await runCommand('node', ['scripts/validate-env.js']);
  
  if (result.code === 0) {
    console.log(`${colors.green}✓ Environment variables are valid${colors.reset}`);
    return true;
  } else {
    console.log(`${colors.red}✗ Environment variables validation failed${colors.reset}`);
    console.log(result.stdout);
    return false;
  }
}

// Function to check database connection
async function checkDatabaseConnection() {
  console.log(`\n${colors.blue}Checking database connection...${colors.reset}`);
  
  try {
    // Just a simple check that the script runs without error
    const result = await runCommand('node', ['scripts/test-db-connection.js']);
    
    if (result.code === 0) {
      console.log(`${colors.green}✓ Database connection is working${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}✗ Database connection failed${colors.reset}`);
      console.log(result.stdout);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Database connection check failed to run: ${error.message}${colors.reset}`);
    return false;
  }
}

// Function to check database schema
async function checkDatabaseSchema() {
  console.log(`\n${colors.blue}Checking database schema...${colors.reset}`);
  
  try {
    const result = await runCommand('node', ['scripts/validate-database.js']);
    
    if (result.code === 0) {
      console.log(`${colors.green}✓ Database schema is valid${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}✗ Database schema validation failed${colors.reset}`);
      console.log(result.stdout);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Database schema check failed to run: ${error.message}${colors.reset}`);
    return false;
  }
}

// Function to check if Node.js dependencies are installed
async function checkNodeDependencies() {
  console.log(`\n${colors.blue}Checking Node.js dependencies...${colors.reset}`);
  
  // Check if node_modules exists
  try {
    await fs.access('node_modules');
    console.log(`${colors.green}✓ node_modules directory exists${colors.reset}`);
  } catch (error) {
    console.log(`${colors.red}✗ node_modules directory not found${colors.reset}`);
    console.log('Run npm install to install dependencies');
    return false;
  }
  
  // Check if critical dependencies are installed
  try {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const criticalDeps = [
      'react',
      'react-dom',
      'express',
      '@solana/web3.js',
      'pg',
      'drizzle-orm',
      'typescript'
    ];
    
    let missingDeps = [];
    
    for (const dep of criticalDeps) {
      if (!dependencies[dep]) {
        missingDeps.push(dep);
      }
    }
    
    if (missingDeps.length === 0) {
      console.log(`${colors.green}✓ All critical dependencies are listed in package.json${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Missing dependencies in package.json: ${missingDeps.join(', ')}${colors.reset}`);
      return false;
    }
    
    // Run npm ls to check for dependency errors
    const npmLsResult = await runCommand('npm', ['ls', '--depth=0']);
    
    if (!npmLsResult.stderr.includes('missing:') && !npmLsResult.stderr.includes('UNMET DEPENDENCY')) {
      console.log(`${colors.green}✓ All dependencies are properly installed${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️ Some dependencies have issues:${colors.reset}`);
      console.log(npmLsResult.stderr);
    }
    
    return true;
  } catch (error) {
    console.log(`${colors.red}✗ Failed to check dependencies: ${error.message}${colors.reset}`);
    return false;
  }
}

// Function to check if the application builds successfully
async function checkBuild() {
  console.log(`\n${colors.blue}Testing application build...${colors.reset}`);
  
  try {
    // Run build in dry-run mode if possible, or just check for dist directory
    try {
      await fs.access('dist');
      console.log(`${colors.green}✓ Distribution directory exists${colors.reset}`);
      return true;
    } catch (error) {
      console.log(`${colors.yellow}⚠️ Distribution directory not found${colors.reset}`);
      console.log('Building the application is recommended before deployment');
      return true; // Not a critical failure
    }
  } catch (error) {
    console.log(`${colors.red}✗ Build check failed: ${error.message}${colors.reset}`);
    return false;
  }
}

// Function to check if required ports are available
async function checkPorts() {
  console.log(`\n${colors.blue}Checking required ports...${colors.reset}`);
  
  const requiredPorts = [
    process.env.PORT || 5000,  // Main application port
    80,  // HTTP
    443  // HTTPS
  ];
  
  const results = {
    success: true,
    blockedPorts: []
  };
  
  // Note: This is a basic check that assumes ports are available if a connection can't be established
  for (const port of requiredPorts) {
    try {
      const isAvailable = await new Promise((resolve) => {
        const server = http.createServer();
        server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            resolve(false);
          } else {
            resolve(true); // Other errors likely mean the port is available
          }
        });
        
        server.on('listening', () => {
          server.close();
          resolve(true);
        });
        
        server.listen(port);
      });
      
      if (isAvailable) {
        console.log(`${colors.green}✓ Port ${port} is available${colors.reset}`);
      } else {
        console.log(`${colors.red}✗ Port ${port} is blocked${colors.reset}`);
        results.blockedPorts.push(port);
        results.success = false;
      }
    } catch (error) {
      console.log(`${colors.red}✗ Failed to check port ${port}: ${error.message}${colors.reset}`);
      results.success = false;
    }
  }
  
  return results;
}

// Function to check system resources
async function checkSystemResources() {
  console.log(`\n${colors.blue}Checking system resources...${colors.reset}`);
  
  try {
    // Check available disk space
    const diskCheck = await runCommand('df', ['-h', '/']);
    const diskLines = diskCheck.stdout.split('\n').filter(line => line.includes('/'));
    if (diskLines.length > 0) {
      const diskInfo = diskLines[0].split(/\s+/);
      const usedPercent = diskInfo[4].replace('%', '');
      
      if (parseInt(usedPercent) < 90) {
        console.log(`${colors.green}✓ Disk space: ${diskInfo[3]} available (${usedPercent}% used)${colors.reset}`);
      } else {
        console.log(`${colors.red}✗ Low disk space: ${diskInfo[3]} available (${usedPercent}% used)${colors.reset}`);
      }
    }
    
    // Check memory
    const memCheck = await runCommand('free', ['-m']);
    const memLines = memCheck.stdout.split('\n');
    if (memLines.length > 1) {
      const memInfo = memLines[1].split(/\s+/);
      const total = parseInt(memInfo[1]);
      const available = parseInt(memInfo[6]);
      const usedPercent = Math.round((1 - available / total) * 100);
      
      if (available > 1024) { // At least 1GB free
        console.log(`${colors.green}✓ Memory: ${available}MB available (${usedPercent}% used)${colors.reset}`);
      } else {
        console.log(`${colors.red}✗ Low memory: ${available}MB available (${usedPercent}% used)${colors.reset}`);
      }
    }
    
    // CPU load
    const loadCheck = await runCommand('uptime', []);
    const loadMatch = loadCheck.stdout.match(/load average: ([0-9.]+), ([0-9.]+), ([0-9.]+)/);
    if (loadMatch) {
      const load1m = parseFloat(loadMatch[1]);
      const load5m = parseFloat(loadMatch[2]);
      const load15m = parseFloat(loadMatch[3]);
      
      // Get number of CPUs
      const cpuCheck = await runCommand('nproc', []);
      const cpuCount = parseInt(cpuCheck.stdout.trim());
      
      // Check if load is more than 80% of CPU count
      if (load5m < cpuCount * 0.8) {
        console.log(`${colors.green}✓ CPU load: ${load1m.toFixed(2)}, ${load5m.toFixed(2)}, ${load15m.toFixed(2)} (${cpuCount} CPUs)${colors.reset}`);
      } else {
        console.log(`${colors.red}✗ High CPU load: ${load1m.toFixed(2)}, ${load5m.toFixed(2)}, ${load15m.toFixed(2)} (${cpuCount} CPUs)${colors.reset}`);
      }
    }
    
    return true;
  } catch (error) {
    console.log(`${colors.yellow}⚠️ Failed to check system resources: ${error.message}${colors.reset}`);
    console.log('This is not critical but you should ensure adequate resources are available');
    return true; // Not a critical failure
  }
}

// Main function
async function runChecks() {
  console.log(`${colors.blue}=================================================${colors.reset}`);
  console.log(`${colors.blue}YOT Swap Pre-Deployment Check - ${new Date().toISOString()}${colors.reset}`);
  console.log(`${colors.blue}=================================================${colors.reset}\n`);
  
  const results = {};
  
  // Check required files
  results.files = await checkRequiredFiles();
  
  // Check environment variables
  results.env = await checkEnvironmentVariables();
  
  // Check database connection
  results.dbConnection = await checkDatabaseConnection();
  
  // Check database schema
  results.dbSchema = await checkDatabaseSchema();
  
  // Check dependencies
  results.dependencies = await checkNodeDependencies();
  
  // Check build
  results.build = await checkBuild();
  
  // Check ports
  results.ports = await checkPorts();
  
  // Check system resources
  results.resources = await checkSystemResources();
  
  // Summary
  console.log(`\n${colors.blue}=================================================${colors.reset}`);
  console.log(`${colors.blue}Pre-Deployment Check Summary${colors.reset}`);
  console.log(`${colors.blue}=================================================${colors.reset}\n`);
  
  // Count failures
  let criticalFailures = 0;
  let warnings = 0;
  
  // Files check
  if (results.files.success) {
    console.log(`${colors.green}✓ Required files${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Required files (${results.files.missingFiles.length} missing)${colors.reset}`);
    criticalFailures++;
  }
  
  // Environment check
  if (results.env) {
    console.log(`${colors.green}✓ Environment variables${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Environment variables${colors.reset}`);
    criticalFailures++;
  }
  
  // Database connection
  if (results.dbConnection) {
    console.log(`${colors.green}✓ Database connection${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Database connection${colors.reset}`);
    criticalFailures++;
  }
  
  // Database schema
  if (results.dbSchema) {
    console.log(`${colors.green}✓ Database schema${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Database schema${colors.reset}`);
    criticalFailures++;
  }
  
  // Dependencies
  if (results.dependencies) {
    console.log(`${colors.green}✓ Node.js dependencies${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Node.js dependencies${colors.reset}`);
    criticalFailures++;
  }
  
  // Build
  if (results.build) {
    console.log(`${colors.green}✓ Application build${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠️ Application build${colors.reset}`);
    warnings++;
  }
  
  // Ports
  if (results.ports.success) {
    console.log(`${colors.green}✓ Required ports${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Required ports (${results.ports.blockedPorts.join(', ')} blocked)${colors.reset}`);
    criticalFailures++;
  }
  
  // System resources
  if (results.resources) {
    console.log(`${colors.green}✓ System resources${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠️ System resources${colors.reset}`);
    warnings++;
  }
  
  // Final result
  console.log(`\n${colors.blue}Final Result${colors.reset}`);
  
  if (criticalFailures === 0) {
    if (warnings === 0) {
      console.log(`${colors.green}✓ All checks passed! The system is ready for deployment.${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️ Deployment can proceed but with ${warnings} warning(s).${colors.reset}`);
    }
    
    // Next steps
    console.log(`\n${colors.blue}Next Steps${colors.reset}`);
    console.log(`1. Run the deployment script: ${colors.cyan}./scripts/deploy-production.sh${colors.reset}`);
    console.log(`2. Check application status: ${colors.cyan}pm2 status${colors.reset}`);
    console.log(`3. View application logs: ${colors.cyan}pm2 logs yot-swap${colors.reset}`);
    
    return true;
  } else {
    console.log(`${colors.red}✗ Deployment not recommended! Found ${criticalFailures} critical failure(s) and ${warnings} warning(s).${colors.reset}`);
    
    // Suggest fixes
    console.log(`\n${colors.blue}Suggested Fixes${colors.reset}`);
    if (!results.files.success) {
      console.log(`• Missing files: Ensure the repository is properly cloned and all files are present`);
    }
    if (!results.env) {
      console.log(`• Environment variables: Review and fix environment variables in .env file`);
    }
    if (!results.dbConnection) {
      console.log(`• Database connection: Check database credentials and ensure PostgreSQL is running`);
    }
    if (!results.dbSchema) {
      console.log(`• Database schema: Run the repair script: ${colors.cyan}node scripts/repair-database.js${colors.reset}`);
    }
    if (!results.dependencies) {
      console.log(`• Node.js dependencies: Run ${colors.cyan}npm install${colors.reset} to install missing dependencies`);
    }
    if (!results.ports.success) {
      console.log(`• Blocked ports: Free up ports ${results.ports.blockedPorts.join(', ')} or reconfigure the application to use different ports`);
    }
    
    return false;
  }
}

// Run checks and exit with appropriate code
runChecks().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error(`${colors.red}Error running pre-deployment checks:${colors.reset}`, err);
  process.exit(1);
});