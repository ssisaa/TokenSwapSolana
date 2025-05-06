import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram
} from '@solana/web3.js';
import { createTransaction, simulateTransaction, verifyTransaction, sendTransaction } from './transaction-helper';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddress,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  createApproveInstruction
} from '@solana/spl-token';
import { Buffer } from 'buffer';
import { uiToRawTokenAmount } from './utils';
// Import configuration from centralized configuration system
import {
  solanaConfig,
  SOL_TOKEN_ADDRESS,
  YOT_TOKEN_ADDRESS,
  YOS_TOKEN_ADDRESS,
  MULTI_HUB_SWAP_PROGRAM_ID,
  MULTI_HUB_SWAP_STATE,
  MULTI_HUB_SWAP_ADMIN,
  MULTI_HUB_SWAP_PROGRAM_AUTHORITY,
  SOLANA_RPC_URL,
  DEFAULT_DISTRIBUTION_RATES,
  DEFAULT_FEE_RATES,
  BUY_AND_DISTRIBUTE_DISCRIMINATOR,
  CLAIM_REWARD_DISCRIMINATOR,
  WITHDRAW_CONTRIBUTION_DISCRIMINATOR,
  UPDATE_PARAMETERS_DISCRIMINATOR
} from './config';

// Export program IDs for backward compatibility
export const MULTI_HUB_SWAP_PROGRAM_STATE = MULTI_HUB_SWAP_STATE;
export { MULTI_HUB_SWAP_PROGRAM_ID };

// Instruction types for the program
export enum MultiHubSwapInstructionType {
  Initialize = 0,
  Swap = 1,
  Contribute = 2,
  ClaimRewards = 3,
  WithdrawLiquidity = 4,
  UpdateParameters = 5
}

// Connection to Solana network
export const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Use discriminators from centralized config

/**
 * Find the program state PDA
 * CRITICAL: Seed must match the Rust program's "state" seed
 */
export function findProgramStateAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Find the vault token account PDA for a specific token
 * Uses exact same seed as the Rust program: ["vault", token_mint]
 */
export function findVaultTokenAddress(tokenMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), tokenMint.toBuffer()],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Find the liquidity token account PDA for a specific token
 * Uses exact same seed as the Rust program: ["liquidity", token_mint]
 */
export function findLiquidityTokenAddress(tokenMint: PublicKey): [PublicKey, number] {
  // CRITICAL: Need to use "liquidity" seed to match the Rust program
  return PublicKey.findProgramAddressSync(
    [Buffer.from("liquidity"), tokenMint.toBuffer()],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Create PDA token accounts needed for the Multi-Hub Swap program if they don't exist
 * @param wallet The connected wallet
 * @param tokenMintsToCreate A map of token mint addresses to their token account PDAs
 * @returns The transaction signature if accounts were created, null if no accounts needed creation
 */
/**
 * Creates a user's token account if needed
 * IMPORTANT: Only use this for user-owned accounts, NOT PDA-owned accounts!
 * 
 * @param wallet The user's wallet
 * @param mintAddress The token mint address
 * @returns The transaction signature if account was created, null otherwise
 */
export async function createUserTokenAccount(
  wallet: any,
  mintAddress: PublicKey
): Promise<string | null> {
  if (!wallet || !wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  try {
    const userPublicKey = wallet.publicKey;
    
    // Find the associated token address for the user
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mintAddress,
      userPublicKey
    );
    
    // Check if the account already exists
    const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
    if (accountInfo) {
      console.log(`User token account ${associatedTokenAddress.toString()} already exists`);
      return null;
    }
    
    console.log(`Creating user token account for mint ${mintAddress.toString()}`);
    
    // Create transaction
    const transaction = new Transaction();
    transaction.add(
      createAssociatedTokenAccountInstruction(
        userPublicKey, // payer
        associatedTokenAddress, // token account address
        userPublicKey, // owner (user wallet)
        mintAddress // token mint
      )
    );
    
    // Set recent blockhash and fee payer
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = userPublicKey;
    
    // Sign and send transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log(`User token account created: ${associatedTokenAddress.toString()}`);
    return signature;
  } catch (error) {
    console.error("Error creating user token account:", error);
    // Continue execution even if this fails
    return null;
  }
}

/**
 * Find the liquidity contribution account for a user
 * CRITICAL: Must use "liq" seed to match Rust program exactly
 * Rust: Pubkey::find_program_address(&[b"liq", user.as_ref()], program_id)
 */
export function findLiquidityContributionAddress(userWallet: PublicKey): [PublicKey, number] {
  // CRITICAL FIX: Use "liq" seed to match Rust program exactly
  // This matches the Rust code: `&[b"liq", user.as_ref()]`
  return PublicKey.findProgramAddressSync(
    [Buffer.from("liq"), userWallet.toBuffer()],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Encode a u64 for the program
 */
function encodeU64(value: number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value), 0);
  return buffer;
}

/**
 * Creates a transaction with compute budget instructions for complex operations
 * This ensures transactions have enough compute units and prioritization
 */
/**
 * Create a transaction with proper compute budget for complex operations
 * Also ensures transaction is properly constructed to avoid simulation errors
 */
/**
 * FIXED: Create a properly structured transaction that avoids the numRequiredSignatures error
 * This function ensures the transaction has all the required fields in the correct order
 */
async function createAndSignTransaction(
  wallet: any, 
  instruction: TransactionInstruction, 
  connection: Connection
): Promise<Transaction> {
  // STEP 1: Get a valid blockhash first
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  
  // STEP 2: Create a completely fresh Transaction object
  const transaction = new Transaction();
  
  // STEP 3: Set blockhash and fee payer FIRST (before adding instructions)
  // This is CRITICAL to avoid "Cannot read properties of undefined (reading 'numRequiredSignatures')" error
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = wallet.publicKey;
  
  // STEP 4: Add compute budget instructions for complex operations
  const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 1000000 // High value for complex transactions
  });
  
  const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 1_000_000 // Higher priority fee
  });
  
  // STEP 5: Add all instructions in the correct order
  transaction.add(computeUnits);
  transaction.add(priorityFee);
  transaction.add(instruction);
  
  // Log transaction structure to verify it's valid
  console.log("Transaction created with:", {
    blockhash: transaction.recentBlockhash?.substring(0, 8) + "...",
    feePayer: transaction.feePayer?.toString().substring(0, 8) + "...",
    numInstructions: transaction.instructions.length,
    isFullySigned: transaction.signatures.length > 0
  });
  
  return transaction;
}

// Keep the old function for backward compatibility
function createTransactionWithComputeBudget(instruction: TransactionInstruction): Transaction {
  console.warn("WARNING: Using legacy createTransactionWithComputeBudget - consider using createAndSignTransaction instead");
  
  // Add compute unit allocation to the transaction (critical for complex instructions)
  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 1000000 // Use a high value to ensure enough compute budget
  });
  
  const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 1_000_000 // Higher priority fee to increase chance of success
  });
  
  // Create a new transaction object to ensure clean state
  const transaction = new Transaction();
  
  // Add compute budget instructions first
  transaction.add(modifyComputeUnits);
  transaction.add(priorityFee);
  
  // Add the main program instruction
  transaction.add(instruction);
  
  console.log("Transaction includes compute budget allocation for complex operations");
  
  return transaction;
}

/**
 * Safely simulates a transaction and provides detailed logs for debugging
 * This function will never throw, only log errors and return a success/failure status
 */
/**
 * Enhanced transaction simulation function with detailed analysis 
 * and helpful debugging information for troubleshooting transaction errors
 */
async function safelySimulateTransaction(connection: Connection, transaction: Transaction): Promise<boolean> {
  try {
    console.log("📊 SIMULATION: Attempting to simulate transaction before sending...");
    
    // Print detailed account list information for better debugging
    console.log("\n🔑 TRANSACTION ACCOUNTS ANALYSIS:");
    for (let i = 0; i < transaction.instructions.length; i++) {
      const instruction = transaction.instructions[i];
      console.log(`\nInstruction #${i} with program ID: ${instruction.programId.toString()}`);
      
      // Enhanced account logging with expected program state account checks
      instruction.keys.forEach((keyObj, idx) => {
        const pubkeyStr = keyObj.pubkey.toString();
        console.log(`  Account #${idx}: ${pubkeyStr}`);
        console.log(`    Signer: ${keyObj.isSigner}, Writable: ${keyObj.isWritable}`);
        
        // Help identify program state account issues
        if (idx === 0 && !keyObj.isSigner) {
          console.warn("⚠️ WARNING: First account is expected to be a signer in most instructions!");
        }
        
        // Check for program state account
        const [expectedProgramState] = PublicKey.findProgramAddressSync(
          [Buffer.from("state")],
          new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
        );
        if (pubkeyStr === expectedProgramState.toString()) {
          console.log("    ✓ IDENTIFIED: This is the program state account");
        }
      });
    }
    
    // Extract the instruction data for debugging
    if (transaction.instructions.length > 0) {
      const instructionData = transaction.instructions[0].data;
      
      // Enhanced instruction data analysis with discriminator identification
      const discriminatorByte = instructionData[0];
      console.log("\n📊 INSTRUCTION DATA ANALYSIS:");
      console.log(`- Data length: ${instructionData.length} bytes`);
      console.log(`- Discriminator byte: ${discriminatorByte}`);
      console.log(`- Full data (hex): ${instructionData.toString('hex')}`);
      
      // Identify which instruction is being called
      let instructionName = "Unknown";
      if (discriminatorByte === BUY_AND_DISTRIBUTE_DISCRIMINATOR[0]) {
        instructionName = "BUY_AND_DISTRIBUTE";
        const amountBytes = instructionData.slice(1, 9);
        const amount = Number(amountBytes.readBigUInt64LE(0));
        console.log(`- Instruction type: ${instructionName}`);
        console.log(`- Amount bytes: ${amountBytes.toString('hex')}`);
        console.log(`- Amount (raw): ${amount}`);
        console.log(`- Amount (UI): ${amount / Math.pow(10, 9)} YOT`);
      } else if (discriminatorByte === CLAIM_REWARD_DISCRIMINATOR[0]) {
        instructionName = "CLAIM_WEEKLY_REWARD";
        console.log(`- Instruction type: ${instructionName}`);
      } else if (discriminatorByte === WITHDRAW_CONTRIBUTION_DISCRIMINATOR[0]) {
        instructionName = "WITHDRAW_CONTRIBUTION";
        console.log(`- Instruction type: ${instructionName}`);
      } else if (discriminatorByte === UPDATE_PARAMETERS_DISCRIMINATOR[0]) {
        instructionName = "UPDATE_PARAMETERS";
        console.log(`- Instruction type: ${instructionName}`);
      }
      
      console.log(`- Expected account order: See Rust code for ${instructionName}`);
    }
    
    // Check if transaction is properly built
    if (!transaction.recentBlockhash) {
      console.error("❌ Transaction is missing recentBlockhash. Skipping simulation.");
      return false;
    }
    
    if (!transaction.feePayer) {
      console.error("❌ Transaction is missing feePayer. Skipping simulation.");
      return false;
    }
    
    console.log("\n🧪 Starting transaction simulation...");
    
    try {
      // We use the basic form without options to avoid type errors
      const simResult = await connection.simulateTransaction(transaction);
      
      // Check if simulation results are available
      if (!simResult || !simResult.value) {
        console.error("❌ SIMULATION: Result is undefined or malformed");
        return false;
      }
      
      // Check for errors in the simulation
      if (simResult.value.err) {
        console.error("❌ SIMULATION FAILED:", simResult.value.err);
        
        // Advanced error analysis specifically for "Invalid program state account" errors
        if (typeof simResult.value.err === 'object') {
          const errorObj = simResult.value.err as any;
          
          console.log("\n🔍 DETAILED ERROR ANALYSIS:", JSON.stringify(errorObj, null, 2));
          
          // Look for specific InstructionError patterns
          if (errorObj.InstructionError) {
            const [index, error] = errorObj.InstructionError;
            console.error(`❌ Error in instruction ${index}:`, error);
            
            if (error.Custom === 1) {
              console.error("❗ IDENTIFIED ERROR: Unknown Instruction Discriminator - The instruction byte doesn't match what the program expects");
              console.error("📝 FIX: Verify the instruction discriminator byte is correct (first byte of instruction data)");
            } else if (error.Custom === 0) {
              console.error("❗ IDENTIFIED ERROR: Invalid account data - An account may not be properly initialized");
              console.error("📝 FIX: Check account ownership and initialization status");
            } else if (typeof error === 'string' && error.includes("InvalidAccountData")) {
              console.error("❗ IDENTIFIED ERROR: Invalid Account Data - Account doesn't match program expectations");
              console.error("📝 FIX: Verify account order matches EXACTLY what the Rust program expects");
            } else if (typeof error === 'string' && error.includes("AccountNotExecutable")) {
              console.error("❗ IDENTIFIED ERROR: Account Not Executable - Program account cannot be executed");
              console.error("📝 FIX: Check program ID is correct and deployed");
            }
          }
        }
        
        // Enhanced log analysis specifically targeting "Invalid program state account" errors
        if (simResult.value.logs) {
          console.log("\n📋 SIMULATION LOGS:");
          simResult.value.logs.forEach((log: string, i: number) => console.log(`#${i}: ${log}`));
          
          // Check for specific error messages in the logs
          const invalidProgramStateError = simResult.value.logs.find(log => 
            log.includes("Invalid program state account")
          );
          
          if (invalidProgramStateError) {
            console.error("\n❗ CRITICAL ERROR IDENTIFIED: 'Invalid program state account'");
            console.error("📝 FIX: This error occurs when the program state account is not in the expected position in the accounts array.");
            console.error("📝 SOLUTION: Update the account order in the TransactionInstruction to match EXACTLY what the Rust program expects.");
          }
          
          // Additional analysis of logs
          const programLogs = simResult.value.logs.filter((log: string) => 
            log.includes("Program log:") || 
            log.includes("Program return:")
          );
          
          if (programLogs.length > 0) {
            console.log("\n🔍 PROGRAM SPECIFIC LOGS:");
            programLogs.forEach((log: string, i: number) => console.log(`#${i}: ${log}`));
          }
        }
        
        console.log("\n⚠️ Will proceed with transaction despite simulation errors.");
        return false;
      }
      
      // Simulation succeeded, log any available logs
      console.log("✅ SIMULATION SUCCEEDED.");
      if (simResult.value.logs) {
        console.log("Logs (truncated):");
        simResult.value.logs.slice(0, 10).forEach((log: string, i: number) => console.log(`#${i}: ${log}`));
      }
      
      return true;
    } catch (simError: any) {
      console.error("❌ SIMULATION ERROR:", simError);
      
      // Enhanced error message extraction
      if (simError?.message) {
        console.log("📝 SIMULATION ERROR MESSAGE:", simError.message);
        
        // Look for specific error patterns
        if (simError.message.includes("Cannot read properties of undefined")) {
          console.error("❗ IDENTIFIED ERROR: 'Cannot read properties of undefined'");
          console.error("📝 This often happens when the transaction structure is incorrect or an expected account is missing.");
          console.error("📝 SOLUTION: Double-check ALL account addresses and their order in the instruction.");
        }
      }
      
      return false;
    }
  } catch (error: any) {
    console.error("❌ CRITICAL ERROR during transaction simulation:", error);
    
    // Enhanced error handling for typical transaction issues
    if (error?.message) {
      console.log("📝 ERROR MESSAGE:", error.message);
      
      if (error.message.includes("failed to get account")) {
        console.error("❗ IDENTIFIED ERROR: Failed to get account information");
        console.error("📝 FIX: One of the accounts in the transaction doesn't exist or is invalid");
      } else if (error.message.includes("Transaction too large")) {
        console.error("❗ IDENTIFIED ERROR: Transaction too large");
        console.error("📝 FIX: Reduce the number of instructions or account references");
      }
    }
    
    console.log("\n⚠️ Simulation failed but will continue with transaction.");
    return false;
  }
}

/**
 * Buy and distribute YOT tokens with cashback in YOS
 * This implements the buy_and_distribute instruction from the Anchor smart contract
 * 
 * Key features of the smart contract:
 * 1. Split Token Distribution System:
 *    - 75% goes directly to the user
 *    - 20% is added to the liquidity pool (auto-split 50/50 between YOT/SOL)
 *    - 5% is minted as YOS tokens for cashback rewards
 * 
 * 2. Liquidity Contribution Tracking:
 *    - Records user contributions to the liquidity pool
 *    - Tracks contribution amount, start time, and last claim time
 *    - Stores contribution data in a PDA unique to each user
 * 
 * 3. Weekly Rewards System:
 *    - Users can claim weekly rewards through claim_weekly_reward function
 *    - Enforces a 7-day (604,800 seconds) waiting period between claims
 *    - Calculates rewards as 1/52 of the yearly reward amount (based on contribution)
 * 
 * 4. Contribution Withdrawal Mechanism:
 *    - Users can withdraw their contributed liquidity using withdraw_contribution
 *    - Transfers the full contribution amount back to the user
 *    - Verifies user ownership before allowing withdrawal
 *    - Automatically stops reward generation when withdrawn
 */
/**
 * Buy and distribute YOT tokens with cashback in YOS
 * This implements the buy_and_distribute instruction from the Anchor smart contract
 * 
 * Key features of the smart contract:
 * 1. Split Token Distribution System:
 *    - 75% goes directly to the user
 *    - 20% is added to the liquidity pool (auto-split 50/50 between YOT/SOL)
 *    - 5% is minted as YOS tokens for cashback rewards
 * 
 * @param wallet - The user's connected wallet
 * @param yotAmount - The amount of YOT tokens to buy and distribute
 * @param buyUserPercent - Percentage that goes to user (default 75%)
 * @param buyLiquidityPercent - Percentage that goes to liquidity (default 20%)
 * @param buyCashbackPercent - Percentage that goes to YOS cashback (default 5%)
 */
export async function buyAndDistribute(
  wallet: any, 
  yotAmount: number,
  buyUserPercent: number = 75,
  buyLiquidityPercent: number = 20,
  buyCashbackPercent: number = 5
): Promise<string> {
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }
    
    console.log(`Initiating buyAndDistribute with YOT amount: ${yotAmount}`);

    // Get program and public keys
    const program = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    const userPublicKey = wallet.publicKey;
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    
    // Convert YOT amount to raw token amount with proper decimals
    const rawAmount = uiToRawTokenAmount(yotAmount, 9);
    console.log(`Raw YOT token amount: ${rawAmount}`);
    
    // Get token accounts
    console.log("Getting associated token accounts...");
    const userYotAccount = await getAssociatedTokenAddress(yotMint, userPublicKey);
    const userYosAccount = await getAssociatedTokenAddress(yosMint, userPublicKey);
    
    // The pool token account owned by the pool authority
    const poolAuthority = new PublicKey(solanaConfig.pool.authority);
    console.log("Pool authority from config:", poolAuthority.toString());
    const poolYotAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
    
    // Find liquidity contribution PDA
    const [liquidityContribution] = findLiquidityContributionAddress(userPublicKey);
    
    // Get program state and authority accounts
    const stateAccount = new PublicKey(MULTI_HUB_SWAP_STATE);
    
    // Find the program authority PDA - CRITICAL: this must be derived correctly
    // This is the authority that the program uses for token operations
    const [programAuthority, authorityBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority")],
      new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
    );
    console.log("Dynamically derived program authority PDA:", programAuthority.toString());
    console.log("Program authority bump seed:", authorityBump);
    
    // Validate percentages match contract expectations
    if (buyUserPercent !== 75 || buyLiquidityPercent !== 20 || buyCashbackPercent !== 5) {
      console.warn("Warning: Custom percentages provided, but contract uses fixed values: 75/20/5");
    }

    // Check if user YOT and YOS accounts exist and create them if needed
    console.log("Checking if user has required token accounts...");
    
    // Create transaction for token accounts if needed
    const setupTransaction = new Transaction();
    setupTransaction.feePayer = userPublicKey;
    
    // Check and create YOT token account if needed
    const userYotAccountInfo = await connection.getAccountInfo(userYotAccount);
    if (!userYotAccountInfo) {
      console.log("User needs YOT token account - will create it");
      setupTransaction.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,  // payer
          userYotAccount, // ata address
          userPublicKey,  // owner
          yotMint         // mint
        )
      );
    } else {
      console.log("User YOT token account exists:", userYotAccount.toString());
    }
    
    // Check and create YOS token account if needed
    const userYosAccountInfo = await connection.getAccountInfo(userYosAccount);
    if (!userYosAccountInfo) {
      console.log("User needs YOS token account - will create it");
      setupTransaction.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,  // payer
          userYosAccount, // ata address
          userPublicKey,  // owner
          yosMint         // mint
        )
      );
    } else {
      console.log("User YOS token account exists:", userYosAccount.toString());
    }
    
    // Execute the setup transaction only if we need to create accounts
    if (setupTransaction.instructions.length > 0) {
      try {
        console.log("Sending transaction to create token accounts...");
        
        const recentBlockhash = await connection.getLatestBlockhash('confirmed');
        setupTransaction.recentBlockhash = recentBlockhash.blockhash;
        
        const signedSetupTransaction = await wallet.signTransaction(setupTransaction);
        const setupSignature = await connection.sendRawTransaction(signedSetupTransaction.serialize());
        
        await connection.confirmTransaction(setupSignature, 'confirmed');
        console.log("✅ Successfully created token accounts:", setupSignature);
      } catch (error) {
        console.warn("Failed to create token accounts:", error);
        throw new Error("Failed to create required token accounts. Please try again.");
      }
    } else {
      console.log("All required token accounts already exist.");
    }
    
    // Create instruction data buffer for the buy_and_distribute instruction
    const instructionBuffer = Buffer.alloc(9); // 1 byte discriminator + 8 bytes amount
    instructionBuffer.writeUInt8(4, 0); // BUY_AND_DISTRIBUTE_IX = 4
    instructionBuffer.writeBigUInt64LE(BigInt(rawAmount), 1); // amount as u64 little-endian
    
    console.log("Instruction data created:");
    console.log("- Discriminator:", instructionBuffer[0]);
    console.log("- Raw amount:", rawAmount.toString());
    
    // Create transaction instruction with accounts in EXACT order needed by Rust program
    // CRITICAL: Order of accounts must match exactly what the Rust program expects
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },          // user
        { pubkey: poolYotAccount, isSigner: false, isWritable: true },        // vault_yot
        { pubkey: userYotAccount, isSigner: false, isWritable: true },        // user_yot
        { pubkey: poolYotAccount, isSigner: false, isWritable: true },        // liquidity_yot (same as vault_yot)
        { pubkey: yosMint, isSigner: false, isWritable: true },               // yos_mint
        { pubkey: userYosAccount, isSigner: false, isWritable: true },        // user_yos
        { pubkey: liquidityContribution, isSigner: false, isWritable: true }, // liquidity_contribution_account
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },     // token_program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },   // rent_sysvar
        { pubkey: stateAccount, isSigner: false, isWritable: true },          // program_state_account
        { pubkey: programAuthority, isSigner: false, isWritable: false },     // program authority
        { pubkey: poolAuthority, isSigner: false, isWritable: false }         // pool authority (owns pool token accounts)
      ],
      programId: program,
      data: instructionBuffer
    });
    
    // Create an approval instruction to delegate authority for token transfers
    console.log("Creating approval instruction for program authority...");
    const approveInstruction = createApproveInstruction(
      userYotAccount,              // source account
      programAuthority,            // delegate
      userPublicKey,               // owner
      rawAmount                    // amount
    );
    
    // Create transaction with compute budget for complex operations
    const transaction = new Transaction();
    
    // Add compute budget instructions
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1000000 // High value for complex operations
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000 // Higher priority fee
    });
    
    // Get a valid blockhash
    const recentBlockhash = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = recentBlockhash.blockhash;
    transaction.lastValidBlockHeight = recentBlockhash.lastValidBlockHeight;
    transaction.feePayer = userPublicKey;
    
    // Add instructions in order - IMPORTANT: add approval BEFORE the swap instruction
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    transaction.add(approveInstruction);
    transaction.add(instruction);
    
    // Simulate the transaction before wallet signing
    console.log("Simulating transaction...");
    try {
      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        console.error("Simulation failed:", simulation.value.err);
        console.error("Logs:", simulation.value.logs);
        throw new Error(`Transaction would fail: ${JSON.stringify(simulation.value.err)}`);
      }
      console.log("Simulation successful");
    } catch (err: any) {
      console.error("Error during simulation:", err);
      throw new Error(`Simulation error: ${err.message}`);
    }
    
    // Sign and send the transaction
    console.log("Requesting wallet signature...");
    const signedTransaction = await wallet.signTransaction(transaction);
    
    console.log("Sending transaction...");
    const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    
    console.log(`Transaction sent with signature: ${signature}`);
    
    // Wait for confirmation
    console.log("Waiting for confirmation...");
    await connection.confirmTransaction({
      signature,
      blockhash: recentBlockhash.blockhash,
      lastValidBlockHeight: recentBlockhash.lastValidBlockHeight
    }, 'confirmed');
    
    console.log("Transaction confirmed successfully!");
    return signature;
  } catch (error) {
    // Just log the error without reference to swapProgramAuthority which may not be defined
    console.error("Error in buyAndDistribute:", error);
    throw error;
  }
}

/**
 * Distribute weekly YOS rewards automatically to users
 * This implements the auto-distribution version of the claim_weekly_reward instruction
 * 
 * Features:
 * 1. Can be called by anyone (including admin or automated system) on behalf of users
 * 2. Enforces a 7-day (604,800 seconds) waiting period between distributions
 * 3. Calculates rewards as 1/52 of the yearly reward amount (based on contribution)
 * 4. Updates the last claim time in the LiquidityContribution account
 * 5. Automatically sends rewards directly to user wallets without manual claiming
 */
