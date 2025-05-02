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
  return PublicKey.findProgramAddressSync(
    [Buffer.from("program_state")],
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
 * Execute token swap with safer implementation
 * This improved version ensures YOS token account exists before proceeding
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
  
  // Add the swap instruction with MORE accounts than previously (matching V3 contract expectation)
  const finalSwapInstruction = new TransactionInstruction({
    keys: [
      // User accounts
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },             // 0. User wallet (signer)
      { pubkey: fromTokenAccount, isSigner: false, isWritable: true },            // 1. User's input token account
      { pubkey: toTokenAccount, isSigner: false, isWritable: true },              // 2. User's output token account
      { pubkey: yosTokenAccount, isSigner: false, isWritable: true },             // 3. User's YOS token account (for cashback)
      
      // Program accounts
      { pubkey: programStateAddress, isSigner: false, isWritable: true },         // 4. Program state account
      { pubkey: authorityAddress, isSigner: false, isWritable: false },           // 5. Program authority
      
      // Program token accounts
      { pubkey: programFromTokenAccount, isSigner: false, isWritable: true },     // 6. Program's input token account
      { pubkey: programToTokenAccount, isSigner: false, isWritable: true },       // 7. Program's output token account
      { pubkey: programYosTokenAccount, isSigner: false, isWritable: true },      // 8. Program's YOS token account
      
      // Token mints
      { pubkey: fromMint, isSigner: false, isWritable: false },                   // 9. Input token mint
      { pubkey: toMint, isSigner: false, isWritable: false },                     // 10. Output token mint
      { pubkey: YOS_TOKEN_MINT, isSigner: false, isWritable: false },             // 11. YOS token mint
      
      // System programs
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },           // 12. Token program
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },         // 13. Rent sysvar
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },    // 14. System program
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
    // Simulate transaction first
    console.log("Simulating transaction...");
    const simulation = await connection.simulateTransaction(transaction);
    
    if (simulation.value.logs) {
      console.log("Simulation logs:", simulation.value.logs);
    }
    
    if (simulation.value.err) {
      console.error("Simulation failed:", simulation.value.err);
      throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }
    console.log("Simulation successful");

    // Sign and send transaction
    console.log("Sending transaction for signing...");
    const signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: true, // Skip as we've already simulated
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