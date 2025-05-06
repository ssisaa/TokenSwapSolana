/**
 * Test script for SOL to YOT swap using a sequential approach
 * This script implements a two-phase approach with separate transactions
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY, ComputeBudgetProgram, TransactionInstruction } = require('@solana/web3.js');
const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } = require('@solana/spl-token');
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

// Ensure a token account exists for the user
async function ensureTokenAccount(connection, wallet, mint) {
  try {
    const associatedTokenAddress = await getAssociatedTokenAddress(mint, wallet.publicKey);
    
    // Check if account exists
    const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
    if (accountInfo) {
      console.log(`Token account for ${mint.toString()} already exists`);
      return associatedTokenAddress;
    }
    
    console.log(`Creating token account for ${mint.toString()}`);
    const transaction = new Transaction();
    
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        associatedTokenAddress,
        wallet.publicKey,
        mint
      )
    );
    
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    console.log(`Created token account, signature: ${signature}`);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature);
    
    return associatedTokenAddress;
  } catch (error) {
    console.error('Error ensuring token account:', error);
    throw error;
  }
}

// PHASE 1: Create liquidity contribution account - completely separate transaction
async function createLiquidityAccount(connection, wallet) {
  try {
    const liquidityContributionAddress = getLiquidityContributionPda(wallet.publicKey);
    
    // Check if account already exists
    const accountInfo = await connection.getAccountInfo(liquidityContributionAddress);
    if (accountInfo) {
      console.log(`Liquidity contribution account already exists at: ${liquidityContributionAddress}`);
      return true;
    }
    
    console.log(`Creating liquidity contribution account at: ${liquidityContributionAddress}`);
    
    // Get program PDAs
    const programStateAddress = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda();
    
    // Get token accounts
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    
    // Ensure token accounts exist first
    const userYotAccount = await ensureTokenAccount(connection, wallet, yotMint);
    const userYosAccount = await ensureTokenAccount(connection, wallet, new PublicKey(YOS_TOKEN_ADDRESS));
    
    // Get pool accounts
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, POOL_AUTHORITY);
    
    // Create the transaction for liquidity account creation ONLY
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
    
    // Instruction data for CreateLiquidityAccount (index 7)
    const data = Buffer.alloc(1);
    data.writeUint8(7, 0);
    
    // Important: Use program authority as central liquidity wallet
    const centralLiquidityWallet = programAuthority;
    
    // Account list must match EXACTLY what the program expects
    const accountMetas = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: true }, 
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
      { pubkey: POOL_SOL_ACCOUNT, isSigner: false, isWritable: false },
      { pubkey: yotPoolAccount, isSigner: false, isWritable: false },
      { pubkey: centralLiquidityWallet, isSigner: false, isWritable: false },
      { pubkey: await getAssociatedTokenAddress(YOS_TOKEN_ADDRESS, POOL_AUTHORITY), isSigner: false, isWritable: false },
      { pubkey: yotMint, isSigner: false, isWritable: false },
      { pubkey: userYotAccount, isSigner: false, isWritable: false },
      { pubkey: YOS_TOKEN_ADDRESS, isSigner: false, isWritable: false },
      { pubkey: userYosAccount, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    const instruction = new TransactionInstruction({
      programId: MULTI_HUB_SWAP_PROGRAM_ID,
      keys: accountMetas,
      data,
    });
    
    transaction.add(instruction);
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true
    });
    
    console.log(`Creation transaction sent: ${signature}`);
    
    // Wait for confirmation with retry logic
    let confirmed = false;
    let retries = 3;
    
    while (!confirmed && retries > 0) {
      try {
        await connection.confirmTransaction(signature, 'confirmed');
        confirmed = true;
        console.log('Liquidity account creation confirmed!');
      } catch (error) {
        retries--;
        console.log(`Waiting for confirmation... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return confirmed;
  } catch (error) {
    console.error('Error creating liquidity account:', error);
    return false;
  }
}

// PHASE 2: Execute the swap with exact minimum amount to avoid simulation errors
async function executeSwap(connection, wallet, solAmount) {
  try {
    console.log(`Executing swap of ${solAmount} SOL`);
    
    // Convert SOL to lamports
    const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    
    // Get program PDAs
    const programStateAddress = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda();
    const liquidityContributionAddress = getLiquidityContributionPda(wallet.publicKey);
    
    // Get token accounts
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, POOL_AUTHORITY);
    const userYotAccount = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
    const userYosAccount = await getAssociatedTokenAddress(yosMint, wallet.publicKey);
    
    // Calculate expected output based on AMM formula
    const solPoolBalance = await connection.getBalance(POOL_SOL_ACCOUNT) / LAMPORTS_PER_SOL;
    const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotAccountInfo.value.uiAmount);
    
    // Calculate expected output
    const expectedOutput = (solAmount * yotPoolBalance) / (solPoolBalance + solAmount);
    
    // Apply slippage tolerance
    const minOutputAmount = Math.floor(expectedOutput * 0.99 * Math.pow(10, 9));
    
    console.log(`Pool balances - SOL: ${solPoolBalance}, YOT: ${yotPoolBalance}`);
    console.log(`Expected output: ${expectedOutput} YOT`);
    console.log(`Min output with slippage: ${minOutputAmount / Math.pow(10, 9)} YOT`);
    
    // Create instruction data for SOL to YOT swap (index 8)
    const data = Buffer.alloc(17);
    data.writeUint8(8, 0); // SolToYotSwapImmediate instruction
    data.writeBigUInt64LE(BigInt(amountInLamports), 1);
    data.writeBigUInt64LE(BigInt(minOutputAmount), 9);
    
    // Important: Use program authority as central liquidity wallet
    const centralLiquidityWallet = programAuthority;
    
    // Print all accounts for debugging
    console.log('\nAccount details for swap transaction:');
    console.log(`1. User (Signer): ${wallet.publicKey.toString()}`);
    console.log(`2. Program State: ${programStateAddress.toString()}`);
    console.log(`3. Program Authority: ${programAuthority.toString()}`);
    console.log(`4. SOL Pool Account: ${POOL_SOL_ACCOUNT.toString()}`);
    console.log(`5. YOT Pool Account: ${yotPoolAccount.toString()}`);
    console.log(`6. User YOT Account: ${userYotAccount.toString()}`);
    console.log(`7. Central Liquidity: ${centralLiquidityWallet.toString()}`);
    console.log(`8. Liquidity Contribution: ${liquidityContributionAddress.toString()}`);
    console.log(`9. YOS Mint: ${yosMint.toString()}`);
    console.log(`10. User YOS Account: ${userYosAccount.toString()}`);
    
    // Account metas must match EXACTLY what the program expects
    const accountMetas = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: POOL_SOL_ACCOUNT, isSigner: false, isWritable: true },
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
      programId: MULTI_HUB_SWAP_PROGRAM_ID,
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
    
    // Sign transaction
    transaction.sign(wallet);
    
    // Try to simulate the transaction first to check for errors
    console.log('\nSimulating swap transaction before sending...');
    try {
      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        console.error('Simulation showed potential errors:', simulation.value.err);
        console.warn('Logs:', simulation.value.logs);
        console.log('Continuing with skipPreflight=true anyway...');
      } else {
        console.log('Simulation successful!');
      }
    } catch (error) {
      console.error('Error during simulation:', error);
    }
    
    // Send the transaction with skipPreflight to bypass simulation errors
    console.log('\nSending swap transaction with skipPreflight=true...');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true
    });
    
    console.log(`Swap transaction sent: ${signature}`);
    console.log(`View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation with retry logic
    let confirmed = false;
    let retries = 3;
    
    while (!confirmed && retries > 0) {
      try {
        console.log('Waiting for transaction confirmation...');
        await connection.confirmTransaction(signature, 'confirmed');
        confirmed = true;
        console.log('Swap transaction confirmed successfully!');
      } catch (error) {
        retries--;
        console.log(`Confirmation error, retrying (${retries} retries left): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return { success: confirmed, signature };
  } catch (error) {
    console.error('Error executing swap:', error);
    return { success: false, error: error.message };
  }
}

// Main function to test the sequential approach
async function testSequentialSwap() {
  try {
    console.log('===============================================');
    console.log('SEQUENTIAL SOL TO YOT SWAP TEST');
    console.log('===============================================');
    
    // Connect to devnet and load wallet
    const connection = new Connection(DEVNET_ENDPOINT, 'confirmed');
    const wallet = loadWalletFromFile();
    
    console.log(`Using wallet: ${wallet.publicKey.toString()}`);
    
    // Display initial balances
    const initialSolBalance = await connection.getBalance(wallet.publicKey) / LAMPORTS_PER_SOL;
    console.log(`Initial SOL balance: ${initialSolBalance} SOL`);
    
    try {
      const userYotAccount = await getAssociatedTokenAddress(YOT_TOKEN_ADDRESS, wallet.publicKey);
      const yotBalance = await connection.getTokenAccountBalance(userYotAccount);
      console.log(`Initial YOT balance: ${yotBalance.value.uiAmount} YOT`);
    } catch (error) {
      console.log('No YOT token account yet');
    }
    
    // PHASE 1: Create liquidity contribution account
    console.log('\n--- PHASE 1: Creating Liquidity Contribution Account ---');
    const accountCreated = await createLiquidityAccount(connection, wallet);
    
    if (!accountCreated) {
      console.error('Failed to create liquidity contribution account. Aborting swap.');
      return;
    }
    
    // Wait a bit between transactions to avoid "already in progress" errors
    console.log('Waiting 5 seconds before proceeding to swap...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // PHASE 2: Execute the swap
    console.log('\n--- PHASE 2: Executing SOL to YOT Swap ---');
    const solAmount = 0.01; // Small amount for testing
    const swapResult = await executeSwap(connection, wallet, solAmount);
    
    if (!swapResult.success) {
      console.error(`Swap failed: ${swapResult.error}`);
      return;
    }
    
    // Display final balances
    console.log('\nFinal Balances:');
    const finalSolBalance = await connection.getBalance(wallet.publicKey) / LAMPORTS_PER_SOL;
    console.log(`Final SOL balance: ${finalSolBalance} SOL`);
    console.log(`Change: ${finalSolBalance - initialSolBalance} SOL`);
    
    try {
      const userYotAccount = await getAssociatedTokenAddress(YOT_TOKEN_ADDRESS, wallet.publicKey);
      const yotBalance = await connection.getTokenAccountBalance(userYotAccount);
      console.log(`Final YOT balance: ${yotBalance.value.uiAmount} YOT`);
    } catch (error) {
      console.log('Error getting final YOT balance');
    }
    
    try {
      const userYosAccount = await getAssociatedTokenAddress(YOS_TOKEN_ADDRESS, wallet.publicKey);
      const yosBalance = await connection.getTokenAccountBalance(userYosAccount);
      console.log(`Final YOS balance: ${yosBalance.value.uiAmount} YOS`);
    } catch (error) {
      console.log('Error getting final YOS balance');
    }
    
    console.log('\nTest completed!');
    
  } catch (error) {
    console.error('Error during sequential swap test:', error);
  }
}

// Run the test
testSequentialSwap();