/**
 * Test script for SOL to YOT swap using the sequential (two-phase) approach
 * This script tests our solution for the "account already borrowed" error
 * First running test-create-liquidity-account.cjs to create the account,
 * then executing the actual swap transaction separately
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY, ComputeBudgetProgram, TransactionInstruction } = require('@solana/web3.js');
const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
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
  
  // YOS Balance
  try {
    const yosAccount = await getAssociatedTokenAddress(
      new PublicKey(YOS_TOKEN_ADDRESS),
      wallet.publicKey
    );
    
    const yosBalance = await connection.getTokenAccountBalance(yosAccount);
    console.log(`YOS balance: ${yosBalance.value.uiAmount} YOS`);
  } catch (error) {
    console.log('No YOS token account found');
  }
  
  // Check liquidity contribution account
  const liquidityContributionAddress = getLiquidityContributionPda(wallet.publicKey);
  const liquidityAccountInfo = await connection.getAccountInfo(liquidityContributionAddress);
  console.log(`Liquidity contribution account exists: ${liquidityAccountInfo !== null}`);
  if (liquidityAccountInfo) {
    console.log(`Liquidity account size: ${liquidityAccountInfo.data.length} bytes`);
  }
  
  console.log('------------------------\n');
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

// Execute the swap transaction (PHASE 2)
async function executeSwap(wallet, solAmount) {
  try {
    console.log(`PHASE 2: Executing SOL to YOT swap for ${solAmount} SOL...`);
    
    // Convert SOL to lamports
    const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    
    // Get program PDAs
    const programStateAddress = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda();
    const liquidityContributionAddress = getLiquidityContributionPda(wallet.publicKey);
    
    // Get token accounts
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, new PublicKey(POOL_AUTHORITY));
    const userYotAccount = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
    const userYosAccount = await getAssociatedTokenAddress(yosMint, wallet.publicKey);
    
    // Calculate expected output based on pool balances
    const solPoolBalance = await connection.getBalance(new PublicKey(POOL_SOL_ACCOUNT)) / LAMPORTS_PER_SOL;
    const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotAccountInfo.value.uiAmount);
    
    // Calculate expected output using AMM formula
    const expectedOutput = (solAmount * yotPoolBalance) / (solPoolBalance + solAmount);
    
    // Apply slippage tolerance (1%)
    const minAmountOut = Math.floor(expectedOutput * 0.99 * Math.pow(10, 9));
    
    console.log(`Pool balances - SOL: ${solPoolBalance}, YOT: ${yotPoolBalance}`);
    console.log(`Expected output: ${expectedOutput} YOT`);
    console.log(`Min output with slippage: ${minAmountOut / Math.pow(10, 9)} YOT`);
    
    // Create instruction data for SOL to YOT swap (index 8)
    const data = Buffer.alloc(17);
    data.writeUint8(8, 0); // SolToYotSwapImmediate instruction
    data.writeBigUInt64LE(BigInt(amountInLamports), 1);
    data.writeBigUInt64LE(BigInt(minAmountOut), 9);
    
    // IMPORTANT: Use program authority as central liquidity wallet
    const centralLiquidityWallet = programAuthority;
    
    // Account metas for the swap instruction
    const accountMetas = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(POOL_SOL_ACCOUNT), isSigner: false, isWritable: true },
      { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
      { pubkey: userYotAccount, isSigner: false, isWritable: true },
      { pubkey: centralLiquidityWallet, isSigner: false, isWritable: true },
      { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
      { pubkey: yosMint, isSigner: false, isWritable: true },
      { pubkey: userYosAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    const instruction = new TransactionInstruction({
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
      keys: accountMetas,
      data,
    });
    
    // Create transaction with compute budget
    const transaction = new Transaction();
    
    // Add compute budget instructions
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    transaction.add(instruction);
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    const signedTx = await wallet.signTransaction(transaction);
    console.log('Sending transaction...');
    
    const signature = await connection.sendRawTransaction(signedTx.serialize(), { 
      skipPreflight: true 
    });
    
    console.log(`Transaction sent: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    try {
      console.log('Waiting for confirmation...');
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('Transaction confirmed! 🎉');
      
      return { success: true, signature };
    } catch (error) {
      console.error(`Error confirming transaction: ${error.message}`);
      return { success: false, signature, error: error.message };
    }
  } catch (error) {
    console.error(`Error executing swap: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Main test function
async function testSequentialSwap() {
  try {
    console.log('==============================================');
    console.log('SEQUENTIAL SOL TO YOT SWAP TEST');
    console.log('==============================================');
    
    // Load wallet
    const keypair = loadWalletFromFile();
    const mockWallet = createMockWallet(keypair);
    console.log(`Using wallet: ${keypair.publicKey.toString()}`);
    
    // Display PDAs
    console.log('\n--- PDAs ---');
    console.log(`Program State: ${getProgramStatePda().toString()}`);
    console.log(`Program Authority: ${getProgramAuthorityPda().toString()}`);
    console.log(`Liquidity Contribution: ${getLiquidityContributionPda(keypair.publicKey).toString()}`);
    console.log('------------\n');
    
    // Check initial balances
    await checkBalances(keypair);
    
    // PHASE 1: Verify Liquidity Contribution Account exists
    console.log('PHASE 1: Verifying liquidity contribution account...');
    const liquidityContributionAddress = getLiquidityContributionPda(keypair.publicKey);
    const accountInfo = await connection.getAccountInfo(liquidityContributionAddress);
    
    if (!accountInfo) {
      console.log('⚠️ Liquidity contribution account does not exist!');
      console.log('Please run test-create-liquidity-account.cjs first.');
      return;
    }
    
    console.log('✅ Liquidity contribution account exists. Size: ' + accountInfo.data.length + ' bytes');
    
    // PHASE 2: Execute the swap
    const solAmount = 0.01; // Small test amount
    const swapResult = await executeSwap(mockWallet, solAmount);
    
    if (swapResult.success) {
      console.log(`\n✅ Swap succeeded! Transaction: ${swapResult.signature}`);
    } else {
      console.log(`\n❌ Swap failed: ${swapResult.error}`);
    }
    
    // Check final balances
    await checkBalances(keypair);
    
    console.log('Test completed!');
  } catch (error) {
    console.error('Error during sequential swap test:', error);
  }
}

// Run the test
testSequentialSwap();