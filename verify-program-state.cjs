/**
 * Script to verify the program state for the multi-hub swap program
 */
const fs = require('fs');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');

// Load app config
const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
const { programId, programState, programAuthority, admin } = appConfig.solana.multiHubSwap;
const rpcUrl = appConfig.solana.rpcUrl;

// Connect to Solana
const connection = new Connection(rpcUrl, 'confirmed');

// Program IDs
const PROGRAM_ID = new PublicKey(programId);
const PROGRAM_STATE_ADDRESS = new PublicKey(programState);
const PROGRAM_AUTHORITY = new PublicKey(programAuthority);
const ADMIN_WALLET = new PublicKey(admin);

// Display details
console.log('=============================================');
console.log('Program State Verification');
console.log('=============================================');
console.log(`Network: ${appConfig.solana.network}`);
console.log(`RPC URL: ${rpcUrl}`);
console.log('\nAddresses:');
console.log(`Program ID: ${PROGRAM_ID.toBase58()}`);
console.log(`Program State: ${PROGRAM_STATE_ADDRESS.toBase58()}`);
console.log(`Program Authority: ${PROGRAM_AUTHORITY.toBase58()}`);
console.log(`Admin Wallet: ${ADMIN_WALLET.toBase58()}`);

// Derive PDAs for verification
function findProgramStateAddress() {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    PROGRAM_ID
  );
  return { pda, bump };
}

function findProgramAuthority() {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    PROGRAM_ID
  );
  return { pda, bump };
}

// Check PDAs against configuration
async function verifyProgramAddresses() {
  console.log('\nVerifying PDAs:');
  
  // Check program state
  const { pda: derivedState, bump: stateBump } = findProgramStateAddress();
  console.log(`\nProgram State:`);
  console.log(`  Config: ${PROGRAM_STATE_ADDRESS.toBase58()}`);
  console.log(`  Derived: ${derivedState.toBase58()} (bump: ${stateBump})`);
  
  if (derivedState.toBase58() === PROGRAM_STATE_ADDRESS.toBase58()) {
    console.log('  ✅ Program State address matches derived PDA');
  } else {
    console.log('  ❌ Program State address does not match derived PDA');
    console.log('  The config should be updated to use the correct PDA');
  }
  
  // Check program authority
  const { pda: derivedAuthority, bump: authorityBump } = findProgramAuthority();
  console.log(`\nProgram Authority:`);
  console.log(`  Config: ${PROGRAM_AUTHORITY.toBase58()}`);
  console.log(`  Derived: ${derivedAuthority.toBase58()} (bump: ${authorityBump})`);
  
  if (derivedAuthority.toBase58() === PROGRAM_AUTHORITY.toBase58()) {
    console.log('  ✅ Program Authority address matches derived PDA');
  } else {
    console.log('  ❌ Program Authority address does not match derived PDA');
    console.log('  The config should be updated to use the correct PDA');
  }
  
  // Verify if accounts exist on-chain
  console.log('\nChecking if accounts exist on-chain:');
  
  try {
    const programInfo = await connection.getAccountInfo(PROGRAM_ID);
    if (programInfo) {
      console.log(`✅ Program account exists (size: ${programInfo.data.length} bytes)`);
      console.log(`  Owner: ${programInfo.owner.toBase58()}`);
      console.log(`  Executable: ${programInfo.executable}`);
    } else {
      console.log('❌ Program account does not exist on chain!');
    }
  } catch (error) {
    console.log('❌ Failed to check program account:', error);
  }
  
  try {
    const stateInfo = await connection.getAccountInfo(PROGRAM_STATE_ADDRESS);
    if (stateInfo) {
      console.log(`✅ Program State account exists (size: ${stateInfo.data.length} bytes)`);
      console.log(`  Owner: ${stateInfo.owner.toBase58()}`);
      if (stateInfo.owner.toBase58() === PROGRAM_ID.toBase58()) {
        console.log('  ✅ Owner is the program - correct!');
      } else {
        console.log('  ❌ Owner is not the program - incorrect!');
      }
    } else {
      console.log('❌ Program State account does not exist on chain. It needs to be initialized.');
    }
  } catch (error) {
    console.log('❌ Failed to check program state account:', error);
  }
  
  try {
    const authorityInfo = await connection.getAccountInfo(PROGRAM_AUTHORITY);
    if (authorityInfo) {
      console.log(`❓ Program Authority account exists (size: ${authorityInfo.data.length} bytes)`);
      console.log(`  This is unusual as Authority is a PDA and should not have its own account.`);
    } else {
      console.log('✅ Program Authority PDA does not have its own account - this is normal.');
    }
  } catch (error) {
    console.log('❌ Failed to check program authority account:', error);
  }
}

// Main function
async function main() {
  try {
    // Verify program addresses
    await verifyProgramAddresses();
    
    console.log('\n=============================================');
    console.log('Verification complete.');
    console.log('=============================================');
  } catch (error) {
    console.error('Error during verification:', error);
  }
}

// Run the main function
main();