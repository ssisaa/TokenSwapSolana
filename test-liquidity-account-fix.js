/**
 * Test script for the new liquidity contribution account creation fix
 * This script tests the approach of creating the liquidity contribution account separately
 * before attempting a swap operation.
 */

import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';

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

// Find the liquidity contribution account address for a user's wallet
function findLiquidityContributionAddress(userWallet, programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.toBuffer()],
    programId
  );
}

// Main test function
async function testLiquidityAccountFix() {
  // Load config from app.config.json
  const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
  
  // Set up connection to Solana devnet
  const connection = new Connection(appConfig.solana.rpcUrl, 'confirmed');
  
  // Load test wallet
  const wallet = loadWalletFromFile();
  console.log(`Using wallet: ${wallet.publicKey.toString()}`);
  
  // Get program ID from config
  const programId = new PublicKey(appConfig.solana.multiHubSwap.programId);
  console.log(`Multi-Hub Swap Program ID: ${programId.toString()}`);
  
  // Check wallet SOL balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Wallet SOL balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  
  // Find the liquidity contribution account PDA for this wallet
  const [liquidityContributionAccount, bump] = findLiquidityContributionAddress(
    wallet.publicKey,
    programId
  );
  
  console.log(`Liquidity contribution account address: ${liquidityContributionAccount.toString()}`);
  console.log(`Bump seed: ${bump}`);
  
  // Check if the account exists
  const accountInfo = await connection.getAccountInfo(liquidityContributionAccount);
  if (accountInfo) {
    console.log('✅ Liquidity contribution account exists!');
    console.log(`Account data length: ${accountInfo.data.length} bytes`);
    console.log(`Account owner: ${accountInfo.owner.toString()}`);
    
    // Try to print some data if available
    if (accountInfo.data.length > 0) {
      console.log(`First few bytes: ${Buffer.from(accountInfo.data).slice(0, 8).toString('hex')}`);
    }
  } else {
    console.log('❌ Liquidity contribution account does not exist');
    console.log('You need to create it before trying to perform a swap');
    console.log('Use the ensureLiquidityContributionAccount function in solToYotSwapV3.ts');
  }
}

// Run the test
testLiquidityAccountFix().catch(err => {
  console.error('Test failed:', err);
});