/**
 * Test script for the fixed SOL to YOT swap functionality
 * This uses the direct secure swap implementation
 */
const { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Connection to Solana
const SOLANA_RPC_URL = "https://api.devnet.solana.com";
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Load wallet from file
function loadWalletFromFile() {
  try {
    // Read keypair file
    const keypairFile = path.resolve(__dirname, '.keypair-test.json');
    const keypairData = fs.readFileSync(keypairFile, 'utf8');
    const keypairJson = JSON.parse(keypairData);
    
    // Create keypair from secretKey
    const wallet = Keypair.fromSecretKey(
      Uint8Array.from(keypairJson)
    );
    
    console.log(`Loaded wallet: ${wallet.publicKey.toString()}`);
    return wallet;
  } catch (error) {
    console.error('Error loading wallet:', error);
    process.exit(1);
  }
}

// Mock wallet object for the browser-compatible interface
function createMockWallet(keypair) {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (transaction) => {
      transaction.sign(keypair);
      return transaction;
    },
    signAllTransactions: async (transactions) => {
      return transactions.map(tx => {
        tx.sign(keypair);
        return tx;
      });
    }
  };
}

// Import the secure swap function directly from the source
// This script assumes it's in the same directory as the client src
const { secureSwap } = require('./client/src/lib/secureSwap');

// Constants
const YOT_TOKEN_ADDRESS = "9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw";
const YOS_TOKEN_ADDRESS = "2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop";

// Check token balances
async function checkBalances(wallet) {
  try {
    const solBalance = await connection.getBalance(wallet.publicKey);
    console.log(`SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
    
    try {
      const { Token } = require('@solana/spl-token');
      
      // Create token objects
      const yotToken = new Token(
        connection,
        new PublicKey(YOT_TOKEN_ADDRESS),
        Token.ASSOCIATED_TOKEN_PROGRAM_ID,
        wallet
      );
      
      const yosToken = new Token(
        connection,
        new PublicKey(YOS_TOKEN_ADDRESS),
        Token.ASSOCIATED_TOKEN_PROGRAM_ID,
        wallet
      );
      
      // Get associated token accounts
      try {
        const yotAccount = await yotToken.getOrCreateAssociatedAccountInfo(wallet.publicKey);
        console.log(`YOT Balance: ${yotAccount.amount / Math.pow(10, 9)} YOT`);
      } catch (error) {
        console.log('No YOT token account found:', error.message);
      }
      
      try {
        const yosAccount = await yosToken.getOrCreateAssociatedAccountInfo(wallet.publicKey);
        console.log(`YOS Balance: ${yosAccount.amount / Math.pow(10, 9)} YOS`);
      } catch (error) {
        console.log('No YOS token account found:', error.message);
      }
    } catch (error) {
      console.log('Error checking token balances:', error);
    }
  } catch (error) {
    console.error('Error checking balances:', error);
  }
}

// Main test function
async function testSwapFix() {
  console.log("=== TESTING SOL TO YOT SWAP FIX ===");
  
  // Load wallet
  const keypair = loadWalletFromFile();
  const wallet = createMockWallet(keypair);
  
  // Check balances before swap
  console.log("\n=== BALANCES BEFORE SWAP ===");
  await checkBalances(keypair);
  
  // Amount to swap (in SOL)
  const solAmount = 0.01;
  console.log(`\n=== SWAPPING ${solAmount} SOL TO YOT ===`);
  
  try {
    // Execute the swap
    const result = await secureSwap(wallet, solAmount);
    
    // Print swap results
    console.log("\n=== SWAP RESULT ===");
    console.log(`Success: ${result.success}`);
    
    if (result.success) {
      console.log(`Transaction Signature: ${result.signature}`);
      console.log(`Explorer Link: https://explorer.solana.com/tx/${result.signature}?cluster=devnet`);
      console.log(`Output Amount: ${result.outputAmount} YOT`);
      console.log(`Exchange Rate: 1 SOL = ${result.exchangeRate} YOT`);
      
      if (result.distributionDetails) {
        console.log("\n=== TOKEN DISTRIBUTION ===");
        console.log(`User Received: ${result.distributionDetails.userReceived} YOT (75%)`);
        console.log(`Liquidity Contribution: ${result.distributionDetails.liquidityContribution} YOT (20%)`);
        console.log(`YOS Cashback: ${result.distributionDetails.yosCashback} YOS (5%)`);
      }
    } else {
      console.log(`Error: ${result.error}`);
      console.log(`Message: ${result.message}`);
    }
    
    // Check balances after swap
    console.log("\n=== BALANCES AFTER SWAP ===");
    await checkBalances(keypair);
    
  } catch (error) {
    console.error("Error during swap test:", error);
  }
}

// Run the test
testSwapFix().then(() => {
  console.log("Test completed");
  process.exit(0);
}).catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});