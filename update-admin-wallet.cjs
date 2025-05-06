/**
 * Script to update the admin wallet in the program state
 */
const { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  sendAndConfirmTransaction 
} = require('@solana/web3.js');
const fs = require('fs');

// Program configuration
const PROGRAM_ID = new PublicKey('FDKcjgPeqtGn4baGXvXVZLheLCPipTw4SzTgcEdnK91s');
const NEW_ADMIN_WALLET = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ');

// Load wallet from keypair file
function loadWalletFromFile() {
  try {
    // Try to load the program keypair
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
    PROGRAM_ID
  );
}

// Create the update admin instruction
function createUpdateAdminInstruction(
  currentAdmin,
  programState,
  newAdmin
) {
  // Prepare the data buffer with instruction ID for updating admin (9)
  const data = Buffer.alloc(33); // 1 byte for instruction ID + 32 bytes for new admin public key
  data.writeUint8(9, 0); // Instruction 9 = UpdateAdmin
  newAdmin.toBuffer().copy(data, 1); // Copy new admin pubkey to buffer

  return {
    keys: [
      { pubkey: currentAdmin, isSigner: true, isWritable: false }, // Current admin must sign
      { pubkey: programState, isSigner: false, isWritable: true }  // Program state will be updated
    ],
    programId: PROGRAM_ID,
    data
  };
}

// Main function to update the admin
async function updateAdminWallet() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const currentAdminWallet = loadWalletFromFile();
  
  console.log('Current Admin Wallet:', currentAdminWallet.publicKey.toBase58());
  console.log('New Admin Wallet:', NEW_ADMIN_WALLET.toBase58());
  
  // Get program state PDA
  const [programStatePDA, bump] = findProgramStateAddress();
  console.log('Program State PDA:', programStatePDA.toBase58(), 'with bump:', bump);
  
  // Create the update admin instruction
  const updateAdminIx = createUpdateAdminInstruction(
    currentAdminWallet.publicKey,
    programStatePDA,
    NEW_ADMIN_WALLET
  );
  
  // Create and sign transaction
  const transaction = new Transaction().add(updateAdminIx);
  
  // Set a valid blockhash and sign the transaction
  transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
  transaction.feePayer = currentAdminWallet.publicKey;
  
  try {
    console.log('Sending update admin transaction...');
    const signature = await sendAndConfirmTransaction(
      connection, 
      transaction, 
      [currentAdminWallet],
      { commitment: 'confirmed' }
    );
    
    console.log('Transaction successful!');
    console.log('Signature:', signature);
    console.log('Admin wallet updated successfully');
    
    // Verify the program state was updated
    const programStateAccount = await connection.getAccountInfo(programStatePDA);
    if (programStateAccount) {
      console.log('Program state account verified');
      
      // The first 32 bytes should be the admin wallet
      const adminFromState = new PublicKey(programStateAccount.data.slice(0, 32));
      console.log('Admin wallet in program state:', adminFromState.toBase58());
      
      if (adminFromState.equals(NEW_ADMIN_WALLET)) {
        console.log('Admin wallet successfully updated to:', NEW_ADMIN_WALLET.toBase58());
      } else {
        console.log('Admin wallet update did not succeed. Current admin in state:', adminFromState.toBase58());
      }
    } else {
      console.log('Program state account not found after update!');
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

// Run the update admin function
updateAdminWallet().then(() => {
  console.log('Update admin completed');
  process.exit(0);
}).catch(err => {
  console.error('Update admin failed:', err);
  process.exit(1);
});