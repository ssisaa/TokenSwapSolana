/**
 * Script to read the multi-hub swap program state
 */
const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');

// Load app config
const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
const { programId, programState, admin } = appConfig.solana.multiHubSwap;
const rpcUrl = appConfig.solana.rpcUrl;
const connection = new Connection(rpcUrl, 'confirmed');

// Addresses
const PROGRAM_ID = new PublicKey(programId);
const PROGRAM_STATE = new PublicKey(programState);
const ADMIN_WALLET = new PublicKey(admin);

// Display config
console.log('=============================================');
console.log('Multi-Hub Swap Program State Read');
console.log('=============================================');
console.log('Program ID:', PROGRAM_ID.toBase58());
console.log('Program State:', PROGRAM_STATE.toBase58());
console.log('Admin Wallet in Config:', ADMIN_WALLET.toBase58());

// Read program state account
async function readProgramState() {
  try {
    const accountInfo = await connection.getAccountInfo(PROGRAM_STATE);
    
    if (!accountInfo) {
      console.log('Program state account does not exist');
      return;
    }
    
    console.log('\nProgram State Info:');
    console.log('- Owner:', accountInfo.owner.toBase58());
    console.log('- Data Length:', accountInfo.data.length, 'bytes');
    
    // First 8 bytes are typically a discriminator
    const discriminator = accountInfo.data.slice(0, 8);
    console.log('- Discriminator:', Buffer.from(discriminator).toString('hex'));
    
    // Try to parse admin wallet from data
    try {
      // Assuming the admin wallet is stored as a PublicKey (32 bytes) in the account data
      // The exact position depends on the account's schema, but it's often after the discriminator
      if (accountInfo.data.length >= 40) { // 8 (discriminator) + 32 (pubkey)
        const adminBytes = accountInfo.data.slice(8, 40);
        const adminPubkey = new PublicKey(adminBytes);
        console.log('- Admin Wallet (parsed):', adminPubkey.toBase58());
        
        if (adminPubkey.toBase58() === ADMIN_WALLET.toBase58()) {
          console.log('  ✅ Admin wallet in state matches config');
        } else {
          console.log('  ❌ Admin wallet in state does NOT match config');
          console.log('  Config has:', ADMIN_WALLET.toBase58());
          console.log('  State has:', adminPubkey.toBase58());
        }
      }
    } catch (error) {
      console.log('Error parsing admin wallet:', error.message);
    }
    
    // Try to dump the raw data for analysis (first 100 bytes)
    console.log('\nRaw Data (first 100 bytes):');
    const dataSlice = accountInfo.data.slice(0, Math.min(100, accountInfo.data.length));
    console.log(Buffer.from(dataSlice).toString('hex'));
  } catch (error) {
    console.error('Error reading program state:', error);
  }
}

// Main function
async function main() {
  console.log('\nReading program state...');
  await readProgramState();
  console.log('\n=============================================');
}

// Run the main function
main();