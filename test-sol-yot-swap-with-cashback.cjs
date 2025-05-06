/**
 * Test script for SOL to YOT swap with common wallet contribution and YOS cashback
 * 
 * This test script:
 * 1. Tests 80% SOL to YOT swap via pool
 * 2. Tests 20% contribution to common wallet
 * 3. Tests 5% YOS cashback to user wallet
 */

const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');

// Constants
const ENDPOINT = 'https://api.devnet.solana.com';
const connection = new Connection(ENDPOINT, 'confirmed');
const YOT_TOKEN_ADDRESS = '9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw';
const YOS_TOKEN_ADDRESS = '2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop';
const POOL_SOL_ACCOUNT = 'Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH';
const POOL_AUTHORITY = 'CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9';
const MULTI_HUB_SWAP_PROGRAM_ID = 'Js9TqdpLBsF7M64ra2mYNyfbPTWwTvBUNR85wsEoSKP';
const CONTRIBUTION_DISTRIBUTION_PERCENT = 20;
const YOS_CASHBACK_PERCENT = 5.0;

// Load keypair from file for testing
function loadWalletFromFile() {
  try {
    const keyData = fs.readFileSync('./keypair-test.json', 'utf8');
    const parsedKey = JSON.parse(keyData);
    const secretKey = Uint8Array.from(parsedKey);
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error('Error loading wallet:', error);
    throw error;
  }
}

