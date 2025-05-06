// @ts-check\n// ESModule\n
/**
 * Test script for the enhanced SOL to YOT swap with liquidity contribution fix
 * This tests the new two-step process in solToYotSwapV3.ts
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';

// Load configuration from app.config.json
const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
const solanaConfig = appConfig.solana;

// Connection to Solana
const connection = new Connection(solanaConfig.rpcUrl, 'confirmed');

// Load wallet from file
function loadWalletFromFile() {
  try {
    // Try to load from program-keypair.json first
    const keypairData = JSON.parse(fs.readFileSync('./program-keypair.json', 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (e) {
    console.log('Failed to load from program-keypair.json, trying .keypair-test.json');
    
    try {
      // Try to load from .keypair-test.json as fallback
      const keypairData = JSON.parse(fs.readFileSync('./.keypair-test.json', 'utf8'));
      return Keypair.fromSecretKey(new Uint8Array(keypairData));
    } catch (e) {
      console.error('Failed to load wallet. Please ensure either program-keypair.json or .keypair-test.json exists.');
      process.exit(1);
    }
  }
}

// Helper functions
function findProgramStateAddress(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    programId
  );
}

function findProgramAuthority(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    programId
  );
}

function findLiquidityContributionAddress(userWallet, programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.toBuffer()],
    programId
  );
}

// Check balances
async function checkBalances(wallet) {
  const solBalance = await connection.getBalance(wallet.publicKey);
  console.log(`SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
  
  try {
    console.log('Checking YOT token balance...');
    const { TokenAccountNotFoundError, getAssociatedTokenAddress } = await import('@solana/spl-token');
    
    const yotTokenMint = new PublicKey(solanaConfig.tokens.yot.address);
    const userTokenAddress = await getAssociatedTokenAddress(
      yotTokenMint,
      wallet.publicKey
    );
    
    try {
      const tokenBalance = await connection.getTokenAccountBalance(userTokenAddress);
      console.log(`YOT Balance: ${tokenBalance.value.uiAmount} YOT`);
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        console.log('YOT token account does not exist yet');
      } else {
        console.error('Error checking YOT balance:', error);
      }
    }
  } catch (error) {
    console.error('Error in YOT balance check:', error);
  }
  
  try {
    console.log('Checking YOS token balance...');
    const { getAssociatedTokenAddress } = await import('@solana/spl-token');
    
    const yosTokenMint = new PublicKey(solanaConfig.tokens.yos.address);
    const userYosAddress = await getAssociatedTokenAddress(
      yosTokenMint,
      wallet.publicKey
    );
    
    try {
      const yosBalance = await connection.getTokenAccountBalance(userYosAddress);
      console.log(`YOS Balance: ${yosBalance.value.uiAmount} YOS`);
    } catch (error) {
      console.log('YOS token account does not exist yet');
    }
  } catch (error) {
    console.error('Error in YOS balance check:', error);
  }
}

// Check if liquidity contribution account exists
async function checkLiquidityContributionAccount(wallet) {
  const programId = new PublicKey(solanaConfig.multiHubSwap.programId);
  const [contributionAddress] = findLiquidityContributionAddress(wallet.publicKey, programId);
  
  console.log(`Checking liquidity contribution account: ${contributionAddress.toString()}`);
  
  const accountInfo = await connection.getAccountInfo(contributionAddress);
  if (accountInfo) {
    console.log('Liquidity contribution account exists with data length:', accountInfo.data.length);
    return true;
  } else {
    console.log('Liquidity contribution account does not exist');
    return false;
  }
}

// Main test function
async function testLiquidityContributionFix() {
  try {
    console.log('Testing enhanced SOL-YOT swap with liquidity contribution fix');
    
    // Load wallet
    const wallet = loadWalletFromFile();
    console.log(`Using wallet: ${wallet.publicKey.toString()}`);
    
    // Check balances before
    console.log('\n--- Balances Before ---');
    await checkBalances(wallet);
    
    // Check if liquidity contribution account exists
    const hasContribution = await checkLiquidityContributionAccount(wallet);
    
    // Delete the liquidity contribution account if it exists (for testing purposes)
    if (hasContribution) {
      console.log('\nLiquidity contribution account already exists.');
      console.log('For testing purposes, we would need to delete it and recreate.');
      console.log('However, this requires special instructions not available in this test.');
      
      const proceed = process.argv.includes('--force');
      if (!proceed) {
        console.log('\nTo continue testing with the existing account, run with --force flag');
        process.exit(0);
      }
    }
    
    // Import the two-step swap implementation
    const swapModule = await import('./client/src/lib/solToYotSwapV3.js');
    
    // Create a wrapper around the Node.js wallet for compatibility with web wallet
    const walletAdapter = {
      publicKey: wallet.publicKey,
      signTransaction: async (transaction) => {
        transaction.sign(wallet);
        return transaction;
      }
    };
    
    // Execute the swap with a small amount of SOL (0.01)
    const solAmount = 0.01;
    console.log(`\nAttempting to swap ${solAmount} SOL for YOT tokens...`);
    
    const result = await swapModule.solToYotSwapV3(walletAdapter, solAmount);
    
    console.log('\nSwap Result:', JSON.stringify(result, null, 2));
    
    if (result.accountCreated) {
      console.log('\nLiquidity contribution account was created with signature:', 
        result.accountCreationSignature);
    }
    
    if (result.success) {
      console.log('\nSwap was successful with signature:', result.signature);
    } else {
      console.error('\nSwap failed:', result.message);
    }
    
    // Check balances after
    console.log('\n--- Balances After ---');
    await checkBalances(wallet);
    
    // Check if liquidity contribution account now exists
    await checkLiquidityContributionAccount(wallet);
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testLiquidityContributionFix();