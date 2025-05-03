/**
 * MultiHub Client - Browser Compatible Version
 * 
 * This version of the multihub client avoids using Node.js built-in modules
 * like crypto that cause problems in the browser environment, especially
 * with Vite's default configuration.
 */

import { 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  TransactionInstruction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { 
  getOrCreateAssociatedTokenAccount, 
  createAssociatedTokenAccountInstruction, 
  getAssociatedTokenAddress,
  createTransferInstruction
} from '@solana/spl-token';
import { connection } from '@/lib/solana';
import { ADMIN_WALLET_ADDRESS } from '@/lib/constants';

// Constants
const MULTIHUB_PROGRAM_ID = new PublicKey('Cohae9agySEgC9gyJL1QHCJWw4q58R7Wshr3rpPJHU7L');
const SOL_TOKEN = 'So11111111111111111111111111111111111111112';
const YOT_TOKEN = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
const YOS_TOKEN = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';

// Instruction types
enum MultiHubInstructionType {
  Initialize = 0,
  Swap = 1,
  SwapYot = 2,
  CloseProgram = 3
}

/**
 * Browser-compatible serialization helper
 * This replaces Borsh serialization which may use crypto module
 */
function serializeInitializeInstruction(
  liquidityContributionBps: number,
  adminFeeBps: number,
  referralBps: number,
  swapFeeBps: number,
  yosCashbackBps: number
): Buffer {
  // Create a buffer with the appropriate size for all our parameters
  const data = new Uint8Array(1 + 5 * 2); // 1 byte for instruction + 5 uint16 values
  
  // Write the instruction type
  data[0] = MultiHubInstructionType.Initialize;
  
  // Write params - using DataView to handle endianness correctly
  const view = new DataView(data.buffer);
  view.setUint16(1, liquidityContributionBps, true); // Little endian
  view.setUint16(3, adminFeeBps, true);
  view.setUint16(5, referralBps, true);
  view.setUint16(7, swapFeeBps, true);
  view.setUint16(9, yosCashbackBps, true);
  
  return Buffer.from(data);
}

/**
 * Browser-compatible serialization helper for Swap instruction
 */
function serializeSwapInstruction(amount: bigint): Buffer {
  // Create a buffer for instruction + u64
  const data = new Uint8Array(1 + 8); // 1 byte for instruction + 8 bytes for u64
  
  // Write instruction type
  data[0] = MultiHubInstructionType.Swap;
  
  // Write amount (convert BigInt to bytes, little-endian)
  writeUint64LE(data, 1, amount);
  
  return Buffer.from(data);
}

/**
 * Browser-compatible serialization helper for SwapYot instruction
 */
function serializeSwapYotInstruction(amount: bigint): Buffer {
  // Create a buffer for instruction + u64
  const data = new Uint8Array(1 + 8); // 1 byte for instruction + 8 bytes for u64
  
  // Write instruction type
  data[0] = MultiHubInstructionType.SwapYot;
  
  // Write amount (convert BigInt to bytes, little-endian)
  writeUint64LE(data, 1, amount);
  
  return Buffer.from(data);
}

/**
 * Helper function to write uint64 in little-endian format
 * This avoids using Node.js Buffer methods that might not be available
 */
function writeUint64LE(array: Uint8Array, offset: number, value: bigint): void {
  // Write the 64-bit value in little-endian order
  for (let i = 0; i < 8; i++) {
    array[offset + i] = Number((value >> BigInt(i * 8)) & BigInt(0xff));
  }
}

/**
 * Find the program state account address
 */
function findProgramStateAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("program_state")],
    MULTIHUB_PROGRAM_ID
  );
}

/**
 * Check if the MultiHub Swap Program is initialized by checking
 * if the program state account exists
 */
export async function isMultiHubSwapProgramInitialized(): Promise<boolean> {
  try {
    const [programStateAddress] = findProgramStateAddress();
    const account = await connection.getAccountInfo(programStateAddress);
    return account !== null;
  } catch (error) {
    console.error("Error checking program initialization:", error);
    return false;
  }
}

/**
 * Initialize the MultiHub Swap Program with default parameters
 */
