/**
 * Test script for repairing the program state
 * This will call the new instruction #6 that fixes the program state structure without reinitializing
 */
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
const fs = require('fs');

// Program and token configuration
const MULTI_HUB_SWAP_PROGRAM_ID = new PublicKey('FDKcjgPeqtGn4baGXvXVZLheLCPipTw4SzTgcEdnK91s');
const POOL_AUTHORITY = new PublicKey('CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9');
const SOL_TOKEN_ACCOUNT = new PublicKey('Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH');
const YOT_TOKEN = new PublicKey('9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw');
const YOT_TOKEN_ACCOUNT = new PublicKey('EieVwYpDMdKr94iQygkyCeEBMhRWA4XsXyGumXztza74');
const YOS_TOKEN = new PublicKey('2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop');
const YOS_TOKEN_ACCOUNT = new PublicKey('7GnphdpgcV5Z8swNAFZ8QkMdo43TPHa4SmdtUw1ApMxz');

// Load wallet from keypair file
function loadWalletFromFile() {
  try {
    // Try to load the program keypair for admin access
    try {
      const secretKeyString = fs.readFileSync('program-keypair.json', 'utf8');
      const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
      return Keypair.fromSecretKey(secretKey);
    } catch (err) {
      console.log('Could not load program keypair, generating new keypair for testing only');
      return Keypair.generate();
    }
  } catch (error) {
    console.error('Error loading wallet:', error);
    throw error;
  }
}

// Find program state address (PDA)
function findProgramStateAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
}

// Encode a 64-bit unsigned integer in little-endian format
function encodeU64(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

// Create the repair program state instruction
function createRepairProgramStateInstruction(
  admin,
  programState,
  liquidityWallet,
  lpContributionRate = 20,
  yosCashbackRate = 5,
  adminFeeRate = 0,
  swapFeeRate = 1,
  referralRate = 0,
  liquidityThreshold = 100000000 // 0.1 SOL
) {
  const dataLayout = Buffer.alloc(49); // 1 + 8*6 bytes
  
  // Instruction 6 = repair program state
  dataLayout[0] = 6;
  
  // Pack all the parameters
  encodeU64(lpContributionRate).copy(dataLayout, 1);
  encodeU64(yosCashbackRate).copy(dataLayout, 9);
  encodeU64(adminFeeRate).copy(dataLayout, 17);
  encodeU64(swapFeeRate).copy(dataLayout, 25);
  encodeU64(referralRate).copy(dataLayout, 33);
  encodeU64(liquidityThreshold).copy(dataLayout, 41);
  
  return {
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: programState, isSigner: false, isWritable: true },
      { pubkey: liquidityWallet, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: MULTI_HUB_SWAP_PROGRAM_ID,
    data: dataLayout
  };
}

// Main function to repair program state
async function testRepairProgramState() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const wallet = loadWalletFromFile();
  
  // Get program state PDA
  const [programStatePDA, _] = findProgramStateAddress();
  
  console.log('Program State PDA:', programStatePDA.toBase58());
  
  // Check if program state account exists
  const programStateAccount = await connection.getAccountInfo(programStatePDA);
  
  if (!programStateAccount) {
    console.error('Program state account not found!');
    return;
  }
  
  console.log('Program state data length:', programStateAccount.data.length);
  
  // Choose central liquidity wallet (can be any wallet you control)
  const centralLiquidityWallet = wallet.publicKey;
  
  console.log('Preparing to repair program state...');
  console.log('Using parameters:');
  console.log('- LP contribution rate: 20%');
  console.log('- YOS cashback rate: 5%');
  console.log('- Admin fee rate: 0%');
  console.log('- Swap fee rate: 1%');
  console.log('- Referral rate: 0%');
  console.log('- Liquidity wallet:', centralLiquidityWallet.toBase58());
  console.log('- Liquidity threshold: 0.1 SOL (100,000,000 lamports)');

  // Create the repair instruction
  const repairIx = createRepairProgramStateInstruction(
    wallet.publicKey,
    programStatePDA,
    centralLiquidityWallet,
    20,  // LP contribution rate: 20%
    5,   // YOS cashback rate: 5%
    0,   // Admin fee: 0%
    1,   // Swap fee: 1% 
    0,   // Referral rate: 0%
    100000000  // Liquidity threshold: 0.1 SOL
  );
  
  // Create and sign transaction
  const transaction = new Transaction().add(repairIx);
  
  // Set a valid blockhash and sign the transaction
  transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
  transaction.feePayer = wallet.publicKey;
  
  try {
    console.log('Sending repair program state transaction...');
    const signature = await sendAndConfirmTransaction(
      connection, 
      transaction, 
      [wallet],
      { commitment: 'confirmed' }
    );
    
    console.log('Transaction successful!');
    console.log('Signature:', signature);
    console.log('Program state repaired successfully');
    
    // Verify the program state was repaired
    const updatedProgramState = await connection.getAccountInfo(programStatePDA);
    if (updatedProgramState) {
      console.log('Updated program state data length:', updatedProgramState.data.length);
    }
    
  } catch (error) {
    console.error('Transaction failed:', error);
    
    // Try to extract the program log messages for more information
    if (error.logs) {
      console.log('\nProgram logs:');
      error.logs.forEach(log => console.log(log));
    }
  }
}

// Run the test
testRepairProgramState().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});