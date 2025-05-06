/**
 * Minimal test script that only attempts a simple SOL transfer
 * This isolates the core account borrowing issue
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');

// Connect to devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Load wallet from keypair file
function loadWalletFromFile() {
  const keypairData = JSON.parse(fs.readFileSync('./program-keypair.json', 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Simple SOL transfer function
async function transferSOL(fromWallet, toAddress, amount) {
  console.log(`Transferring ${amount} SOL to ${toAddress}`);
  
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromWallet.publicKey,
      toPubkey: new PublicKey(toAddress),
      lamports: amount * LAMPORTS_PER_SOL
    })
  );
  
  transaction.feePayer = fromWallet.publicKey;
  
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  transaction.sign(fromWallet);
  const signature = await connection.sendRawTransaction(transaction.serialize());
  
  console.log(`Transaction sent: ${signature}`);
  console.log(`View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  
  await connection.confirmTransaction(signature);
  console.log('Transaction confirmed!');
  
  return signature;
}

// Main test function
async function testMinimalTransfer() {
  try {
    console.log('Simple SOL Transfer Test');
    
    const wallet = loadWalletFromFile();
    console.log(`Using wallet: ${wallet.publicKey.toString()}`);
    
    // Get current balance
    const initialBalance = await connection.getBalance(wallet.publicKey) / LAMPORTS_PER_SOL;
    console.log(`Initial SOL balance: ${initialBalance}`);
    
    // Send a small amount of SOL to the SOL pool account for Multi-Hub Swap
    const POOL_SOL_ACCOUNT = 'Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH';
    const solAmount = 0.01;
    
    await transferSOL(wallet, POOL_SOL_ACCOUNT, solAmount);
    
    // Check final balance
    const finalBalance = await connection.getBalance(wallet.publicKey) / LAMPORTS_PER_SOL;
    console.log(`Final SOL balance: ${finalBalance}`);
    console.log(`Change: ${finalBalance - initialBalance} SOL`);
    
    console.log('Test completed!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testMinimalTransfer().catch(console.error);