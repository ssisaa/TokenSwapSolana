/**
 * Client interface for the simplified SOL to YOT swap program
 * 
 * This module provides functions to interact with the on-chain swap program
 * that handles direct SOL to YOT swaps with distribution based on ratios:
 * - SOL: 80% to pool, 20% to common wallet
 * - YOT: 80% to user, 20% to common wallet
 * - Additionally: 5% YOS as cashback to the user
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  SIMPLIFIED_SWAP_PROGRAM_ID,
  YOT_MINT,
  YOS_MINT,
  SOL_POOL_WALLET,
  YOT_POOL_TOKEN_ACCOUNT,
  COMMON_WALLET_ADDRESS,
  SOL_DISTRIBUTION_RATIO,
  YOT_DISTRIBUTION_RATIO,
  YOS_CASHBACK_PERCENTAGE,
  getRpcEndpoint,
} from './configConstants';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { Buffer } from 'buffer';

/**
 * Find program state PDA for the simplified swap program
 * @returns [pda, bump]
 */
export function findProgramStatePda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID)
  );
}

/**
 * Find program authority PDA for the simplified swap program
 * @returns [pda, bump]
 */
export function findProgramAuthorityPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID)
  );
}

/**
 * Create instruction data for the SOL to YOT swap
 * 
 * @param solAmount Amount of SOL in lamports
 * @param minYotAmount Minimum YOT amount with slippage protection
 * @returns Instruction data buffer
 */
export function createSwapSolToYotInstructionData(
  solAmount: number,
  minYotAmount: number
): Buffer {
  // Create buffer: 1 byte (instruction) + 8 bytes (amount) + 8 bytes (min amount) 
  // + 1 byte (user ratio) + 1 byte (common ratio) + 1 byte (cashback percentage)
  const buffer = Buffer.alloc(20);
  
  // Instruction discriminator: 0 for Initialize, 1 for SwapSolToYot
  buffer.writeUInt8(1, 0);
  
  // SOL amount in lamports
  buffer.writeBigUInt64LE(BigInt(solAmount), 1);
  
  // Min YOT amount (slippage protection)
  buffer.writeBigUInt64LE(BigInt(minYotAmount), 9);
  
  // Distribution ratios and cashback percentage
  buffer.writeUInt8(YOT_DISTRIBUTION_RATIO, 17); // 80% to user
  buffer.writeUInt8(100 - YOT_DISTRIBUTION_RATIO, 18); // 20% to common wallet
  buffer.writeUInt8(YOS_CASHBACK_PERCENTAGE, 19); // 5% YOS cashback
  
  return buffer;
}

/**
 * Create a transaction for SOL to YOT swap
 */
export async function createSwapSolToYotTransaction(
  wallet: PublicKey,
  solAmount: number,
  minYotAmount: number,
  connection: Connection
): Promise<Transaction> {
  // Convert SOL to lamports
  const lamports = solAmount * LAMPORTS_PER_SOL;
  
  // Get required PDAs
  const [programStatePda] = findProgramStatePda();
  const [programAuthorityPda] = findProgramAuthorityPda();
  
  // Get token accounts for the user
  const userYotAccount = await getAssociatedTokenAddress(
    new PublicKey(YOT_MINT),
    wallet
  );
  
  const userYosAccount = await getAssociatedTokenAddress(
    new PublicKey(YOS_MINT),
    wallet
  );
  
  // Get the common wallet's YOT token account
  const commonWalletYotAccount = await getAssociatedTokenAddress(
    new PublicKey(YOT_MINT),
    new PublicKey(COMMON_WALLET_ADDRESS)
  );
  
  // Create the swap instruction
  const instructionData = createSwapSolToYotInstructionData(lamports, minYotAmount);
  
  const swapInstruction = new TransactionInstruction({
    programId: new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID),
    keys: [
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: programStatePda, isSigner: false, isWritable: false },
      { pubkey: programAuthorityPda, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(SOL_POOL_WALLET), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(YOT_POOL_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
      { pubkey: userYotAccount, isSigner: false, isWritable: true },
      { pubkey: new PublicKey(COMMON_WALLET_ADDRESS), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(YOS_MINT), isSigner: false, isWritable: true },
      { pubkey: userYosAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), isSigner: false, isWritable: false },
      { pubkey: commonWalletYotAccount, isSigner: false, isWritable: true },
    ],
    data: instructionData,
  });
  
  // Create and return the transaction
  const transaction = new Transaction();
  transaction.add(swapInstruction);
  
  // Get recent blockhash for transaction
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet;
  
  return transaction;
}

/**
 * Execute a SOL to YOT swap 
 * 
 * @param wallet User's wallet (must have sendTransaction method)
 * @param solAmount Amount of SOL to swap
 * @param minYotAmount Minimum YOT tokens to receive (slippage protection)
 * @param connection Solana connection
 * @returns Transaction signature
 */
export async function swapSolToYot(
  wallet: any,
  solAmount: number,
  minYotAmount: number,
  connection: Connection
): Promise<string> {
  try {
    console.log(`Initiating SOL to YOT swap: ${solAmount} SOL with minimum ${minYotAmount} YOT`);
    console.log(`Distribution ratios: ${YOT_DISTRIBUTION_RATIO}% to user, ${100-YOT_DISTRIBUTION_RATIO}% to common wallet, ${YOS_CASHBACK_PERCENTAGE}% YOS cashback`);
    
    // Create the swap transaction
    const transaction = await createSwapSolToYotTransaction(
      wallet.publicKey,
      solAmount,
      minYotAmount,
      connection
    );
    
    // Sign and send the transaction
    console.log('Sending transaction to wallet for approval...');
    const signature = await wallet.sendTransaction(transaction, connection);
    
    console.log(`Swap transaction sent: ${signature}`);
    
    // Wait for confirmation
    console.log('Waiting for transaction confirmation...');
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('Transaction failed during confirmation:', confirmation.value.err);
      throw new Error(`Transaction confirmed but failed: ${confirmation.value.err}`);
    }
    
    console.log('Swap transaction confirmed successfully!');
    return signature;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error executing SOL to YOT swap:', errorMessage);
    throw error;
  }
}