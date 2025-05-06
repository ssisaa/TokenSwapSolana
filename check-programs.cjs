/**
 * Script to check if the program ID exists and if its state is initialized
 */
const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');

// Load app config
const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
const solanaConfig = appConfig.solana;
const multiHubSwapConfig = solanaConfig.multiHubSwap;

// Constants
const RPC_URL = solanaConfig.rpcUrl;
const PROGRAM_ID = multiHubSwapConfig.programId;
const PROGRAM_STATE = multiHubSwapConfig.programState;
const PROGRAM_AUTHORITY = multiHubSwapConfig.programAuthority;
const ADMIN_WALLET = multiHubSwapConfig.admin;

// Set up connection
const connection = new Connection(RPC_URL, 'confirmed');

// Function to find PDAs
function findProgramStateAddress(programId) {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(programId)
  );
  return { pda: pda.toBase58(), bump };
}

function findProgramAuthority(programId) {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(programId)
  );
  return { pda: pda.toBase58(), bump };
}

// Main verification function
async function verifyProgramState() {
  try {
    console.log('====== PROGRAM VERIFICATION ======');
    console.log('Program ID:', PROGRAM_ID);
    console.log('Expected Program State:', PROGRAM_STATE);
    console.log('Expected Program Authority:', PROGRAM_AUTHORITY);
    console.log('Admin Wallet:', ADMIN_WALLET);
    
    // Check program exists
    const programInfo = await connection.getAccountInfo(new PublicKey(PROGRAM_ID));
    if (!programInfo) {
      console.log('❌ PROGRAM DOES NOT EXIST ON CHAIN!');
      return { exists: false };
    }
    
    console.log('✅ Program exists on chain');
    console.log('Program data size:', programInfo.data.length, 'bytes');
    
    // Check if state account exists
    const stateInfo = await connection.getAccountInfo(new PublicKey(PROGRAM_STATE));
    if (!stateInfo) {
      console.log('❌ Program state account does not exist!');
      
      // Calculate correct PDAs
      const { pda: calculatedState, bump: stateBump } = findProgramStateAddress(PROGRAM_ID);
      const { pda: calculatedAuthority, bump: authBump } = findProgramAuthority(PROGRAM_ID);
      
      console.log('Calculated Program State should be:', calculatedState);
      console.log('Calculated Program Authority should be:', calculatedAuthority);
      
      return { 
        exists: true, 
        stateExists: false,
        calculatedPDAs: {
          state: calculatedState,
          authority: calculatedAuthority
        }
      };
    }
    
    console.log('✅ Program state account exists');
    console.log('State data size:', stateInfo.data.length, 'bytes');
    
    // Basic data validation
    if (stateInfo.data.length < 32) {
      console.log('⚠️ WARNING: Program state data might be too short!');
    }
    
    return { 
      exists: true, 
      stateExists: true, 
      stateSize: stateInfo.data.length 
    };
    
  } catch (error) {
    console.error('Error during verification:', error);
    return { error: error.message };
  }
}

// Run verification
verifyProgramState()
  .then(result => {
    console.log('Verification result:', result);
    console.log('================================');
  })
  .catch(err => {
    console.error('Fatal error:', err);
  });