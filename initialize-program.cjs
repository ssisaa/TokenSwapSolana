/**
 * Script to initialize the multi-hub swap program
 */
const { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  sendAndConfirmTransaction 
} = require('@solana/web3.js');
const fs = require('fs');

// Program and token configuration
const PROGRAM_ID = new PublicKey('FDKcjgPeqtGn4baGXvXVZLheLCPipTw4SzTgcEdnK91s');
const YOT_TOKEN = new PublicKey('9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw');
const YOS_TOKEN = new PublicKey('2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop');

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

// Create a specific admin wallet to use for the program
const ADMIN_WALLET = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ');

// Find program state address (PDA)
function findProgramStateAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    PROGRAM_ID
  );
}

// Encode an array of public keys into a buffer
function encodePublicKeys(keys) {
  const buffer = Buffer.alloc(32 * keys.length);
  keys.forEach((key, index) => {
    buffer.set(key.toBuffer(), index * 32);
  });
  return buffer;
}

// Create the initialization instruction
function createInitializeInstruction(
  admin,
  programState,
  liquidityWallet,
  yotMint,
  yosMint
) {
  // Prepare the data buffer with instruction ID and public keys
  const data = Buffer.concat([
    Buffer.from([0]), // Instruction 0 = Initialize
    encodePublicKeys([yotMint, yosMint])
  ]);
  
  return {
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: programState, isSigner: false, isWritable: true },
      { pubkey: liquidityWallet, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data
  };
}

// Main function to initialize the program
async function initializeProgram() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const wallet = loadWalletFromFile();
  
  console.log('Admin Wallet:', wallet.publicKey.toBase58());
  
  // Get program state PDA
  const [programStatePDA, bump] = findProgramStateAddress();
  console.log('Program State PDA:', programStatePDA.toBase58(), 'with bump:', bump);
  
  // Use admin wallet as the liquidity wallet for this example
  const liquidityWallet = wallet.publicKey;
  console.log('Liquidity Wallet:', liquidityWallet.toBase58());
  
  // Create the initialization instruction
  const initIx = createInitializeInstruction(
    wallet.publicKey,
    programStatePDA,
    liquidityWallet,
    YOT_TOKEN,
    YOS_TOKEN
  );
  
  // Create and sign transaction
  const transaction = new Transaction().add(initIx);
  
  // Set a valid blockhash and sign the transaction
  transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
  transaction.feePayer = wallet.publicKey;
  
  try {
    console.log('Sending initialization transaction...');
    const signature = await sendAndConfirmTransaction(
      connection, 
      transaction, 
      [wallet],
      { commitment: 'confirmed' }
    );
    
    console.log('Transaction successful!');
    console.log('Signature:', signature);
    console.log('Program initialized successfully');
    
    // Verify the program state was created
    const programStateAccount = await connection.getAccountInfo(programStatePDA);
    if (programStateAccount) {
      console.log('Program state account created with size:', programStateAccount.data.length, 'bytes');
    } else {
      console.log('Program state account not found after initialization!');
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

// Run the initialization
initializeProgram().then(() => {
  console.log('Initialization completed');
  process.exit(0);
}).catch(err => {
  console.error('Initialization failed:', err);
  process.exit(1);
});