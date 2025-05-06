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

// User's wallet to set as the admin
const USER_ADMIN_WALLET = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ');

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
  signer,  // The wallet that signs the transaction
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
      { pubkey: signer, isSigner: true, isWritable: true },
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
  
  console.log('Signer Wallet:', wallet.publicKey.toBase58());
  console.log('Admin Wallet to be set:', USER_ADMIN_WALLET.toBase58());
  
  // Get program state PDA
  const [programStatePDA, bump] = findProgramStateAddress();
  console.log('Program State PDA:', programStatePDA.toBase58(), 'with bump:', bump);
  
  // Use the defined admin wallet as the liquidity wallet
  const liquidityWallet = USER_ADMIN_WALLET;
  console.log('Liquidity Wallet:', liquidityWallet.toBase58());
  
  // Create the initialization instruction with the wallet as signer but setting your wallet as admin
  // The signer has to match the one that will sign the transaction
  const initIx = createInitializeInstruction(
    wallet.publicKey, // The signer
    programStatePDA,
    liquidityWallet,
    YOT_TOKEN,
    YOS_TOKEN
  );
  
  // Modify the instruction data to include your admin wallet
  // This is a special case where we're initializing but want to set a different admin
  const adminBytes = ADMIN_WALLET.toBuffer();
  // Replace the first 32 bytes of the deserialized program state with your admin wallet
  initIx.data = Buffer.concat([
    Buffer.from([0]), // Instruction 0 = Initialize
    adminBytes,       // Admin wallet (first 32 bytes of program state)
    encodePublicKeys([YOT_TOKEN, YOS_TOKEN])
  ]);
  
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