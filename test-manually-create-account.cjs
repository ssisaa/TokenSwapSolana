/**
 * Script to manually create a Program Derived Address (PDA) account for liquidity contribution
 * This script creates the account using manual memory allocation
 */

const { 
  Connection, 
  PublicKey, 
  Keypair, 
  LAMPORTS_PER_SOL, 
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
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

// Helper function to find liquidity contribution account PDA
function findLiquidityContributionAddress(userWallet, programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.toBuffer()],
    programId
  );
}

// Main function
async function createLiquidityAccount() {
  // Load config from app.config.json
  const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
  
  // Set up connection to Solana devnet
  const connection = new Connection(appConfig.solana.rpcUrl, 'confirmed');
  
  // Load test wallet
  const wallet = loadWalletFromFile();
  console.log(`Using wallet: ${wallet.publicKey.toString()}`);
  
  // Check wallet SOL balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Wallet SOL balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  
  // Get essential addresses
  const programId = new PublicKey(appConfig.solana.multiHubSwap.programId);
  
  // Find the liquidity contribution account PDA
  const [liquidityAccount, bump] = findLiquidityContributionAddress(wallet.publicKey, programId);
  console.log(`Liquidity contribution account address: ${liquidityAccount.toString()}`);
  console.log(`Bump seed: ${bump}`);
  
  // Check if the account already exists
  const accountInfo = await connection.getAccountInfo(liquidityAccount);
  
  if (accountInfo) {
    console.log(`✅ Account already exists with size ${accountInfo.data.length} bytes`);
    console.log(`Owner: ${accountInfo.owner.toString()}`);
    return;
  }
  
  console.log("❌ Account doesn't exist, trying to create it manually...");
  
  // Simulate the process of creating the PDA from the program
  // NOTE: This won't work directly, as PDAs cannot be owned by users
  // It's an educational example to understand why we need to use the program to create PDAs
  
  // Account size and rent exemption
  const space = 128; // Size for liquidity contribution account (adjust if needed)
  const lamports = await connection.getMinimumBalanceForRentExemption(space);
  
  console.log(`Creating account with ${space} bytes, requires ${lamports / LAMPORTS_PER_SOL} SOL for rent exemption`);
  
  // Create a transaction
  const transaction = new Transaction();
  
  // Create a seed for creating an address (not a PDA) 
  const seedPhrase = "liquiditytest" + Math.floor(Math.random() * 1000000);
  
  // Create a regular account with seed (this WILL NOT create a PDA)
  // Just demonstrating why we need program to create PDAs
  const newAccountKeypair = Keypair.generate();
  
  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: wallet.publicKey,
    newAccountPubkey: newAccountKeypair.publicKey,
    lamports,
    space,
    programId // Make account owned by the program
  });
  
  transaction.add(createAccountIx);
  
  // Set transaction properties
  const recentBlockhash = await connection.getRecentBlockhash();
  transaction.recentBlockhash = recentBlockhash.blockhash;
  transaction.feePayer = wallet.publicKey;
  
  // Sign with both the payer and the new account keypair
  console.log("Signing and sending transaction...");
  
  try {
    // Sign with both the payer and the new account keypair
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet, newAccountKeypair],
      { commitment: 'confirmed' }
    );
    
    console.log(`✅ Regular account created: ${newAccountKeypair.publicKey.toString()}`);
    console.log(`Transaction signature: ${signature}`);
    
    // Now explain why PDAs are different
    console.log("\nImportant Note:");
    console.log("--------------------------------------------------");
    console.log("This created a regular account, NOT the PDA we need.");
    console.log("Program Derived Addresses (PDAs) can ONLY be created by their owning program.");
    console.log("The regular address we created is:", newAccountKeypair.publicKey.toString());
    console.log("But we need the PDA address:", liquidityAccount.toString());
    console.log("--------------------------------------------------");
    console.log("For our app to work correctly, we must use the program's swap instruction");
    console.log("which will automatically create the liquidity contribution PDA if needed.");
    console.log("--------------------------------------------------");
  } catch (error) {
    console.error("Error creating account:", error);
  }
}

// Run the main function
createLiquidityAccount().catch(console.error);