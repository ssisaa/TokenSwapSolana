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

  // Create instruction data for SwapToken using simple binary format to match the contract
  // Format: [1, amount_in (8 bytes), min_amount_out (8 bytes)]
  const SWAP_TOKEN_INSTRUCTION = 1;
  const data = Buffer.alloc(1 + 8 + 8);
  data.writeUInt8(SWAP_TOKEN_INSTRUCTION, 0);
  
  // Write the bigint values as little-endian 64-bit integers
  const amountBuffer = Buffer.alloc(8);
  const minAmountBuffer = Buffer.alloc(8);
  
  // Convert BigInt to bytes (little-endian)
  let tempBigInt = amountRaw;
  for (let i = 0; i < 8; i++) {
    amountBuffer.writeUInt8(Number(tempBigInt & BigInt(0xFF)), i);
    tempBigInt = tempBigInt >> BigInt(8);
  }
  
  tempBigInt = minAmountOutRaw;
  for (let i = 0; i < 8; i++) {
    minAmountBuffer.writeUInt8(Number(tempBigInt & BigInt(0xFF)), i);
    tempBigInt = tempBigInt >> BigInt(8);
  }
  
  // Copy the individual buffers into the main data buffer
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

  // Add the swap instruction with EXACTLY the 8 accounts expected by the contract
  // This matches the process_swap_token function in our fixed contract version
  const finalSwapInstruction = new TransactionInstruction({
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },             // 0. User wallet (signer)
      { pubkey: fromTokenAccount, isSigner: false, isWritable: true },            // 1. User's input token account
      { pubkey: toTokenAccount, isSigner: false, isWritable: true },              // 2. User's output token account
      { pubkey: yosTokenAccount, isSigner: false, isWritable: true },             // 3. User's YOS token account (for cashback)
      { pubkey: programStateAddress, isSigner: false, isWritable: true },         // 4. Program state account
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },           // 5. Token program
      { pubkey: fromMint, isSigner: false, isWritable: false },                   // 6. Input token mint
      { pubkey: toMint, isSigner: false, isWritable: false },                     // 7. Output token mint
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