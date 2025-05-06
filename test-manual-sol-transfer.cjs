/**
 * Test script for the manual SOL transfer approach
 * This script manually transfers SOL to the pool without using the swap instruction
 * This is to avoid the "account already borrowed" error in the program
 */

const { 
  Connection, 
  PublicKey, 
  Keypair, 
  LAMPORTS_PER_SOL, 
  SystemProgram,
  Transaction
} = require('@solana/web3.js');
const fs = require('fs');

// Helper function to load wallet from file for testing
function loadWalletFromFile() {
  try {
    const keypairData = JSON.parse(fs.readFileSync('./program-keypair.json', 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    console.error('Error loading wallet:', error);
    process.exit(1);
  }
}

/**
 * Helper function to check wallet balances
 */
async function checkBalances(wallet, connection) {
  console.log('\n=== Current Balances ===');
  
  // Check SOL balance
  const solBalance = await connection.getBalance(wallet.publicKey);
  console.log(`SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
  
  try {
    // Get configuration from app.config.json
    const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
    
    // Check pool SOL account balance
    const poolSolAccount = new PublicKey(appConfig.solana.pool.solAccount);
    const poolSolBalance = await connection.getBalance(poolSolAccount);
    console.log(`Pool SOL Balance: ${poolSolBalance / LAMPORTS_PER_SOL} SOL`);
  } catch (error) {
    console.error('Error checking pool balances:', error);
  }
}

/**
 * Manual SOL transfer to pool
 */
async function transferSolToPool(wallet, connection, solAmount) {
  console.log(`\n=== Manually Transferring ${solAmount} SOL to pool ===`);
  
  try {
    // Get configuration from app.config.json
    const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
    const poolSolAccount = new PublicKey(appConfig.solana.pool.solAccount);
    
    // Convert SOL to lamports
    const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    
    // Create a transaction to transfer SOL directly to the pool
    const transaction = new Transaction();
    
    // Add instruction to transfer SOL to pool
    const transferSolIx = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: poolSolAccount,
      lamports: amountInLamports
    });
    
    transaction.add(transferSolIx);
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send the transaction
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    console.log(`Transaction sent: ${signature}`);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature);
    console.log('Transaction confirmed!');
    
    return signature;
  } catch (error) {
    console.error('Error transferring SOL to pool:', error);
    throw error;
  }
}

/**
 * Main test function
 */
async function testManualSolTransfer() {
  // Get app config
  const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
  const connection = new Connection(appConfig.solana.rpcUrl, 'confirmed');
  
  console.log(`Connected to ${appConfig.solana.rpcUrl}`);
  
  // Load wallet
  const wallet = loadWalletFromFile();
  console.log(`Using wallet: ${wallet.publicKey.toString()}`);
  
  // Check initial balances
  await checkBalances(wallet, connection);
  
  // Set amount to transfer (0.05 SOL)
  const solAmount = 0.05;
  
  // Execute manual SOL transfer
  const signature = await transferSolToPool(wallet, connection, solAmount);
  
  // Show result
  console.log('\n=== Transfer Result ===');
  console.log(`Signature: ${signature}`);
  console.log(`SOL Amount: ${solAmount}`);
  
  // Check final balances
  await checkBalances(wallet, connection);
}

// Run the test
testManualSolTransfer().catch(err => {
  console.error('Test failed:', err);
});