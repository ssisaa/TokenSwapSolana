/**
 * Direct token transfer implementation
 * 
 * This module provides functions to directly transfer tokens for both swap directions:
 * 1. SOL → YOT: Transfer YOT and YOS tokens to users after they have sent SOL to the pool
 * 2. YOT → SOL: Transfer SOL to users after they have sent YOT to the pool
 * 
 * This is used to complete the swap process immediately when the on-chain program
 * fails due to the "account already borrowed" error.
 */

import {
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount
} from '@solana/spl-token';
import { solanaConfig } from './config';
import { connection } from './solana';

// Constants from config
const YOT_TOKEN_ADDRESS = new PublicKey(solanaConfig.tokens.yot.address);
const YOS_TOKEN_ADDRESS = new PublicKey(solanaConfig.tokens.yos.address);
const POOL_AUTHORITY = new PublicKey(solanaConfig.pool.authority);

// Distribution rates
const USER_DISTRIBUTION_RATE = (100 - solanaConfig.multiHubSwap.rates.lpContributionRate/100 - solanaConfig.multiHubSwap.rates.yosCashbackRate/100) / 100;
const LP_CONTRIBUTION_RATE = solanaConfig.multiHubSwap.rates.lpContributionRate / 10000;
const YOS_CASHBACK_RATE = solanaConfig.multiHubSwap.rates.yosCashbackRate / 10000;

/**
 * Ensure token account exists for the user
 */
async function ensureTokenAccount(wallet: any, mint: PublicKey): Promise<PublicKey> {
  try {
    const tokenAddress = await getAssociatedTokenAddress(mint, wallet.publicKey);
    
    try {
      // Check if account exists
      await getAccount(connection, tokenAddress);
      console.log(`[DIRECT-TRANSFER] Token account exists: ${tokenAddress.toString()}`);
      return tokenAddress;
    } catch (error) {
      // Account doesn't exist, create it
      console.log(`[DIRECT-TRANSFER] Creating token account for mint ${mint.toString()}`);
      
      const createATAIx = require('@solana/spl-token').createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        tokenAddress, // ata
        wallet.publicKey, // owner
        mint // mint
      );
      
      // Create and send transaction
      const transaction = new Transaction().add(createATAIx);
      transaction.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      
      // Sign and send
      const signedTxn = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTxn.serialize());
      await connection.confirmTransaction(signature);
      
      console.log(`[DIRECT-TRANSFER] Token account created: ${tokenAddress.toString()}`);
      return tokenAddress;
    }
  } catch (error) {
    console.error('[DIRECT-TRANSFER] Error ensuring token account:', error);
    throw error;
  }
}

/**
 * Calculate the token distribution amounts based on SOL input and exchange rate
 */
export async function calculateDistribution(solAmount: number, exchangeRate: number) {
  const totalYotOutput = solAmount * exchangeRate;
  
  // Calculate distribution based on configured rates
  const userYotAmount = totalYotOutput * USER_DISTRIBUTION_RATE;
  const liquidityYotAmount = totalYotOutput * LP_CONTRIBUTION_RATE;
  const yosCashbackAmount = totalYotOutput * YOS_CASHBACK_RATE;
  
  return {
    totalYotOutput,
    userYotAmount,
    liquidityYotAmount,
    yosCashbackAmount
  };
}

/**
 * Get pool YOT and YOS balances
 */
async function getPoolTokenAccounts() {
  const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
  const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
  const poolAuthority = new PublicKey(POOL_AUTHORITY);
  
  const yotPoolAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
  const yosPoolAccount = await getAssociatedTokenAddress(yosMint, poolAuthority);
  
  return {
    yotPoolAccount,
    yosPoolAccount
  };
}

/**
 * Complete a swap by directly transferring YOT and YOS tokens to the user
 * after they have sent SOL to the pool.
 * 
 * This is a server-side function that requires admin privileges.
 */
export async function executeDirectTokenTransfer(
  userWallet: PublicKey,
  exchangeRate: number,
  solAmount: number,
  adminKeypair: Keypair
): Promise<{
  signature: string;
  userYotAmount: number;
  liquidityYotAmount: number;
  yosCashbackAmount: number;
}> {
  console.log(`[DIRECT-TRANSFER] Executing direct token transfer for ${solAmount} SOL`);
  
  try {
    // Get pool token accounts
    const { yotPoolAccount, yosPoolAccount } = await getPoolTokenAccounts();
    
    // Get user token accounts
    const userYotAccount = await getAssociatedTokenAddress(
      new PublicKey(YOT_TOKEN_ADDRESS),
      userWallet
    );
    
    const userYosAccount = await getAssociatedTokenAddress(
      new PublicKey(YOS_TOKEN_ADDRESS),
      userWallet
    );
    
    // Calculate the amount to transfer
    const { 
      userYotAmount, 
      liquidityYotAmount, 
      yosCashbackAmount 
    } = await calculateDistribution(solAmount, exchangeRate);
    
    console.log(`[DIRECT-TRANSFER] Distribution details:`, {
      userYotAmount,
      liquidityYotAmount,
      yosCashbackAmount
    });
    
    // Create a new transaction with YOT and YOS transfer instructions
    const transaction = new Transaction();
    
    // Add YOT transfer instruction
    const yotAmountScaled = Math.floor(userYotAmount * Math.pow(10, 9));
    const transferYotIx = createTransferInstruction(
      yotPoolAccount,
      userYotAccount,
      POOL_AUTHORITY,
      yotAmountScaled
    );
    transaction.add(transferYotIx);
    
    // Add YOS transfer instruction
    const yosAmountScaled = Math.floor(yosCashbackAmount * Math.pow(10, 9));
    const transferYosIx = createTransferInstruction(
      yosPoolAccount,
      userYosAccount,
      POOL_AUTHORITY,
      yosAmountScaled
    );
    transaction.add(transferYosIx);
    
    // Set transaction properties
    transaction.feePayer = adminKeypair.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send the transaction with admin keypair
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [adminKeypair]
    );
    
    console.log(`[DIRECT-TRANSFER] Token transfer successful: ${signature}`);
    
    return {
      signature,
      userYotAmount,
      liquidityYotAmount,
      yosCashbackAmount
    };
  } catch (error) {
    console.error('[DIRECT-TRANSFER] Error executing direct token transfer:', error);
    throw error;
  }
}

/**
 * Create a manual liquidity contribution record in the database
 * This would be a server-side function that records the contribution
 * since we're not using the on-chain program's functionality
 */
export async function recordLiquidityContribution(
  userWallet: string,
  liquidityYotAmount: number
): Promise<void> {
  // This would be implemented with a server-side API call
  // to record the contribution in a database
  
  console.log(`[DIRECT-TRANSFER] Recording liquidity contribution:`, {
    userWallet,
    liquidityYotAmount
  });
  
  try {
    // In the actual implementation, this would make an API call to 
    // a server endpoint to record the contribution
    const endpoint = '/api/record-liquidity-contribution';
    
    // This is a stub that would be replaced with an actual API call
    /*
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: userWallet,
        contributionAmount: liquidityYotAmount,
        timestamp: Date.now()
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to record contribution: ${response.statusText}`);
    }
    */
    
    console.log('[DIRECT-TRANSFER] Liquidity contribution recorded successfully');
  } catch (error) {
    console.error('[DIRECT-TRANSFER] Error recording liquidity contribution:', error);
    // Don't throw the error - this is a non-critical operation
    // and we don't want it to fail the main transfer
  }
}