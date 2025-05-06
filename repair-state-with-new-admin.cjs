/**
 * Script to repair and initialize the program state with new admin
 * This approach tries to modify the program state data with 
 * a transaction that preserves all existing state while updating the admin
 */
const { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  TransactionInstruction, 
  SystemProgram,
  sendAndConfirmTransaction 
} = require('@solana/web3.js');
const fs = require('fs');

// Configuration 
const PROGRAM_ID = new PublicKey('FDKcjgPeqtGn4baGXvXVZLheLCPipTw4SzTgcEdnK91s');
const NEW_ADMIN_WALLET = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ');
const YOT_TOKEN = new PublicKey('9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw');
const YOS_TOKEN = new PublicKey('2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop');

// PDAs
function findProgramStateAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    PROGRAM_ID
  );
}

function findProgramAuthority() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    PROGRAM_ID
  );
}

// Load wallet
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

// Create repair instruction with new admin
async function createRepairStateInstruction(
  wallet,
  programState,
  programAuthority,
  newAdmin,
  rates = null,
) {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Get current state to preserve non-admin values
  const programStateAccount = await connection.getAccountInfo(programState);
  if (!programStateAccount) {
    throw new Error('Program state account not found');
  }
  
  // If rates not provided, extract from existing state
  if (!rates) {
    rates = {
      lpContributionRate: programStateAccount.data.readBigUInt64LE(96),
      adminFeeRate: programStateAccount.data.readBigUInt64LE(104),
      yosCashbackRate: programStateAccount.data.readBigUInt64LE(112),
      swapFeeRate: programStateAccount.data.readBigUInt64LE(120),
      referralRate: programStateAccount.data.readBigUInt64LE(128)
    };
  }
  
  console.log('Using rates from existing state:');
  console.log('- LP Contribution Rate:', rates.lpContributionRate.toString());
  console.log('- Admin Fee Rate:', rates.adminFeeRate.toString());
  console.log('- YOS Cashback Rate:', rates.yosCashbackRate.toString());
  console.log('- Swap Fee Rate:', rates.swapFeeRate.toString());
  console.log('- Referral Rate:', rates.referralRate.toString());

  // Get YOT and YOS mints from existing state
  const yotMint = new PublicKey(programStateAccount.data.slice(32, 64));
  const yosMint = new PublicKey(programStateAccount.data.slice(64, 96));
  
  console.log('YOT Mint from state:', yotMint.toBase58());
  console.log('YOS Mint from state:', yosMint.toBase58());
  
  // Create instruction data with the new admin but preserving all other fields
  const data = Buffer.alloc(137); // 1 byte for instruction ID + 3 * 32 bytes for pubkeys + 5 * 8 bytes for rates
  
  // Instruction ID (6 for UpdateParameters)
  data.writeUint8(6, 0);
  
  // Set the rates exactly as they are to avoid changes
  const offset = 1; // After instruction ID
  data.writeBigUInt64LE(rates.lpContributionRate, offset);
  data.writeBigUInt64LE(rates.adminFeeRate, offset + 8);
  data.writeBigUInt64LE(rates.yosCashbackRate, offset + 16);
  data.writeBigUInt64LE(rates.swapFeeRate, offset + 24);
  data.writeBigUInt64LE(rates.referralRate, offset + 32);
  
  // Add another instruction called UpdateAdmin (instruction 8)
  const updateAdminData = Buffer.alloc(33); // 1 byte for instruction ID + 32 bytes for admin pubkey
  updateAdminData.writeUint8(8, 0);
  newAdmin.toBuffer().copy(updateAdminData, 1);
  
  return [
    new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: programState, isSigner: false, isWritable: true },
      ],
      programId: PROGRAM_ID,
      data: data,
    }),
    // Add a second instruction in case there's a special undocumented one
    new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: programState, isSigner: false, isWritable: true },
        { pubkey: programAuthority, isSigner: false, isWritable: false },
        { pubkey: newAdmin, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: updateAdminData,
    })
  ];
}

// Main function
async function repairProgramStateWithNewAdmin() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const wallet = loadWalletFromFile();
  
  console.log('Current wallet:', wallet.publicKey.toBase58());
  console.log('New admin wallet to set:', NEW_ADMIN_WALLET.toBase58());
  
  const [programState, stateBump] = findProgramStateAddress();
  const [programAuthority, authorityBump] = findProgramAuthority();
  
  console.log('Program State PDA:', programState.toBase58());
  console.log('Program Authority PDA:', programAuthority.toBase58());
  
  try {
    console.log('Creating state repair instructions...');
    const instructions = await createRepairStateInstruction(
      wallet,
      programState,
      programAuthority,
      NEW_ADMIN_WALLET
    );
    
    // Try with each instruction separately
    for (let i = 0; i < instructions.length; i++) {
      const transaction = new Transaction().add(instructions[i]);
      transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
      transaction.feePayer = wallet.publicKey;
      
      try {
        console.log(`\nSending instruction ${i + 1}...`);
        const signature = await sendAndConfirmTransaction(
          connection, 
          transaction, 
          [wallet],
          { commitment: 'confirmed' }
        );
        
        console.log('Transaction successful!');
        console.log('Signature:', signature);
      } catch (error) {
        console.error(`Error with instruction ${i + 1}:`, error.message);
        
        if (error.logs) {
          console.log('\nTransaction logs:');
          error.logs.forEach(log => console.log(log));
        }
      }
    }
    
    // Verify if update was successful
    const updatedAccount = await connection.getAccountInfo(programState);
    const updatedAdmin = new PublicKey(updatedAccount.data.slice(0, 32));
    console.log('\nVerifying result...');
    console.log('Current admin wallet in state:', updatedAdmin.toBase58());
    
    if (updatedAdmin.equals(NEW_ADMIN_WALLET)) {
      console.log('✅ Admin wallet successfully updated to the new wallet!');
    } else {
      console.log('❌ Admin wallet update failed. Still using the old admin wallet.');
    }
  } catch (error) {
    console.error('Error during program state repair:', error);
  }
}

// Run the repair function
repairProgramStateWithNewAdmin().then(() => {
  console.log('Program state repair completed');
  process.exit(0);
}).catch(err => {
  console.error('Program state repair failed:', err);
  process.exit(1);
});