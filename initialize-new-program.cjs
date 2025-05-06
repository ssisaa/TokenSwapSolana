/**
 * Script to initialize the new multi-hub swap program deployment
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

// Program and token configuration - will be updated from file
let PROGRAM_ID;
const YOT_TOKEN = new PublicKey('9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw');
const YOS_TOKEN = new PublicKey('2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop');

// Set your wallet as the admin
const USER_ADMIN_WALLET = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ');

// Load deployment wallet from keypair file
function loadDeploymentWallet() {
  try {
    // Load the new program keypair for deployment
    const secretKeyString = fs.readFileSync('./temp/new-program-keypair.json', 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const keypair = Keypair.fromSecretKey(secretKey);
    
    // Update the global PROGRAM_ID
    PROGRAM_ID = keypair.publicKey;
    console.log('New Program ID:', PROGRAM_ID.toBase58());
    
    return keypair;
  } catch (error) {
    console.error('Error loading deployment wallet:', error);
    throw error;
  }
}

// Find program state address (PDA)
function findProgramStateAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    PROGRAM_ID
  );
}

// Find program authority (PDA)
function findProgramAuthority() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
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
  signer, // The wallet that will sign the transaction
  adminWallet, // The wallet to set as admin in the program state
  programState,
  systemProgram
) {
  // Create a custom data buffer that includes the admin wallet at the beginning
  // This is a special case where we set a different wallet as admin than the signer
  const data = Buffer.concat([
    Buffer.from([0]), // Instruction 0 = Initialize
    adminWallet.toBuffer(), // Manually inject admin wallet into data
    encodePublicKeys([YOT_TOKEN, YOS_TOKEN])
  ]);
  
  return {
    keys: [
      { pubkey: signer, isSigner: true, isWritable: true }, // The signer
      { pubkey: programState, isSigner: false, isWritable: true },
      { pubkey: systemProgram, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data
  };
}

// Function to update app.config.json with the new program ID
function updateAppConfig() {
  try {
    // Read the current config
    const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
    
    // Save the old program ID
    const oldProgramId = appConfig.MULTI_HUB_SWAP_PROGRAM_ID;
    console.log('Previous Program ID:', oldProgramId);
    
    // Update with the new program ID
    appConfig.MULTI_HUB_SWAP_PROGRAM_ID = PROGRAM_ID.toBase58();
    
    // Write back to file
    fs.writeFileSync('./app.config.json', JSON.stringify(appConfig, null, 2));
    console.log('Updated app.config.json with new Program ID');
    
    return oldProgramId;
  } catch (error) {
    console.error('Error updating app config:', error);
    throw error;
  }
}

// Main function to initialize the program
async function initializeProgram() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const wallet = loadDeploymentWallet();
  
  // Update app config with new program ID
  const oldProgramId = updateAppConfig();
  
  console.log('Deployment Wallet:', wallet.publicKey.toBase58());
  console.log('Admin Wallet to be set:', USER_ADMIN_WALLET.toBase58());
  
  // Get program state PDA
  const [programStatePDA, stateBump] = findProgramStateAddress();
  console.log('Program State PDA:', programStatePDA.toBase58(), 'with bump:', stateBump);
  
  // Get program authority PDA
  const [programAuthority, authBump] = findProgramAuthority();
  console.log('Program Authority PDA:', programAuthority.toBase58(), 'with bump:', authBump);
  
  // Create the initialization instruction
  const initIx = createInitializeInstruction(
    wallet.publicKey, // The signer wallet
    USER_ADMIN_WALLET, // Set your wallet as admin
    programStatePDA,
    SystemProgram.programId
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
      
      // Display the admin wallet from the program state
      const adminWallet = new PublicKey(programStateAccount.data.slice(0, 32));
      console.log('Admin wallet in program state:', adminWallet.toBase58());
      
      if (adminWallet.equals(USER_ADMIN_WALLET)) {
        console.log('✅ Admin wallet correctly set to your wallet');
      } else {
        console.log('❌ Admin wallet mismatch - check initialization logic');
      }
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
    
    // Revert config changes on failure
    try {
      const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
      appConfig.MULTI_HUB_SWAP_PROGRAM_ID = oldProgramId;
      fs.writeFileSync('./app.config.json', JSON.stringify(appConfig, null, 2));
      console.log('Reverted app.config.json changes due to initialization failure');
    } catch (configError) {
      console.error('Error reverting config changes:', configError);
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