export async function initializeMultiHubSwapProgram(wallet: any): Promise<string> {
  try {
    if (!wallet?.publicKey) {
      throw new Error("Wallet not connected");
    }

    console.log("Starting program initialization...");
    
    // Default parameters for the program
    const liquidityContributionBps = 2000; // 20%
    const adminFeeBps = 10; // 0.1%
    const referralBps = 50; // 0.5%
    const swapFeeBps = 30; // 0.3%
    const yosCashbackBps = 500; // 5%

    // Find program state address
    const [programStateAddress] = findProgramStateAddress();
    console.log("Program state address:", programStateAddress.toBase58());

    // Create SOL account for program state
    const transaction = new Transaction();
    
    // Get on-chain program accounts
    const yotMint = new PublicKey(YOT_TOKEN);
    const yosMint = new PublicKey(YOS_TOKEN);
    const adminPublicKey = new PublicKey(ADMIN_WALLET_ADDRESS);

    // Serialize the initialization data using our browser-compatible function
    const initBuffer = serializeInitializeInstruction(
      liquidityContributionBps,
      adminFeeBps,
      referralBps,
      swapFeeBps,
      yosCashbackBps
    );
    
    // Create the instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // admin/payer
        { pubkey: programStateAddress, isSigner: false, isWritable: true }, // program state account
        { pubkey: yotMint, isSigner: false, isWritable: false }, // YOT token mint
        { pubkey: yosMint, isSigner: false, isWritable: false }, // YOS token mint
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // System program
      ],
      programId: MULTIHUB_PROGRAM_ID,
      data: initBuffer
    });

    transaction.add(instruction);
    
    // Recent blockhash needed for transaction
    const latestBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = wallet.publicKey;

    // Sign and send the transaction
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log("Program initialized successfully with signature:", signature);
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    });
    
    if (confirmation.value.err) {
      throw new Error(`Transaction confirmed but failed: ${confirmation.value.err}`);
    }
    
    return signature;
  } catch (error) {
    console.error("Error in initializeMultiHubSwapProgram:", error);
    throw error;
  }
}

/**
 * Swap any token to YOT with 20% liquidity contribution and 5% YOS cashback
 * Browser-compatible implementation
 */
export async function swapTokenToYOT(
  wallet: any,
  fromTokenMint: string,
  amount: number,
  decimals: number = 9,
  referrer?: string
): Promise<string> {
  try {
    if (!wallet?.publicKey) {
      throw new Error("Wallet not connected");
    }
    
    console.log(`Swapping ${amount} of token ${fromTokenMint} to YOT`);
    
    // Check if program is initialized
    const isInitialized = await isMultiHubSwapProgramInitialized();
    if (!isInitialized) {
      throw new Error("MultiHub Swap Program is not initialized. Please initialize it first.");
    }
    
    // Get program state address
    const [programStateAddress] = findProgramStateAddress();
    console.log("Program state address:", programStateAddress.toBase58());
    
    // Convert tokens
    const fromMint = new PublicKey(fromTokenMint);
    const yotMint = new PublicKey(YOT_TOKEN);
    const yosMint = new PublicKey(YOS_TOKEN);
    const adminPublicKey = new PublicKey(ADMIN_WALLET_ADDRESS);
    
    // Build the transaction
    const transaction = new Transaction();
    
    // Get or create token accounts
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.publicKey,
      fromMint,
      wallet.publicKey
    );
    
    // Get or create YOT token account for user
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.publicKey,
      yotMint,
      wallet.publicKey
    );
    
    // Get or create YOS token account for user (for cashback)
    const userYosTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.publicKey,
      yosMint,
      wallet.publicKey
    );
    
    // Get the admin's YOT account for liquidity contribution
    const adminYotTokenAccount = await getAssociatedTokenAddress(
      yotMint,
      adminPublicKey
    );
    
    // Get the admin's YOS account for cashback distribution
    const adminYosTokenAccount = await getAssociatedTokenAddress(
      yosMint,
      adminPublicKey
    );
    
    // Convert to raw amount
    const rawAmount = BigInt(Math.floor(amount * (10 ** decimals)));
    
    // Create the swap instruction data using our browser-compatible function
    const dataBuffer = serializeSwapInstruction(rawAmount);
    
    // Create the program instruction
    const swapInstruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // user/payer
        { pubkey: programStateAddress, isSigner: false, isWritable: true }, // program state
        { pubkey: fromTokenAccount.address, isSigner: false, isWritable: true }, // from token account
        { pubkey: toTokenAccount.address, isSigner: false, isWritable: true }, // to token account (YOT)
        { pubkey: userYosTokenAccount.address, isSigner: false, isWritable: true }, // user YOS account
        { pubkey: adminYotTokenAccount, isSigner: false, isWritable: true }, // admin YOT account
        { pubkey: adminYosTokenAccount, isSigner: false, isWritable: true }, // admin YOS account
        { pubkey: fromMint, isSigner: false, isWritable: false }, // input token mint
        { pubkey: yotMint, isSigner: false, isWritable: false }, // YOT mint
        { pubkey: yosMint, isSigner: false, isWritable: false }, // YOS mint
        { pubkey: adminPublicKey, isSigner: false, isWritable: false }, // admin
      ],
      programId: MULTIHUB_PROGRAM_ID,
      data: dataBuffer
    });
    
    // Add the instruction to the transaction
    transaction.add(swapInstruction);
    
    // Special handling for SOL
    if (fromTokenMint === SOL_TOKEN) {
      // Create a transfer instruction to wrap SOL
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: fromTokenAccount.address,
          lamports: Number(rawAmount)
        })
      );
    }
    
    // Add recent blockhash
    const latestBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Sign and send transaction
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log("Swap transaction sent with signature:", signature);
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    });
    
    if (confirmation.value.err) {
      throw new Error(`Transaction confirmed but failed: ${confirmation.value.err}`);
    }
    
    return signature;
  } catch (error) {
    console.error("Error in swapTokenToYOT:", error);
    throw error;
  }
}

