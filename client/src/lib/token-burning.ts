import { Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { createBurnInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ENDPOINT, YOT_TOKEN_ADDRESS } from './constants';
import { useAdminSettings } from '@/hooks/use-admin-settings';

const connection = new Connection(ENDPOINT, 'confirmed');

/**
 * Calculate the amount of tokens to burn based on operation type and amount
 * @param operationType - 'buy' or 'sell'
 * @param amount - The amount of tokens involved in the operation
 * @param burnPercentageBuy - Buy burn percentage from admin settings
 * @param burnPercentageSell - Sell burn percentage from admin settings
 * @returns The amount of tokens to burn (in raw token units)
 */
export function calculateBurnAmount(
  operationType: 'buy' | 'sell',
  amount: number,
  burnPercentageBuy: number,
  burnPercentageSell: number
): number {
  const burnPercentage = operationType === 'buy' ? burnPercentageBuy : burnPercentageSell;
  const burnAmount = (amount * burnPercentage) / 100;
  
  console.log(`Token burning calculation:
    Operation: ${operationType}
    Amount: ${amount} YOT
    Burn percentage: ${burnPercentage}%
    Tokens to burn: ${burnAmount} YOT
  `);
  
  return burnAmount;
}

/**
 * Burn YOT tokens from a user's wallet
 * @param wallet - The connected wallet
 * @param burnAmount - Amount of YOT tokens to burn (in regular units, not lamports)
 * @returns Transaction signature
 */
export async function burnYotTokens(wallet: any, burnAmount: number): Promise<string> {
  if (!wallet || !wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  if (burnAmount <= 0) {
    throw new Error('Burn amount must be greater than 0');
  }

  try {
    console.log(`Burning ${burnAmount} YOT tokens from wallet ${wallet.publicKey.toString()}`);

    // Get user's YOT token account
    const userYotTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(YOT_TOKEN_ADDRESS),
      wallet.publicKey
    );

    // Convert burn amount to raw token units (YOT has 9 decimals)
    const rawBurnAmount = Math.floor(burnAmount * Math.pow(10, 9));

    console.log(`Raw burn amount: ${rawBurnAmount} (${burnAmount} YOT tokens)`);

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    // Create burn transaction
    const transaction = new Transaction({
      feePayer: wallet.publicKey,
      blockhash,
      lastValidBlockHeight
    });

    // Add burn instruction
    transaction.add(
      createBurnInstruction(
        userYotTokenAccount,     // Token account to burn from
        new PublicKey(YOT_TOKEN_ADDRESS), // Mint address
        wallet.publicKey,        // Owner of the token account
        rawBurnAmount            // Amount to burn in raw units
      )
    );

    // Send and confirm transaction
    const signature = await wallet.sendTransaction(transaction, connection);
    
    // Wait for confirmation
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');

    console.log(`Successfully burned ${burnAmount} YOT tokens. Transaction: ${signature}`);
    
    return signature;
  } catch (error) {
    console.error('Error burning tokens:', error);
    throw error;
  }
}

/**
 * Get current burn percentages from admin settings
 * @returns Object containing buy and sell burn percentages
 */
export async function getBurnPercentages(): Promise<{ buy: number; sell: number }> {
  try {
    // Fetch admin settings from API
    const response = await fetch('/api/admin/settings');
    if (!response.ok) {
      throw new Error('Failed to fetch admin settings');
    }
    
    const settings = await response.json();
    
    return {
      buy: parseFloat(settings.burnPercentageBuy || '10.0'),
      sell: parseFloat(settings.burnPercentageSell || '6.5')
    };
  } catch (error) {
    console.error('Error fetching burn percentages, using defaults:', error);
    // Return default values if API call fails
    return {
      buy: 10.0,
      sell: 6.5
    };
  }
}

/**
 * Integration function to be called during swap operations
 * @param wallet - Connected wallet
 * @param operationType - 'buy' or 'sell'
 * @param tokenAmount - Amount of YOT tokens involved in the swap
 * @returns Transaction signature of the burn operation
 */
export async function executeTokenBurn(
  wallet: any,
  operationType: 'buy' | 'sell',
  tokenAmount: number
): Promise<string | null> {
  try {
    // Get current burn percentages from admin settings
    const burnPercentages = await getBurnPercentages();
    
    // Calculate burn amount
    const burnAmount = calculateBurnAmount(
      operationType,
      tokenAmount,
      burnPercentages.buy,
      burnPercentages.sell
    );
    
    // If burn amount is negligible, skip burning
    if (burnAmount < 0.000000001) { // Less than 1 nanowatt
      console.log('Burn amount too small, skipping burn operation');
      return null;
    }
    
    // Execute the burn
    const signature = await burnYotTokens(wallet, burnAmount);
    
    console.log(`Token burn completed successfully:
      Operation: ${operationType}
      Tokens burned: ${burnAmount} YOT
      Transaction: ${signature}
    `);
    
    return signature;
  } catch (error) {
    console.error('Token burning failed:', error);
    // Don't fail the entire swap if burning fails
    // Log the error but continue with the swap
    return null;
  }
}