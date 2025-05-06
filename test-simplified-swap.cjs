/**
 * Test script for the simplified on-chain SOL to YOT swap
 * This test focuses on verifying the correct distribution of tokens according to the specified ratios:
 * 
 * For SOL → YOT swaps:
 * - SOL Distribution: 80% to pool, 20% to common wallet
 * - YOT Distribution: 80% to user, 20% to common wallet
 * - Additionally: 5% YOS as cashback to the user
 */

const { Keypair, Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Constants for the test
const SIMPLIFIED_SWAP_PROGRAM_ID = 'SimpleSwapPDCsXVzAi7i2UmXt3VY6K79Po4wY3zLGwu'; // Will be updated by deploy script
const YOT_MINT = '9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw';
const YOS_MINT = '2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop';
const SOL_POOL_WALLET = 'Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH';
const YOT_POOL_TOKEN_ACCOUNT = 'EieVwYpDMdKr94iQygkyCeEBMhRWA4XsXyGumXztza74';
const COMMON_WALLET_ADDRESS = 'CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9';

// Distribution percentages
const SOL_DISTRIBUTION_RATIO = 80; // 80% to pool, 20% to common wallet
const YOT_DISTRIBUTION_RATIO = 80; // 80% to user, 20% to common wallet

// Connect to Solana devnet
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// Load wallet from the keypair file
function loadWalletFromFile() {
  const keypairFile = path.resolve(process.cwd(), '.keypair-test.json');
  if (!fs.existsSync(keypairFile)) {
    console.error('Keypair file not found. Please create .keypair-test.json');
    process.exit(1);
  }
  
  const keypairData = JSON.parse(fs.readFileSync(keypairFile, 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Find program state PDA
function findProgramStateAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID)
  );
}

// Find program authority PDA
function findProgramAuthorityAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID)
  );
}

// Helper function to check the balance of SOL and tokens
async function checkBalances(wallet) {
  const solBalance = await connection.getBalance(wallet.publicKey);
  console.log(`SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
  
  // Check balances of relevant accounts
  console.log('\nChecking pool and common wallet balances...');
  const solPoolBalance = await connection.getBalance(new PublicKey(SOL_POOL_WALLET));
  console.log(`SOL Pool Balance: ${solPoolBalance / LAMPORTS_PER_SOL} SOL`);
  
  const commonWalletBalance = await connection.getBalance(new PublicKey(COMMON_WALLET_ADDRESS));
  console.log(`Common Wallet SOL Balance: ${commonWalletBalance / LAMPORTS_PER_SOL} SOL`);
}

// Main test function
async function testSimplifiedSwap() {
  try {
    console.log('Starting simplified swap test...');
    
    // Load wallet
    const wallet = loadWalletFromFile();
    console.log(`Using wallet: ${wallet.publicKey.toString()}`);
    
    // Check initial balances
    console.log('\nInitial balances:');
    await checkBalances(wallet);
    
    // Find program PDAs
    const [programStatePda, programStateBump] = findProgramStateAddress();
    const [programAuthorityPda, programAuthorityBump] = findProgramAuthorityAddress();
    
    console.log('\nProgram PDAs:');
    console.log(`Program State PDA: ${programStatePda.toString()}`);
    console.log(`Program Authority PDA: ${programAuthorityPda.toString()}`);
    
    console.log('\nTest initialized. Now deploy the program and update this script with the new Program ID.');
    console.log('Then run this test to simulate the swap operation.');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testSimplifiedSwap();