/**
 * Swap YOT to any token with 20% liquidity contribution and 5% YOS cashback
 * Browser-compatible implementation
 */
export async function swapYOTToToken(
  wallet: any,
  toTokenMint: string,
  amount: number,
  decimals: number = 9,
  referrer?: string
): Promise<string> {
  try {
    if (!wallet?.publicKey) {
      throw new Error("Wallet not connected");
    }
    
    console.log(`Swapping ${amount} YOT to token ${toTokenMint}`);
    
    // Check if program is initialized
    const isInitialized = await isMultiHubSwapProgramInitialized();
    if (!isInitialized) {
      throw new Error("MultiHub Swap Program is not initialized. Please initialize it first.");
    }
    
    // Get program state address
    const [programStateAddress] = findProgramStateAddress();
    console.log("Program state address:", programStateAddress.toBase58());
    
    // Convert tokens
    const yotMint = new PublicKey(YOT_TOKEN);
    const toMint = new PublicKey(toTokenMint);
    const yosMint = new PublicKey(YOS_TOKEN);
    const adminPublicKey = new PublicKey(ADMIN_WALLET_ADDRESS);
    
    // Build the transaction
    const transaction = new Transaction();
    
    // Get or create YOT token account for user
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.publicKey,
      yotMint,
      wallet.publicKey
    );
    
    // Get or create destination token account for user
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.publicKey,
      toMint,
      wallet.publicKey
    );
    
    // Get or create YOS token account for user (for cashback)
    const userYosTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.publicKey,
      yosMint,
      wallet.publicKey
    );
    
    // Get the admin's YOT account for liquidity contribution
    const adminYotTokenAccount = await getAssociatedTokenAddress(
      yotMint,
      adminPublicKey
    );
    
    // Convert to raw amount
    const rawAmount = BigInt(Math.floor(amount * (10 ** decimals)));
    
    // Create the swap instruction data using our browser-compatible function
    const dataBuffer = serializeSwapYotInstruction(rawAmount);
    
    // Create the program instruction
    const swapInstruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // user/payer
        { pubkey: programStateAddress, isSigner: false, isWritable: true }, // program state
        { pubkey: fromTokenAccount.address, isSigner: false, isWritable: true }, // from token account (YOT)
        { pubkey: toTokenAccount.address, isSigner: false, isWritable: true }, // to token account 
        { pubkey: userYosTokenAccount.address, isSigner: false, isWritable: true }, // user YOS account
        { pubkey: adminYotTokenAccount, isSigner: false, isWritable: true }, // admin YOT account
        { pubkey: yotMint, isSigner: false, isWritable: false }, // YOT mint
        { pubkey: toMint, isSigner: false, isWritable: false }, // output token mint
        { pubkey: yosMint, isSigner: false, isWritable: false }, // YOS mint
        { pubkey: adminPublicKey, isSigner: false, isWritable: false }, // admin
      ],
      programId: MULTIHUB_PROGRAM_ID,
      data: dataBuffer
    });
    
    // Add the instruction to the transaction
    transaction.add(swapInstruction);
    
    // Add recent blockhash
    const latestBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Sign and send transaction
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log("Swap transaction sent with signature:", signature);
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    });
    
    if (confirmation.value.err) {
      throw new Error(`Transaction confirmed but failed: ${confirmation.value.err}`);
    }
    
    return signature;
  } catch (error) {
    console.error("Error in swapYOTToToken:", error);
    throw error;
  }
}