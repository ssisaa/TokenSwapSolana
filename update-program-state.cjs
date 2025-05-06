/**
 * Script to directly update the program state data using the program's authority
 */
const { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  TransactionInstruction,
  sendAndConfirmTransaction
} = require('@solana/web3.js');
const fs = require('fs');

// Program and wallet configuration
const PROGRAM_ID = new PublicKey('FDKcjgPeqtGn4baGXvXVZLheLCPipTw4SzTgcEdnK91s');
const USER_ADMIN_WALLET = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ');
const YOT_TOKEN = new PublicKey('9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw');
const YOS_TOKEN = new PublicKey('2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop');

// Function to find program state PDA
function findProgramStateAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    PROGRAM_ID
  );
}

// Function to find program authority PDA
function findProgramAuthority() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    PROGRAM_ID
  );
}

// Load wallet from keypair file
function loadWalletFromFile() {
  try {
    const secretKeyString = fs.readFileSync('program-keypair.json', 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error('Error loading wallet:', error);
    throw error;
  }
}

// Main function to update the program state
async function updateProgramState() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const wallet = loadWalletFromFile();
  
  console.log('Using wallet:', wallet.publicKey.toBase58());
  
  // Get program state PDA
  const [programStatePDA, stateBump] = findProgramStateAddress();
  console.log('Program State PDA:', programStatePDA.toBase58());
  
  // Get program authority PDA
  const [programAuthority, authorityBump] = findProgramAuthority();
  console.log('Program Authority PDA:', programAuthority.toBase58());

  // Step 1: Fetch the current account data
  const programStateAccount = await connection.getAccountInfo(programStatePDA);
  if (!programStateAccount) {
    console.error('Program state account not found!');
    return;
  }
  
  console.log('Current account data size:', programStateAccount.data.length, 'bytes');
  
  // Create a copy of the existing data
  const newData = Buffer.from(programStateAccount.data);
  
  // Step 2: Modify the first 32 bytes to set the admin wallet
  USER_ADMIN_WALLET.toBuffer().copy(newData, 0);
  
  // Create the instruction - using the REPAIR_STATE instruction (7) if it exists
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: programStatePDA, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: false }
    ],
    programId: PROGRAM_ID,
    data: Buffer.concat([
      Buffer.from([7]), // Instruction 7 = REPAIR_STATE or UPDATE_ADMIN
      newData.slice(0, 136) // Send the first 136 bytes which is the size of the program state
    ])
  });
  
  // Create transaction
  const transaction = new Transaction().add(instruction);
  transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
  transaction.feePayer = wallet.publicKey;
  
  try {
    console.log('Sending transaction to update program state...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: 'confirmed' }
    );
    
    console.log('✅ Transaction successful!');
    console.log('Signature:', signature);
    
    // Verify the update
    const updatedAccount = await connection.getAccountInfo(programStatePDA);
    const updatedAdmin = new PublicKey(updatedAccount.data.slice(0, 32));
    console.log('Updated admin wallet:', updatedAdmin.toBase58());
    
    if (updatedAdmin.equals(USER_ADMIN_WALLET)) {
      console.log('✅ Admin wallet successfully updated to your wallet!');
    } else {
      console.log('❌ Admin wallet update failed.');
    }
  } catch (error) {
    console.error('Transaction failed:', error);
    
    if (error.logs) {
      console.log('\nProgram logs:');
      error.logs.forEach(log => console.log(log));
    }
    
    // Try a more direct approach using instruction 6 (UpdateParameters)
    console.log('\nTrying alternative approach with UpdateParameters instruction...');
    
    // Fetch the current rates from the program state
    const lpContributionRate = programStateAccount.data.readBigUInt64LE(96);
    const adminFeeRate = programStateAccount.data.readBigUInt64LE(104);
    const yosCashbackRate = programStateAccount.data.readBigUInt64LE(112);
    const swapFeeRate = programStateAccount.data.readBigUInt64LE(120);
    const referralRate = programStateAccount.data.readBigUInt64LE(128);
    
    // Create buffer to encode the rates
    const ratesData = Buffer.alloc(40); // 5 * 8 bytes
    ratesData.writeBigUInt64LE(lpContributionRate, 0);
    ratesData.writeBigUInt64LE(adminFeeRate, 8);
    ratesData.writeBigUInt64LE(yosCashbackRate, 16);
    ratesData.writeBigUInt64LE(swapFeeRate, 24);
    ratesData.writeBigUInt64LE(referralRate, 32);
    
    // Create the update parameters instruction
    const updateParamsInstruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: programStatePDA, isSigner: false, isWritable: true },
        { pubkey: USER_ADMIN_WALLET, isSigner: false, isWritable: false }, // Try passing your wallet as an additional key
      ],
      programId: PROGRAM_ID,
      data: Buffer.concat([
        Buffer.from([6]), // Instruction 6 = UPDATE_PARAMETERS
        ratesData,
        USER_ADMIN_WALLET.toBuffer() // Add your wallet as admin at the end
      ])
    });
    
    // Create a new transaction
    const alternateTx = new Transaction().add(updateParamsInstruction);
    alternateTx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
    alternateTx.feePayer = wallet.publicKey;
    
    try {
      console.log('Sending alternative transaction...');
      const altSignature = await sendAndConfirmTransaction(
        connection,
        alternateTx,
        [wallet],
        { commitment: 'confirmed' }
      );
      
      console.log('✅ Alternative transaction successful!');
      console.log('Signature:', altSignature);
      
      // Verify the update
      const altUpdatedAccount = await connection.getAccountInfo(programStatePDA);
      const altUpdatedAdmin = new PublicKey(altUpdatedAccount.data.slice(0, 32));
      console.log('Updated admin wallet:', altUpdatedAdmin.toBase58());
      
      if (altUpdatedAdmin.equals(USER_ADMIN_WALLET)) {
        console.log('✅ Admin wallet successfully updated to your wallet!');
      } else {
        console.log('❌ Admin wallet update failed.');
      }
    } catch (altError) {
      console.error('Alternative transaction failed:', altError);
      
      if (altError.logs) {
        console.log('\nProgram logs:');
        altError.logs.forEach(log => console.log(log));
      }
    }
  }
}

// Run the update
updateProgramState().then(() => {
  console.log('Program state update attempt completed');
  process.exit(0);
}).catch(err => {
  console.error('Program state update failed:', err);
  process.exit(1);
});