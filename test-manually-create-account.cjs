// Test script for manually creating a liquidity contribution account
// This script attempts to:
// 1. Create a new account with the SystemProgram
// 2. Assign it to the Multi-Hub Swap program

const { Keypair, Connection, PublicKey, Transaction, SystemProgram, 
  TransactionInstruction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// Load configuration from app.config.json
const appConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.config.json'), 'utf8'));
const solanaConfig = appConfig.solana;

// Constants from config
const SOLANA_RPC_URL = solanaConfig.rpcUrl || 'https://api.devnet.solana.com';
const MULTI_HUB_SWAP_PROGRAM_ID = new PublicKey(solanaConfig.multiHubSwap.programId);
const YOT_TOKEN_ADDRESS = new PublicKey(solanaConfig.tokens.yot.address);
const YOS_TOKEN_ADDRESS = new PublicKey(solanaConfig.tokens.yos.address);

// Create connection
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Load wallet from file
function loadWalletFromFile() {
  try {
    const keypairData = JSON.parse(fs.readFileSync('.keypair-test.json', 'utf8'));
    const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
    console.log(`Using wallet: ${wallet.publicKey.toString()}`);
    return wallet;
  } catch (error) {
    console.error('Error loading wallet keypair:', error);
    process.exit(1);
  }
}

// Find liquidity contribution address for a user
function findLiquidityContributionAddress(userWallet, programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.toBuffer()],
    programId
  );
}

// Print balances
async function printBalances(wallet, liquidityContributionAccount) {
  // Get SOL balance
  const solBalance = await connection.getBalance(wallet.publicKey);
  
  // Get YOT balance
  let yotBalance = 0;
  try {
    const yotTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(YOT_TOKEN_ADDRESS),
      wallet.publicKey
    );
    const accountInfo = await connection.getTokenAccountBalance(yotTokenAccount);
    yotBalance = Number(accountInfo.value.uiAmount);
  } catch (error) {
    // Account doesn't exist or other error
  }
  
  // Get YOS balance
  let yosBalance = 0;
  try {
    const yosTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(YOS_TOKEN_ADDRESS),
      wallet.publicKey
    );
    const accountInfo = await connection.getTokenAccountBalance(yosTokenAccount);
    yosBalance = Number(accountInfo.value.uiAmount);
  } catch (error) {
    // Account doesn't exist or other error
  }
  
  console.log('\n=== Current Balances ===');
  console.log(`SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
  console.log(`YOT Balance: ${yotBalance} YOT`);
  console.log(`YOS Balance: ${yosBalance} YOS`);
  
  // Check if liquidity contribution account exists
  const accountInfo = await connection.getAccountInfo(liquidityContributionAccount);
  if (accountInfo) {
    console.log(`Liquidity contribution account exists: ${liquidityContributionAccount.toString()}`);
    console.log(`Account data size: ${accountInfo.data.length} bytes`);
    console.log(`Account owner: ${accountInfo.owner.toString()}`);
    console.log(`Account data: ${Buffer.from(accountInfo.data).toString('hex').substring(0, 40)}...`);
  } else {
    console.log(`Liquidity contribution account does not exist: ${liquidityContributionAccount.toString()}`);
  }
}

// Main test function
async function main() {
  // Load wallet
  const wallet = loadWalletFromFile();
  
  // Get liquidity contribution account address (PDA)
  const [liquidityContributionAccount, bump] = findLiquidityContributionAddress(
    wallet.publicKey,
    MULTI_HUB_SWAP_PROGRAM_ID
  );
  
  console.log(`Liquidity contribution address: ${liquidityContributionAccount.toString()}`);
  console.log(`PDA bump: ${bump}`);
  
  // Print initial balances
  await printBalances(wallet, liquidityContributionAccount);
  
  // Check if the account already exists
  const accountInfo = await connection.getAccountInfo(liquidityContributionAccount);
  const accountExists = accountInfo !== null;
  
  if (accountExists) {
    console.log('\nAccount already exists, no need to create it');
    return;
  }
  
  console.log('\n=== Attempting to create the liquidity contribution account ===');
  
  // Calculate space needed for the account
  // We'll allocate 128 bytes which should be sufficient for most programs
  const ACCOUNT_SIZE = 128;
  
  // Calculate lamports needed for rent exemption
  const lamports = await connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE);
  console.log(`Required lamports for rent exemption: ${lamports / LAMPORTS_PER_SOL} SOL`);
  
  // Create a transaction to create a new account and assign it to the program
  // NOTE: This will fail because PDAs cannot be created directly with createAccount
  // This is for demonstration purposes only
  
  try {
    // Method 1: Using createAccount (This will fail for PDAs)
    console.log('\nAttempting Method 1: Using createAccount (will fail for PDAs)');
    
    // Create a new temporary keypair for the account
    // Note: This is just for demonstration, it won't work for PDAs
    const tempAccount = Keypair.generate();
    console.log(`Temporary account: ${tempAccount.publicKey.toString()}`);
    
    // Create account instruction
    const createAccountIx = SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: tempAccount.publicKey,
      lamports,
      space: ACCOUNT_SIZE,
      programId: MULTI_HUB_SWAP_PROGRAM_ID
    });
    
    // Create and send transaction
    const transaction = new Transaction().add(createAccountIx);
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    console.log('Sending transaction...');
    try {
      const signature = await connection.sendTransaction(
        transaction,
        [wallet, tempAccount]
      );
      
      console.log(`Transaction sent: ${signature}`);
      console.log('Waiting for confirmation...');
      
      await connection.confirmTransaction(signature);
      console.log('Transaction confirmed!');
    } catch (error) {
      console.error('Error sending transaction:', error);
      console.log('Method 1 failed as expected for PDA accounts');
    }
    
    // Method 2: Using create_account_with_seed (Another approach that would fail for PDAs)
    console.log('\nAttempting Method 2: Using create_account_with_seed (will also fail for PDAs)');
    
    const seed = 'liqcontrib';
    const derivedAddress = await PublicKey.createWithSeed(
      wallet.publicKey,
      seed,
      MULTI_HUB_SWAP_PROGRAM_ID
    );
    
    console.log(`Derived address: ${derivedAddress.toString()}`);
    
    // Create account with seed instruction
    const createWithSeedIx = SystemProgram.createAccountWithSeed({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: derivedAddress,
      basePubkey: wallet.publicKey,
      seed,
      lamports,
      space: ACCOUNT_SIZE,
      programId: MULTI_HUB_SWAP_PROGRAM_ID
    });
    
    // Create and send transaction
    const transaction2 = new Transaction().add(createWithSeedIx);
    transaction2.feePayer = wallet.publicKey;
    const { blockhash: blockhash2 } = await connection.getLatestBlockhash();
    transaction2.recentBlockhash = blockhash2;
    
    console.log('Sending transaction...');
    try {
      const signature = await connection.sendTransaction(
        transaction2,
        [wallet]
      );
      
      console.log(`Transaction sent: ${signature}`);
      console.log('Waiting for confirmation...');
      
      await connection.confirmTransaction(signature);
      console.log('Transaction confirmed!');
    } catch (error) {
      console.error('Error sending transaction:', error);
      console.log('Method 2 failed (as expected for PDAs)');
    }
    
    // Method 3: Allocate + Assign (This also won't work for PDAs but demonstrates the concept)
    console.log('\nAttempting Method 3: Using allocate + assign (will also fail for PDAs)');
    
    // Generate a new keypair for testing
    const testAccount = Keypair.generate();
    console.log(`Test account: ${testAccount.publicKey.toString()}`);
    
    // Create instruction to transfer SOL to the new account
    const transferIx = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: testAccount.publicKey,
      lamports
    });
    
    // Create instruction to allocate space in the account
    const allocateIx = SystemProgram.allocate({
      accountPubkey: testAccount.publicKey,
      space: ACCOUNT_SIZE
    });
    
    // Create instruction to assign the account to the program
    const assignIx = SystemProgram.assign({
      accountPubkey: testAccount.publicKey,
      programId: MULTI_HUB_SWAP_PROGRAM_ID
    });
    
    // Create and send transaction
    const transaction3 = new Transaction().add(transferIx).add(allocateIx).add(assignIx);
    transaction3.feePayer = wallet.publicKey;
    const { blockhash: blockhash3 } = await connection.getLatestBlockhash();
    transaction3.recentBlockhash = blockhash3;
    
    console.log('Sending transaction...');
    try {
      const signature = await connection.sendTransaction(
        transaction3,
        [wallet, testAccount]
      );
      
      console.log(`Transaction sent: ${signature}`);
      console.log('Waiting for confirmation...');
      
      await connection.confirmTransaction(signature);
      console.log('Transaction confirmed!');
      
      // Check if the account has been assigned to the program
      const newAccountInfo = await connection.getAccountInfo(testAccount.publicKey);
      console.log(`Account owner: ${newAccountInfo.owner.toString()}`);
      
      if (newAccountInfo.owner.equals(MULTI_HUB_SWAP_PROGRAM_ID)) {
        console.log('Account successfully assigned to the program!');
      } else {
        console.log('Account not assigned to the program');
      }
    } catch (error) {
      console.error('Error sending transaction:', error);
      console.log('Method 3 also failed (expected for creating PDAs directly)');
    }
  } catch (error) {
    console.error('Error:', error);
  }
  
  // CONCLUSION: PDAs can only be created by their program
  console.log('\nCONCLUSION: Program Derived Addresses (PDAs) can only be created by their own program');
  console.log('This means we cannot create the liquidity contribution account directly from the client');
  console.log('The program must have a dedicated instruction to create the account');
  
  // Print final balances
  await printBalances(wallet, liquidityContributionAccount);
}

// Run the test
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });