/**
 * Improved MultiHub Swap Client Implementation
 * A safer version that ensures YOS token account exists before submitting transactions
 */
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  Commitment,
  sendAndConfirmTransaction,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccount,
} from '@solana/spl-token';
import { ENDPOINT, MULTI_HUB_SWAP_PROGRAM_ID } from './constants';

// Token mint addresses
const YOT_TOKEN_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
const YOS_TOKEN_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');
const MULTIHUB_SWAP_PROGRAM_ID = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);

/**
 * Calculate PDA for program state
 */
function findProgramStateAddress(programId: PublicKey): [PublicKey, number] {
  // CRITICAL FIX: Changed from "program_state" to "state" to match the Rust contract
  // The Rust code uses: Pubkey::find_program_address(&[b"state"], program_id)
  return PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    programId
  );
}

/**
 * Calculate PDA for program authority
 */
function findAuthorityAddress(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    programId
  );
}

/**
 * CRITICAL IMPROVEMENT: Ensure YOS token account exists separately before swap
 * This helps prevent the "InvalidMint" error that happens when the YOS token
 * account doesn't exist during the swap transaction
 */
export async function ensureYosTokenAccountExists(
  connection: Connection,
  wallet: any
): Promise<boolean> {
  try {
    if (!wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    console.log("Ensuring YOS token account exists for wallet:", wallet.publicKey.toString());
    
    // Get the associated token address for YOS
    const yosTokenAccount = await getAssociatedTokenAddress(
      YOS_TOKEN_MINT,
      wallet.publicKey
    );
    
    console.log("YOS token account address:", yosTokenAccount.toString());
    
    // Check if the account exists
    try {
      const account = await getAccount(connection, yosTokenAccount);
      console.log("YOS token account exists", account.address.toString());
      return true;
    } catch (error) {
      console.log("YOS token account doesn't exist, creating now...");
      
      // Create the YOS token account
      const transaction = new Transaction();
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          yosTokenAccount,
          wallet.publicKey,
          YOS_TOKEN_MINT
        )
      );
      
      // Sign and send transaction
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = wallet.publicKey;
      
      // Simulate transaction to ensure it will work
      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        console.error("YOS account creation simulation failed:", simulation.value.err);
        throw new Error(`YOS account creation simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }
      
      // Send transaction
      const signature = await wallet.sendTransaction(transaction, connection);
      console.log("YOS token account creation transaction sent:", signature);
      
      // Confirm transaction
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`YOS token account creation failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      
      console.log("YOS token account created successfully");
      return true;
    }
  } catch (error) {
    console.error("Error ensuring YOS token account exists:", error);
    throw error;
  }
}

/**
 * Initialize the MultiHub Swap program
 * This should be called once before using the swap functionality
 */
export async function initializeMultiHubSwapProgram(wallet: any): Promise<string> {
  console.log("Initializing MultiHub Swap Program...");
  const connection = new Connection(ENDPOINT, 'confirmed');

  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  // Verify the wallet is the admin
  const adminPublicKey = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ');
  if (!wallet.publicKey.equals(adminPublicKey)) {
    throw new Error("Only the admin can initialize the program");
  }

  // Use "state" for PDA seed (matching the Rust contract)
  const [programStateAddress, _] = findProgramStateAddress(MULTIHUB_SWAP_PROGRAM_ID);
  const [authorityAddress, authorityBump] = findAuthorityAddress(MULTIHUB_SWAP_PROGRAM_ID);
  
  console.log("Program state PDA:", programStateAddress.toString());
  console.log("Authority PDA:", authorityAddress.toString());
  
  // Check if already initialized
  const programState = await connection.getAccountInfo(programStateAddress);
  if (programState) {
    console.log("Program already initialized with size:", programState.data.length);
    // Program exists, check if it has data
    if (programState.data.length > 0) {
      return "Program already initialized";
    }
  }
  
  // Create initialization transaction
  const transaction = new Transaction();
  
  // Instruction data for Initialize with these parameters:
  // - admin (Pubkey)
  // - yot_mint (Pubkey)
  // - yos_mint (Pubkey)
  // - lp_contribution_rate (u64) = 2000 (20%)
  // - admin_fee_rate (u64) = 10 (0.1%)
  // - yos_cashback_rate (u64) = 500 (5%)
  // - swap_fee_rate (u64) = 30 (0.3%) 
  // - referral_rate (u64) = 50 (0.5%)
  
  console.log("Preparing new initialization approach with precise byte layout...");
  
  try {
    // Let's use the exact layout based on the Contract analysis
    // First, we'll define our constants
    const YOT_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
    const YOS_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');
    
    // The variant index for Initialize instruction is 0
    const INITIALIZE_VARIANT = 0;
    
    // These parameters should match contract's expected values
    // All percentages are expressed in basis points (1/100 of 1%)
    // 2000 basis points = 20%
    const LP_CONTRIBUTION_RATE = BigInt(2000); 
    const ADMIN_FEE_RATE = BigInt(10);         // 0.1%
    const YOS_CASHBACK_RATE = BigInt(500);     // 5%
    const SWAP_FEE_RATE = BigInt(30);          // 0.3%
    const REFERRAL_RATE = BigInt(50);          // 0.5%
    
    console.log(`Using admin: ${adminPublicKey.toString()}`);
    console.log(`Using YOT mint: ${YOT_MINT.toString()}`);
    console.log(`Using YOS mint: ${YOS_MINT.toString()}`);
    console.log("Using rates (in basis points):");
    console.log(`  LP contribution: ${LP_CONTRIBUTION_RATE} (20%)`);
    console.log(`  Admin fee: ${ADMIN_FEE_RATE} (0.1%)`);
    console.log(`  YOS cashback: ${YOS_CASHBACK_RATE} (5%)`);
    console.log(`  Swap fee: ${SWAP_FEE_RATE} (0.3%)`);
    console.log(`  Referral: ${REFERRAL_RATE} (0.5%)`);
    
    // Now construct the instruction data byte-by-byte to ensure exact layout
    // Layout:
    // - 1 byte: variant index (0 = Initialize)
    // - 32 bytes: admin pubkey
    // - 32 bytes: YOT mint pubkey
    // - 32 bytes: YOS mint pubkey
    // - 8 bytes: LP contribution rate (u64)
    // - 8 bytes: admin fee rate (u64)
    // - 8 bytes: YOS cashback rate (u64)
    // - 8 bytes: swap fee rate (u64)
    // - 8 bytes: referral rate (u64)
    // Total: 137 bytes
    
    const instructionData = Buffer.alloc(1 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8);
    let offset = 0;
    
    // Write variant index
    instructionData.writeUInt8(INITIALIZE_VARIANT, offset);
    offset += 1;
    
    // Write admin pubkey
    const adminBuffer = adminPublicKey.toBuffer();
    adminBuffer.copy(instructionData, offset);
    offset += 32;
    
    // Write YOT mint pubkey
    const yotMintBuffer = YOT_MINT.toBuffer();
    yotMintBuffer.copy(instructionData, offset);
    offset += 32;
    
    // Write YOS mint pubkey
    const yosMintBuffer = YOS_MINT.toBuffer();
    yosMintBuffer.copy(instructionData, offset);
    offset += 32;
    
    // Write all rates as little-endian u64 values
    instructionData.writeBigUInt64LE(LP_CONTRIBUTION_RATE, offset);
    offset += 8;
    
    instructionData.writeBigUInt64LE(ADMIN_FEE_RATE, offset);
    offset += 8;
    
    instructionData.writeBigUInt64LE(YOS_CASHBACK_RATE, offset);
    offset += 8;
    
    instructionData.writeBigUInt64LE(SWAP_FEE_RATE, offset);
    offset += 8;
    
    instructionData.writeBigUInt64LE(REFERRAL_RATE, offset);
    
    // Log the full instruction data for debugging
    console.log(`Initialization data created: ${instructionData.length} bytes`);
    console.log("Data hex:", instructionData.toString('hex'));
    
    // Create the instruction with required accounts
    const initInstruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },              // Payer/admin
        { pubkey: programStateAddress, isSigner: false, isWritable: true },          // Program state PDA
        { pubkey: authorityAddress, isSigner: false, isWritable: false },            // Authority PDA
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },     // System program 
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },          // Rent sysvar
      ],
      programId: MULTIHUB_SWAP_PROGRAM_ID,
      data: instructionData
    });
    
    // Add the instruction to the transaction
    transaction.add(initInstruction);
  } catch (error: any) {
    console.error("Error creating initialization instruction:", error);
    throw new Error(`Failed to create initialization instruction: ${error.message || error}`);
  }
  
  // Send and confirm the transaction
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = wallet.publicKey;
    
    // Simulate first
    console.log("Simulating initialization transaction...");
    const simulation = await connection.simulateTransaction(transaction);
    
    if (simulation.value.err) {
      console.error("Initialization simulation failed:", simulation.value.err);
      throw new Error(`Initialization simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }
    
    console.log("Initialization simulation logs:", simulation.value.logs);
    
    // Send transaction
    console.log("Sending initialization transaction...");
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log("Initialization transaction sent:", signature);
    
    // Confirm transaction
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');
    
    if (confirmation.value.err) {
      throw new Error(`Initialization failed: ${JSON.stringify(confirmation.value.err)}`);
    }
    
    console.log("Program initialized successfully!");
    return signature;
  } catch (error) {
    console.error("Error in initialization:", error);
    throw error;
  }
}

/**
 * Check if the MultiHub Swap program is initialized
 */
export async function isMultiHubSwapProgramInitialized(): Promise<boolean> {
  const connection = new Connection(ENDPOINT, 'confirmed');
  const [programStateAddress] = findProgramStateAddress(MULTIHUB_SWAP_PROGRAM_ID);
  
  try {
    const programState = await connection.getAccountInfo(programStateAddress);
    return programState !== null && programState.data.length > 0;
  } catch (error) {
    console.error("Error checking program initialization:", error);
    return false;
  }
}

/**
 * Execute token swap with safer implementation
 * This improved version ensures YOS token account exists before proceeding
 * and checks if the program is initialized
 */
export async function executeMultiHubSwapImproved(
  wallet: any,
  fromToken: PublicKey,
  toToken: PublicKey,
  amount: number,
  minAmountOut: number
): Promise<string> {
  console.log("Starting improved MultiHub swap execution...");
  const connection = new Connection(ENDPOINT, 'confirmed');

  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }
  
  // Check if program is initialized
  const isInitialized = await isMultiHubSwapProgramInitialized();
  if (!isInitialized) {
    console.error("MultiHub Swap program is not initialized");
    throw new Error("Program not initialized. Admin must initialize the program first.");
  }

  // CRITICAL IMPROVEMENT: First ensure YOS token account exists as a separate transaction
  await ensureYosTokenAccountExists(connection, wallet);
  console.log("YOS token account verified, proceeding with swap...");

  // Convert tokens to PublicKey objects if they are strings
  const fromMint = typeof fromToken === 'string' ? new PublicKey(fromToken) : fromToken;
  const toMint = typeof toToken === 'string' ? new PublicKey(toToken) : toToken;

  console.log("From token mint:", fromMint.toString());
  console.log("To token mint:", toMint.toString());
  console.log("Amount:", amount);
  console.log("Minimum amount out:", minAmountOut);

  // Get associated token accounts
  const fromTokenAccount = await getAssociatedTokenAddress(fromMint, wallet.publicKey);
  const toTokenAccount = await getAssociatedTokenAddress(toMint, wallet.publicKey);
  const yosTokenAccount = await getAssociatedTokenAddress(YOS_TOKEN_MINT, wallet.publicKey);

  console.log("From token account:", fromTokenAccount.toString());
  console.log("To token account:", toTokenAccount.toString());
  console.log("YOS token account:", yosTokenAccount.toString());

  // SAFETY CHECK: Double-check YOS token account exists
  try {
    const yosAccount = await getAccount(connection, yosTokenAccount);
    console.log("YOS token account confirmed to exist:", yosAccount.address.toString());
  } catch (error) {
    console.error("YOS token account still doesn't exist, aborting swap");
    throw new Error("YOS token account required but doesn't exist. Please try again.");
  }

  // Find program state PDA
  const [programStateAddress] = findProgramStateAddress(MULTIHUB_SWAP_PROGRAM_ID);
  console.log("Program state address:", programStateAddress.toString());

  // Convert amounts to raw u64 values (assuming 9 decimals)
  const amountRaw = BigInt(Math.floor(amount * 1_000_000_000));
  const minAmountOutRaw = BigInt(Math.floor(minAmountOut * 1_000_000_000));

  console.log("Amount (raw):", amountRaw.toString());
  console.log("Min amount out (raw):", minAmountOutRaw.toString());

  // Create instruction data for SwapToken using proper Borsh format to match the contract
  // In the V3 contract, the enum discriminant may be different
  // Testing with index 1 (the original) and if needed we'll try 2
  
  // Create a buffer for the instruction
  // Try index 2 instead of 1 (which matches our fix in the contract-v3.ts file)
  const SWAP_TOKEN_INSTRUCTION = 2; // Try discriminant 2 (for Instruction::Swap)
  const data = Buffer.alloc(1 + 8 + 8);
  data.writeUInt8(SWAP_TOKEN_INSTRUCTION, 0);
  
  // Use proper writeBigUInt64LE method which writes in little-endian format
  const amountBuffer = Buffer.alloc(8);
  const minAmountBuffer = Buffer.alloc(8);
  
  // Better approach using built-in writeBigUInt64LE
  amountBuffer.writeBigUInt64LE(amountRaw);
  minAmountBuffer.writeBigUInt64LE(minAmountOutRaw);
  
  // Copy the buffers to the data buffer
  amountBuffer.copy(data, 1);
  minAmountBuffer.copy(data, 9);
  console.log("Swap instruction data:", Buffer.from(data).toString('hex'));

  // Create the transaction
  const transaction = new Transaction();

  // Create token accounts if they don't exist
  try {
    await getAccount(connection, fromTokenAccount);
    console.log("From token account exists");
  } catch (error) {
    console.log("Creating from token account");
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        fromTokenAccount,
        wallet.publicKey,
        fromMint
      )
    );
  }

  try {
    await getAccount(connection, toTokenAccount);
    console.log("To token account exists");
  } catch (error) {
    console.log("Creating to token account");
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        toTokenAccount,
        wallet.publicKey,
        toMint
      )
    );
  }

  // Find program authority address for program token accounts
  const [authorityAddress] = findAuthorityAddress(MULTIHUB_SWAP_PROGRAM_ID);
  console.log("Program authority address:", authorityAddress.toString());
  
  // Get the token accounts for the program (PDAs)
  const programFromTokenAccount = await getAssociatedTokenAddress(
    fromMint,
    authorityAddress,
    true // Allow owner off curve for PDAs
  );
  
  const programToTokenAccount = await getAssociatedTokenAddress(
    toMint,
    authorityAddress,
    true // Allow owner off curve for PDAs
  );
  
  const programYosTokenAccount = await getAssociatedTokenAddress(
    YOS_TOKEN_MINT,
    authorityAddress,
    true // Allow owner off curve for PDAs
  );
  
  console.log("Program from token account:", programFromTokenAccount.toString());
  console.log("Program to token account:", programToTokenAccount.toString());
  console.log("Program YOS token account:", programYosTokenAccount.toString());
  
  // Create these accounts if they don't exist
  try {
    const programFromAccount = await connection.getAccountInfo(programFromTokenAccount);
    if (!programFromAccount) {
      console.log("Creating program from token account");
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          programFromTokenAccount,
          authorityAddress,
          fromMint
        )
      );
    }
    
    const programToAccount = await connection.getAccountInfo(programToTokenAccount);
    if (!programToAccount) {
      console.log("Creating program to token account");
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          programToTokenAccount,
          authorityAddress,
          toMint
        )
      );
    }
    
    const programYosAccount = await connection.getAccountInfo(programYosTokenAccount);
    if (!programYosAccount) {
      console.log("Creating program YOS token account");
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          programYosTokenAccount,
          authorityAddress,
          YOS_TOKEN_MINT
        )
      );
    }
  } catch (error) {
    console.warn("Error checking program token accounts:", error);
    // Continue anyway as this may not be fatal
  }
  
  // Create the swap instruction with exactly the accounts the contract expects
  // The process_swap function in the contract expects only 7 accounts in this specific order
  const finalSwapInstruction = new TransactionInstruction({
    keys: [
      // These are the exact accounts needed in the exact order per the contract
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },             // 0. User wallet (signer)
      { pubkey: programStateAddress, isSigner: false, isWritable: true },         // 1. Program state account
      { pubkey: authorityAddress, isSigner: false, isWritable: false },           // 2. Program authority
      { pubkey: fromTokenAccount, isSigner: false, isWritable: true },            // 3. User's input token account
      { pubkey: toTokenAccount, isSigner: false, isWritable: true },              // 4. User's output token account  
      { pubkey: yosTokenAccount, isSigner: false, isWritable: true },             // 5. User's YOS token account (for cashback)
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },           // 6. Token program
    ],
    programId: MULTIHUB_SWAP_PROGRAM_ID,
    data: data
  });

  transaction.add(finalSwapInstruction);

  // Get a recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = wallet.publicKey;

  console.log("Sending swap transaction...");

  try {
    // Dump detailed instruction data for debugging
    console.log("DEBUGGING SWAP TRANSACTION");
    console.log("==========================");
    console.log("Program ID:", MULTIHUB_SWAP_PROGRAM_ID.toString());
    console.log("State PDA:", programStateAddress.toString());
    console.log("Authority PDA:", authorityAddress.toString());
    
    // Log instruction details from the transaction
    transaction.instructions.forEach((ix, index) => {
      console.log(`Instruction ${index}:`);
      console.log(`  Program: ${ix.programId.toString()}`);
      console.log(`  Data: ${Buffer.from(ix.data).toString('hex')}`);
      console.log(`  Accounts (${ix.keys.length}):`);
      ix.keys.forEach((key, i) => {
        console.log(`    [${i}] ${key.pubkey.toString()} (Signer: ${key.isSigner}, Writable: ${key.isWritable})`);
      });
    });
    
    console.log("Simulating transaction with detailed logs...");
    const simOptions = {
      commitment: 'confirmed',
      sigVerify: false,
      replaceRecentBlockhash: true,
      accounts: {
        encoding: 'base64',
        addresses: [programStateAddress.toString()]
      },
    };
    
    // Simulate transaction without extra options that cause type errors
    const simulation = await connection.simulateTransaction(transaction);
    
    if (simulation.value.logs) {
      console.log("Simulation logs:", simulation.value.logs);
      
      // Look for specific error patterns in logs
      const logs = simulation.value.logs.join('\n');
      if (logs.includes("UninitializedAccount")) {
        console.error("CRITICAL: Program not initialized! You need to call initializeProgram first.");
        throw new Error("MultiHub swap program not initialized. Please initialize the program first.");
      }
    }
    
    if (simulation.value.err) {
      console.error("Simulation failed:", simulation.value.err);
      throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }
    console.log("Simulation successful");

    // Sign and send transaction
    console.log("Sending transaction for signing...");
    const signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: false, // Enable preflight for better error reporting
    });
    console.log("Transaction sent:", signature);

    // Confirm transaction
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log("Swap executed successfully!");
    return signature;
  } catch (error) {
    console.error("Swap failed:", error);
    
    // Enhanced error handling
    if (error instanceof Error) {
      if (error.message.includes("Custom program error: 0xb")) {
        throw new Error("InvalidMint error - Token account issue. Try again.");
      } else if (error.message.includes("Custom program error: 0x11")) {
        throw new Error("Insufficient funds in source token account.");
      } else if (error.message.includes("Custom program error: 0x1")) {
        throw new Error("Program not initialized. Run initialization first.");
      }
    }
    
    throw error;
  }
}