/**
 * Multi-Hub Integration Module
 * This module integrates the different versions of the Multi-Hub Swap functionality
 * and provides utility functions for working with both the v1 (original program ID)
 * and v2 (new program ID) versions.
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { AccountValidation } from './account-validation';
import MultihubSwapV2 from './multihub-contract-v2';
import { TokenInfo } from './token-search-api';
import { SwapEstimate, SwapProvider } from './multi-hub-swap';

// Import the original multihub swap module for backward compatibility
// Note: In a real implementation, you would import your existing module
import { MULTIHUB_SWAP_PROGRAM_ID as ORIGINAL_PROGRAM_ID } from './multihub-contract';

// Constants for the different program versions
export const PROGRAM_ID_V1 = ORIGINAL_PROGRAM_ID;
export const PROGRAM_ID_V2 = MultihubSwapV2.PROGRAM_ID;

// Token constants
export const YOT_TOKEN_MINT = new PublicKey(MultihubSwapV2.YOT_TOKEN_MINT);
export const YOS_TOKEN_MINT = new PublicKey(MultihubSwapV2.YOS_TOKEN_MINT);
export const SOL_TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112');
export const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';

/**
 * Detect which program version to use based on transaction environment
 * This is a heuristic approach - in a real environment, you might
 * use feature flags or config settings to determine which version to use
 */
export async function detectProgramVersion(
  connection: Connection
): Promise<'v1' | 'v2'> {
  try {
    // Try to access the v2 program's state account
    const [stateAddressV2] = MultihubSwapV2.findProgramStateAddress();
    const stateAccountV2 = await connection.getAccountInfo(stateAddressV2);
    
    if (stateAccountV2 && stateAccountV2.owner.equals(new PublicKey(PROGRAM_ID_V2))) {
      console.log('V2 program state account found, using V2 program');
      return 'v2';
    }
  } catch (error) {
    console.log('Error checking V2 program:', error);
  }
  
  // Default to v1 if v2 is not available
  console.log('Using V1 program by default');
  return 'v1';
}

/**
 * Prepare for a swap by ensuring all necessary token accounts exist
 * @param connection Solana connection
 * @param wallet User's wallet
 * @param inputTokenMint Input token mint
 * @param outputTokenMint Output token mint
 * @returns Transaction information and token accounts
 */
export async function prepareForSwap(
  connection: Connection,
  wallet: any,
  inputTokenMint: PublicKey,
  outputTokenMint: PublicKey
) {
  console.log('Preparing for swap transaction with YOS validation');
  
  // Always ensure YOS token account as a separate step
  const yosResult = await AccountValidation.ensureYosTokenAccount(
    connection,
    wallet
  );
  
  // Check required token accounts
  const requiredMints = [inputTokenMint, outputTokenMint];
  const accountResult = await AccountValidation.ensureTokenAccounts(
    connection,
    wallet,
    requiredMints
  );
  
  // Combine transactions if necessary
  let finalTransaction = new Transaction();
  if (yosResult.transaction.instructions.length > 0) {
    finalTransaction.add(...yosResult.transaction.instructions);
  }
  
  if (accountResult.transaction.instructions.length > 0) {
    finalTransaction.add(...accountResult.transaction.instructions);
  }
  
  return {
    transaction: finalTransaction,
    inputTokenAccount: accountResult.tokenAccounts.get(inputTokenMint.toString()),
    outputTokenAccount: accountResult.tokenAccounts.get(outputTokenMint.toString()),
    yosTokenAccount: yosResult.yosTokenAccount,
    needsSetup: finalTransaction.instructions.length > 0,
    missingAccounts: [
      ...accountResult.missingAccounts,
      ...(!yosResult.exists ? ['YOS Token Account'] : [])
    ]
  };
}

/**
 * Perform a token swap using the multi-hub approach
 * This function will automatically handle token account creation and version selection
 */
export async function performMultiHubSwap(
  wallet: any,
  tokenFrom: TokenInfo,
  tokenTo: TokenInfo,
  amountIn: number,
  swapEstimate: SwapEstimate,
  provider: SwapProvider = 'multihub' // Default to multihub provider
): Promise<string> {
  console.log(`Preparing Multi-Hub Swap: ${tokenFrom.symbol} → ${tokenTo.symbol}`);
  console.log(`Amount: ${amountIn}, Estimated output: ${swapEstimate.outAmount}`);
  
  const connection = new Connection(DEVNET_ENDPOINT);
  
  // Convert token info to PublicKey objects
  const inputMint = new PublicKey(tokenFrom.address);
  const outputMint = new PublicKey(tokenTo.address);
  
  // Prepare all necessary token accounts
  const setupResult = await prepareForSwap(
    connection,
    wallet,
    inputMint,
    outputMint
  );
  
  // If accounts need to be created first, do that in a separate transaction
  if (setupResult.needsSetup) {
    console.log('Creating missing token accounts first...');
    const setupSignature = await wallet.sendTransaction(setupResult.transaction, connection);
    console.log('Token account setup transaction sent:', setupSignature);
    
    // Wait for confirmation
    await connection.confirmTransaction(setupSignature, 'confirmed');
    console.log('Token account setup confirmed');
  }
  
  // Determine which program version to use
  const programVersion = await detectProgramVersion(connection);
  
  // Use v2 if available
  if (programVersion === 'v2') {
    console.log('Using Multi-Hub Swap V2');
    return MultihubSwapV2.performSwap(
      wallet,
      tokenFrom,
      tokenTo,
      amountIn,
      swapEstimate,
      provider
    );
  } else {
    // In a real implementation, you would call the v1 version here
    console.log('Using Multi-Hub Swap V1');
    
    // This is a placeholder - replace with your actual v1 implementation
    return Promise.reject('V1 implementation not provided - this would call your existing swap implementation');
  }
}

/**
 * Create a button specifically for creating YOS token accounts
 * This can be used as a preparatory step before swapping
 */
export async function createYosAccountExplicitly(
  wallet: any
): Promise<string> {
  const connection = new Connection(DEVNET_ENDPOINT);
  return AccountValidation.createYosTokenAccount(connection, wallet);
}

/**
 * Export a clean API for the integration
 */
export const MultihubIntegration = {
  PROGRAM_ID_V1,
  PROGRAM_ID_V2,
  YOT_TOKEN_MINT: YOT_TOKEN_MINT.toString(),
  YOS_TOKEN_MINT: YOS_TOKEN_MINT.toString(),
  performMultiHubSwap,
  createYosAccountExplicitly,
  prepareForSwap,
  detectProgramVersion
};

export default MultihubIntegration;