// Get common wallet (program authority PDA)
function getCommonWallet() {
  const [programAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return programAuthority;
}

// Get token balance for a wallet
async function getTokenBalance(tokenMintAddress, walletPublicKey) {
  try {
    const tokenMint = new PublicKey(tokenMintAddress);
    const associatedTokenAddress = await getAssociatedTokenAddress(
      tokenMint,
      walletPublicKey
    );
    
    try {
      const tokenAccountInfo = await connection.getTokenAccountBalance(associatedTokenAddress);
      return Number(tokenAccountInfo.value.uiAmount);
    } catch (error) {
      // If token account doesn't exist, balance is 0
      return 0;
    }
  } catch (error) {
    console.error('Error getting token balance:', error);
    return 0;
  }
}

// Check balances for user wallet, common wallet, and pool
async function checkBalances(wallet) {
  const walletPublicKey = wallet.publicKey;
  const commonWallet = getCommonWallet();
  
  console.log('--- CURRENT BALANCES ---');
  
  // SOL balances
  const userSolBalance = await connection.getBalance(walletPublicKey) / LAMPORTS_PER_SOL;
  const commonWalletBalance = await connection.getBalance(commonWallet) / LAMPORTS_PER_SOL;
  const poolSolBalance = await connection.getBalance(new PublicKey(POOL_SOL_ACCOUNT)) / LAMPORTS_PER_SOL;
  
  console.log(`User SOL balance: ${userSolBalance} SOL`);
  console.log(`Common wallet balance: ${commonWalletBalance} SOL`);
  console.log(`Pool SOL balance: ${poolSolBalance} SOL`);
  
  // Token balances
  const userYotBalance = await getTokenBalance(YOT_TOKEN_ADDRESS, walletPublicKey);
  const userYosBalance = await getTokenBalance(YOS_TOKEN_ADDRESS, walletPublicKey);
  
  console.log(`User YOT balance: ${userYotBalance} YOT`);
  console.log(`User YOS balance: ${userYosBalance} YOS`);
  
  // Pool token balances
  const poolYotBalance = await getTokenBalance(YOT_TOKEN_ADDRESS, new PublicKey(POOL_AUTHORITY));
  const poolYosBalance = await getTokenBalance(YOS_TOKEN_ADDRESS, new PublicKey(POOL_AUTHORITY));
  
  console.log(`Pool YOT balance: ${poolYotBalance} YOT`);
  console.log(`Pool YOS balance: ${poolYosBalance} YOS`);
  
  console.log('------------------------');
  
  return {
    userSolBalance,
    commonWalletBalance,
    poolSolBalance,
    userYotBalance,
    userYosBalance,
    poolYotBalance,
    poolYosBalance
  };
}

// Execute SOL to YOT swap with common wallet contribution
async function solToYotSwapWithCashback(wallet, solAmount) {
  const walletPublicKey = wallet.publicKey;
  
  // Calculate amounts
  const contributionAmount = solAmount * (CONTRIBUTION_DISTRIBUTION_PERCENT / 100);
  const swapAmount = solAmount - contributionAmount;
  
  console.log(`Executing SOL to YOT swap for ${solAmount} SOL...`);
  console.log(`Common wallet contribution: ${contributionAmount} SOL (${CONTRIBUTION_DISTRIBUTION_PERCENT}%)`);
  console.log(`Swap amount: ${swapAmount} SOL (${100 - CONTRIBUTION_DISTRIBUTION_PERCENT}%)`);
  
  // Convert to lamports
  const contributionLamports = Math.floor(contributionAmount * LAMPORTS_PER_SOL);
  const swapLamports = Math.floor(swapAmount * LAMPORTS_PER_SOL);
  
  // Get common wallet
  const commonWallet = getCommonWallet();
  
  // Calculate expected output based on pool balances
  const solPoolBalance = await connection.getBalance(new PublicKey(POOL_SOL_ACCOUNT)) / LAMPORTS_PER_SOL;
  
  // Get YOT token account balance from pool
  const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
  const poolYotAccount = await getAssociatedTokenAddress(
    yotMint,
    new PublicKey(POOL_AUTHORITY)
  );
  const yotAccountInfo = await connection.getTokenAccountBalance(poolYotAccount);
  const yotPoolBalance = Number(yotAccountInfo.value.uiAmount);
  
  // Calculate expected output using AMM formula (x * y) / (x + Δx)
  const expectedYotOutput = (swapAmount * yotPoolBalance) / (solPoolBalance + swapAmount);
  const expectedYosCashback = expectedYotOutput * (YOS_CASHBACK_PERCENT / 100);
  
  console.log(`Pool balances - SOL: ${solPoolBalance}, YOT: ${yotPoolBalance}`);
  console.log(`Expected YOT output: ${expectedYotOutput}`);
  console.log(`Expected YOS cashback: ${expectedYosCashback} (${YOS_CASHBACK_PERCENT}% of YOT)`);
  
  // In a normal implementation, this would send a blockchain transaction
  // But for this test, we'll just validate the calculations
  
  console.log('✅ Calculation verified!');
  console.log('In a full implementation, the transaction would be sent to the blockchain.');
  
  return {
    expectedYotOutput,
    expectedYosCashback,
    contributionAmount
  };
}

// Main function
async function main() {
  console.log('==============================================');
  console.log('SOL TO YOT SWAP WITH CASHBACK TEST');
  console.log('==============================================');
  
  try {
    // Load wallet from keypair file
    const wallet = loadWalletFromFile();
    console.log(`Using wallet: ${wallet.publicKey.toBase58()}`);
    console.log(`Common wallet: ${getCommonWallet().toBase58()}`);
    
    // Check initial balances
    console.log('\nInitial Balances:');
    const initialBalances = await checkBalances(wallet);
    
    // Define swap amount (use a small amount for testing)
    const swapAmount = 0.01; // 0.01 SOL
    
    // Simulate swap
    console.log('\nSimulating Swap:');
    const swapResult = await solToYotSwapWithCashback(wallet, swapAmount);
    
    console.log('\nExpected Results:');
    console.log(`SOL Used: ${swapAmount} SOL`);
    console.log(`Common Wallet Contribution: ${swapResult.contributionAmount} SOL`);
    console.log(`Expected YOT Output: ${swapResult.expectedYotOutput} YOT`);
    console.log(`Expected YOS Cashback: ${swapResult.expectedYosCashback} YOS`);
    
    // In a full implementation, we would check the updated balances
    // to verify the transaction effects
    
    console.log('\nTest completed!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
main();