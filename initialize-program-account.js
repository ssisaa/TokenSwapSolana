// Simple script to initialize the program's YOT token account
// This only needs to be run once by the admin

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount, createTransferInstruction } = require('@solana/spl-token');
const fs = require('fs');

// YOT token mint
const YOT_TOKEN_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
// Program ID 
const PROGRAM_ID = new PublicKey('Cohae9agySEgC9gyJL1QHCJWw4q58R7Wshr3rpPJHU7L');

// Find program authority PDA
function findProgramAuthorityAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    PROGRAM_ID
  );
}

async function run() {
  try {
    // Connect to Solana
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Using your admin wallet
    const adminKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync('program-keypair.json')))
    );
    
    console.log('Admin wallet:', adminKeypair.publicKey.toString());
    
    // Get program's PDA
    const [programAuthority] = findProgramAuthorityAddress();
    console.log('Program Authority PDA:', programAuthority.toString());
    
    // 1. Create YOT token account for the program's PDA (if it doesn't exist)
    console.log('Creating YOT token account for program...');
    const programYotAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair,
      YOT_TOKEN_MINT,
      programAuthority,
      true // Allow owner off curve (PDA)
    );
    
    console.log('Program YOT account created:', programYotAccount.address.toString());
    console.log('Current balance:', programYotAccount.amount.toString());
    
    // 2. If no tokens, transfer some YOT from admin to the program
    if (programYotAccount.amount === 0n) {
      console.log('No YOT tokens in program account, transferring some...');
      
      // Get admin's YOT account
      const adminYotAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        adminKeypair,
        YOT_TOKEN_MINT,
        adminKeypair.publicKey
      );
      
      console.log('Admin YOT account:', adminYotAccount.address.toString());
      console.log('Admin YOT balance:', adminYotAccount.amount.toString());
      
      // Transfer 100,000 YOT tokens (adjust amount as needed)
      const amountToTransfer = 100_000_000_000_000n; // 100,000 with 9 decimals
      
      const transaction = await createTransferInstruction(
        adminYotAccount.address,
        programYotAccount.address,
        adminKeypair.publicKey,
        amountToTransfer
      );
      
      console.log('Transferring tokens...');
      const signature = await connection.sendTransaction(transaction, [adminKeypair]);
      console.log('Transfer complete! Transaction:', signature);
    }
    
    console.log('Program is now ready for SOL→YOT swaps!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

run();