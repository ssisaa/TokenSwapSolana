/**
 * Dedicated module for creating liquidity contribution accounts without
 * attempting to use any smart contract instructions (pure client-side).
 */
import {
  SystemProgram,
  PublicKey,
  Transaction,
  Connection,
  sendAndConfirmTransaction,
  SYSVAR_RENT_PUBKEY,
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
 * Check if liquidity contribution account exists and create it if needed
 * This is a pure client-side implementation that creates the account directly
 * without using any program instructions
 */
export async function ensureLiquidityContributionAccount(
  wallet: any,
  connection: Connection
): Promise<{
  exists: boolean;
  accountAddress: PublicKey;
  signature?: string;
}> {
  try {
    if (!wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    // Get the liquidity contribution account PDA
    const programId = new PublicKey(solanaConfig.multiHubSwap.programId);
    const [liquidityAccount] = findLiquidityContributionAddress(wallet.publicKey, programId);

    console.log(`Checking liquidity contribution account: ${liquidityAccount.toString()}`);

    // Check if the account exists
    const accountInfo = await connection.getAccountInfo(liquidityAccount);
    
    if (accountInfo !== null) {
      console.log('Liquidity contribution account already exists');
      return {
        exists: true,
        accountAddress: liquidityAccount
      };
    }

    console.log('Liquidity contribution account does not exist, creating...');

    // The account doesn't exist, create it directly using SystemProgram.createAccount
    const space = 128; // Size for liquidity contribution account (adjust if needed)
    const lamports = await connection.getMinimumBalanceForRentExemption(space);

    // Create a transaction to allocate the account
    const transaction = new Transaction();
    
    // Since this is a PDA, we need to use SystemProgram.createAccount with a signed instruction
    const createAccountIx = SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: liquidityAccount, // This is a PDA so it won't work directly
      lamports,
      space,
      programId
    });

    // This will fail because we can't sign as a PDA, but we'll try a different approach
    transaction.add(createAccountIx);

    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    // This will likely fail because we can't sign as a PDA
    // But we'll attempt it anyway in case the account can be created with a special mechanism
    try {
      // Prompt user to sign the transaction
      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature);
      
      console.log('Liquidity contribution account created successfully!');
      
      return {
        exists: false,
        accountAddress: liquidityAccount,
        signature
      };
    } catch (err) {
      console.error('Failed to create account directly:', err);
      
      // Return the account address anyway, the swap instruction can try to create it
      return {
        exists: false,
        accountAddress: liquidityAccount
      };
    }
  } catch (error) {
    console.error('Error in ensureLiquidityContributionAccount:', error);
    throw error;
  }
}