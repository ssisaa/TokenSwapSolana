/**
 * Simple SOL to YOT swap implementation
 * Direct implementation without unnecessary account creation or borrowing
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getSolanaConnection } from './solana';
import { 
  MULTI_HUB_SWAP_PROGRAM_ID, 
  YOT_TOKEN_ADDRESS, 
  POOL_SOL_ACCOUNT,
  POOL_AUTHORITY
} from './config';

// Simple swap function that just sends SOL and receives YOT
export async function simpleSwap(
  wallet: any,
  solAmount: number,
  slippagePercent: number = 1.0
): Promise<{
  success: boolean,
  signature?: string,
  error?: string,
  amount?: number
}> {
  try {
    console.log(`Executing simple SOL to YOT swap for ${solAmount} SOL...`);
    const connection = getSolanaConnection();
    const walletPublicKey = wallet.publicKey;
    
    // Convert SOL to lamports
    const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    
    // Get token accounts
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, new PublicKey(POOL_AUTHORITY));
    const userYotAccount = await getAssociatedTokenAddress(yotMint, walletPublicKey);
    
    // Calculate expected output based on pool balances
    const solPoolBalance = await connection.getBalance(new PublicKey(POOL_SOL_ACCOUNT)) / LAMPORTS_PER_SOL;
    const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotAccountInfo.value.uiAmount);
    
    // Calculate expected output using AMM formula
    const expectedOutput = (solAmount * yotPoolBalance) / (solPoolBalance + solAmount);
    
    // Apply slippage tolerance
    const slippageFactor = (100 - slippagePercent) / 100;
    const minAmountOut = Math.floor(expectedOutput * slippageFactor * Math.pow(10, 9));
    
    console.log(`Pool balances - SOL: ${solPoolBalance}, YOT: ${yotPoolBalance}`);
    console.log(`Expected output: ${expectedOutput} YOT`);
    console.log(`Min output with ${slippagePercent}% slippage: ${minAmountOut / Math.pow(10, 9)} YOT`);
    
    // Create a simple transaction
    const transaction = new Transaction();
    
    // Add compute budget instructions for better transaction reliability
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 200000
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    
    // Add a simple SOL transfer instruction to the pool
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: walletPublicKey,
      toPubkey: new PublicKey(POOL_SOL_ACCOUNT),
      lamports: amountInLamports
    });
    
    transaction.add(transferInstruction);
    
    // Set transaction properties
    transaction.feePayer = walletPublicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    const signedTx = await wallet.signTransaction(transaction);
    console.log('Sending transaction...');
    
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    console.log(`Transaction sent: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log('Transaction confirmed!');
    
    return {
      success: true,
      signature,
      amount: expectedOutput
    };
  } catch (error: any) {
    console.error('Error executing swap:', error);
    return {
      success: false,
      error: error.message
    };
  }
}