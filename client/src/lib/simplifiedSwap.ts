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
  sendAndConfirmTransaction,
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
import { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction, 
  getAccount,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
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
 * Check if token account exists and create it if needed
 * @param connection Solana connection
 * @param tokenMint Token mint address
 * @param owner Token account owner
 * @returns Token account address and a create instruction (if needed)
 */
async function checkAndGetTokenAccount(
  connection: Connection,
  tokenMint: PublicKey,
  owner: PublicKey
): Promise<{address: PublicKey, createInstruction: TransactionInstruction | null}> {
  // Get associated token account address
  const address = await getAssociatedTokenAddress(tokenMint, owner);
  
  try {
    // Check if account exists
    await getAccount(connection, address);
    console.log(`Token account ${address.toBase58()} already exists`);
    return { address, createInstruction: null };
  } catch (error: any) {
    // If account doesn't exist, return create instruction
    console.log(`Token account ${address.toBase58()} needs to be created`);
    const createInstruction = createAssociatedTokenAccountInstruction(
      owner, // payer
      address, // associated token account
      owner, // owner
      tokenMint // mint
    );
    return { address, createInstruction };
  }
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
  
  // Get token accounts for the user and check if they exist
  const yotMintPubkey = new PublicKey(YOT_MINT);
  const yosMintPubkey = new PublicKey(YOS_MINT);
  
  // Check and maybe create token accounts
  const { address: userYotAccount, createInstruction: createYotInstruction } = 
    await checkAndGetTokenAccount(connection, yotMintPubkey, wallet);
  
  const { address: userYosAccount, createInstruction: createYosInstruction } = 
    await checkAndGetTokenAccount(connection, yosMintPubkey, wallet);
  
  // Get the common wallet's YOT token account
  const commonWalletPubkey = new PublicKey(COMMON_WALLET_ADDRESS);
  const { address: commonWalletYotAccount, createInstruction: createCommonWalletYotInstruction } = 
    await checkAndGetTokenAccount(connection, yotMintPubkey, commonWalletPubkey);
  
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
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: commonWalletYotAccount, isSigner: false, isWritable: true },
    ],
    data: instructionData,
  });
  
  // Create transaction and add account creation instructions if needed
  const transaction = new Transaction();
  
  // Add token account creation instructions if needed
  if (createYotInstruction) {
    console.log('Adding instruction to create YOT token account');
    transaction.add(createYotInstruction);
  }
  
  if (createYosInstruction) {
    console.log('Adding instruction to create YOS token account');
    transaction.add(createYosInstruction);
  }
  
  if (createCommonWalletYotInstruction) {
    console.log('Adding instruction to create common wallet YOT token account');
    transaction.add(createCommonWalletYotInstruction);
  }
  
  // Add the swap instruction
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
    
    try {
      // Pre-flight simulation check
      try {
        console.log('Simulating transaction before sending...');
        const simulation = await connection.simulateTransaction(transaction);
        
        if (simulation.value.err) {
          console.error('Transaction simulation failed:', simulation.value.err);
          
          // Check for specific errors in logs
          const logs = simulation.value.logs;
          if (logs) {
            console.log('Simulation logs:', logs);
            
            // Check for common errors
            if (logs.some(log => log.includes('invalid account data'))) {
              throw new Error(
                'Transaction simulation failed: Account validation error. This could happen if one of the required token accounts does not exist.'
              );
            } else if (logs.some(log => log.includes('insufficient funds'))) {
              throw new Error('Transaction simulation failed: Insufficient funds for transaction');
            }
          }
          
          throw new Error(`Transaction simulation failed: ${simulation.value.err}`);
        }
        
        console.log('Simulation successful, proceeding with transaction');
      } catch (simError) {
        // If it's already our custom error, just propagate it
        if (simError instanceof Error && 
            (simError.message.includes('Transaction simulation failed:') ||
             simError.message.includes('insufficient funds'))) {
          throw simError;
        }
        
        // Otherwise show the raw error but proceed with the transaction
        console.warn('Simulation error:', simError);
        console.log('Proceeding with transaction despite simulation error');
      }
      
      // Some wallets require using this approach instead of sendTransaction
      if (wallet.signTransaction) {
        console.log('Using sign + send approach for transaction...');
        const signedTransaction = await wallet.signTransaction(transaction);
        
        // Send with skipPreflight=true to bypass simulation errors
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: true
        });
        console.log(`Transaction signed and sent manually: ${signature}`);
        
        // Wait for confirmation
        console.log('Waiting for transaction confirmation...');
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
          console.error('Transaction failed during confirmation:', confirmation.value.err);
          throw new Error(`Transaction confirmed but failed: ${confirmation.value.err}`);
        }
        
        return signature;
      } else {
        // Standard sendTransaction approach
        console.log('Using standard wallet.sendTransaction approach');
        const signature = await wallet.sendTransaction(transaction, connection);
        console.log(`Swap transaction sent: ${signature}`);
        
        // Wait for confirmation
        console.log('Waiting for transaction confirmation...');
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
          console.error('Transaction failed during confirmation:', confirmation.value.err);
          throw new Error(`Transaction confirmed but failed: ${confirmation.value.err}`);
        }
        
        return signature;
      }
    } catch (txError) {
      console.error('Error in transaction signing/sending:', txError);
      
      // Enhanced error handling with specific user-friendly messages
      const errorMessage = txError instanceof Error ? txError.message : 'Unknown error';
      
      if (errorMessage.includes('User rejected')) {
        throw new Error('Transaction was rejected by the user in wallet');
      } else if (errorMessage.includes('insufficient funds')) {
        throw new Error('Insufficient SOL in wallet to complete the transaction');
      } else if (errorMessage.includes('Simulation failed')) {
        // Try to parse RPC error details
        if (errorMessage.includes('invalid account data')) {
          throw new Error('Transaction failed: One of the required accounts may be missing or invalid');
        } else if (errorMessage.includes('would exceed maximum number of instructions')) {
          throw new Error('Transaction failed: Too many instructions in one transaction. Please try a smaller amount');
        }
        
        // If no specific error identified, return the simulation error as is
        throw new Error(`Transaction simulation failed: ${errorMessage}`);
      } else {
        // For other errors, provide as much context as possible
        throw new Error(`Transaction error: ${errorMessage}. Please ensure you have enough SOL for transaction fees.`);
      }
    }
    
    // Note: the returns are now inside the try/catch blocks above
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error executing SOL to YOT swap:', errorMessage);
    throw error;
  }
}