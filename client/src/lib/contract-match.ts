/**
 * CONTRACT-MATCH: Follows the exact order from the server's contract definition
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';

// ---------------------- CONSTANTS ----------------------

const PROGRAM_ID = new PublicKey('SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// Program state and authority accounts
const PROGRAM_STATE = new PublicKey('2sR6kFJfCa7oG9hrMWxeTK6ESir7PNZe4vky2JDiNrKC');
const PROGRAM_AUTHORITY = new PublicKey('Au1gRnNzhtN7odbtUPRHPF7N4c8siwePW8wLsD1FmqHQ');
const POOL_AUTHORITY = new PublicKey('7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK');

// Token accounts for pool
const POOL_SOL_ACCOUNT = new PublicKey('7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS');
const PROGRAM_YOT_ACCOUNT = new PublicKey('BtHDQ6QwAffeeGftkNQK8X22n7HfnX4dud5vVsPZdqzE');
const PROGRAM_YOS_ACCOUNT = new PublicKey('5eQTdriuNrWaVdbLiyKDPwakYjM9na6ctYbxauPxaqWz');

// Token mints
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const YOT_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
const YOS_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');

/**
 * Create a minimal swap instruction data buffer
 * First byte = 1 (swap opcode)
 * Next 8 bytes = amount in (u64 little-endian)
 * Rest can be zero
 */
function createSwapInstructionData(amountIn: bigint): Buffer {
  const buffer = Buffer.alloc(17);
  
  // Opcode: 1 = Swap
  buffer[0] = 1;
  
  // Amount in (u64 little-endian)
  const view = new DataView(buffer.buffer, buffer.byteOffset + 1, 8);
  const amountLow = Number(amountIn & BigInt(0xFFFFFFFF));
  const amountHigh = Number(amountIn >> BigInt(32));
  view.setUint32(0, amountLow, true);
  view.setUint32(4, amountHigh, true);
  
  return buffer;
}

/**
 * Swap implementation that follows the exact ordering of accounts from the contract
 */
export async function contractMatch(
  connection: Connection,
  wallet: any, // Any wallet adapter
  isSOLToYOT: boolean, // true = SOL->YOT, false = YOT->SOL
  amountIn: number // UI amount (e.g. 1.5 SOL or 1000 YOT)
): Promise<string> {
  console.log(`CONTRACT MATCH IMPLEMENTATION: ${isSOLToYOT ? "SOL → YOT" : "YOT → SOL"} for ${amountIn}`);
  
  try {
    // Convert UI amount to raw amount (lamports/tokens)
    const decimals = 9; // Both SOL and YOT have 9 decimals
    const rawAmount = BigInt(Math.floor(amountIn * 10 ** decimals));
    
    // Start by getting token accounts for the user
    const USER_YOT_ACCOUNT = new PublicKey('8ufUyc9yA5j2uJqHRwxi7XZZR8gKg8dwKBg2J168yvk4');
    const USER_YOS_ACCOUNT = new PublicKey('8QGzzUxJ5X88LwMW6gBd7zc5Re6FbjHhFv52oj5WMfSz');
    
    // Create transaction
    const transaction = new Transaction();
    transaction.feePayer = wallet.publicKey;
    
    // Fund program authority with a little SOL for operations
    const fundingIx = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: PROGRAM_AUTHORITY,
      lamports: 3_000_000, // 0.003 SOL
    });
    transaction.add(fundingIx);
    
    // Create swap instruction data
    const swapData = createSwapInstructionData(rawAmount);
    
    // Define the accounts in the EXACT SAME ORDER as the original contract
    const accounts = [
      // --- SECTION 1: Signers and state ---
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },      // User wallet         [0]
      { pubkey: PROGRAM_STATE, isSigner: false, isWritable: true },        // Program state       [1]
      { pubkey: PROGRAM_AUTHORITY, isSigner: false, isWritable: true },    // Program authority   [2]
      { pubkey: POOL_AUTHORITY, isSigner: false, isWritable: true },       // Pool authority      [3]
      
      // --- SECTION 2: User token accounts (NOT duplicating wallet or System Program) ---
      // For SOL->YOT, we need a different account than SystemProgram.programId (position 14)
      // Use POOL_AUTHORITY as a stand-in for user's SOL account instead
      { pubkey: isSOLToYOT ? POOL_AUTHORITY : USER_YOT_ACCOUNT,            // User FROM account   [4]
        isSigner: false, isWritable: true },                               // Never mark as signer here
      { pubkey: USER_YOT_ACCOUNT, isSigner: false, isWritable: true },     // User YOT account    [5]
      { pubkey: USER_YOS_ACCOUNT, isSigner: false, isWritable: true },     // User YOS account    [6]
      
      // --- SECTION 3: Program token accounts ---
      { pubkey: POOL_SOL_ACCOUNT, isSigner: false, isWritable: true },     // Pool SOL account    [7]
      { pubkey: PROGRAM_YOT_ACCOUNT, isSigner: false, isWritable: true },  // Program YOT acct    [8]
      { pubkey: PROGRAM_YOS_ACCOUNT, isSigner: false, isWritable: true },  // Program YOS acct    [9]
      
      // --- SECTION 4: Token mints ---
      { pubkey: SOL_MINT, isSigner: false, isWritable: false },            // SOL mint           [10]
      { pubkey: YOT_MINT, isSigner: false, isWritable: false },            // YOT mint           [11]
      { pubkey: YOS_MINT, isSigner: false, isWritable: false },            // YOS mint           [12]
      
      // --- SECTION 5: System programs ---
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },    // Token Program      [13]
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System Program [14]
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },  // Rent               [15]
    ];
    
    // Log all accounts for verification
    console.log('CONTRACT MATCH ACCOUNT ADDRESSES:');
    accounts.forEach((acct, i) => {
      console.log(`[${i}] ${acct.pubkey.toString()}${acct.isSigner ? ' (signer)' : ''}`);
    });
    
    // Create the instruction
    const swapIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: accounts,
      data: swapData
    });
    
    // Add the swap instruction to the transaction
    transaction.add(swapIx);
    
    // Add recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    console.log("Simulating transaction with exact contract account order...");
    try {
      const sim = await connection.simulateTransaction(transaction);
      if (sim.value.err) {
        console.error("Simulation failed:", sim.value.err);
        const logs = sim.value.logs || [];
        if (logs.length > 0) {
          console.log("First 10 logs:");
          logs.slice(0, 10).forEach(log => console.log(" - " + log));
        }
        throw new Error("Transaction simulation failed: " + JSON.stringify(sim.value.err));
      }
      console.log("Simulation successful!");
    } catch (error) {
      console.error("Error during simulation:", error);
      throw error;
    }
    
    // Send and confirm transaction
    console.log('Sending transaction...');
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log(`Transaction sent: ${signature}`);
    
    await connection.confirmTransaction(signature, 'confirmed');
    console.log('Transaction confirmed!');
    
    return signature;
  } catch (error) {
    console.error('Error in contract-match swap:', error);
    throw error;
  }
}