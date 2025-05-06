/**
 * Test script to deploy and initialize the simplified swap program
 * This is separate from the main multi-hub swap program
 * Command to run: node test-simplified-swap-init.cjs
 */

const { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  SystemProgram, 
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  BpfLoader,
  BPF_LOADER_PROGRAM_ID,
} = require('@solana/web3.js');
const { 
  getAssociatedTokenAddress, 
  TOKEN_PROGRAM_ID, 
  createAssociatedTokenAccountInstruction 
} = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// Constants
const YOT_MINT = '9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw';
const YOS_MINT = '2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop';
const COMMON_WALLET_ADDRESS = 'CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9';

async function main() {
  try {
    // Load the test keypair
    const keypairBuffer = fs.readFileSync(path.join(__dirname, '.keypair-test.json'), 'utf-8');
    const keypairData = JSON.parse(keypairBuffer);
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    
    // Create a connection to the Solana cluster
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Check the wallet balance
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(`Wallet balance: ${balance/LAMPORTS_PER_SOL} SOL`);
    
    // Log key information
    console.log(`Using wallet: ${keypair.publicKey.toString()}`);
    console.log(`YOT mint: ${YOT_MINT}`);
    console.log(`YOS mint: ${YOS_MINT}`);
    console.log(`Common wallet: ${COMMON_WALLET_ADDRESS}`);
    
    // Load the compiled program
    // This assumes your program has been compiled into a .so file
    // You would need to build the program separately with cargo build-bpf
    
    // IMPORTANT: This part of the test script is a placeholder
    // In a production environment, you would deploy the program using solana program deploy
    // and store the program ID for future use
    
    console.log("To deploy the simplified swap program, compile it with:");
    console.log("cd program/simplified_swap_program && cargo build-bpf");
    console.log("Then deploy with:");
    console.log("solana program deploy target/deploy/simplified_swap_program.so");
    
    console.log("Once deployed, update the SIMPLIFIED_SWAP_PROGRAM_ID in the client code");
    console.log("Then run the initialization transaction using the SimplifiedSwapButton component");
    
    // For testing purpose, you can add some mock initialization code here
    // that would be similar to what the actual initialization function does
    
    console.log("Simplified swap program test completed");
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();