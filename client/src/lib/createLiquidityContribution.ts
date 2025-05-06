/**
 * Dedicated module for checking liquidity contribution accounts
 * Note: We've shifted our approach to not try to create the account directly
 * but instead return the status to let the swap handle account creation
 */
import {
  PublicKey,
  Connection,
} from '@solana/web3.js';
import { solanaConfig } from './config';

/**
 * Find the liquidity contribution account address for a user
 * @param userPubkey User wallet public key
 * @param programId Program ID of the multi-hub swap program
 * @returns The PDA and bump seed
 */
export function findLiquidityContributionAddress(
  userPubkey: PublicKey,
  programId: PublicKey = new PublicKey(solanaConfig.multiHubSwap.programId)
): [PublicKey, number] {
  // Same seed derivation as in the Rust program: "liq" + user_pubkey
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userPubkey.toBuffer()],
    programId
  );
}

/**
 * Check if liquidity contribution account exists
 * We've updated our approach - instead of trying to create the account separately,
 * we just check if it exists and let the swap transaction handle the creation
 * if needed.
 */
export async function ensureLiquidityContributionAccount(
  wallet: any,
  connection: Connection
): Promise<{
  exists: boolean;
  accountAddress: PublicKey;
}> {
  try {
    if (!wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    // Get the liquidity contribution account PDA
    const programId = new PublicKey(solanaConfig.multiHubSwap.programId);
    const [liquidityAccount] = findLiquidityContributionAddress(wallet.publicKey, programId);

    console.log(`[Account Check] Checking liquidity contribution account: ${liquidityAccount.toString()}`);

    // Check if the account exists
    const accountInfo = await connection.getAccountInfo(liquidityAccount);
    
    if (accountInfo !== null) {
      console.log('[Account Check] Liquidity contribution account already exists');
      return {
        exists: true,
        accountAddress: liquidityAccount
      };
    }

    console.log('[Account Check] Liquidity contribution account does not exist');
    
    // We're no longer trying to create the account - the swap instruction will handle this
    return {
      exists: false,
      accountAddress: liquidityAccount
    };
  } catch (error) {
    console.error('Error in ensureLiquidityContributionAccount:', error);
    throw error;
  }
}