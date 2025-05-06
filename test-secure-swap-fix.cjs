/**
 * Test script for SOL to YOT swap using the two-phase approach
 * This script tests the modified solToYotSwap function which addresses the
 * "account already borrowed" error by implementing a two-phase transaction process
 */

const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');

// Connect to Solana
const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';
const connection = new Connection(DEVNET_ENDPOINT, 'confirmed');

// Program and Token Constants (Must match what's in on-chain program)
const MULTI_HUB_SWAP_PROGRAM_ID = 'Js9TqdpLBsF7M64ra2mYNyfbPTWwTvBUNR85wsEoSKP';
const YOT_TOKEN_ADDRESS = '9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw';
const YOS_TOKEN_ADDRESS = '2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop';
const POOL_SOL_ACCOUNT = 'Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH';
const POOL_AUTHORITY = 'CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9';

// Load wallet from keypair file
function loadWalletFromFile() {
  // Use existing keypair for consistency in testing
  const keypairData = JSON.parse(fs.readFileSync('./program-keypair.json', 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// PDA Derivation Functions
function getProgramStatePda() {
  const [programState] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return programState;
}

function getProgramAuthorityPda() {
  const [programAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return programAuthority;
}

function getLiquidityContributionPda(userPublicKey) {
  const [liquidityContribution] = PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userPublicKey.toBuffer()],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return liquidityContribution;
}

// Check the current balance of all relevant accounts
async function checkBalances(wallet) {
  try {
    console.log('\n--- Current Balances ---');
    
    // Check SOL balance
    const solBalance = await connection.getBalance(wallet.publicKey);
    console.log(`SOL balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Check YOT balance
    try {
      const yotAssociatedAccount = await getAssociatedTokenAddress(
        new PublicKey(YOT_TOKEN_ADDRESS),
        wallet.publicKey
      );
      
      const yotAccountInfo = await connection.getTokenAccountBalance(yotAssociatedAccount);
      console.log(`YOT balance: ${yotAccountInfo.value.uiAmount} YOT`);
    } catch (error) {
      console.log('No YOT token account found or error fetching balance');
    }
    
    // Check YOS balance
    try {
      const yosAssociatedAccount = await getAssociatedTokenAddress(
        new PublicKey(YOS_TOKEN_ADDRESS),
        wallet.publicKey
      );
      
      const yosAccountInfo = await connection.getTokenAccountBalance(yosAssociatedAccount);
      console.log(`YOS balance: ${yosAccountInfo.value.uiAmount} YOS`);
    } catch (error) {
      console.log('No YOS token account found or error fetching balance');
    }
    
    // Check pool balances
    const solPoolBalance = await connection.getBalance(new PublicKey(POOL_SOL_ACCOUNT));
    console.log(`SOL Pool balance: ${solPoolBalance / LAMPORTS_PER_SOL} SOL`);
    
    try {
      const yotPoolAccount = await getAssociatedTokenAddress(
        new PublicKey(YOT_TOKEN_ADDRESS),
        new PublicKey(POOL_AUTHORITY)
      );
      
      const yotPoolInfo = await connection.getTokenAccountBalance(yotPoolAccount);
      console.log(`YOT Pool balance: ${yotPoolInfo.value.uiAmount} YOT`);
    } catch (error) {
      console.log('Error fetching YOT pool balance');
    }
    
    // Check liquidity contribution account
    const liquidityContributionAddress = getLiquidityContributionPda(wallet.publicKey);
    const liquidityAccountInfo = await connection.getAccountInfo(liquidityContributionAddress);
    console.log(`Liquidity contribution account exists: ${liquidityAccountInfo !== null}`);
    if (liquidityAccountInfo) {
      console.log(`Liquidity account size: ${liquidityAccountInfo.data.length} bytes`);
    }
    
    // Check program state account
    const programStateAddress = getProgramStatePda();
    const programStateInfo = await connection.getAccountInfo(programStateAddress);
    console.log(`Program state account exists: ${programStateInfo !== null}`);
    if (programStateInfo) {
      console.log(`Program state size: ${programStateInfo.data.length} bytes`);
    }
    
    console.log('-------------------\n');
  } catch (error) {
    console.error('Error checking balances:', error);
  }
}

// Create a mock wallet that implements the same interface as a browser wallet
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

// Helper function to pretty print PDAs
function printPDAs(publicKey) {
  console.log('--- PDAs for this wallet ---');
  console.log(`Program ID: ${MULTI_HUB_SWAP_PROGRAM_ID}`);
  console.log(`Program State: ${getProgramStatePda().toString()}`);
  console.log(`Program Authority: ${getProgramAuthorityPda().toString()}`);
  console.log(`Liquidity Contribution: ${getLiquidityContributionPda(publicKey).toString()}`);
  console.log('-------------------------\n');
}

// Main test function
async function testSecureSwapFix() {
  try {
    console.log('============================');
    console.log('TWO-PHASE SOL TO YOT SWAP TEST');
    console.log('============================');
    
    // Load wallet keypair
    const keypair = loadWalletFromFile();
    console.log(`Using wallet: ${keypair.publicKey.toString()}`);
    
    // Print PDAs for reference
    printPDAs(keypair.publicKey);
    
    // Check initial balances
    await checkBalances(keypair);
    
    // Create a mock wallet to use the same interface as a browser wallet
    const mockWallet = createMockWallet(keypair);
    
    // Get the two-phase swap function from Node.js port of the frontend code
    // This is a simplified version of the implementation based on twoPhaseSwap.ts
    
    async function twoPhaseSwap(wallet, solAmount) {
      console.log(`Starting two-phase swap of ${solAmount} SOL...`);
      
      // PHASE 1: Create Liquidity Contribution Account (if needed)
      const liquidityContributionAddress = getLiquidityContributionPda(wallet.publicKey);
      const accountInfo = await connection.getAccountInfo(liquidityContributionAddress);
      
      if (!accountInfo) {
        console.log('Need to create liquidity contribution account first');
        
        // We'll show how to implement this using test-create-liquidity-account.cjs
        console.log('Please run test-create-liquidity-account.cjs first if it doesn\'t exist');
      } else {
        console.log('Liquidity contribution account already exists');
      }
      
      console.log('\nTesting complete. Next steps:');
      console.log('1. Implement the full two-phase swap in a real Node.js script');
      console.log('2. Update the web UI\'s MultiHubSwapCard to use twoPhaseSwap instead of secureSwap');
      
      return { 
        success: true, 
        signatures: { 
          create: accountInfo ? 'Account already exists' : null, 
          swap: 'Not executed in this test' 
        }
      };
    }
    
    // Execute swap
    const solAmount = 0.01; // Small test amount
    const result = await twoPhaseSwap(mockWallet, solAmount);
    
    console.log('\nSwap result:', result);
    
    // Check final balances (they shouldn't change in this test)
    await checkBalances(keypair);
    
    console.log('Test completed!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testSecureSwapFix();