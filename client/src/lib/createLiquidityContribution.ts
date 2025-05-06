/**
 * Creates a liquidity contribution account for the user
 * This is a separate transaction that must be completed before swapping
 */

import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { appConfig } from './config';

// Multi-hub swap program ID
const MULTI_HUB_SWAP_PROGRAM_ID = appConfig.multiHubSwapProgramId;

/**
 * Find the PDA for the liquidity contribution account
 * @param userWallet User's wallet public key
 * @param programId Multi-hub swap program ID
 * @returns [liquidityContributionAddress, bump]
 */
export function findLiquidityContributionAddress(
  userWallet: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.toBuffer()],
    programId
  );
}

/**
 * Check if a liquidity contribution account exists for the user
 * @param connection Solana connection
 * @param userWallet User's wallet public key
 * @returns true if the account exists, false otherwise
 */
export async function checkLiquidityContributionAccount(
  connection: Connection,
  userWallet: PublicKey
): Promise<boolean> {
  try {
    const programId = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    const [liquidityContributionAccount] = findLiquidityContributionAddress(
      userWallet,
      programId
    );
    
    // Check if account exists
    const accountInfo = await connection.getAccountInfo(liquidityContributionAccount);
    return accountInfo !== null;
  } catch (error) {
    console.error('Error checking liquidity contribution account:', error);
    return false;
  }
}

/**
 * Initialize the liquidity contribution account for a user
 * This must be done before the user can participate in swaps
 * @param wallet User's wallet (must be a wallet adapter with signTransaction method)
 * @param connection Solana connection
 * @returns Result object with success status and optional signature
 */
export async function createLiquidityContributionAccount(
  wallet: any,
  connection: Connection
): Promise<{ success: boolean; signature?: string; message?: string }> {
  try {
    // First check if the account already exists
    const programId = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    const [liquidityContributionAddress] = findLiquidityContributionAddress(
      wallet.publicKey,
      programId
    );
    
    const accountInfo = await connection.getAccountInfo(liquidityContributionAddress);
    
    if (accountInfo) {
      return { 
        success: true, 
        message: 'Liquidity contribution account already exists' 
      };
    }
    
    console.log('Creating liquidity contribution account...');
    
    // Size of the liquidity contribution account data structure
    // This must match the size in the Rust program
    const LIQUIDITY_CONTRIBUTION_SIZE = 128;
    
    // Calculate minimum balance for rent exemption
    const rentExemption = await connection.getMinimumBalanceForRentExemption(
      LIQUIDITY_CONTRIBUTION_SIZE
    );
    
    // Create initialization instruction
    // Format is [1] as the instruction index for initialization
    const data = Buffer.from([1]);
    
    // Create transaction instruction
    const createAccountIx = {
      programId,
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      data
    };
    
    // Create transaction
    const transaction = new Transaction();
    transaction.add({
      ...createAccountIx,
      data: Buffer.from([1])  // Initialize instruction
    });
    
    // Get latest blockhash and sign transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Sign and send transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    // Wait for confirmation
    await connection.confirmTransaction(signature);
    
    console.log('Liquidity contribution account created successfully!');
    return { 
      success: true, 
      signature,
      message: 'Liquidity contribution account created successfully!' 
    };
  } catch (error: any) {
    console.error('Error creating liquidity contribution account:', error);
    return { 
      success: false, 
      message: error.message || 'Unknown error creating liquidity contribution account'
    };
  }
}