/**
 * Script to update the app config to correctly reflect the current admin wallet
 */
const fs = require('fs');
const { PublicKey, Keypair } = require('@solana/web3.js');

// Admin wallet from program state (as detected in our previous script)
const PROGRAM_ADMIN_WALLET = new PublicKey('5rQzEXhDTYdyDftPmu4DiaLpZz4GePd2XumXYPHBSj6T');

// User wallet (kept in config for reference)
const USER_ADMIN_WALLET = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ');

// Load the keypair to confirm we have it
function loadAdminKeypair() {
  try {
    const secretKeyString = fs.readFileSync('./program-keypair.json', 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const keypair = Keypair.fromSecretKey(secretKey);
    
    console.log('Loaded admin keypair:', keypair.publicKey.toBase58());
    
    // Verify it matches the expected admin wallet
    if (keypair.publicKey.toBase58() === PROGRAM_ADMIN_WALLET.toBase58()) {
      console.log('✅ Keypair matches program admin wallet');
    } else {
      console.log('❌ Keypair does NOT match program admin wallet');
      console.log('  Expected:', PROGRAM_ADMIN_WALLET.toBase58());
      console.log('  Actual:', keypair.publicKey.toBase58());
    }
    
    return keypair;
  } catch (error) {
    console.error('Error loading admin keypair:', error);
    return null;
  }
}

// Update the app config with the correct admin wallet
function updateAppConfig() {
  try {
    // Read the current config
    const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
    
    // Save the current settings
    const currentAdmin = appConfig.solana.multiHubSwap.admin;
    console.log('Current admin in config:', currentAdmin);
    
    // Update with the actual admin wallet from program state
    appConfig.solana.multiHubSwap.admin = PROGRAM_ADMIN_WALLET.toBase58();
    
    // Add a note about the user's wallet for future reference
    appConfig.solana.multiHubSwap.userAdmin = USER_ADMIN_WALLET.toBase58();
    
    // Write the updated config
    fs.writeFileSync('./app.config.json', JSON.stringify(appConfig, null, 2));
    console.log('Updated app.config.json with correct admin wallet');
    
    return currentAdmin;
  } catch (error) {
    console.error('Error updating app config:', error);
    return null;
  }
}

// Main function
function main() {
  console.log('============================================');
  console.log('Fixing admin wallet configuration');
  console.log('============================================');
  
  // Load the admin keypair to verify we have it
  const adminKeypair = loadAdminKeypair();
  if (!adminKeypair) {
    console.error('Failed to load admin keypair. Cannot proceed.');
    return;
  }
  
  // Update the app config
  console.log('\nUpdating app config...');
  const previousAdmin = updateAppConfig();
  
  console.log('\nSummary:');
  console.log('------------');
  console.log('Previous admin in config:', previousAdmin);
  console.log('Program admin wallet (from on-chain state):', PROGRAM_ADMIN_WALLET.toBase58());
  console.log('User admin wallet (kept for reference):', USER_ADMIN_WALLET.toBase58());
  console.log('Admin keypair public key:', adminKeypair.publicKey.toBase58());
  console.log('\nConfig updated successfully. The application will now use the correct admin wallet.');
  console.log('============================================');
}

// Run the main function
main();