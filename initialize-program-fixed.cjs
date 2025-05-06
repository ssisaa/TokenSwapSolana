/**
 * Simple program state initialization script
 * For Multi-Hub Swap Program ID: Js9TqdpLBsF7M64ra2mYNyfbPTWwTvBUNR85wsEoSKP
 */
const { 
  Connection, 
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  sendAndConfirmTransaction 
} = require('@solana/web3.js');
const fs = require('fs');

// Set up connection to Solana
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Program ID
const PROGRAM_ID = new PublicKey('Js9TqdpLBsF7M64ra2mYNyfbPTWwTvBUNR85wsEoSKP');
// Admin wallet
const ADMIN_WALLET = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ');
// Token mints
const YOT_MINT = new PublicKey('9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw');
const YOS_MINT = new PublicKey('2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop');

// Find PDAs
const [PROGRAM_STATE, STATE_BUMP] = PublicKey.findProgramAddressSync(
  [Buffer.from('state')],
  PROGRAM_ID
);

const [PROGRAM_AUTHORITY, AUTHORITY_BUMP] = PublicKey.findProgramAddressSync(
  [Buffer.from('authority')],
  PROGRAM_ID
);

console.log('===== INITIALIZATION =====');
console.log('Program ID:', PROGRAM_ID.toBase58());
console.log('Admin Wallet:', ADMIN_WALLET.toBase58());
console.log('Program State:', PROGRAM_STATE.toBase58(), 'Bump:', STATE_BUMP);
console.log('Program Authority:', PROGRAM_AUTHORITY.toBase58(), 'Bump:', AUTHORITY_BUMP);
console.log('YOT Mint:', YOT_MINT.toBase58());
console.log('YOS Mint:', YOS_MINT.toBase58());

// Create a keypair for the transaction
const keypair = Keypair.generate();

async function initialize() {
  try {
    // Airdrop some SOL to the keypair
    console.log('Requesting airdrop...');
    const airdropSignature = await connection.requestAirdrop(
      keypair.publicKey,
      1000000000 // 1 SOL
    );
    
    // Wait for confirmation
    await connection.confirmTransaction(airdropSignature);
    console.log('Airdrop confirmed:', airdropSignature);
    
    // Check keypair balance
    const balance = await connection.getBalance(keypair.publicKey);
    console.log('Keypair balance:', balance / 1000000000, 'SOL');
    
    // Create initialize instruction with the anchor discriminator format
    // Each instruction has a unique 8-byte discriminator
    // For initialize, we'll use [0,0,0,0,0,0,0,0] as a simple discriminator
    const initializeIx = new TransactionInstruction({
      keys: [
        { pubkey: keypair.publicKey, isSigner: true, isWritable: false },
        { pubkey: PROGRAM_STATE, isSigner: false, isWritable: true },
        { pubkey: PROGRAM_AUTHORITY, isSigner: false, isWritable: false },
        { pubkey: ADMIN_WALLET, isSigner: false, isWritable: false },
        { pubkey: YOT_MINT, isSigner: false, isWritable: false },
        { pubkey: YOS_MINT, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: Buffer.from([0,0,0,0,0,0,0,0]), // Initialize discriminator
    });
    
    // Create transaction
    const transaction = new Transaction().add(initializeIx);
    
    // Set recent blockhash and fee payer
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = keypair.publicKey;
    
    console.log('Sending transaction...');
    
    // Sign and send
    const txSignature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair],
      { 
        skipPreflight: true,
        commitment: 'confirmed'
      }
    );
    
    console.log('Transaction confirmed!');
    console.log('Signature:', txSignature);
    
    // Verify it worked by checking if the state account exists
    const stateAccount = await connection.getAccountInfo(PROGRAM_STATE);
    if (stateAccount) {
      console.log('Success! Program state exists with size:', stateAccount.data.length, 'bytes');
    } else {
      console.log('Error: Program state still does not exist!');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

initialize();