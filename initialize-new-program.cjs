/**
 * Simple program initialization script for Multi-Hub Swap
 */
const { 
  Connection, 
  PublicKey, 
  Keypair, 
  SystemProgram,
  Transaction, 
  TransactionInstruction, 
  sendAndConfirmTransaction 
} = require('@solana/web3.js');

// Use Solana devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Program and token addresses - hardcoded for clarity
const PROGRAM_ID = new PublicKey('Js9TqdpLBsF7M64ra2mYNyfbPTWwTvBUNR85wsEoSKP');
const ADMIN_WALLET = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ');
const YOT_MINT = new PublicKey('9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw');
const YOS_MINT = new PublicKey('2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop');

// Calculate program PDAs
const [PROGRAM_STATE] = PublicKey.findProgramAddressSync(
  [Buffer.from('state')],
  PROGRAM_ID
);

const [PROGRAM_AUTHORITY] = PublicKey.findProgramAddressSync(
  [Buffer.from('authority')],
  PROGRAM_ID
);

console.log('==== PROGRAM INITIALIZATION ====');
console.log('Program ID:', PROGRAM_ID.toBase58());
console.log('Admin Wallet:', ADMIN_WALLET.toBase58());
console.log('Program State PDA:', PROGRAM_STATE.toBase58());
console.log('Program Authority PDA:', PROGRAM_AUTHORITY.toBase58());

async function initializeProgram() {
  try {
    // Generate a new keypair for the transaction
    const signer = Keypair.generate();
    console.log('Transaction Signer:', signer.publicKey.toBase58());
    
    // Request airdrop for transaction fees
    console.log('Requesting SOL airdrop...');
    const airdropSignature = await connection.requestAirdrop(
      signer.publicKey, 
      1000000000 // 1 SOL
    );
    await connection.confirmTransaction(airdropSignature);
    console.log('Airdrop confirmed');
    
    // Get discriminator for the initialize instruction
    const discriminator = Buffer.from([
      109, 97, 53, 115, 217, 210, 251, 183
    ]);
    
    // Create the initialization instruction
    const initializeIx = new TransactionInstruction({
      keys: [
        { pubkey: signer.publicKey, isSigner: true, isWritable: true },
        { pubkey: PROGRAM_STATE, isSigner: false, isWritable: true },
        { pubkey: PROGRAM_AUTHORITY, isSigner: false, isWritable: false },
        { pubkey: ADMIN_WALLET, isSigner: false, isWritable: false },
        { pubkey: YOT_MINT, isSigner: false, isWritable: false },
        { pubkey: YOS_MINT, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: discriminator
    });
    
    // Create and send transaction
    const transaction = new Transaction().add(initializeIx);
    transaction.feePayer = signer.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    console.log('Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [signer],
      { skipPreflight: true }
    );
    
    console.log('Transaction sent successfully!');
    console.log('Signature:', signature);
    
    // Check if initialization was successful
    const stateAccount = await connection.getAccountInfo(PROGRAM_STATE);
    if (stateAccount) {
      console.log('SUCCESS: Program state initialized!');
      console.log('State account size:', stateAccount.data.length, 'bytes');
      return true;
    } else {
      console.log('ERROR: Program state not found after initialization');
      return false;
    }
  } catch (error) {
    console.error('Initialization error:', error);
    return false;
  }
}

// Run the initialization
initializeProgram()
  .then(success => {
    console.log('Initialization complete. Success:', success);
    console.log('==================================');
  });