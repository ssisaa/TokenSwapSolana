/**
 * Simplified direct SOL to YOT swap test script
 * This script uses a more direct approach focused only on SOL transfer to the pool
 */
const { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  Keypair,
  sendAndConfirmTransaction,
  ComputeBudgetProgram
} = require('@solana/web3.js');
const fs = require('fs');

// Configuration
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Pool configuration from app.config.json
const POOL_AUTHORITY = 'CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9';
const SOL_TOKEN_ACCOUNT = 'Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH';
const YOT_TOKEN = '9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw';
const YOT_TOKEN_ACCOUNT = 'EieVwYpDMdKr94iQygkyCeEBMhRWA4XsXyGumXztza74';
const YOS_TOKEN = '2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop';
const YOS_TOKEN_ACCOUNT = '7GnphdpgcV5Z8swNAFB8QkMdo43TPHa4SmdtUw1ApMxz';
const MULTI_HUB_SWAP_PROGRAM_ID = 'SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE';

function loadWalletFromFile() {
  try {
    // Read the keypair file
    const keypairData = JSON.parse(fs.readFileSync('./program-keypair.json', 'utf-8'));
    const secretKey = Uint8Array.from(keypairData);
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error('Error loading wallet:', error);
    process.exit(1);
  }
}

async function checkBalances(keypair) {
  try {
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(`Wallet balance: ${balance / 1000000000} SOL`);
    return balance;
  } catch (error) {
    console.error('Error checking balances:', error);
  }
}

// Simple direct SOL transfer to the pool
async function simpleSolTransfer(solAmount) {
  try {
    const wallet = loadWalletFromFile();
    console.log(`Using wallet: ${wallet.publicKey.toString()}`);

    // Log current balance
    await checkBalances(wallet);

    const lamports = solAmount * 1000000000; // Convert SOL to lamports
    console.log(`\nSending ${solAmount} SOL (${lamports} lamports) directly to the pool...`);

    // Create a simple direct transfer transaction
    const transaction = new Transaction();

    // Add a compute budget instruction to increase units
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 400000
      })
    );

    // Simple SOL transfer to the pool account
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: new PublicKey(SOL_TOKEN_ACCOUNT),
        lamports: lamports
      })
    );

    // Get a recent blockhash for the transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Sign and send the transaction
    console.log(`Signing and sending transaction...`);
    try {
      // First try with normal preflight checks
      const signature = await sendAndConfirmTransaction(
        connection, 
        transaction, 
        [wallet], 
        {
          skipPreflight: false,
          preflightCommitment: 'processed',
          commitment: 'processed',
          maxRetries: 5
        }
      );
      console.log(`Transaction successful! Signature: ${signature}`);
      console.log(`View transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    } catch (preflightError) {
      console.log(`First attempt failed, trying with skipPreflight=true:`, preflightError);
      
      // If that fails, try again with skipPreflight=true
      const signature = await sendAndConfirmTransaction(
        connection, 
        transaction, 
        [wallet], 
        {
          skipPreflight: true,
          preflightCommitment: 'processed',
          commitment: 'processed',
          maxRetries: 5
        }
      );
      console.log(`Transaction successful! Signature: ${signature}`);
      console.log(`View transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    }

    // Check balances after transaction
    await checkBalances(wallet);
    
    return true;
  } catch (error) {
    console.error(`Error in simpleSolTransfer:`, error);
    return false;
  }
}

// Execute the script with a small amount of SOL
const SOL_AMOUNT = 0.001; // Small test amount
simpleSolTransfer(SOL_AMOUNT)
  .then(() => {
    console.log('Test completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });