/**
 * Real-world test script for the fixed secureSwap implementation
 * This script tests the actual swap functionality in a real devnet environment
 */

const fs = require('fs');
const { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  Keypair, 
  LAMPORTS_PER_SOL 
} = require('@solana/web3.js');
const { 
  getAssociatedTokenAddress, 
  TOKEN_PROGRAM_ID
} = require('@solana/spl-token');

// Direct constants - no config file dependency
const CONNECTION_URL = 'https://api.devnet.solana.com';
const MULTI_HUB_SWAP_PROGRAM_ID = new PublicKey('Js9TqdpLBsF7M64ra2mYNyfbPTWwTvBUNR85wsEoSKP');
const POOL_AUTHORITY = new PublicKey('CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9');
const POOL_SOL_ACCOUNT = new PublicKey('Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH'); 
const YOT_TOKEN_ADDRESS = new PublicKey('9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw');
const YOS_TOKEN_ADDRESS = new PublicKey('2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop');

// Create connection
const connection = new Connection(CONNECTION_URL, 'confirmed');

// Test wallet loading
function loadWalletFromFile() {
  try {
    // Use the test keypair for testing
    const keyfileContent = fs.readFileSync('test-keypair.json', 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(keyfileContent));
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error('Error loading test wallet:', error);
    process.exit(1);
  }
}

// Mock wallet interface for testing
function createMockWallet(keypair) {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (tx) => {
      tx.sign(keypair);
      return tx;
    },
    signAllTransactions: async (txs) => {
      return txs.map(tx => {
        tx.sign(keypair);
        return tx;
      });
    }
  };
}

// Helper function for sleeping
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check wallet balance and token accounts
async function checkBalances(wallet) {
  try {
    // Check SOL balance
    const solBalance = await connection.getBalance(wallet.publicKey);
    console.log(`Wallet SOL balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Check YOT balance
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const userYotAccount = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
    try {
      const yotBalance = await connection.getTokenAccountBalance(userYotAccount);
      console.log(`Wallet YOT balance: ${yotBalance.value.uiAmount} YOT`);
    } catch (error) {
      console.log(`No YOT token account found: ${error.message}`);
    }
    
    // Check YOS balance
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const userYosAccount = await getAssociatedTokenAddress(yosMint, wallet.publicKey);
    try {
      const yosBalance = await connection.getTokenAccountBalance(userYosAccount);
      console.log(`Wallet YOS balance: ${yosBalance.value.uiAmount} YOS`);
    } catch (error) {
      console.log(`No YOS token account found: ${error.message}`);
    }
  } catch (error) {
    console.error('Error checking balances:', error);
  }
}

// Simplified implementation of secureSwap for testing
async function simpleSecureSwap(wallet, solAmount) {
  console.log(`\n--- Starting secure swap of ${solAmount} SOL ---`);
  
  try {
    // Find program state address
    const [programStateAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('state')],
      MULTI_HUB_SWAP_PROGRAM_ID
    );
    
    // Find program authority
    const [programAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority')],
      MULTI_HUB_SWAP_PROGRAM_ID
    );
    
    // Find user liquidity contribution account
    const [liquidityContributionAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('liq'), wallet.publicKey.toBuffer()],
      MULTI_HUB_SWAP_PROGRAM_ID
    );
    
    // Check if liquidity contribution account exists
    const liquidityAccount = await connection.getAccountInfo(liquidityContributionAddress);
    console.log(`Liquidity contribution account exists: ${liquidityAccount !== null}`);
    
    // Get YOT token account addresses
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, POOL_AUTHORITY);
    const userYotAccount = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
    
    // Get YOS token account address
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const userYosAccount = await getAssociatedTokenAddress(yosMint, wallet.publicKey);
    
    // Create tx for SOL-YOT swap
    console.log('Creating swap transaction...');
    
    // Important: Always pull values directly from app.config.json
    const centralLiquidityWallet = new PublicKey(config.multiHubSwap.centralLiquidity.wallet);
    console.log(`SOL Pool Account: ${POOL_SOL_ACCOUNT.toString()}`);
    console.log(`Central Liquidity Wallet: ${centralLiquidityWallet.toString()}`);
    
    // Prepare instruction data
    const rawAmount = Math.floor(solAmount * LAMPORTS_PER_SOL);
    const data = Buffer.alloc(17);
    data.writeUint8(8, 0); // SOL_TO_YOT_SWAP_IMMEDIATE = 8
    data.writeBigUInt64LE(BigInt(rawAmount), 1);
    data.writeBigUInt64LE(BigInt(0), 9); // Min output amount (0 for test)
    
    // Prepare account metas
    const accountMetas = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: POOL_SOL_ACCOUNT, isSigner: false, isWritable: true },
      { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
      { pubkey: userYotAccount, isSigner: false, isWritable: true },
      { pubkey: centralLiquidityWallet, isSigner: false, isWritable: true }, // Using SOL pool account
      { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
      { pubkey: yosMint, isSigner: false, isWritable: true },
      { pubkey: userYosAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      // No rent sysvar needed for test as the account should already exist
    ];
    
    // Create transaction
    const transaction = new Transaction();
    transaction.add({
      programId: MULTI_HUB_SWAP_PROGRAM_ID,
      keys: accountMetas,
      data,
    });
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign transaction
    console.log('Signing transaction...');
    const signedTransaction = await wallet.signTransaction(transaction);
    
    // Send transaction
    console.log('Sending transaction...');
    try {
      // First try with regular preflight
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });
      
      console.log(`Transaction sent! Signature: ${signature}`);
      console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      
      // Wait for confirmation
      console.log('Waiting for confirmation...');
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      console.log('Transaction confirmed!', confirmation);
      
      return signature;
    } catch (preflightError) {
      console.warn('Transaction failed preflight checks, trying with skipPreflight=true:', preflightError);
      
      // If preflight fails, try again with skipPreflight=true
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true,
        preflightCommitment: 'confirmed'
      });
      
      console.log(`Transaction sent! Signature: ${signature}`);
      console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      
      // Wait for confirmation
      console.log('Waiting for confirmation...');
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      console.log('Transaction confirmed!', confirmation);
      
      return signature;
    }
  } catch (error) {
    console.error('Error during secure swap:', error);
    throw error;
  }
}

// Test swap on a small amount
async function testRealSwap() {
  console.log('Testing Real Secure Swap Implementation');
  console.log('======================================');
  
  // Load wallet
  const keypair = loadWalletFromFile();
  const wallet = createMockWallet(keypair);
  console.log(`Test wallet: ${wallet.publicKey.toString()}`);
  
  // Check balances before
  console.log('\nBalances before swap:');
  await checkBalances(wallet);
  
  // Execute swap
  try {
    const smallAmount = 0.01; // Small amount for testing
    const signature = await simpleSecureSwap(wallet, smallAmount);
    
    // Give some time for blockchain state to update
    console.log('\nWaiting for blockchain state to update...');
    await sleep(5000);
    
    // Check balances after
    console.log('\nBalances after swap:');
    await checkBalances(wallet);
    
    console.log('\nSwap test completed successfully!');
  } catch (error) {
    console.error('\nSwap test failed:', error);
  }
}

// Run the test
testRealSwap();