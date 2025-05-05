/**
 * DIRECT SWAP - Minimal implementation using only what is needed
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';

// Program and token addresses - never change these
const PROGRAM_ID = new PublicKey('SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const YOT_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
const YOS_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Hardcoded token accounts - never change these
const USER_YOT_ACCOUNT = new PublicKey('8ufUyc9yA5j2uJqHRwxi7XZZR8gKg8dwKBg2J168yvk4');
const USER_YOS_ACCOUNT = new PublicKey('8QGzzUxJ5X88LwMW6gBd7zc5Re6FbjHhFv52oj5WMfSz');
const PROGRAM_YOT_ACCOUNT = new PublicKey('BtHDQ6QwAffeeGftkNQK8X22n7HfnX4dud5vVsPZdqzE');
const PROGRAM_YOS_ACCOUNT = new PublicKey('5eQTdriuNrWaVdbLiyKDPwakYjM9na6ctYbxauPxaqWz');
const POOL_SOL_ACCOUNT = new PublicKey('7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS');

// Program PDAs
const PROGRAM_STATE = new PublicKey('2sR6kFJfCa7oG9hrMWxeTK6ESir7PNZe4vky2JDiNrKC');
const PROGRAM_AUTHORITY = new PublicKey('Au1gRnNzhtN7odbtUPRHPF7N4c8siwePW8wLsD1FmqHQ');
const POOL_AUTHORITY = new PublicKey('7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK');

// Special address identified from error logs
const MYSTERY_ADDRESS = new PublicKey('Eh8fHudZ4Rkb1MrzXSHRWP8SoubpBM4BhEHBmoJg17F8');

/**
 * Simple helper to create instruction data
 */
function createSwapInstructionData(amountIn: bigint): Buffer {
  const buffer = Buffer.alloc(17);
  buffer[0] = 1; // Opcode: 1 = Swap
  
  // Amount as little-endian 64-bit integer
  const view = new DataView(buffer.buffer, buffer.byteOffset + 1, 8);
  const amountLow = Number(amountIn & BigInt(0xFFFFFFFF));
  const amountHigh = Number(amountIn >> BigInt(32));
  view.setUint32(0, amountLow, true);
  view.setUint32(4, amountHigh, true);
  
  return buffer;
}

/**
 * Direct swap implementation - absolutely minimal code
 */
export async function directSwap(
  connection: Connection,
  wallet: any,
  isSOLToYOT: boolean, // true = SOL->YOT, false = YOT->SOL
  amountIn: number // UI amount (e.g. 1.5 SOL or 1000 YOT)
): Promise<string> {
  try {
    console.log(`️⚡ DIRECT SWAP: ${isSOLToYOT ? "SOL → YOT" : "YOT → SOL"} for ${amountIn} ${isSOLToYOT ? "SOL" : "YOT"}`);
    
    // Convert UI amount to raw amount (lamports/tokens)
    const decimals = 9; // Both SOL and YOT have 9 decimals
    const rawAmount = BigInt(Math.floor(amountIn * 10 ** decimals));
    
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
    
    // CRITICAL: Use a separate SOL account to avoid duplicate wallet in positions [0] and [4]
    // Create a temporary keypair just for this transaction
    const tempSOLAccount = SystemProgram.programId; // Use this as a non-wallet address that program can handle
    
    // Define the accounts in the exact order required by the program
    const accounts = [
      // Critical: Only mark wallet as signer once, never duplicate the signer flag
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },      // User wallet         [0]
      { pubkey: PROGRAM_STATE, isSigner: false, isWritable: true },        // Program state       [1]
      { pubkey: PROGRAM_AUTHORITY, isSigner: false, isWritable: true },    // Program authority   [2]
      { pubkey: POOL_AUTHORITY, isSigner: false, isWritable: true },       // Pool authority      [3]
      
      // CRITICAL: Use different accounts for [0] and [4] to avoid duplicates
      // For SOL operations, use tempSOLAccount instead of wallet.publicKey
      { pubkey: isSOLToYOT ? tempSOLAccount : USER_YOT_ACCOUNT,            // User FROM account   [4]
        isSigner: false, isWritable: true },
      { pubkey: isSOLToYOT ? USER_YOT_ACCOUNT : tempSOLAccount,            // User TO account     [5]
        isSigner: false, isWritable: true },
      { pubkey: USER_YOS_ACCOUNT, isSigner: false, isWritable: true },     // User YOS account    [6]
      
      // Program accounts
      { pubkey: isSOLToYOT ? POOL_SOL_ACCOUNT : PROGRAM_YOT_ACCOUNT,       // Program FROM        [7]
        isSigner: false, isWritable: true },
      { pubkey: isSOLToYOT ? PROGRAM_YOT_ACCOUNT : POOL_SOL_ACCOUNT,       // Program TO          [8]
        isSigner: false, isWritable: true },
      { pubkey: PROGRAM_YOS_ACCOUNT, isSigner: false, isWritable: true },  // Program YOS         [9]
      
      // Token mints
      { pubkey: isSOLToYOT ? SOL_MINT : YOT_MINT,                          // FROM mint          [10]
        isSigner: false, isWritable: false },
      { pubkey: isSOLToYOT ? YOT_MINT : SOL_MINT,                          // TO mint            [11]
        isSigner: false, isWritable: false },
      { pubkey: YOS_MINT, isSigner: false, isWritable: false },            // YOS mint           [12]
      
      // System programs needed by the contract
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },    // Token Program      [13]
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System Program [14]
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },  // Rent               [15]
      
      // Mystery address required by the program
      { pubkey: MYSTERY_ADDRESS, isSigner: false, isWritable: true }       // Mystery address    [16]
    ];
    
    // Log all accounts for verification
    console.log('ACCOUNT ADDRESSES FOR VERIFICATION:');
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
    
    // Send and confirm transaction
    console.log('Sending transaction...');
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log(`Transaction sent: ${signature}`);
    
    await connection.confirmTransaction(signature, 'confirmed');
    console.log('Transaction confirmed!');
    
    return signature;
  } catch (error) {
    console.error('Error in directSwap:', error);
    throw error;
  }
}