/**
 * Final MultiHub Swap Client Implementation
 * Updated to work with the fixed multihub_swap_final.rs contract
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
 * Initialize the MultiHub Swap Program with required parameters
 * This should be called only once to set up the program state
 */
export async function initializeMultiHubSwap(
  adminWallet: any,
  yotMint = YOT_TOKEN_MINT,
  yosMint = YOS_TOKEN_MINT
): Promise<string> {
  console.log("Starting program initialization...");
  const connection = new Connection(ENDPOINT, 'confirmed');

  if (!adminWallet.publicKey) {
    throw new Error("Admin wallet not connected");
  }

  console.log("Admin:", adminWallet.publicKey.toString());
  console.log("YOT Mint:", yotMint.toString());
  console.log("YOS Mint:", yosMint.toString());

  // Find program state PDA
  const [programStateAddress, stateBump] = findProgramStateAddress(MULTIHUB_SWAP_PROGRAM_ID);
  console.log("Program state address:", programStateAddress.toString());
  console.log("State bump:", stateBump);

  // Find authority PDA
  const [authorityAddress, authorityBump] = findAuthorityAddress(MULTIHUB_SWAP_PROGRAM_ID);
  console.log("Authority address:", authorityAddress.toString());
  console.log("Authority bump:", authorityBump);

  // Find SOL-YOT pool address or create a placeholder for now
  const solYotPool = new PublicKey("7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS");
  console.log("SOL-YOT pool address:", solYotPool.toString());

  // Create instruction data for Initialize instruction
  // Format: [0, authority_bump]
  const INITIALIZE_INSTRUCTION = 0;
  const data = Buffer.alloc(2);
  data.writeUInt8(INITIALIZE_INSTRUCTION, 0);
  data.writeUInt8(authorityBump, 1);

  console.log("Initialize instruction data:", data.toString('hex'));

  // Create the transaction
  const transaction = new Transaction();
  
  // Add initialization instruction with exact account ordering matching the contract
  const initInstruction = new TransactionInstruction({
    keys: [
      { pubkey: adminWallet.publicKey, isSigner: true, isWritable: true },          // 0. Admin account (signer)
      { pubkey: programStateAddress, isSigner: false, isWritable: true },           // 1. Program state account (PDA)
      { pubkey: yotMint, isSigner: false, isWritable: false },                      // 2. YOT token mint
      { pubkey: yosMint, isSigner: false, isWritable: false },                      // 3. YOS token mint
      { pubkey: solYotPool, isSigner: false, isWritable: false },                   // 4. SOL-YOT liquidity pool
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },      // 5. System program
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },           // 6. Rent sysvar
    ],
    programId: MULTIHUB_SWAP_PROGRAM_ID,
    data: data
  });

  transaction.add(initInstruction);

  // Get a recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = adminWallet.publicKey;

  console.log("Sending initialization transaction...");

  try {
    // Simulate transaction first
    const simulation = await connection.simulateTransaction(transaction);
    if (simulation.value.logs) {
      console.log("Simulation logs:", simulation.value.logs);
    }

    if (simulation.value.err) {
      console.error("Simulation failed:", simulation.value.err);
      throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }

    // Sign and send
    console.log("Simulation successful, sending transaction...");
    const signature = await adminWallet.sendTransaction(transaction, connection, {
      skipPreflight: true, // Skip as we've already simulated
    });
    console.log("Initialization transaction sent:", signature);

    // Confirm transaction
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    });

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log("MultiHub Swap Program initialized successfully!");
    return signature;
  } catch (error) {
    console.error("Initialization failed:", error);
    throw error;
  }
}

/**
 * Execute token swap using the fixed MultiHub Swap contract
 */
export async function executeMultiHubSwap(
  wallet: any,
  fromToken: PublicKey,
  toToken: PublicKey,
  amount: number,
  minAmountOut: number
): Promise<string> {
  console.log("Starting MultiHub swap execution...");
  const connection = new Connection(ENDPOINT, 'confirmed');

  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

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

  console.log("Swap instruction data:", data.toString('hex'));

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

  try {
    await getAccount(connection, yosTokenAccount);
    console.log("YOS token account exists");
  } catch (error) {
    console.log("Creating YOS token account");
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        yosTokenAccount,
        wallet.publicKey,
        YOS_TOKEN_MINT
      )
    );
  }

  // Find authority PDA for token transfers
  const [authorityAddress, authorityBump] = findAuthorityAddress(MULTIHUB_SWAP_PROGRAM_ID);
  console.log("Authority address:", authorityAddress.toString(), "with bump:", authorityBump);
  
  // Get YOT and YOS mint addresses from program state or use default values
  const yotMint = new PublicKey("2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF");
  const yosMint = new PublicKey("GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n");
  console.log("YOT mint:", yotMint.toString());
  console.log("YOS mint:", yosMint.toString());
  
  // SOL-YOT Pool for liquidity contribution (20%)
  const solYotPool = new PublicKey("7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS");
  console.log("Using SOL-YOT pool:", solYotPool.toString());

  // Find program-owned token accounts for YOT and YOS
  const programYotAccount = await getAssociatedTokenAddress(yotMint, authorityAddress, true);
  const programYosAccount = await getAssociatedTokenAddress(yosMint, authorityAddress, true);
  console.log("Program YOT account:", programYotAccount.toString());
  console.log("Program YOS account:", programYosAccount.toString());
  
  // Try to get the program token accounts to check if they exist
  try {
    await getAccount(connection, programYotAccount);
    console.log("Program YOT account exists");
  } catch (error) {
    console.log("Creating program YOT account");
    // Create the program YOT account if it doesn't exist
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        programYotAccount,
        authorityAddress,
        yotMint
      )
    );
  }

  try {
    await getAccount(connection, programYosAccount);
    console.log("Program YOS account exists");
  } catch (error) {
    console.log("Creating program YOS account");
    // Create the program YOS account if it doesn't exist
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        programYosAccount,
        authorityAddress,
        yosMint
      )
    );
  }

  // Handle special case for SOL (native) tokens
  // When swapping with SOL, we need to ensure it's properly handled
  let wrappedSolAccount: PublicKey | null = null;
  
  // Check if we're swapping from or to SOL
  const isFromSol = fromToken === SystemProgram.programId || 
                    (typeof fromToken === 'string' && fromToken === 'native');
  const isToSol = toToken === SystemProgram.programId || 
                  (typeof toToken === 'string' && toToken === 'native');
                  
  if (isFromSol || isToSol) {
    console.log("SOL is involved in this swap - handling wrapped SOL");
    // Since this is a special case, we'll adjust our approach in a future update
  }

  // Determine admin fee account based on tokens involved
  let adminFeeAccount;
  if (fromMint.equals(yotMint) || toMint.equals(yotMint)) {
    // If swapping YOT, use YOT admin fee account
    adminFeeAccount = programYotAccount;
  } else {
    // Otherwise, default to YOS admin fee account
    adminFeeAccount = programYosAccount;
  }
  console.log("Admin fee account:", adminFeeAccount.toString());

  // Add the swap instruction with EXACTLY the 8 accounts expected by the contract
  // This matches the process_swap_token function in program/src/multihub_swap_final.rs
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
      if (error.message.includes("Custom program error: 0x0")) {
        throw new Error("Invalid instruction format. Contract may have been updated.");
      } else if (error.message.includes("Custom program error: 0x1")) {
        throw new Error("Program not initialized. Run initialization first.");
      } else if (error.message.includes("Custom program error: 0x2")) {
        throw new Error("Program already initialized.");
      } else if (error.message.includes("Custom program error: 0x3")) {
        throw new Error("Invalid authority. PDA derivation may be incorrect.");
      } else if (error.message.includes("Custom program error: 0x4")) {
        throw new Error("Slippage exceeded. Try increasing minimum amount out or reducing slippage tolerance.");
      } else if (error.message.includes("Custom program error: 0x6")) {
        throw new Error("Insufficient funds for transaction.");
      } else if (error.message.includes("Custom program error: 0xf")) {
        throw new Error("Account not rent exempt. Try again or increase transaction lamports.");
      } else if (error.message.includes("Custom program error: 0x10")) {
        throw new Error("Serialization failed. Contract and client may be out of sync.");
      } else if (error.message.includes("Custom program error: 0x11")) {
        throw new Error("Account not owned by program. Check account permissions.");
      } else if (error.message.includes("Custom program error: 0x12")) {
        throw new Error("Invalid account size. Program state account may be too small.");
      }
    }
    
    throw error;
  }
}