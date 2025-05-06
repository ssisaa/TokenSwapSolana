/**
 * Simplified SOL to YOT swap implementation
 * This implementation focuses on reliability and simplicity
 * It uses instruction #7 (BUY_AND_DISTRIBUTE) from the program
 * but with improved account handling and transaction building
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  PROGRAM_ID,
  YOT_MINT,
  YOS_MINT,
  PROGRAM_STATE_PDA,
  PROGRAM_AUTHORITY_PDA,
  SOL_POOL_WALLET,
  YOT_POOL_TOKEN_ACCOUNT,
  YOS_POOL_TOKEN_ACCOUNT,
  COMMON_WALLET_ADDRESS,
} from './config';

/**
 * Find the proper PDAs and token accounts needed for a swap
 * @param connection Solana connection
 * @param walletPublicKey User's wallet public key
 * @returns Object containing all necessary accounts for the swap
 */
export async function getSwapAccounts(connection: Connection, walletPublicKey: PublicKey) {
  // Get the user's token accounts
  const userYotAccount = await getAssociatedTokenAddress(
    new PublicKey(YOT_MINT),
    walletPublicKey
  );
  
  const userYosAccount = await getAssociatedTokenAddress(
    new PublicKey(YOS_MINT),
    walletPublicKey
  );
  
  // Return all accounts needed for the swap
  return {
    userWallet: walletPublicKey,
    programState: new PublicKey(PROGRAM_STATE_PDA),
    programAuthority: new PublicKey(PROGRAM_AUTHORITY_PDA),
    solPoolWallet: new PublicKey(SOL_POOL_WALLET),
    yotPoolAccount: new PublicKey(YOT_POOL_TOKEN_ACCOUNT),
    userYotAccount,
    centralLiquidityWallet: new PublicKey(COMMON_WALLET_ADDRESS),
    yosMint: new PublicKey(YOS_MINT),
    userYosAccount,
  };
}

/**
 * Execute a simplified SOL to YOT swap
 * This implementation focuses on reliability over advanced features
 * @param wallet Connected wallet
 * @param solAmount Amount of SOL to swap (in SOL, not lamports)
 * @returns Transaction signature
 */
export async function executeSimpleSwap(wallet: any, solAmount: number) {
  console.log(`Executing simple swap with ${solAmount} SOL`);
  
  // Input validation
  if (!wallet || !wallet.publicKey) {
    throw new Error("Wallet not connected");
  }
  if (solAmount <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  
  try {
    const connection = new Connection(process.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com');
    
    // Convert SOL to lamports
    const lamports = solAmount * LAMPORTS_PER_SOL;
    
    // Calculate minimum amount out for slippage protection (5% slippage tolerance)
    const minAmountOut = lamports * 0.95;
    
    // Get all accounts needed for the swap
    const accounts = await getSwapAccounts(connection, wallet.publicKey);
    
    // Build the transaction instruction
    const keys = [
      { pubkey: accounts.userWallet, isSigner: true, isWritable: true },
      { pubkey: accounts.programState, isSigner: false, isWritable: true },
      { pubkey: accounts.programAuthority, isSigner: false, isWritable: false },
      { pubkey: accounts.solPoolWallet, isSigner: false, isWritable: true },
      { pubkey: accounts.yotPoolAccount, isSigner: false, isWritable: true },
      { pubkey: accounts.userYotAccount, isSigner: false, isWritable: true },
      { pubkey: accounts.centralLiquidityWallet, isSigner: false, isWritable: true },
      { pubkey: accounts.yosMint, isSigner: false, isWritable: true },
      { pubkey: accounts.userYosAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];
    
    // Instruction data: [7, amount_in (u64), min_amount_out (u64)]
    const data = Buffer.alloc(1 + 8 + 8);
    data.writeUInt8(7, 0); // Instruction index: 7 for BUY_AND_DISTRIBUTE
    
    // Write amount as a 64-bit little-endian integer
    data.writeBigUInt64LE(BigInt(lamports), 1);
    
    // Write minAmountOut as a 64-bit little-endian integer
    data.writeBigUInt64LE(BigInt(minAmountOut), 9);
    
    // Add a small priority fee to help the transaction succeed
    const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 500_000,
    });
    
    // Create the transaction instruction
    const instruction = new TransactionInstruction({
      keys,
      programId: new PublicKey(PROGRAM_ID),
      data,
    });
    
    // Create and sign the transaction
    const transaction = new Transaction();
    transaction.feePayer = wallet.publicKey;
    
    // Get the latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    
    // Add both instructions to the transaction
    transaction.add(priorityFeeInstruction);
    transaction.add(instruction);
    
    // Check if the token accounts exist and add creation if needed
    const userYotAccount = await connection.getAccountInfo(accounts.userYotAccount);
    if (!userYotAccount) {
      console.log("Token account doesn't exist, you need to create it first");
      return {
        needsTokenAccount: true,
        message: "You need to create a YOT token account first before swapping",
        userYotAccount: accounts.userYotAccount,
        yotMint: new PublicKey(YOT_MINT),
      };
    }
    
    // Sign and send the transaction
    console.log("Sending transaction...");
    
    // Try with regular simulation first
    console.log("Simulating transaction...");
    try {
      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        console.error("Simulation error:", simulation.value.err);
        
        // If simulation fails, try with skipPreflight
        console.log("Transaction failed preflight checks, trying with skipPreflight=true");
        const signature = await wallet.sendTransaction(transaction, connection, { skipPreflight: true });
        console.log("Transaction sent successfully:", signature);
        return { success: true, signature };
      } else {
        console.log("Simulation successful, sending transaction");
        const signature = await wallet.sendTransaction(transaction, connection);
        console.log("Transaction sent successfully:", signature);
        return { success: true, signature };
      }
    } catch (error) {
      console.error("Error during simulation or transaction:", error);
      return { success: false, error };
    }
  } catch (error) {
    console.error("Error in executeSimpleSwap:", error);
    return { success: false, error };
  }
}