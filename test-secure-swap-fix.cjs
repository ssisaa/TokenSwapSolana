/**
 * Test script for debugging and fixing SOL to YOT swap simulation errors
 * This script implements multiple approaches to diagnose and fix issues
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
  const associatedTokenAddress = await getAssociatedTokenAddress(mint, wallet.publicKey);
  
  try {
    const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
    if (accountInfo) {
      console.log(`Token account for ${mint.toString()} already exists: ${associatedTokenAddress.toString()}`);
      return associatedTokenAddress;
    }
  } catch (error) {
    // Account doesn't exist, continue to create it
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
}

// Create a transaction to swap SOL for YOT tokens - Fixed version with correctly ordered accounts
async function createFixedSwapTransaction(wallet, connection, solAmount) {
  // Convert SOL to lamports
  const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  
  // Program PDAs
  const programStateAddress = getProgramStatePda();
  const programAuthority = getProgramAuthorityPda();
  const liquidityContributionAddress = getLiquidityContributionPda(wallet.publicKey);
  
  // Get token accounts
  const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
  const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
  
  // Token accounts - assuming they already exist
  const yotPoolAccount = await getAssociatedTokenAddress(yotMint, POOL_AUTHORITY);
  const userYotAccount = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
  const userYosAccount = await getAssociatedTokenAddress(yosMint, wallet.publicKey);
  
  // Calculate expected YOT output
  // Get the current exchange rate from the pool balances
  const solPoolBalance = await connection.getBalance(POOL_SOL_ACCOUNT) / LAMPORTS_PER_SOL;
  const yotTokenInfo = await connection.getTokenAccountBalance(yotPoolAccount);
  const yotPoolBalance = Number(yotTokenInfo.value.uiAmount);
  
  // Calculate expected output
  const expectedOutput = (solAmount * yotPoolBalance) / (solPoolBalance + solAmount);
  
  // Apply 1% slippage
  const minAmountOut = Math.floor(expectedOutput * 0.99 * Math.pow(10, 9));
  
  console.log(`Expected output: ${expectedOutput} YOT`);
  console.log(`Min output with slippage: ${minAmountOut / Math.pow(10, 9)} YOT`);
  
  // Create instruction data for SOL to YOT swap (ix_discriminator = 8)
  const data = Buffer.alloc(17);
  data.writeUint8(8, 0); // SolToYotSwapImmediate instruction
  data.writeBigUInt64LE(BigInt(amountInLamports), 1);
  data.writeBigUInt64LE(BigInt(minAmountOut), 9);
  
  // Log all accounts for better debugging
  console.log("\nAccount details for transaction:");
  console.log(`1. User (Signer): ${wallet.publicKey.toString()}`);
  console.log(`2. Program State: ${programStateAddress.toString()}`);
  console.log(`3. Program Authority: ${programAuthority.toString()}`);
  console.log(`4. SOL Pool Account: ${POOL_SOL_ACCOUNT.toString()}`);
  console.log(`5. YOT Pool Account: ${yotPoolAccount.toString()}`);
  console.log(`6. User YOT Account: ${userYotAccount.toString()}`);
  console.log(`7. Central Liquidity: ${programAuthority.toString()}`);
  console.log(`8. Liquidity Contribution: ${liquidityContributionAddress.toString()}`);
  console.log(`9. YOS Mint: ${yosMint.toString()}`);
  console.log(`10. User YOS Account: ${userYosAccount.toString()}`);
  
  // CRITICAL FIX: Ensure central liquidity wallet is the program authority PDA
  const centralLiquidityWallet = programAuthority;
  
  // Create account metas in the correct order
  const accountMetas = [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },         // 1. user (signer)
    { pubkey: programStateAddress, isSigner: false, isWritable: true },     // 2. program_state - MUST BE WRITABLE
    { pubkey: programAuthority, isSigner: false, isWritable: false },       // 3. program_authority
    { pubkey: POOL_SOL_ACCOUNT, isSigner: false, isWritable: true },        // 4. sol_pool_account
    { pubkey: yotPoolAccount, isSigner: false, isWritable: true },          // 5. yot_pool_account
    { pubkey: userYotAccount, isSigner: false, isWritable: true },          // 6. user_yot_account
    { pubkey: centralLiquidityWallet, isSigner: false, isWritable: true },  // 7. central_liquidity_wallet
    { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true }, // 8. liquidity_contribution
    { pubkey: yosMint, isSigner: false, isWritable: true },                // 9. yos_mint
    { pubkey: userYosAccount, isSigner: false, isWritable: true },         // 10. user_yos_account
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },// 11. system_program
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },      // 12. token_program
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },    // 13. rent_sysvar
  ];
  
  const instruction = new TransactionInstruction({
    programId: MULTI_HUB_SWAP_PROGRAM_ID,
    keys: accountMetas,
    data,
  });
  
  // Create transaction with compute budget instructions
  const transaction = new Transaction();
  
  // Add compute budget instructions to ensure enough compute units
  const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400000 // High value for complex operations
  });
  
  const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 1_000_000 // Higher priority fee
  });
  
  transaction.add(computeUnits);
  transaction.add(priorityFee);
  transaction.add(instruction);
  
  // Set transaction properties
  transaction.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  return transaction;
}

// Main function to test the complete swap process
async function testCompleteSwap() {
  try {
    console.log("Starting complete swap test with fixed account order...");
    
    // Connect to devnet and load wallet
    const connection = new Connection(DEVNET_ENDPOINT, 'confirmed');
    const wallet = loadWalletFromFile();
    
    console.log(`Using wallet: ${wallet.publicKey.toString()}`);
    
    // Get initial balances
    const initialSolBalance = await connection.getBalance(wallet.publicKey) / LAMPORTS_PER_SOL;
    console.log(`Initial SOL balance: ${initialSolBalance} SOL`);
    
    // Ensure token accounts exist
    console.log("\nEnsuring token accounts exist...");
    await ensureTokenAccount(connection, wallet, new PublicKey(YOT_TOKEN_ADDRESS));
    await ensureTokenAccount(connection, wallet, new PublicKey(YOS_TOKEN_ADDRESS));
    
    // Get the liquidity contribution account
    const liquidityContributionAddress = getLiquidityContributionPda(wallet.publicKey);
    
    // Check if liquidity contribution account exists
    const liquidityAccountInfo = await connection.getAccountInfo(liquidityContributionAddress);
    console.log(`Liquidity contribution account ${liquidityContributionAddress.toString()} exists: ${liquidityAccountInfo !== null}`);
    
    // If account doesn't exist, create it with a transaction
    if (!liquidityAccountInfo) {
      console.log("\nCreating liquidity contribution account...");
      
      // Create PDA creation transaction
      const createAccountTx = new Transaction();
      
      // Add compute budget instructions
      const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
        units: 400000
      });
      
      const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1_000_000
      });
      
      createAccountTx.add(computeUnits);
      createAccountTx.add(priorityFee);
      
      // Program PDAs
      const programStateAddress = getProgramStatePda();
      const programAuthority = getProgramAuthorityPda();
      
      // Get token accounts
      const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
      const yosPoolAccount = await getAssociatedTokenAddress(YOS_TOKEN_ADDRESS, POOL_AUTHORITY);
      const yotPoolAccount = await getAssociatedTokenAddress(yotMint, POOL_AUTHORITY);
      const userYotAccount = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
      const userYosAccount = await getAssociatedTokenAddress(YOS_TOKEN_ADDRESS, wallet.publicKey);
      
      // IMPORTANT: Use program authority as central liquidity wallet
      const centralLiquidityWallet = programAuthority;
      
      // Create the instruction data (ix_discriminator = 7)
      const data = Buffer.alloc(1);
      data.writeUint8(7, 0); // CreateLiquidityAccount instruction
      
      // Account metas for createLiquidityAccount
      const accountMetas = [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: true },
        { pubkey: programAuthority, isSigner: false, isWritable: false },
        { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
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
      
      const createAccountInstruction = new TransactionInstruction({
        programId: MULTI_HUB_SWAP_PROGRAM_ID,
        keys: accountMetas,
        data,
      });
      
      createAccountTx.add(createAccountInstruction);
      
      // Set transaction properties
      createAccountTx.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      createAccountTx.recentBlockhash = blockhash;
      
      // Sign and send the transaction
      createAccountTx.sign(wallet);
      const createTxSignature = await connection.sendRawTransaction(createAccountTx.serialize(), {
        skipPreflight: true // Skip preflight to allow transaction to go through
      });
      
      console.log(`Create liquidity account transaction sent: ${createTxSignature}`);
      
      // Wait for confirmation
      try {
        await connection.confirmTransaction(createTxSignature, 'confirmed');
        console.log('Liquidity account creation confirmed!');
      } catch (error) {
        console.log('Error confirming liquidity account creation, but transaction may still succeed');
      }
      
      // Wait a moment for the transaction to settle
      console.log('Waiting 5 seconds for transaction to settle...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Now perform the actual swap
    console.log("\nPerforming SOL to YOT swap...");
    const solAmount = 0.01; // Small amount for testing
    
    // Create the swap transaction
    const swapTx = await createFixedSwapTransaction(wallet, connection, solAmount);
    
    // Sign the transaction
    swapTx.sign(wallet);
    
    // Simulate the transaction to check for errors
    console.log("\nSimulating transaction before sending...");
    try {
      const simulation = await connection.simulateTransaction(swapTx);
      
      if (simulation.value.err) {
        console.error("Simulation failed:", simulation.value.err);
        console.log("Trying with skipPreflight=true anyway...");
      } else {
        console.log("Simulation successful!");
      }
    } catch (error) {
      console.error("Error during simulation:", error);
      console.log("Trying with skipPreflight=true anyway...");
    }
    
    // Send the transaction with skipPreflight to bypass simulation errors
    console.log("\nSending transaction with skipPreflight=true...");
    const signature = await connection.sendRawTransaction(swapTx.serialize(), {
      skipPreflight: true
    });
    
    console.log(`Transaction sent: ${signature}`);
    
    // Wait for confirmation
    console.log("Waiting for confirmation...");
    try {
      await connection.confirmTransaction(signature, 'confirmed');
      console.log("Transaction confirmed successfully!");
    } catch (error) {
      console.error("Error confirming transaction:", error);
    }
    
    // Check final balances
    const finalSolBalance = await connection.getBalance(wallet.publicKey) / LAMPORTS_PER_SOL;
    console.log(`\nFinal SOL balance: ${finalSolBalance} SOL`);
    console.log(`Change: ${finalSolBalance - initialSolBalance} SOL`);
    
    // Try to get YOT balance
    try {
      const userYotAccount = await getAssociatedTokenAddress(new PublicKey(YOT_TOKEN_ADDRESS), wallet.publicKey);
      const yotBalance = await connection.getTokenAccountBalance(userYotAccount);
      console.log(`YOT balance: ${yotBalance.value.uiAmount} YOT`);
    } catch (error) {
      console.log("Could not fetch YOT balance:", error);
    }
    
    // Try to get YOS balance
    try {
      const userYosAccount = await getAssociatedTokenAddress(new PublicKey(YOS_TOKEN_ADDRESS), wallet.publicKey);
      const yosBalance = await connection.getTokenAccountBalance(userYosAccount);
      console.log(`YOS balance: ${yosBalance.value.uiAmount} YOS`);
    } catch (error) {
      console.log("Could not fetch YOS balance:", error);
    }
    
    console.log("\nTest completed!");
    
  } catch (error) {
    console.error("Error during test:", error);
  }
}

// Run the test
testCompleteSwap();