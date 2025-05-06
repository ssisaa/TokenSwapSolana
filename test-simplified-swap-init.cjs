/**
 * Initialize the simplified swap program
 * 
 * This script sets up the program state for the simplified SOL to YOT swap.
 * It must be run by the admin after the program is deployed.
 */

const { 
  Keypair, 
  Connection, 
  PublicKey, 
  clusterApiUrl, 
  Transaction, 
  TransactionInstruction, 
  sendAndConfirmTransaction 
} = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Constants for initialization
const SIMPLIFIED_SWAP_PROGRAM_ID = 'SimpleSwapPDCsXVzAi7i2UmXt3VY6K79Po4wY3zLGwu'; // Will be updated by deploy script
const YOT_MINT = '9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw';
const YOS_MINT = '2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop';
const SOL_POOL_WALLET = 'Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH';
const YOT_POOL_TOKEN_ACCOUNT = 'EieVwYpDMdKr94iQygkyCeEBMhRWA4XsXyGumXztza74';
const COMMON_WALLET_ADDRESS = 'CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9';

// Distribution ratios
const SOL_DISTRIBUTION_RATIO = 80; // 80% to pool, 20% to common wallet
const YOT_DISTRIBUTION_RATIO = 80; // 80% to user, 20% to common wallet
const MIN_SOL_AMOUNT = 100000; // 0.0001 SOL in lamports

// Connect to Solana devnet
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// Load wallet from the keypair file
function loadWalletFromFile() {
  const keypairFile = path.resolve(process.cwd(), '.keypair-test.json');
  if (!fs.existsSync(keypairFile)) {
    console.error('Keypair file not found. Please create .keypair-test.json');
    process.exit(1);
  }
  
  const keypairData = JSON.parse(fs.readFileSync(keypairFile, 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Find program state PDA
function findProgramStateAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID)
  );
}

// Find program authority PDA
function findProgramAuthorityAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID)
  );
}

// Create instruction data for Initialize
function createInitializeInstructionData() {
  const buffer = Buffer.alloc(1 + 1 + 1 + 8); // 1 + 1 + 1 + 8 bytes
  
  // Instruction index (0 for Initialize)
  buffer.writeUInt8(0, 0);
  
  // SOL distribution ratio (80%)
  buffer.writeUInt8(SOL_DISTRIBUTION_RATIO, 1);
  
  // YOT distribution ratio (80%)
  buffer.writeUInt8(YOT_DISTRIBUTION_RATIO, 2);
  
  // Minimum SOL amount (0.0001 SOL)
  buffer.writeBigUInt64LE(BigInt(MIN_SOL_AMOUNT), 3);
  
  return buffer;
}

// Initialize the program
async function initializeProgram() {
  try {
    console.log('Initializing simplified swap program...');
    
    // Load wallet
    const wallet = loadWalletFromFile();
    console.log(`Using admin wallet: ${wallet.publicKey.toString()}`);
    
    // Get program PDAs
    const [programStatePda, _] = findProgramStateAddress();
    const [programAuthorityPda, __] = findProgramAuthorityAddress();
    
    console.log('Program PDAs:');
    console.log(`Program State PDA: ${programStatePda.toString()}`);
    console.log(`Program Authority PDA: ${programAuthorityPda.toString()}`);
    
    // Create the initialization instruction
    const instructionData = createInitializeInstructionData();
    
    const initializeInstruction = new TransactionInstruction({
      programId: new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID),
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: programStatePda, isSigner: false, isWritable: true },
        { pubkey: programAuthorityPda, isSigner: false, isWritable: false },
        { pubkey: new PublicKey(YOT_MINT), isSigner: false, isWritable: false },
        { pubkey: new PublicKey(YOS_MINT), isSigner: false, isWritable: false },
        { pubkey: new PublicKey(COMMON_WALLET_ADDRESS), isSigner: false, isWritable: false },
        { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // System program
      ],
      data: instructionData,
    });
    
    // Create transaction
    const transaction = new Transaction().add(initializeInstruction);
    transaction.feePayer = wallet.publicKey;
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: 'confirmed' }
    );
    
    console.log('Initialization transaction sent successfully!');
    console.log(`Transaction signature: ${signature}`);
    console.log(`View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    console.log('\nProgram initialized with the following parameters:');
    console.log(`SOL distribution ratio: ${SOL_DISTRIBUTION_RATIO}%`);
    console.log(`YOT distribution ratio: ${YOT_DISTRIBUTION_RATIO}%`);
    console.log(`Minimum SOL amount: ${MIN_SOL_AMOUNT} lamports`);
    
  } catch (error) {
    console.error('Error initializing program:', error);
  }
}

// Run the initialization
initializeProgram();