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
/**
 * Create a separate transaction to create token accounts for the user
 * @param connection Solana connection
 * @param wallet User's wallet
 * @param requiredMints List of token mints to check accounts for
 * @returns Transaction to create token accounts, or null if none needed
 */
export async function createRequiredTokenAccounts(
  connection: Connection,
  wallet: PublicKey,
  requiredMints: PublicKey[]
): Promise<Transaction | null> {
  // Array to hold create instructions
  const createInstructions: TransactionInstruction[] = [];
  
  // Check each token account and add create instructions if needed
  for (const mint of requiredMints) {
    const tokenAccount = await getAssociatedTokenAddress(mint, wallet);
    
    try {
      // Check if account exists
      await getAccount(connection, tokenAccount);
      console.log(`Token account ${tokenAccount.toBase58()} already exists for mint ${mint.toBase58()}`);
    } catch (error: any) {
      // Account doesn't exist, add create instruction
      console.log(`Creating token account ${tokenAccount.toBase58()} for mint ${mint.toBase58()}`);
      
      const createInstruction = createAssociatedTokenAccountInstruction(
        wallet, // payer (using the user's wallet as the payer)
        tokenAccount, // associated token account address
        wallet, // owner
        mint // mint
      );
      
      createInstructions.push(createInstruction);
    }
  }
  
  // If no instructions needed, return null
  if (createInstructions.length === 0) {
    console.log('No token accounts need to be created');
    return null;
  }
  
  // Create and return transaction with all create instructions
  const transaction = new Transaction();
  for (const instruction of createInstructions) {
    transaction.add(instruction);
  }
  
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet;
  
  console.log(`Created transaction to create ${createInstructions.length} token accounts`);
  return transaction;
}

/**
 * Check if a token account exists and get its address
 * @param connection Solana connection
 * @param tokenMint Token mint address
 * @param owner Token account owner
 * @returns Token account address
 */
async function getTokenAccount(
  connection: Connection,
  tokenMint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  // Get associated token account address
  const address = await getAssociatedTokenAddress(tokenMint, owner);
  console.log(`Token account for mint ${tokenMint.toBase58()} is ${address.toBase58()}`);
  return address;
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
  const yotMintPubkey = new PublicKey(YOT_MINT);
  const yosMintPubkey = new PublicKey(YOS_MINT);
  
  // Get the token accounts (they should already exist after our previous account creation step)
  console.log('Getting token account addresses...');
  const userYotAccount = await getTokenAccount(connection, yotMintPubkey, wallet);
  const userYosAccount = await getTokenAccount(connection, yosMintPubkey, wallet);
  
  // Get the common wallet's YOT token account
  const commonWalletPubkey = new PublicKey(COMMON_WALLET_ADDRESS);
  const commonWalletYotAccount = await getTokenAccount(connection, yotMintPubkey, commonWalletPubkey);
  
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
  
  // Create transaction for the swap
  const transaction = new Transaction();
  
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
    
    // First, check and create any missing token accounts
    console.log("Checking for required token accounts...");
    const yotMintPubkey = new PublicKey(YOT_MINT);
    const yosMintPubkey = new PublicKey(YOS_MINT);
    
    // Check if we need to create user token accounts
    console.log("Checking user token accounts...");
    const userAccountCreationTx = await createRequiredTokenAccounts(
      connection,
      wallet.publicKey,
      [yotMintPubkey, yosMintPubkey]
    );
    
    // Also check if common wallet needs token accounts (without direct signing)
    // This will fail during swap if missing, so we need to create it with the admin
    // For now we'll just check if it exists and log a warning
    console.log("Checking common wallet token accounts...");
    const commonWalletPubkey = new PublicKey(COMMON_WALLET_ADDRESS);
    try {
      const commonWalletYotAccount = await getAssociatedTokenAddress(yotMintPubkey, commonWalletPubkey);
      try {
        await getAccount(connection, commonWalletYotAccount);
        console.log(`Common wallet YOT account ${commonWalletYotAccount.toBase58()} exists`);
      } catch (error) {
        console.warn(`Common wallet YOT account ${commonWalletYotAccount.toBase58()} does not exist. ` +
                    `This will need to be created by the admin wallet.`);
      }
    } catch (error) {
      console.error("Error checking common wallet token account:", error);
    }
    
    // Create any missing token accounts with a separate transaction
    const accountCreationTx = userAccountCreationTx;
    
    // If we need to create accounts, do that first
    if (accountCreationTx) {
      console.log("Creating missing token accounts before swap...");
      try {
        // Handle account creation with the same sign/send approach as main swap
        if (wallet.signTransaction) {
          console.log('Using sign + send approach for account creation...');
          const signedTransaction = await wallet.signTransaction(accountCreationTx);
          const signature = await connection.sendRawTransaction(signedTransaction.serialize());
          console.log(`Account creation transaction sent: ${signature}`);
          
          // Wait for confirmation
          console.log('Waiting for account creation confirmation...');
          const confirmation = await connection.confirmTransaction(signature, 'confirmed');
          
          if (confirmation.value.err) {
            console.error('Account creation failed during confirmation:', confirmation.value.err);
            throw new Error(`Account creation confirmed but failed: ${confirmation.value.err}`);
          }
          
          console.log('Token accounts created successfully');
        } else {
          console.log('Using standard wallet.sendTransaction approach for account creation');
          const signature = await wallet.sendTransaction(accountCreationTx, connection);
          console.log(`Account creation transaction sent: ${signature}`);
          
          // Wait for confirmation
          console.log('Waiting for account creation confirmation...');
          const confirmation = await connection.confirmTransaction(signature, 'confirmed');
          
          if (confirmation.value.err) {
            console.error('Account creation failed during confirmation:', confirmation.value.err);
            throw new Error(`Account creation confirmed but failed: ${confirmation.value.err}`);
          }
          
          console.log('Token accounts created successfully');
        }
      } catch (error) {
        console.error('Error creating token accounts:', error);
        throw new Error('Failed to create required token accounts for swap. Please try again.');
      }
    }
    
    // Now create the actual swap transaction
    console.log("Proceeding with swap transaction...");
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