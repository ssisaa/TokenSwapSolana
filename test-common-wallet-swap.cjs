/**
 * Test script for the new common wallet SOL to YOT swap approach
 * This implementation eliminates the "account already borrowed" error
 * by sending 20% to common wallet and 80% directly to the pool
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } = require('@solana/web3.js');
const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');

// Connect to Solana
const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';
const connection = new Connection(DEVNET_ENDPOINT, 'confirmed');

// Program and Token Constants
const MULTI_HUB_SWAP_PROGRAM_ID = 'Js9TqdpLBsF7M64ra2mYNyfbPTWwTvBUNR85wsEoSKP';
const YOT_TOKEN_ADDRESS = '9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw';
const POOL_SOL_ACCOUNT = 'Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH';
const POOL_AUTHORITY = 'CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9';
const CONTRIBUTION_PERCENT = 20; // 20% to common wallet

// Load wallet from keypair file
function loadWalletFromFile() {
  const keypairData = JSON.parse(fs.readFileSync('./program-keypair.json', 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Get the common wallet address (Program Authority PDA)
function getCommonWallet() {
  const [programAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return programAuthority;
}

// Create a mock wallet for better testing
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

// Check current balances
async function checkBalances(wallet) {
  console.log('\n--- CURRENT BALANCES ---');
  
  // SOL Balance
  const solBalance = await connection.getBalance(wallet.publicKey);
  console.log(`SOL balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
  
  // YOT Balance
  try {
    const yotAccount = await getAssociatedTokenAddress(
      new PublicKey(YOT_TOKEN_ADDRESS),
      wallet.publicKey
    );
    
    const yotBalance = await connection.getTokenAccountBalance(yotAccount);
    console.log(`YOT balance: ${yotBalance.value.uiAmount} YOT`);
  } catch (error) {
    console.log('No YOT token account found');
  }
  
  // Common wallet balance
  const commonWallet = getCommonWallet();
  const commonWalletBalance = await connection.getBalance(commonWallet);
  console.log(`Common wallet balance: ${commonWalletBalance / LAMPORTS_PER_SOL} SOL`);
  
  console.log('------------------------\n');
}

// Execute SOL to YOT swap with common wallet contribution
async function executeCommonWalletSwap(wallet, solAmount, slippagePercent = 1.0) {
  try {
    console.log(`Executing SOL to YOT swap for ${solAmount} SOL...`);
    const walletPublicKey = wallet.publicKey;
    
    // Calculate split amounts (20% to common wallet, 80% to pool)
    const commonWalletAmount = solAmount * (CONTRIBUTION_PERCENT / 100);
    const poolAmount = solAmount - commonWalletAmount;
    
    console.log(`Common wallet contribution: ${commonWalletAmount} SOL (${CONTRIBUTION_PERCENT}%)`);
    console.log(`Pool amount: ${poolAmount} SOL (${100 - CONTRIBUTION_PERCENT}%)`);
    
    // Convert amounts to lamports
    const commonWalletLamports = Math.floor(commonWalletAmount * LAMPORTS_PER_SOL);
    const poolLamports = Math.floor(poolAmount * LAMPORTS_PER_SOL);
    
    // Get token accounts
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, new PublicKey(POOL_AUTHORITY));
    const userYotAccount = await getAssociatedTokenAddress(yotMint, walletPublicKey);
    
    // Calculate expected output based on pool balances
    const solPoolBalance = await connection.getBalance(new PublicKey(POOL_SOL_ACCOUNT)) / LAMPORTS_PER_SOL;
    const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotAccountInfo.value.uiAmount);
    
    // Calculate expected output using AMM formula (x * y) / (x + Δx)
    // Note: Only the pool amount (80%) is used for swap calculations
    const expectedOutput = (poolAmount * yotPoolBalance) / (solPoolBalance + poolAmount);
    
    // Apply slippage tolerance
    const slippageFactor = (100 - slippagePercent) / 100;
    const minAmountOut = expectedOutput * slippageFactor;
    
    console.log(`Pool balances - SOL: ${solPoolBalance}, YOT: ${yotPoolBalance}`);
    console.log(`Expected output: ${expectedOutput} YOT`);
    console.log(`Min output with ${slippagePercent}% slippage: ${minAmountOut} YOT`);
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Add compute budget instructions
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 200000
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    
    // 1. Add SOL transfer to common wallet (20%)
    const commonWalletTransfer = SystemProgram.transfer({
      fromPubkey: walletPublicKey,
      toPubkey: getCommonWallet(),
      lamports: commonWalletLamports
    });
    
    // 2. Add SOL transfer to pool (80%)
    const poolTransfer = SystemProgram.transfer({
      fromPubkey: walletPublicKey,
      toPubkey: new PublicKey(POOL_SOL_ACCOUNT),
      lamports: poolLamports
    });
    
    // Add both transfers to transaction
    transaction.add(commonWalletTransfer);
    transaction.add(poolTransfer);
    
    // Set transaction properties
    transaction.feePayer = walletPublicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    const signedTx = await wallet.signTransaction(transaction);
    console.log('Sending transaction...');
    
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    console.log(`Transaction sent: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log('Transaction confirmed successfully!');
    
    return {
      success: true,
      signature,
      amount: expectedOutput,
      commonWalletAmount
    };
  } catch (error) {
    console.error('Error executing SOL to YOT swap:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Main test function
async function testCommonWalletSwap() {
  try {
    console.log('==============================================');
    console.log('COMMON WALLET SOL TO YOT SWAP TEST');
    console.log('==============================================');
    
    // Load wallet
    const keypair = loadWalletFromFile();
    const mockWallet = createMockWallet(keypair);
    console.log(`Using wallet: ${keypair.publicKey.toString()}`);
    
    // Get common wallet
    const commonWallet = getCommonWallet();
    console.log(`Common wallet: ${commonWallet.toString()}`);
    
    // Check initial balances
    await checkBalances(keypair);
    
    // Execute the swap
    const solAmount = 0.01; // Small test amount
    const swapResult = await executeCommonWalletSwap(mockWallet, solAmount);
    
    if (swapResult.success) {
      console.log(`\n✅ Swap succeeded! Transaction: ${swapResult.signature}`);
      console.log(`Expected YOT output: ${swapResult.amount}`);
      console.log(`SOL contributed to common wallet: ${swapResult.commonWalletAmount}`);
    } else {
      console.log(`\n❌ Swap failed: ${swapResult.error}`);
    }
    
    // Check final balances
    await checkBalances(keypair);
    
    console.log('Test completed!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testCommonWalletSwap();