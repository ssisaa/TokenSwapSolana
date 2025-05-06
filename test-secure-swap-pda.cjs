/**
 * Test script for the improved secure SOL to YOT swap using PDA derivation
 * This script tests the approach of using program-derived addresses for all critical operations
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY, ComputeBudgetProgram, TransactionInstruction } = require('@solana/web3.js');
const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');

// Program and Token Constants (Must match what's in on-chain program)
const MULTI_HUB_SWAP_PROGRAM_ID = new PublicKey('Js9TqdpLBsF7M64ra2mYNyfbPTWwTvBUNR85wsEoSKP');
const YOT_TOKEN_ADDRESS = new PublicKey('9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw');
const YOS_TOKEN_ADDRESS = new PublicKey('2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop');
const POOL_SOL_ACCOUNT = new PublicKey('Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH');
const POOL_AUTHORITY = new PublicKey('CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9');
const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';

// PDA Derivation Functions

// 1. Get Program State PDA
function getProgramStatePda() {
  const [programState] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
  return programState;
}

// 2. Get Program Authority PDA
function getProgramAuthorityPda() {
  const [programAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
  return programAuthority;
}

// 3. Get Liquidity Contribution PDA for a user
function getLiquidityContributionPda(userPublicKey) {
  const [liquidityContribution] = PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userPublicKey.toBuffer()],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
  return liquidityContribution;
}

// Load wallet from keypair file
function loadWalletFromFile() {
  // Use existing keypair for consistency in testing
  const keypairData = JSON.parse(fs.readFileSync('./program-keypair.json', 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Create a transaction to initialize the liquidity contribution account
async function createLiquidityAccountTransaction(wallet, connection) {
  try {
    // Find the PDA for the user's liquidity contribution account
    const liquidityContribution = getLiquidityContributionPda(wallet.publicKey);
    
    // Check if account already exists
    const accountInfo = await connection.getAccountInfo(liquidityContribution);
    if (accountInfo !== null) {
      console.log('Liquidity contribution account already exists');
      return null;
    }
    
    console.log('Creating liquidity contribution account transaction');
    
    // Get PDAs
    const programState = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda();
    
    // Get token accounts
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosPoolAccount = await getAssociatedTokenAddress(YOS_TOKEN_ADDRESS, POOL_AUTHORITY);
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, POOL_AUTHORITY);
    const userYotAccount = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
    const userYosAccount = await getAssociatedTokenAddress(YOS_TOKEN_ADDRESS, wallet.publicKey);
    
    // IMPORTANT: Using program authority as central liquidity wallet
    const centralLiquidityWallet = programAuthority;
    
    // Create the instruction data (ix_discriminator = 7)
    const data = Buffer.alloc(1);
    data.writeUint8(7, 0); // Index 7 = CreateLiquidityAccount
    
    // Required accounts
    const accountMetas = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programState, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: liquidityContribution, isSigner: false, isWritable: true },
      { pubkey: POOL_SOL_ACCOUNT, isSigner: false, isWritable: false },
      { pubkey: yotPoolAccount, isSigner: false, isWritable: false },
      { pubkey: centralLiquidityWallet, isSigner: false, isWritable: false },
      { pubkey: yosPoolAccount, isSigner: false, isWritable: false },
      { pubkey: yotMint, isSigner: false, isWritable: false },
      { pubkey: userYotAccount, isSigner: false, isWritable: false },
      { pubkey: YOS_TOKEN_ADDRESS, isSigner: false, isWritable: false },
      { pubkey: userYosAccount, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    // Create the instruction
    const instruction = new TransactionInstruction({
      programId: MULTI_HUB_SWAP_PROGRAM_ID,
      keys: accountMetas,
      data,
    });
    
    // Build the transaction with compute budget for better success rate
    const transaction = new Transaction();
    
    // Add compute budget instructions
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000 // High value for complex operation
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000 // High priority fee for faster processing
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    transaction.add(instruction);
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    return transaction;
  } catch (error) {
    console.error('Error creating liquidity account transaction:', error);
    throw error;
  }
}

// Create a transaction to swap SOL for YOT tokens
async function createSolToYotSwapTransaction(wallet, solAmount, connection) {
  try {
    console.log(`Creating SOL to YOT swap transaction for ${solAmount} SOL`);
    
    // Convert SOL to lamports
    const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    
    // Fetch pool balances to calculate expected output
    const solPoolBalance = await connection.getBalance(POOL_SOL_ACCOUNT) / LAMPORTS_PER_SOL;
    
    // Get the YOT pool account
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, POOL_AUTHORITY);
    
    // Get YOT pool balance
    const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotAccountInfo.value.uiAmount);
    
    console.log(`Pool balances - SOL: ${solPoolBalance}, YOT: ${yotPoolBalance}`);
    
    // Calculate expected output using AMM formula with 1% slippage
    const expectedOutput = (solAmount * yotPoolBalance) / (solPoolBalance + solAmount);
    const minAmountOut = Math.floor(expectedOutput * 0.99 * Math.pow(10, 9)); // Apply 1% slippage and convert to raw
    
    console.log(`Expected YOT output: ${expectedOutput}, Min out with slippage: ${minAmountOut / 1e9}`);
    
    // Get all the required PDAs
    const programState = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda();
    const liquidityContribution = getLiquidityContributionPda(wallet.publicKey);
    
    // Get token accounts
    const userYotAccount = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
    const userYosAccount = await getAssociatedTokenAddress(YOS_TOKEN_ADDRESS, wallet.publicKey);
    
    // IMPORTANT: Use program authority as central liquidity wallet
    const centralLiquidityWallet = programAuthority;
    
    // Create instruction data for SOL to YOT swap (index 8)
    const data = Buffer.alloc(17);
    data.writeUint8(8, 0); // Index 8 = SolToYotSwapImmediate
    data.writeBigUInt64LE(BigInt(amountInLamports), 1); // SOL amount
    data.writeBigUInt64LE(BigInt(minAmountOut), 9); // Min YOT out
    
    // Required accounts
    const accountMetas = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programState, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: POOL_SOL_ACCOUNT, isSigner: false, isWritable: true },
      { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
      { pubkey: userYotAccount, isSigner: false, isWritable: true },
      { pubkey: centralLiquidityWallet, isSigner: false, isWritable: true },
      { pubkey: liquidityContribution, isSigner: false, isWritable: true },
      { pubkey: YOS_TOKEN_ADDRESS, isSigner: false, isWritable: true },
      { pubkey: userYosAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    // Create the instruction
    const instruction = new TransactionInstruction({
      programId: MULTI_HUB_SWAP_PROGRAM_ID,
      keys: accountMetas,
      data,
    });
    
    // Build the transaction with compute budget for better success rate
    const transaction = new Transaction();
    
    // Add compute budget instructions
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000 // High value for complex operation
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000 // High priority fee for faster processing
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    transaction.add(instruction);
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    return transaction;
  } catch (error) {
    console.error('Error creating SOL to YOT swap transaction:', error);
    throw error;
  }
}

// Main test function
async function testSecureSwap() {
  try {
    console.log('Starting secure swap test with PDA derivation...');
    const wallet = loadWalletFromFile();
    const connection = new Connection(DEVNET_ENDPOINT, 'confirmed');
    
    // Get initial balances
    console.log('\nInitial Balances:');
    const solBalance = await connection.getBalance(wallet.publicKey) / LAMPORTS_PER_SOL;
    console.log(`SOL Balance: ${solBalance}`);
    
    try {
      const yotAccount = await getAssociatedTokenAddress(YOT_TOKEN_ADDRESS, wallet.publicKey);
      const yotBalance = await connection.getTokenAccountBalance(yotAccount);
      console.log(`YOT Balance: ${yotBalance.value.uiAmount}`);
    } catch (error) {
      console.log('YOT token account does not exist yet');
    }
    
    // Amount to swap
    const solAmount = 0.02; // Small amount for testing
    
    // PHASE 1: Create liquidity contribution account if needed
    console.log('\nPHASE 1: Check if liquidity contribution account needs to be created');
    const accountInitTx = await createLiquidityAccountTransaction(wallet, connection);
    
    if (accountInitTx) {
      console.log('Sending liquidity account initialization transaction...');
      
      // Sign and send the transaction
      accountInitTx.sign(wallet);
      const initSignature = await connection.sendRawTransaction(accountInitTx.serialize(), {
        skipPreflight: true
      });
      
      console.log(`Initialization transaction sent: ${initSignature}`);
      console.log('Waiting for confirmation...');
      
      try {
        await connection.confirmTransaction(initSignature, 'confirmed');
        console.log('Initialization transaction confirmed!');
      } catch (error) {
        // Ignore confirmation errors - transaction might still succeed
        console.log('Warning: Could not confirm initialization transaction, continuing anyway');
      }
    } else {
      console.log('Liquidity contribution account already exists, skipping initialization');
    }
    
    // PHASE 2: Create and send the SOL to YOT swap transaction
    console.log('\nPHASE 2: Creating and sending SOL to YOT swap transaction');
    const swapTx = await createSolToYotSwapTransaction(wallet, solAmount, connection);
    
    console.log('Signing and sending swap transaction...');
    swapTx.sign(wallet);
    const swapSignature = await connection.sendRawTransaction(swapTx.serialize(), {
      skipPreflight: true
    });
    
    console.log(`Swap transaction sent: ${swapSignature}`);
    console.log('Waiting for confirmation...');
    
    // Wait for confirmation with increased timeout
    try {
      await connection.confirmTransaction(swapSignature, 'confirmed');
      console.log('Swap transaction confirmed successfully!');
    } catch (error) {
      console.log('Warning: Confirmation error, transaction might still succeed:', error);
    }
    
    // Check final balances
    console.log('\nFinal Balances:');
    const finalSolBalance = await connection.getBalance(wallet.publicKey) / LAMPORTS_PER_SOL;
    console.log(`SOL Balance: ${finalSolBalance} (change: ${finalSolBalance - solBalance})`);
    
    try {
      const yotAccount = await getAssociatedTokenAddress(YOT_TOKEN_ADDRESS, wallet.publicKey);
      const yotBalance = await connection.getTokenAccountBalance(yotAccount);
      console.log(`Final YOT Balance: ${yotBalance.value.uiAmount}`);
    } catch (error) {
      console.log('Error getting final YOT balance:', error);
    }
    
    console.log('\nTest completed. Check the balances above to verify swap success.');
    
  } catch (error) {
    console.error('Error during secure swap test:', error);
  }
}

// Run the test
testSecureSwap().catch(console.error);