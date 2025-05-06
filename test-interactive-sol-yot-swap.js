/**
 * Interactive test script for SOL to YOT swap using the web UI
 * This test demonstrates the user experience of performing a swap through the web interface
 */

import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import * as readline from 'readline';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Program and Token Constants (Must match what's in on-chain program)
const MULTI_HUB_SWAP_PROGRAM_ID = 'Js9TqdpLBsF7M64ra2mYNyfbPTWwTvBUNR85wsEoSKP';
const YOT_TOKEN_ADDRESS = '9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw';
const YOS_TOKEN_ADDRESS = '2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop';
const POOL_SOL_ACCOUNT = 'Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH';
const POOL_AUTHORITY = 'CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9';
const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';

// Create a readline interface for user interaction
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Load wallet from keypair file
function loadWalletFromFile() {
  try {
    // Use existing keypair for consistency in testing
    const keypairData = JSON.parse(fs.readFileSync('./program-keypair.json', 'utf-8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    console.error('Error loading wallet:', error);
    process.exit(1);
  }
}

// Display wallet balance
async function displayWalletBalance(connection, wallet) {
  try {
    // Get SOL balance
    const solBalance = await connection.getBalance(wallet.publicKey);
    console.log(`SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Try to get YOT balance if token account exists
    try {
      const yotAccount = await getAssociatedTokenAddress(
        new PublicKey(YOT_TOKEN_ADDRESS),
        wallet.publicKey
      );
      
      const yotAccountInfo = await connection.getAccountInfo(yotAccount);
      if (yotAccountInfo) {
        const tokenBalance = await connection.getTokenAccountBalance(yotAccount);
        console.log(`YOT Balance: ${tokenBalance.value.uiAmount} YOT`);
      } else {
        console.log('YOT token account does not exist yet');
      }
    } catch (error) {
      console.log('YOT token account does not exist yet');
    }
    
    // Try to get YOS balance if token account exists
    try {
      const yosAccount = await getAssociatedTokenAddress(
        new PublicKey(YOS_TOKEN_ADDRESS),
        wallet.publicKey
      );
      
      const yosAccountInfo = await connection.getAccountInfo(yosAccount);
      if (yosAccountInfo) {
        const tokenBalance = await connection.getTokenAccountBalance(yosAccount);
        console.log(`YOS Balance: ${tokenBalance.value.uiAmount} YOS`);
      } else {
        console.log('YOS token account does not exist yet');
      }
    } catch (error) {
      console.log('YOS token account does not exist yet');
    }
  } catch (error) {
    console.error('Error getting balances:', error);
  }
}

// Calculate expected output based on pool data
async function calculateExpectedOutput(connection, solAmount) {
  try {
    // Get SOL pool balance
    const solPoolBalance = await connection.getBalance(new PublicKey(POOL_SOL_ACCOUNT));
    const solPoolBalanceNormalized = solPoolBalance / LAMPORTS_PER_SOL;
    
    // Get YOT pool balance
    const yotPoolAccount = await getAssociatedTokenAddress(
      new PublicKey(YOT_TOKEN_ADDRESS),
      new PublicKey(POOL_AUTHORITY)
    );
    
    const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotAccountInfo.value.uiAmount || 0);
    
    console.log(`Pool Balances: SOL=${solPoolBalanceNormalized}, YOT=${yotPoolBalance}`);
    
    // Calculate expected output using AMM formula
    const expectedOutput = (solAmount * yotPoolBalance) / (solPoolBalanceNormalized + solAmount);
    
    // Calculate distribution based on configured rates
    const lpContributionRate = 0.2; // 20%
    const yosCashbackRate = 0.05;   // 5%
    const userRate = 1 - lpContributionRate - yosCashbackRate; // 75%
    
    const userOutput = expectedOutput * userRate;
    const liquidityOutput = expectedOutput * lpContributionRate;
    const yosCashback = expectedOutput * yosCashbackRate;
    
    return {
      totalOutput: expectedOutput,
      userOutput,
      liquidityOutput,
      yosCashback
    };
  } catch (error) {
    console.error('Error calculating expected output:', error);
    return {
      totalOutput: 0,
      userOutput: 0,
      liquidityOutput: 0,
      yosCashback: 0
    };
  }
}

// PDA derivation utility functions
function getProgramStatePda() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  )[0];
}

function getProgramAuthorityPda() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  )[0];
}

function getLiquidityContributionPda(userPublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userPublicKey.toBuffer()],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  )[0];
}

// Display PDAs
function displayPDAs(wallet) {
  const programState = getProgramStatePda();
  const programAuthority = getProgramAuthorityPda();
  const liquidityContribution = getLiquidityContributionPda(wallet.publicKey);
  
  console.log(`\nProgram-Derived Addresses (PDAs):`);
  console.log(`• Program ID: ${MULTI_HUB_SWAP_PROGRAM_ID}`);
  console.log(`• Program State: ${programState.toString()}`);
  console.log(`• Program Authority: ${programAuthority.toString()}`);
  console.log(`• Liquidity Contribution: ${liquidityContribution.toString()}`);
  console.log(`• SOL Pool Account: ${POOL_SOL_ACCOUNT}`);
  console.log(`• Pool Authority: ${POOL_AUTHORITY}`);
  
  console.log(`\nToken Addresses:`);
  console.log(`• YOT Token: ${YOT_TOKEN_ADDRESS}`);
  console.log(`• YOS Token: ${YOS_TOKEN_ADDRESS}`);
}

// Main function to simulate interactive swap experience
async function interactiveSwapTest() {
  try {
    console.log('='.repeat(80));
    console.log('INTERACTIVE SOL TO YOT SWAP TEST');
    console.log('='.repeat(80));
    
    // Load wallet and connect to devnet
    const wallet = loadWalletFromFile();
    const connection = new Connection(DEVNET_ENDPOINT, 'confirmed');
    
    console.log(`\nWallet Public Key: ${wallet.publicKey.toString()}`);
    
    // Display PDAs
    displayPDAs(wallet);
    
    // Display initial balances
    console.log('\nInitial Balances:');
    await displayWalletBalance(connection, wallet);
    
    // Ask for swap amount
    console.log('\n' + '-'.repeat(80));
    const solAmount = parseFloat(await ask('Enter SOL amount to swap (e.g., 0.01): '));
    if (isNaN(solAmount) || solAmount <= 0) {
      console.log('Invalid amount. Exiting...');
      rl.close();
      return;
    }
    
    // Calculate expected output
    console.log('\nCalculating expected output...');
    const { totalOutput, userOutput, liquidityOutput, yosCashback } = 
      await calculateExpectedOutput(connection, solAmount);
    
    console.log(`\nExpected Output for ${solAmount} SOL:`);
    console.log(`• Total YOT: ${totalOutput.toFixed(2)}`);
    console.log(`• User Receives (75%): ${userOutput.toFixed(2)} YOT`);
    console.log(`• Liquidity Pool (20%): ${liquidityOutput.toFixed(2)} YOT`);
    console.log(`• YOS Cashback (5%): ${yosCashback.toFixed(2)} YOS`);
    
    // Confirm swap
    console.log('\n' + '-'.repeat(80));
    const confirm = await ask('Proceed with swap? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Swap cancelled. Exiting...');
      rl.close();
      return;
    }
    
    // Show instructions for web UI
    console.log('\n' + '-'.repeat(80));
    console.log('INSTRUCTIONS FOR WEB UI SWAP:');
    console.log('-'.repeat(80));
    console.log('1. Go to the Swap tab in the web UI');
    console.log('2. Connect your wallet (Phantom or Solflare)');
    console.log('3. Select SOL as the From token');
    console.log('4. Select YOT as the To token');
    console.log(`5. Enter ${solAmount} as the amount to swap`);
    console.log('6. Click "Swap" and approve the transaction in your wallet');
    console.log('\nAfter the swap is complete, return here and press Enter to continue...');
    
    await ask('Press Enter when the swap is complete...');
    
    // Display final balances
    console.log('\nFinal Balances:');
    await displayWalletBalance(connection, wallet);
    
    console.log('\nSwap test completed!');
    rl.close();
  } catch (error) {
    console.error('Error during swap test:', error);
    rl.close();
  }
}

// Run the interactive test
interactiveSwapTest().catch(console.error);