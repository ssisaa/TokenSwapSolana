const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount, getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');

// Load app config
const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
const { solana: solanaConfig } = appConfig;

// Constants
const YOT_TOKEN_ADDRESS = solanaConfig.tokens.yot;
const ENDPOINT = solanaConfig.endpoints.devnet;
const POOL_AUTHORITY = solanaConfig.pool.authority;

// Create connection to devnet
const connection = new Connection(ENDPOINT, 'confirmed');

// Load wallet from file for testing
function loadWalletFromFile() {
  try {
    // Path to your keypair file (this should be a testing wallet with some SOL)
    const keypairFile = '.keypair-test.json'; // Create this file or replace with your file path
    
    if (!fs.existsSync(keypairFile)) {
      console.log('Keypair file not found. You need to create a test wallet first.');
      console.log('Run: solana-keygen new --outfile .keypair-test.json');
      process.exit(1);
    }
    
    const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(keypairFile, 'utf8')));
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error('Error loading wallet:', error);
    process.exit(1);
  }
}

async function checkBalances(wallet) {
  try {
    // Check SOL balance
    const solBalance = await connection.getBalance(wallet.publicKey);
    console.log(`SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Check YOT balance
    try {
      const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
      const tokenAddress = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
      
      try {
        const tokenAccount = await connection.getTokenAccountBalance(tokenAddress);
        console.log(`YOT Balance: ${tokenAccount.value.uiAmount} YOT`);
      } catch (err) {
        console.log('YOT token account does not exist yet.');
      }
    } catch (err) {
      console.error('Error checking YOT balance:', err);
    }
  } catch (err) {
    console.error('Error checking balances:', err);
  }
}

// Test 1: Check pool balances
async function checkPoolBalances() {
  try {
    // Get pool's SOL balance
    const poolAuthority = new PublicKey(POOL_AUTHORITY);
    const solBalance = await connection.getBalance(poolAuthority);
    console.log(`Pool SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Get pool's YOT balance
    try {
      const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
      const tokenAddress = await getAssociatedTokenAddress(yotMint, poolAuthority);
      
      try {
        const tokenAccount = await connection.getTokenAccountBalance(tokenAddress);
        console.log(`Pool YOT Balance: ${tokenAccount.value.uiAmount} YOT`);
      } catch (err) {
        console.log('Pool YOT token account not found or empty.');
      }
    } catch (err) {
      console.error('Error checking pool YOT balance:', err);
    }
  } catch (err) {
    console.error('Error checking pool balances:', err);
  }
}

// This test would need to be run in a browser environment with wallet adapter
// Here we just check if the accounts exist and have proper balances
async function main() {
  console.log('SOL-YOT Swap Test');
  console.log('================');
  console.log('Pool Authority:', POOL_AUTHORITY);
  console.log('YOT Token Address:', YOT_TOKEN_ADDRESS);
  console.log('================');
  
  // Load a test wallet
  try {
    const wallet = loadWalletFromFile();
    console.log('Test Wallet Public Key:', wallet.publicKey.toString());
    
    // Check wallet balances
    console.log('\nWallet Balances:');
    await checkBalances(wallet);
    
    // Check pool balances
    console.log('\nPool Balances:');
    await checkPoolBalances();
    
    console.log('\nTest completed!');
    console.log('To perform an actual swap, please use the web application with a connected wallet.');
    console.log('This test only verifies the existence of accounts and their balances.');
  } catch (err) {
    console.error('Test failed:', err);
  }
}

main();