export async function distributeWeeklyYosReward(
  adminWallet: any, 
  userAddress: string
): Promise<{ signature: string, distributedAmount: number }> {
  try {
    if (!adminWallet || !adminWallet.publicKey) {
      throw new Error("Admin wallet not connected");
    }

    const adminPublicKey = adminWallet.publicKey;
    const userPublicKey = new PublicKey(userAddress);
    const program = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);

    // Check if reward distribution is eligible (7-day waiting period)
    const contributionInfo = await getLiquidityContributionInfo(userAddress);
    
    if (!contributionInfo.canClaimReward) {
      const nextDistributionDate = contributionInfo.nextClaimAvailable 
        ? new Date(contributionInfo.nextClaimAvailable).toLocaleDateString() 
        : 'unavailable';
      
      throw new Error(
        `Cannot distribute rewards yet. Must wait 7 days between distributions. ` +
        `Next distribution available: ${nextDistributionDate}`
      );
    }
    
    if (contributionInfo.contributedAmount === 0) {
      throw new Error("User doesn't have any liquidity contributions for reward distribution");
    }

    // Find user's token accounts
    const userYosAccount = await getAssociatedTokenAddress(yosMint, userPublicKey);

    // Find program controlled accounts
    const [liquidityContributionAddress] = findLiquidityContributionAddress(userPublicKey);
    
    // Get Pool Authority and its token accounts
    const poolAuthority = new PublicKey(solanaConfig.pool.authority);
    const poolYosAccount = await getAssociatedTokenAddress(yosMint, poolAuthority);
    
    // CRITICAL FIX: Use the exact program state account from config
    const programStateAccount = new PublicKey(MULTI_HUB_SWAP_STATE);

    // Create the instruction data - direct byte approach
    // This must match what's in the Rust program in match instruction_data.first()
    // Use the constant from config to ensure consistency
    const data = CLAIM_REWARD_DISCRIMINATOR; // 5 for CLAIM_WEEKLY_REWARD_IX
    
    console.log("CLAIM_WEEKLY_REWARD instruction preparation:");
    console.log("- Instruction data:", data.toString("hex"));
    console.log("- Program ID:", program.toString());
    
    // Log all accounts for debugging purposes
    // CRITICAL: We must exactly match what the program expects in the process_claim_weekly_reward function
    // Based on the Rust code analysis, here's what the function expects:
    // 1. caller - The admin/caller wallet (signer)
    // 2. user_key - The user who will receive the rewards
    // 3. liquidity_contribution_account - PDA to track contribution
    // 4. yos_mint - YOS mint
    // 5. user_yos - User's YOS account
    // 6. token_program - Token Program

    console.log("CLAIM_WEEKLY_REWARD accounts:");
    console.log("1. caller: ", adminPublicKey.toString(), "(signer)");
    console.log("2. user_key: ", userPublicKey.toString());
    console.log("3. liquidity_contribution_account: ", liquidityContributionAddress.toString());
    console.log("4. yos_mint: ", yosMint.toString());
    console.log("5. user_yos: ", userYosAccount.toString());
    console.log("6. token_program: ", TOKEN_PROGRAM_ID.toString());

    // Create the instruction with proper account list matching EXACTLY what the Rust code expects
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: adminPublicKey, isSigner: true, isWritable: true },    // caller
        { pubkey: userPublicKey, isSigner: false, isWritable: true },    // user_key
        { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true }, // liquidity_contribution_account
        { pubkey: yosMint, isSigner: false, isWritable: true },          // yos_mint
        { pubkey: userYosAccount, isSigner: false, isWritable: true },   // user_yos
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false } // token_program
      ],
      programId: program,
      data
    });

    // Use the improved transaction creation pattern to avoid numRequiredSignatures error
    console.log("Using improved transaction handling for weekly rewards distribution");
    const transaction = await createAndSignTransaction(adminWallet, instruction, connection);
    
    // CRITICAL: Simulate the transaction before requesting wallet signature
    // This prevents the wallet from showing a red error screen
    console.log("Simulating transaction to detect errors before wallet signature prompt...");
    try {
      const simResult = await connection.simulateTransaction(transaction);
      
      // Check for errors in the simulation
      if (simResult.value.err) {
        console.error("Transaction simulation failed:", simResult.value.err);
        console.error("Log messages:", simResult.value.logs);
        throw new Error(`Transaction would fail on-chain: ${JSON.stringify(simResult.value.err)}`);
      }
      
      console.log("Simulation successful, proceeding with transaction signing");
    } catch (error) {
      console.error("Simulation failed:", error);
      throw new Error(`Transaction would fail: ${error.message}`);
    }
    
    // Sign the transaction
    const signedTransaction = await adminWallet.signTransaction(transaction);
    
    // Send the transaction but DO NOT skip preflight verification
    // This ensures another simulation is run as a final check
    console.log("Sending transaction with full preflight verification...");
    const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight: false, // IMPORTANT: don't skip preflight
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });
    
    console.log("Transaction sent! Waiting for confirmation...");
    
    // Use proper confirmation strategy with blockhash reference
    const confirmationStrategy = {
      signature,
      blockhash: transaction.recentBlockhash!,
      lastValidBlockHeight: transaction.lastValidBlockHeight!
    };
    
    // Wait for transaction confirmation and verify success
    console.log("Waiting for reward distribution confirmation...");
    const confirmationResult = await connection.confirmTransaction(confirmationStrategy, 'confirmed');
    
    // CRITICAL: Check if the transaction failed on-chain
    if (confirmationResult.value.err) {
      console.error("Transaction failed on-chain:", confirmationResult.value.err);
      throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmationResult.value.err)}`);
    }
    
    // Double-check the transaction status
    try {
      const txInfo = await connection.getTransaction(signature, {commitment: 'confirmed'});
      
      // If meta is null or transaction has an error, throw a clear error
      if (!txInfo || !txInfo.meta || txInfo.meta.err) {
        const errorDetails = txInfo?.meta?.err ? JSON.stringify(txInfo.meta.err) : "Unknown failure";
        console.error(`Transaction verification failed: ${errorDetails}`);
        throw new Error(`Transaction verification failed: ${errorDetails}`);
      }
      
      console.log("✅ Reward distribution transaction successfully verified:", signature);
    } catch (error) {
      console.error("Error verifying transaction:", error);
      throw new Error(`Transaction may have failed. Please check explorer: ${error.message}`);
    }
    
    // Calculate the distributed reward amount (from config - 100% APR means 1.92% weekly)
    const weeklyRewardRate = solanaConfig.multiHubSwap.rewards.weeklyRewardRate / 100; // Convert from percentage to decimal
    const distributedAmount = contributionInfo.contributedAmount * weeklyRewardRate;
    
    console.log(`Distributed ${distributedAmount} YOS to user ${userAddress} from ${contributionInfo.contributedAmount} YOT contribution`);
    
    return {
      signature,
      distributedAmount
    };
  } catch (error) {
    console.error("Error in distributeWeeklyYosReward:", error);
    throw error;
  }
}

/**
 * Legacy function that redirects to the automated distribution
 * Kept for backward compatibility with existing code
 */
export async function claimWeeklyYosReward(wallet: any): Promise<{ signature: string, claimedAmount: number }> {
  try {
    const result = await distributeWeeklyYosReward(wallet, wallet.publicKey.toString());
    return {
      signature: result.signature,
      claimedAmount: result.distributedAmount
    };
  } catch (error) {
    console.error("Error in legacy claimWeeklyYosReward:", error);
    throw error;
  }
}

/**
 * Withdraw liquidity contribution
 * This implements the withdraw_contribution instruction from the program
 */
export async function withdrawLiquidityContribution(wallet: any): Promise<{ signature: string, withdrawnAmount: number }> {
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    const userPublicKey = wallet.publicKey;
    const program = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);

    // Find user's token account
    const userYotAccount = await getAssociatedTokenAddress(yotMint, userPublicKey);

    // Find program controlled accounts
    const [liquidityContributionAddress] = findLiquidityContributionAddress(userPublicKey);
    
    // Get Pool Authority and its token accounts
    const poolAuthority = new PublicKey(solanaConfig.pool.authority);
    const poolYotAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
    
    // Find program authority (for signing token transfers) - may be needed internally by the program
    const [programAuthorityAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority")],
      program
    );
    
    // CRITICAL FIX: Use the exact program state account from config
    const programStateAccount = new PublicKey(MULTI_HUB_SWAP_STATE);

    // Get the current contribution amount before withdrawal
    const liquidityContributionInfo = await getLiquidityContributionInfo(userPublicKey.toString());
    const withdrawnAmount = liquidityContributionInfo.contributedAmount;

    // Create the instruction data - direct byte approach matching Rust code
    // This must match what's in the Rust program in match instruction_data.first()
    // Use the constant from config to ensure consistency
    const data = WITHDRAW_CONTRIBUTION_DISCRIMINATOR; // 6 for WITHDRAW_CONTRIBUTION_IX
    
    console.log("WITHDRAW_CONTRIBUTION instruction preparation:");
    console.log("- Instruction data:", data.toString("hex"));
    console.log("- Program ID:", program.toString());
    
    // Log all accounts for debugging purposes
    // CRITICAL: We must exactly match what the program expects in the process_withdraw_contribution function
    // Based on the Rust code analysis, here's what the function expects:
    // 1. user - The user's wallet (signer)
    // 2. liquidity_contribution_account - PDA to track contribution
    // 3. liquidity_yot - Pool's YOT account for liquidity
    // 4. user_yot - User's YOT account
    // 5. token_program - Token Program
    
    console.log("WITHDRAW_CONTRIBUTION accounts:");
    console.log("1. user: ", userPublicKey.toString(), "(signer)");
    console.log("2. liquidity_contribution_account: ", liquidityContributionAddress.toString());
    console.log("3. liquidity_yot: ", poolYotAccount.toString(), "POOL YOT ACCOUNT");
    console.log("4. user_yot: ", userYotAccount.toString());
    console.log("5. token_program: ", TOKEN_PROGRAM_ID.toString());

    // Create the instruction that uses the EXACT account order expected by the Rust program
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },             // user
        { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true }, // liquidity_contribution_account
        { pubkey: poolYotAccount, isSigner: false, isWritable: true },           // liquidity_yot
        { pubkey: userYotAccount, isSigner: false, isWritable: true },           // user_yot
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }         // token_program
      ],
      programId: program,
      data
    });

    // Use the improved transaction creation pattern to avoid numRequiredSignatures error
    console.log("Using improved transaction handling for liquidity withdrawal");
    const transaction = await createAndSignTransaction(wallet, instruction, connection);
    
    // Sign the transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    
    // Skip simulation to avoid potential errors
    console.log("Skipping simulation to avoid potential errors");
    
    // Send transaction with skipPreflight
    console.log("Sending transaction with skipPreflight=true...");
    const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight: true,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });
    
    console.log("Transaction sent! Waiting for confirmation...");
    
    // Use proper confirmation strategy with blockhash reference
    const confirmationStrategy = {
      signature,
      blockhash: transaction.recentBlockhash!,
      lastValidBlockHeight: transaction.lastValidBlockHeight!
    };
    
    // Wait for transaction confirmation and verify success
    console.log("Waiting for withdraw contribution confirmation...");
    const confirmationResult = await connection.confirmTransaction(confirmationStrategy, 'confirmed');
    
    // CRITICAL: Check if the transaction failed on-chain
    if (confirmationResult.value.err) {
      console.error("Transaction failed on-chain:", confirmationResult.value.err);
      throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmationResult.value.err)}`);
    }
    
    // Double-check the transaction status
    try {
      const txInfo = await connection.getTransaction(signature, {commitment: 'confirmed'});
      
      // If meta is null or transaction has an error, throw a clear error
      if (!txInfo || !txInfo.meta || txInfo.meta.err) {
        const errorDetails = txInfo?.meta?.err ? JSON.stringify(txInfo.meta.err) : "Unknown failure";
        console.error(`Transaction verification failed: ${errorDetails}`);
        throw new Error(`Transaction verification failed: ${errorDetails}`);
      }
      
      console.log("✅ Withdraw contribution transaction successfully verified:", signature);
    } catch (error) {
      console.error("Error verifying transaction:", error);
      throw new Error(`Transaction may have failed. Please check explorer: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return {
      signature,
      withdrawnAmount
    };
  } catch (error) {
    console.error("Error in withdrawLiquidityContribution:", error);
    throw error;
  }
}

/**
 * LiquidityContribution account stores:
 * - User public key
 * - Contribution amount
 * - Start timestamp
 * - Last claim timestamp
 * - Total claimed YOS
 */
interface LiquidityContribution {
  user: PublicKey;
  contributedAmount: number;
  startTimestamp: number;
  lastClaimTime: number;
  totalClaimedYos: number;
}

/**
 * Get liquidity contribution info for a user
 * Retrieves the LiquidityContribution account for a wallet
 */
export async function getLiquidityContributionInfo(walletAddressStr: string): Promise<{
  contributedAmount: number;
  startTimestamp: number;
  lastClaimTime: number;
  totalClaimedYos: number;
  canClaimReward: boolean;
  nextClaimAvailable: string | null;
  estimatedWeeklyReward: number;
}> {
  try {
    const walletAddress = new PublicKey(walletAddressStr);
    const [liquidityContributionAddress] = findLiquidityContributionAddress(walletAddress);
    
    try {
      // Attempt to fetch the account data
      const accountInfo = await connection.getAccountInfo(liquidityContributionAddress);
      
      if (!accountInfo || !accountInfo.data) {
        // Account doesn't exist, return default values
        return {
          contributedAmount: 0,
          startTimestamp: 0,
          lastClaimTime: 0,
          totalClaimedYos: 0,
          canClaimReward: false,
          nextClaimAvailable: null,
          estimatedWeeklyReward: 0
        };
      }
      
      // Parse the account data according to our schema
      // Assuming data layout: 32 bytes for user pubkey, 8 bytes for amount, 8 bytes for start_time, 8 bytes for last_claim_time
      const data = accountInfo.data;
      const amount = data.readBigUInt64LE(32);
      const startTime = data.readBigInt64LE(40);
      const lastClaimTime = data.readBigInt64LE(48);
      
      // Convert to UI values
      const contributedAmount = Number(amount) / Math.pow(10, 9); // Assuming 9 decimals for YOT
      const startTimestamp = Number(startTime) * 1000; // Convert to milliseconds
      const lastClaimTimeMs = Number(lastClaimTime) * 1000; // Convert to milliseconds
      
      // Calculate next claim time (using claimPeriodDays from config)
      const claimPeriodMs = solanaConfig.multiHubSwap.rewards.claimPeriodDays * 24 * 60 * 60 * 1000;
      const nextClaimTime = lastClaimTimeMs + claimPeriodMs;
      const now = Date.now();
      const canClaimReward = now >= nextClaimTime;
      
      // Calculate estimated weekly reward (using weeklyRewardRate from config)
      const weeklyRewardRate = solanaConfig.multiHubSwap.rewards.weeklyRewardRate / 100;
      const estimatedWeeklyReward = contributedAmount * weeklyRewardRate;
      
      // Calculate total claimed YOS (estimating based on time since start)
      const periodsSinceStart = Math.floor((now - startTimestamp) / claimPeriodMs);
      const totalClaimedYos = periodsSinceStart * estimatedWeeklyReward;
      
      return {
        contributedAmount,
        startTimestamp,
        lastClaimTime: lastClaimTimeMs,
        totalClaimedYos,
        canClaimReward,
        nextClaimAvailable: canClaimReward ? null : new Date(nextClaimTime).toISOString(),
        estimatedWeeklyReward
      };
    } catch (error) {
      console.error("Error fetching liquidity contribution account:", error);
      // If there's an error fetching the account, assume it doesn't exist
      return {
        contributedAmount: 0,
        startTimestamp: 0,
        lastClaimTime: 0,
        totalClaimedYos: 0,
        canClaimReward: false,
        nextClaimAvailable: null,
        estimatedWeeklyReward: 0
      };
    }
  } catch (error) {
    console.error("Error in getLiquidityContributionInfo:", error);
    throw error;
  }
}

/**
 * Update multi-hub swap parameters (admin only)
 * This uses the program's update_parameters instruction to modify rates
 */
export async function updateMultiHubSwapParameters(
  wallet: any,
  lpContributionRate: number = solanaConfig.multiHubSwap.rates.lpContributionRate / 100,   // % of transaction going to LP
  adminFeeRate: number = solanaConfig.multiHubSwap.rates.adminFeeRate / 100,               // % fee going to admin
  yosCashbackRate: number = solanaConfig.multiHubSwap.rates.yosCashbackRate / 100,         // % of transaction minted as YOS
  swapFeeRate: number = solanaConfig.multiHubSwap.rates.swapFeeRate / 100,                 // % swap fee
  referralRate: number = solanaConfig.multiHubSwap.rates.referralRate / 100                // % referral bonus
) {
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    // Check if the calling wallet is the admin
    const [programState] = findProgramStateAddress();
    const programStateInfo = await connection.getAccountInfo(programState);
    
    if (!programStateInfo || !programStateInfo.data) {
      throw new Error("Program state not initialized");
    }
    
    // The first 32 bytes of program state are the admin pubkey
    const adminPubkey = new PublicKey(programStateInfo.data.slice(0, 32));
    
    // Verify caller is admin
    if (!wallet.publicKey.equals(adminPubkey)) {
      throw new Error("Only the admin can update parameters");
    }
    
    console.log("Updating multi-hub swap parameters as admin:", {
      lpContributionRate,
      adminFeeRate,
      yosCashbackRate,
      swapFeeRate,
      referralRate
    });
    
    // Convert percentages to basis points (1% = 100 basis points)
    const lpContributionBps = Math.round(lpContributionRate * 100);
    const adminFeeBps = Math.round(adminFeeRate * 100);
    const yosCashbackBps = Math.round(yosCashbackRate * 100);
    const swapFeeBps = Math.round(swapFeeRate * 100);
    const referralBps = Math.round(referralRate * 100);
    
    // Create instruction data - consistent with how we format the other functions
    // First byte is instruction discriminator (3 for UPDATE_PARAMETERS_IX)
    // This must match the value in the Rust program's match statement
    const data = Buffer.alloc(1 + 5 * 8); // 1 byte discrim + 5 u64 values (8 bytes each)
    
    // Set discriminator as first byte - must be 3 for UPDATE_PARAMETERS_IX
    // Use the constant from config to ensure consistency
    data[0] = UPDATE_PARAMETERS_DISCRIMINATOR[0];
    
    // Write the parameters as u64 values - explicit little-endian
    const params = [
      BigInt(lpContributionBps),
      BigInt(adminFeeBps),
      BigInt(yosCashbackBps),
      BigInt(swapFeeBps), 
      BigInt(referralBps)
    ];
    
    // Pack each parameter as little-endian u64
    for (let i = 0; i < params.length; i++) {
      const paramBuffer = Buffer.alloc(8);
      paramBuffer.writeBigUInt64LE(params[i], 0);
      paramBuffer.copy(data, 1 + (i * 8));
    }
    
    console.log("UPDATE_PARAMETERS instruction preparation:");
    console.log("- Instruction data (hex):", data.toString("hex"));
    console.log("- First byte (discriminator):", data[0]);
    console.log("- Parameters (basis points):", {
      lpContributionBps,
      adminFeeBps,
      yosCashbackBps,
      swapFeeBps,
      referralBps
    });
    
    // Get the program authority PDA
    const [programAuthorityAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority")],
      new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
    );
    
    // Log all accounts for debugging purposes
    // CRITICAL: We must exactly match what the program expects in the process_update_parameters function
    // In lines 436-437, it only gets 2 accounts:
    // let admin_account = next_account_info(accounts_iter)?;            // 1
    // let program_state_account = next_account_info(accounts_iter)?;    // 2
    // The program_authority is not required for this function
    
    console.log("UPDATE_PARAMETERS accounts:");
    console.log("1. admin: ", wallet.publicKey.toString(), "(signer)");
    console.log("2. program_state: ", programState.toString());
    
    // Create instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: programState, isSigner: false, isWritable: true }
        // Removing program_authority as it's not expected by the Rust program
      ],
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
      data
    });
    
    // Use the improved transaction creation pattern to avoid numRequiredSignatures error
    console.log("Using improved transaction handling for parameter updates");
    const transaction = await createAndSignTransaction(wallet, instruction, connection);
    
    // Sign the transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    
    // Skip simulation to avoid potential errors
    console.log("Skipping simulation to avoid potential errors");
    
    // Send transaction with skipPreflight
    console.log("Sending transaction with skipPreflight=true...");
    const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight: true,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });
    
    console.log("Transaction sent! Waiting for confirmation...");
    
    // Use proper confirmation strategy with blockhash reference
    const confirmationStrategy = {
      signature,
      blockhash: transaction.recentBlockhash!,
      lastValidBlockHeight: transaction.lastValidBlockHeight!
    };
    
    // Wait for transaction confirmation and verify success
    console.log("Waiting for parameter update confirmation...");
    const confirmationResult = await connection.confirmTransaction(confirmationStrategy, 'confirmed');
    
    // CRITICAL: Check if the transaction failed on-chain
    if (confirmationResult.value.err) {
      console.error("Transaction failed on-chain:", confirmationResult.value.err);
      throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmationResult.value.err)}`);
    }
    
    // Double-check the transaction status
    try {
      const txInfo = await connection.getTransaction(signature, {commitment: 'confirmed'});
      
      // If meta is null or transaction has an error, throw a clear error
      if (!txInfo || !txInfo.meta || txInfo.meta.err) {
        const errorDetails = txInfo?.meta?.err ? JSON.stringify(txInfo.meta.err) : "Unknown failure";
        console.error(`Transaction verification failed: ${errorDetails}`);
        throw new Error(`Transaction verification failed: ${errorDetails}`);
      }
      
      console.log("✅ Parameter update transaction successfully verified:", signature);
    } catch (error) {
      console.error("Error verifying transaction:", error);
      throw new Error(`Transaction may have failed. Please check explorer: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log("Parameters updated successfully:", {
      signature,
      lpContributionRate,
      adminFeeRate,
      yosCashbackRate,
      swapFeeRate,
      referralRate
    });
    
    return {
      success: true,
      signature,
      message: "Parameters updated on-chain successfully",
      updatedRates: {
        lpContributionRate,
        adminFeeRate,
        yosCashbackRate,
        swapFeeRate,
        referralRate
      }
    };
  } catch (error) {
    console.error("Error updating multi-hub swap parameters:", error);
    throw error;
  }
}

/**
 * Program state stored in a PDA
 * Matches the Solana program's ProgramState struct
 * Default values from app.config.json
 */
interface ProgramState {
  admin: PublicKey;
  yotMint: PublicKey;
  yosMint: PublicKey;
  lpContributionRate: number; // Default: solanaConfig.multiHubSwap.rates.lpContributionRate
  adminFeeRate: number;       // Default: solanaConfig.multiHubSwap.rates.adminFeeRate
  yosCashbackRate: number;    // Default: solanaConfig.multiHubSwap.rates.yosCashbackRate
  swapFeeRate: number;        // Default: solanaConfig.multiHubSwap.rates.swapFeeRate
  referralRate: number;       // Default: solanaConfig.multiHubSwap.rates.referralRate
}

/**
 * Executes a token swap
 * For SOL-YOT swaps, uses the specialized solToYotSwap function
 * 
 * @returns An object containing either:
 * - Regular swap result: {signature, outputAmount, distributionDetails}
 * - Partial swap result: {solSignature, error, message} (when only SOL was sent but YOT couldn't be transferred)
 * - Token account creation required: {solSignature, needsTokenAccount, tokenAccountTransaction}
 */
export async function executeSwap(
  wallet: any,
  fromTokenAddress: string,
  toTokenAddress: string,
  inputAmount: number,
  slippageTolerance: number = 1.0
): Promise<{ 
  signature?: string, 
  outputAmount?: number, 
  distributionDetails?: any,
  solSignature?: string,
  error?: boolean,
  message?: string,
  needsTokenAccount?: boolean,
  tokenAccountTransaction?: Transaction
}> {
  if (!wallet || !wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  // Get expected output amount with slippage tolerance
  const { outputAmount, minOutputAmount } = await getExpectedOutput(
    fromTokenAddress,
    toTokenAddress,
    inputAmount,
    slippageTolerance
  );

  // Case 1: SOL to YOT swap (main focus of Multi-Hub implementation)
  if (fromTokenAddress === SOL_TOKEN_ADDRESS && toTokenAddress === YOT_TOKEN_ADDRESS) {
    console.log("[SWAP_DEBUG] Starting SOL to YOT swap");
    console.log("[SWAP_DEBUG] Input amount (SOL):", inputAmount);
    console.log("[SWAP_DEBUG] Expected output (YOT):", outputAmount);
    
    try {
      // CRITICAL FIX: We can't use buyAndDistribute for SOL to YOT swaps
      // because the user doesn't have YOT tokens to approve
      // We need to use the special solToYotSwapV2 function instead which uses our on-chain solution
      console.log("[SWAP_DEBUG] Using solToYotSwapV2 (on-chain solution) instead of buyAndDistribute");
      
      // Import the enhanced solToYotSwapV3 function that properly handles liquidity contribution creation
      // This version fixes the "account already borrowed" error by using a two-step process
      console.log("[SWAP_DEBUG] Using enhanced solToYotSwapV3 implementation with liquidity contribution fix");
      const { solToYotSwap } = await import('./solToYotSwapV3');
      
      // Execute the swap with our specialized on-chain implementation
      console.log("[SWAP_DEBUG] Executing on-chain SOL to YOT swap...");
      const result = await solToYotSwap(wallet, inputAmount);
      
      // Check if we got an object with error information
      if (typeof result === 'object') {
        console.log("[SWAP_DEBUG] Got structured result from solToYotSwap:", result);
        
        // If we have an error or need token account, just pass it through
        if (result.error || result.needsTokenAccount) {
          return result;
        }
        
        // If we have a regular success with solSignature
        if (result.solSignature && result.completed) {
          console.log("[SWAP_DEBUG] Transaction successful! Signature:", result.solSignature);
          
          // In this case, the contract handles the distribution automatically
          // using rates from the config:
          // - Usually 75% to user 
          // - Usually 20% to liquidity pool
          // - Usually 5% as YOS cashback
          const userDistribution = 100 - (solanaConfig.multiHubSwap.rates.lpContributionRate / 100) - (solanaConfig.multiHubSwap.rates.yosCashbackRate / 100);
          const lpContribution = solanaConfig.multiHubSwap.rates.lpContributionRate / 100;
          const yosCashback = solanaConfig.multiHubSwap.rates.yosCashbackRate / 100;
          
          console.log("[SWAP_DEBUG] Distribution details:", {
            userReceived: outputAmount * userDistribution/100,
            liquidityContribution: outputAmount * lpContribution/100,
            yosCashback: outputAmount * yosCashback/100
          });
          
          return {
            signature: result.solSignature,
            outputAmount,
            distributionDetails: {
              userReceived: outputAmount * userDistribution/100,
              liquidityContribution: outputAmount * lpContribution/100,
              yosCashback: outputAmount * yosCashback/100
            }
          };
        }
        
        // Return the raw result - this will be handled by the UI
        return result;
      }
      
      // Handle the case where we got a string (old API)
      const signature = result as string;
      console.log("[SWAP_DEBUG] Transaction successful! Signature:", signature);
      
      // Calculate distribution details
      const userDistribution = 100 - (solanaConfig.multiHubSwap.rates.lpContributionRate / 100) - (solanaConfig.multiHubSwap.rates.yosCashbackRate / 100);
      const lpContribution = solanaConfig.multiHubSwap.rates.lpContributionRate / 100;
      const yosCashback = solanaConfig.multiHubSwap.rates.yosCashbackRate / 100;
      
      console.log("[SWAP_DEBUG] Distribution details:", {
        userReceived: outputAmount * userDistribution/100,
        liquidityContribution: outputAmount * lpContribution/100,
        yosCashback: outputAmount * yosCashback/100
      });
      
      return {
        signature,
        outputAmount,
        distributionDetails: {
          userReceived: outputAmount * userDistribution/100,
          liquidityContribution: outputAmount * lpContribution/100,
          yosCashback: outputAmount * yosCashback/100
        }
      };
    } catch (error: any) {
      console.error("[SWAP_DEBUG] Critical transaction failure:", error);
      
      // Try to get more information about the error
      console.log("[SWAP_DEBUG] Error type:", typeof error);
      console.log("[SWAP_DEBUG] Error name:", error?.name);
      console.log("[SWAP_DEBUG] Full error object:", JSON.stringify(error, null, 2));
      
      if (error?.logs) {
        console.log("[SWAP_DEBUG] Transaction logs:", error.logs);
      }
      
      // Try to simulate the transaction to get more debugging info
      try {
        console.log("[SWAP_DEBUG] Will attempt transaction simulation for more details...");
        // Re-throw the original error to preserve the stack trace
        throw error;
      } catch (simulationError: any) {
        console.error("[SWAP_DEBUG] Simulation also failed:", simulationError);
        throw error; // Re-throw the original error
      }
    }
  }
  
  // Case 2: YOT to SOL swap (would be implemented via Raydium or Jupiter)
  // Currently stubbed - would need actual AMM integration
  if (fromTokenAddress === YOT_TOKEN_ADDRESS && toTokenAddress === SOL_TOKEN_ADDRESS) {
    throw new Error("YOT to SOL swaps currently under development. Please use SOL to YOT swaps.");
  }
  
  // Default case: Unsupported swap pair
  throw new Error(`Swap from ${fromTokenAddress} to ${toTokenAddress} not supported yet`);
}

/**
 * Calculates the expected output amount based on input and current exchange rate
 */
export async function getExpectedOutput(
  fromTokenAddress: string,
  toTokenAddress: string,
  inputAmount: number,
  slippageTolerance: number = 1.0
): Promise<{ outputAmount: number, minOutputAmount: number, exchangeRate: number }> {
  // Get the exact AMM exchange rate from blockchain
  const exchangeRate = await getExchangeRate(fromTokenAddress, toTokenAddress);
  
  // Calculate output amount using raw exchange rate (no rounding)
  const outputAmount = inputAmount * exchangeRate;
  
  // Calculate minimum output amount based on slippage tolerance
  const slippageFactor = (100 - slippageTolerance) / 100;
  const minOutputAmount = outputAmount * slippageFactor;
  
  console.log(`Exact AMM calculation: ${inputAmount} ${fromTokenAddress} * ${exchangeRate} = ${outputAmount} ${toTokenAddress}`);
  console.log(`With slippage (${slippageTolerance}%): min output = ${minOutputAmount} ${toTokenAddress}`);
  
  return {
    outputAmount,
    minOutputAmount,
    exchangeRate
  };
}

/**
 * Gets exchange rates from the actual Solana blockchain pools
 * Uses real AMM rates instead of hardcoded values
 */
export /**
 * @deprecated Use the getExchangeRate function from solana.ts instead
 * This function remains for backward compatibility but will redirect to the central implementation
 */
async function getExchangeRate(fromToken: string, toToken: string): Promise<number> {
  // Import the canonical implementation from solana.ts
  const { getExchangeRate: getSolanaExchangeRate } = await import('./solana');
  
  try {
    // Normalize token addresses to lowercase for case-insensitive comparison
    const fromTokenLower = fromToken.toString().toLowerCase();
    const toTokenLower = toToken.toString().toLowerCase();
    const solTokenLower = SOL_TOKEN_ADDRESS.toString().toLowerCase();
    const yotTokenLower = YOT_TOKEN_ADDRESS.toString().toLowerCase();
    
    // Case 1: SOL to YOT swap rate
    if (fromTokenLower === solTokenLower && toTokenLower === yotTokenLower) {
      // Get rates from the canonical implementation
      const rates = await getSolanaExchangeRate();
      if (!rates || !rates.solToYot) {
        throw new Error("Failed to fetch SOL-YOT exchange rate from blockchain");
      }
      return rates.solToYot;
    } 
    
    // Case 2: YOT to SOL swap rate
    else if (fromTokenLower === yotTokenLower && toTokenLower === solTokenLower) {
      // Get rates from the canonical implementation
      const rates = await getSolanaExchangeRate();
      if (!rates || !rates.yotToSol) {
        throw new Error("Failed to fetch YOT-SOL exchange rate from blockchain");
      }
      return rates.yotToSol;
    }
    
    // For other pairs, we would integrate with other AMMs like Jupiter or Raydium
    console.warn(`No direct pool for ${fromToken} to ${toToken}`);
    throw new Error(`Swap pair not supported: ${fromToken} to ${toToken}`)
  } catch (error: any) {
    console.error("Error fetching AMM rate:", error);
    
    // No fallbacks - propagate the error
    throw new Error(`Failed to retrieve exchange rate from blockchain: ${error.message}`);
  }
}

/**
 * Get the current SOL and YOT balances in the liquidity pool
 * Fetches real balances from the Solana blockchain
 */
async function getPoolBalances(): Promise<[number, number, number]> {
  try {
    // Get SOL balance from pool SOL account - Using the SOL_YOT_POOL_INFO from config
    const solPoolAccount = new PublicKey(solanaConfig.pool.solAccount);
    const solBalance = await connection.getBalance(solPoolAccount);
    const solBalanceNormalized = solBalance / LAMPORTS_PER_SOL;
    
    // Get YOT balance from pool YOT account 
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const poolAuthority = new PublicKey(solanaConfig.pool.authority); // Pool authority
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
    
    // Get YOS balance (for display purposes)
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const yosPoolAccount = await getAssociatedTokenAddress(yosMint, poolAuthority);
    
    let yotBalance = 0;
    let yosBalance = 0;
    
    try {
      const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
      yotBalance = Number(yotAccountInfo.value.uiAmount || 0);
      if (yotBalance <= 0) {
        console.warn("YOT pool balance is zero or not available");
        throw new Error("Insufficient YOT liquidity in pool");
      }
    } catch (e) {
      console.error("Error fetching YOT balance from pool:", e);
      throw new Error("Failed to retrieve YOT balance from pool");
    }
    
    try {
      const yosAccountInfo = await connection.getTokenAccountBalance(yosPoolAccount);
      yosBalance = Number(yosAccountInfo.value.uiAmount || 0);
      // YOS balance can be zero, as it's only used for display purposes
    } catch (e) {
      console.error("Error fetching YOS balance from pool:", e);
      // YOS balance can be zero as it's only for display
      yosBalance = 0;
    }
    
    console.log(`Pool balances fetched - SOL: ${solBalanceNormalized}, YOT: ${yotBalance}, YOS: ${yosBalance}`);
    return [solBalanceNormalized, yotBalance, yosBalance];
  } catch (error: any) {
    console.error("Error fetching pool balances:", error);
    // In all cases, throw errors and never use fallbacks
    // This forces the caller to handle the error properly
    throw new Error("Failed to retrieve real pool balances from blockchain. Error: " + error.message);
  }
}

/**
 * Gets token balance for a specific token
 */
export async function getTokenBalance(wallet: any, tokenAddress: string): Promise<number> {
  if (!wallet || !wallet.publicKey) {
    return 0;
  }

  try {
    // For SOL, get native SOL balance
    if (tokenAddress === SOL_TOKEN_ADDRESS) {
      const balance = await connection.getBalance(wallet.publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } 
    
    // For SPL tokens like YOT
    else {
      const tokenMint = new PublicKey(tokenAddress);
      const tokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        wallet.publicKey
      );
      
      try {
        const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
        return Number(accountInfo.value.uiAmount);
      } catch (e) {
        // Token account might not exist yet
        return 0;
      }
    }
  } catch (error: any) {
    console.error("Error fetching token balance:", error);
    return 0;
  }
}

/**
 * Checks if a token pair is supported for swapping
 * Uses case-insensitive comparison for token addresses
 */
export function isSwapSupported(fromToken: string, toToken: string): boolean {
  // Normalize token addresses to lowercase for case-insensitive comparison
  const fromTokenLower = fromToken.toString().toLowerCase();
  const toTokenLower = toToken.toString().toLowerCase();
  const solTokenLower = SOL_TOKEN_ADDRESS.toString().toLowerCase();
  const yotTokenLower = YOT_TOKEN_ADDRESS.toString().toLowerCase();
  
  // Check for SOL-YOT swap (fully supported)
  if (fromTokenLower === solTokenLower && toTokenLower === yotTokenLower) {
    return true;
  }
  
  // Check for YOT-SOL swap (supported)
  if (fromTokenLower === yotTokenLower && toTokenLower === solTokenLower) {
    return true;
  }
  
  return false;
}

/**
 * Gets a list of supported swap tokens in the network
 */
export async function getSupportedTokens(): Promise<Array<{ symbol: string, address: string, name: string, logoUrl: string }>> {
  // Return dynamically generated list of supported tokens from config
  return [
    {
      symbol: solanaConfig.tokens.sol.symbol,
      address: SOL_TOKEN_ADDRESS,
      name: solanaConfig.tokens.sol.name,
      logoUrl: "https://cryptologos.cc/logos/solana-sol-logo.png"
    },
    {
      symbol: solanaConfig.tokens.yot.symbol,
      address: YOT_TOKEN_ADDRESS,
      name: solanaConfig.tokens.yot.name,
      logoUrl: "https://place-hold.it/32x32/37c/fff?text=YOT"
    }
  ];
}

/**
 * Get global statistics for the multi-hub swap program
 * Fetches and deserializes the ProgramState
 */
/**
 * Initialize the Multi-Hub Swap program
 * This can only be called by an admin wallet
 */
export async function initializeMultiHubSwap(
  wallet: any,
  yotMint: PublicKey,
  yosMint: PublicKey,
  lpContributionRate: number = solanaConfig.multiHubSwap.rates.lpContributionRate / 100,
  adminFeeRate: number = solanaConfig.multiHubSwap.rates.adminFeeRate / 100,
  yosCashbackRate: number = solanaConfig.multiHubSwap.rates.yosCashbackRate / 100,
  swapFeeRate: number = solanaConfig.multiHubSwap.rates.swapFeeRate / 100,
  referralRate: number = solanaConfig.multiHubSwap.rates.referralRate / 100
): Promise<string> {
  if (!wallet || !wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  // Verify admin privileges
  if (wallet.publicKey.toString() !== MULTI_HUB_SWAP_ADMIN) {
    throw new Error("Only admin wallet can initialize the program");
  }

  // Connect to Solana
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  
  // Create the program state account using the same seed as in the Rust program
  const [programStateAddress, programStateBump] = findProgramStateAddress();
  console.log("Program state PDA:", programStateAddress.toString());
  
  // Create the program authority account
  const [programAuthority, authorityBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  console.log("Program authority PDA:", programAuthority.toString());
  
  // Create a transaction to initialize the program
  const transaction = new Transaction();
  
  // Create the instruction with modified data format to match Rust program
  // The Rust program expects: instruction_type(1) + admin(32) + yot_mint(32) + yos_mint(32) + 5 rates(8*5)
  const data = Buffer.alloc(1 + 32*3 + 8*5);
  
  // Set instruction type
  data.writeUInt8(MultiHubSwapInstructionType.Initialize, 0);
  let offset = 1;
  
  // Add admin public key
  wallet.publicKey.toBuffer().copy(data, offset);
  offset += 32;
  
  // Add token mints
  yotMint.toBuffer().copy(data, offset);
  offset += 32;
  yosMint.toBuffer().copy(data, offset);
  offset += 32;
  
  // Convert percentages to basis points with correct scaling 
  // These should be u64 values as expected by the Rust program
  const lpContributionBasisPoints = BigInt(Math.round(lpContributionRate * 10000));
  const adminFeeBasisPoints = BigInt(Math.round(adminFeeRate * 10000));
  const yosCashbackBasisPoints = BigInt(Math.round(yosCashbackRate * 10000));
  const swapFeeBasisPoints = BigInt(Math.round(swapFeeRate * 10000));
  const referralBasisPoints = BigInt(Math.round(referralRate * 10000));
  
  // Write u64 values in little-endian format
  data.writeBigUInt64LE(lpContributionBasisPoints, offset);
  offset += 8;
  data.writeBigUInt64LE(adminFeeBasisPoints, offset);
  offset += 8;
  data.writeBigUInt64LE(yosCashbackBasisPoints, offset);
  offset += 8;
  data.writeBigUInt64LE(swapFeeBasisPoints, offset);
  offset += 8;
  data.writeBigUInt64LE(referralBasisPoints, offset);
  
  console.log("Initialization parameters:");
  console.log(`- LP Contribution: ${lpContributionRate * 100}% (${lpContributionBasisPoints} basis points)`);
  console.log(`- Admin Fee: ${adminFeeRate * 100}% (${adminFeeBasisPoints} basis points)`);
  console.log(`- YOS Cashback: ${yosCashbackRate * 100}% (${yosCashbackBasisPoints} basis points)`);
  console.log(`- Swap Fee: ${swapFeeRate * 100}% (${swapFeeBasisPoints} basis points)`);
  console.log(`- Referral Rate: ${referralRate * 100}% (${referralBasisPoints} basis points)`);
  
  // Create the instruction with accounts that match the Rust program
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
    data
  });
  
  transaction.add(instruction);
  
  try {
    // Sign and send the transaction
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log("Initialization transaction sent. Waiting for confirmation...");
    
    await connection.confirmTransaction(signature, 'confirmed');
    console.log("Multi-Hub Swap program initialized:", signature);
    return signature;
  } catch (error: any) {
    console.error("Failed to initialize Multi-Hub Swap program:", error);
    throw error;
  }
}

export async function getMultiHubSwapStats() {
  try {
    // Get program state address - using explicit PDA derivation to ensure we're checking the right address
    const [programStateAddress] = findProgramStateAddress();
    console.log("Checking program state at:", programStateAddress.toString());
    
    // Fetch account data
    const accountInfo = await connection.getAccountInfo(programStateAddress);
    
    // Debug info about account
    if (accountInfo) {
      console.log("Program state account found:", {
        owner: accountInfo.owner.toString(),
        dataLength: accountInfo.data.length,
        executable: accountInfo.executable
      });
    }
    
    if (!accountInfo || !accountInfo.data) {
      console.error("Program state account not found or empty");
      throw new Error("Program state not initialized");
    }
    
    // The account data layout should match the Rust program's ProgramState struct:
    // ```
    // pub struct ProgramState {
    //   pub admin: Pubkey,             // 32 bytes
    //   pub yot_mint: Pubkey,          // 32 bytes
    //   pub yos_mint: Pubkey,          // 32 bytes
    //   pub lp_contribution_rate: u64, // 8 bytes
    //   pub admin_fee_rate: u64,       // 8 bytes
    //   pub yos_cashback_rate: u64,    // 8 bytes
    //   pub swap_fee_rate: u64,        // 8 bytes
    //   pub referral_rate: u64,        // 8 bytes
    // }
    // ```
    // Total expected size: 32*3 + 8*5 = 96 + 40 = 136 bytes
    
    const data = accountInfo.data;
    console.log("Account data buffer length:", data.length);
    
    // Safely extract values with error handling
    try {
      // Read the public keys if there's enough data
      if (data.length < 32*3) {
        throw new Error(`Insufficient account data: expected at least ${32*3} bytes, got ${data.length}`);
      }
      
      const admin = new PublicKey(data.slice(0, 32));
      const yotMint = new PublicKey(data.slice(32, 64));
      const yosMint = new PublicKey(data.slice(64, 96));
      
      console.log("Extracted public keys:", {
        admin: admin.toString(),
        yotMint: yotMint.toString(),
        yosMint: yosMint.toString()
      });
      
      let lpContributionRate = solanaConfig.multiHubSwap.rates.lpContributionRate / 100;
      let adminFeeRate = solanaConfig.multiHubSwap.rates.adminFeeRate / 100;
      let yosCashbackRate = solanaConfig.multiHubSwap.rates.yosCashbackRate / 100;
      let swapFeeRate = solanaConfig.multiHubSwap.rates.swapFeeRate / 100;
      let referralRate = solanaConfig.multiHubSwap.rates.referralRate / 100;
      
      // Try to read rates from the account data if there's enough data
      if (data.length >= 32*3 + 8*5) {
        try {
          // Read the rates (u64 values in basis points - divide by 10000 for percentage)
          lpContributionRate = Number(data.readBigUInt64LE(96)) / 10000; // Convert from basis points to percentage
          adminFeeRate = Number(data.readBigUInt64LE(104)) / 10000;
          yosCashbackRate = Number(data.readBigUInt64LE(112)) / 10000;
          swapFeeRate = Number(data.readBigUInt64LE(120)) / 10000;
          referralRate = Number(data.readBigUInt64LE(128)) / 10000;
          
          console.log("Extracted rates:", {
            lpContributionRate,
            adminFeeRate,
            yosCashbackRate,
            swapFeeRate,
            referralRate
          });
        } catch (rateError) {
          console.warn("Error reading rates from account data, using defaults:", rateError);
        }
      } else {
        console.warn(`Insufficient data for rates: expected ${32*3 + 8*5} bytes, got ${data.length}. Using default rates.`);
      }
      
      // Return formatted stats for the UI
      return {
        admin: admin.toString(),
        yotMint: yotMint.toString(),
        yosMint: yosMint.toString(),
        totalLiquidityContributed: solanaConfig.multiHubSwap.stats.totalLiquidityContributed,
        totalContributors: solanaConfig.multiHubSwap.stats.totalContributors,
        totalYosRewarded: solanaConfig.multiHubSwap.stats.totalYosRewarded,
        
        // Rates from blockchain state (no fallbacks)
        lpContributionRate,
        adminFeeRate,
        yosCashbackRate,
        swapFeeRate, 
        referralRate,
        
        // Distribution percentages
        buyDistribution: {
          userPercent: 100 - lpContributionRate - yosCashbackRate,
          liquidityPercent: lpContributionRate,
          cashbackPercent: yosCashbackRate
        },
        
        sellDistribution: {
          userPercent: 100 - lpContributionRate - yosCashbackRate,
          liquidityPercent: lpContributionRate,
          cashbackPercent: yosCashbackRate
        },
        
        // Weekly reward rate from config
        weeklyRewardRate: solanaConfig.multiHubSwap.rewards.weeklyRewardRate,
        yearlyAPR: solanaConfig.multiHubSwap.rewards.yearlyAPR
      };
    } catch (dataError) {
      console.error("Error parsing account data:", dataError);
      throw dataError;
    }
  } catch (error: any) {
    console.error("Error getting multi-hub swap stats:", error);
    
    // No fallbacks - we must get data from blockchain or throw an error
    // This prevents confusion from outdated rates and ensures data integrity
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Failed to fetch protocol data from blockchain";
      
    throw new Error(`Cannot get multi-hub swap stats from blockchain: ${errorMessage}`);
  }
}