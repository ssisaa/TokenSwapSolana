/**
 * SIMPLIFIED DIRECT SWAP IMPLEMENTATION
 * 
 * This is a clean, minimal implementation for SOL<->YOT swaps only
 * Focusing on the absolute minimum accounts needed for a successful swap
 */

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY 
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Hardcoded addresses (verified working)
const PROGRAM_ID = new PublicKey('SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE');
const YOT_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
const YOS_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Program accounts
const PROGRAM_STATE = new PublicKey('2sR6kFJfCa7oG9hrMWxeTK6ESir7PNZe4vky2JDiNrKC');
const PROGRAM_AUTHORITY = new PublicKey('Au1gRnNzhtN7odbtUPRHPF7N4c8siwePW8wLsD1FmqHQ');
const POOL_AUTHORITY = new PublicKey('7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK');

// Pool accounts
const POOL_SOL_ACCOUNT = new PublicKey('7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS');
const POOL_YOT_ACCOUNT = new PublicKey('BtHDQ6QwAffeeGftkNQK8X22n7HfnX4dud5vVsPZdqzE');
const POOL_YOS_ACCOUNT = new PublicKey('5eQTdriuNrWaVdbLiyKDPwakYjM9na6ctYbxauPxaqWz');

// Create minimal swap data (opcode 1 = swap)
function createMinimalSwapData(amountIn: bigint): Buffer {
  const buffer = Buffer.alloc(9); // Just opcode + amount (minimum needed)
  
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
 * Minimal SOL<->YOT swap implementation
 * This focuses solely on the essential accounts needed
 */
export async function simpleSwap(
  connection: Connection,
  wallet: any,
  isSOLToYOT: boolean, // true = SOL->YOT, false = YOT->SOL
  amountIn: number // UI amount (e.g. 1.5 SOL or 1000 YOT)
): Promise<string> {
  console.log(`SIMPLE SWAP: ${isSOLToYOT ? "SOL → YOT" : "YOT → SOL"} for ${amountIn}`);
  
  try {
    // Convert UI amount to raw amount (lamports/tokens)
    const decimals = 9; // Both SOL and YOT have 9 decimals
    const rawAmount = BigInt(Math.floor(amountIn * 10 ** decimals));
    
    // Hardcoded user token account addresses
    const USER_YOT_ACCOUNT = new PublicKey('8ufUyc9yA5j2uJqHRwxi7XZZR8gKg8dwKBg2J168yvk4');
    const USER_YOS_ACCOUNT = new PublicKey('8QGzzUxJ5X88LwMW6gBd7zc5Re6FbjHhFv52oj5WMfSz');
    
    // Create transaction
    const transaction = new Transaction();
    transaction.feePayer = wallet.publicKey;
    
    // Add funding instruction (required for program operation)
    const fundingIx = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: PROGRAM_AUTHORITY,
      lamports: 1_500_000, // 0.0015 SOL
    });
    transaction.add(fundingIx);
    
    // Create swap data
    const swapData = createMinimalSwapData(rawAmount);
    console.log(`Swap data (${swapData.length} bytes):`, Array.from(swapData));
    
    // For SOL->YOT vs YOT->SOL
    const fromMint = isSOLToYOT ? SOL_MINT : YOT_MINT;
    const toMint = isSOLToYOT ? YOT_MINT : SOL_MINT;
    
    // For SOL->YOT: User FROM account is wallet (native SOL)
    // For YOT->SOL: User FROM account is YOT token account
    const userFromAccount = isSOLToYOT ? wallet.publicKey : USER_YOT_ACCOUNT;
    const userToAccount = isSOLToYOT ? USER_YOT_ACCOUNT : wallet.publicKey;
    
    // Log critical account addresses
    console.log(`User wallet: ${wallet.publicKey.toString()}`);
    console.log(`User FROM: ${userFromAccount.toString()}`);
    console.log(`User TO: ${userToAccount.toString()}`);
    console.log(`User YOS: ${USER_YOS_ACCOUNT.toString()}`);
    
    // Simple version with 10 basic accounts
    const accounts = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },             // Wallet 
      { pubkey: PROGRAM_STATE, isSigner: false, isWritable: true },               // Program state
      { pubkey: PROGRAM_AUTHORITY, isSigner: false, isWritable: true },           // Program authority
      { pubkey: userFromAccount, isSigner: isSOLToYOT, isWritable: true },        // User FROM
      { pubkey: userToAccount, isSigner: false, isWritable: true },               // User TO
      { pubkey: USER_YOS_ACCOUNT, isSigner: false, isWritable: true },            // User YOS
      { pubkey: isSOLToYOT ? POOL_SOL_ACCOUNT : POOL_YOT_ACCOUNT,                 // Pool FROM
        isSigner: false, isWritable: true },
      { pubkey: isSOLToYOT ? POOL_YOT_ACCOUNT : POOL_SOL_ACCOUNT,                 // Pool TO
        isSigner: false, isWritable: true },
      { pubkey: POOL_YOS_ACCOUNT, isSigner: false, isWritable: true },            // Pool YOS
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },           // Token Program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },    // System Program
    ];
    
    // Log all accounts for verification
    console.log('SIMPLE SWAP ACCOUNT ADDRESSES:');
    accounts.forEach((acct, i) => {
      console.log(`[${i}] ${acct.pubkey.toString()}${acct.isSigner ? ' (signer)' : ''}`);
    });
    
    // Create instruction
    const swapIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: accounts,
      data: swapData
    });
    
    // Add to transaction
    transaction.add(swapIx);
    
    // Set recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // First simulate to check for errors
    console.log("Simulating transaction...");
    try {
      const sim = await connection.simulateTransaction(transaction);
      if (sim.value.err) {
        console.error("Simulation failed:", sim.value.err);
        const logs = sim.value.logs || [];
        if (logs.length > 0) {
          console.log("Simulation logs (first 10):");
          logs.slice(0, 10).forEach(log => console.log(` - ${log}`));
        }
        throw new Error(`Simulation failed: ${JSON.stringify(sim.value.err)}`);
      } else {
        console.log("Simulation successful!");
        if (sim.value.logs && sim.value.logs.length > 0) {
          console.log("Success logs (first 5):");
          sim.value.logs.slice(0, 5).forEach(log => console.log(` - ${log}`));
        }
      }
    } catch (error) {
      console.error("Error during simulation:", error);
      throw error;
    }
    
    // Send transaction
    console.log('Sending transaction...');
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log(`Transaction sent: ${signature}`);
    
    await connection.confirmTransaction(signature, 'confirmed');
    console.log('Transaction confirmed!');
    
    return signature;
  } catch (error) {
    console.error('Error in simple swap:', error);
    throw error;
  }
}