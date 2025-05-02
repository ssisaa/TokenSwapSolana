/**
 * Multi-Hub Integration Module (V3)
 * This module integrates the V3 version of the Multi-Hub Swap contract.
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import MultihubSwapV3 from './multihub-contract-v3';
import { TokenInfo } from './token-search-api';
import { SwapEstimate, SwapProvider } from './multi-hub-swap';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';

// Constants for the different program versions
export const PROGRAM_ID_V3 = MultihubSwapV3.MULTIHUB_SWAP_PROGRAM_ID;

// Token constants
export const YOT_TOKEN_MINT = new PublicKey(MultihubSwapV3.YOT_TOKEN_MINT);
export const YOS_TOKEN_MINT = new PublicKey(MultihubSwapV3.YOS_TOKEN_MINT);
export const SOL_TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112');
export const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';

/**
 * Prepare for a swap by ensuring all necessary token accounts exist
 */
export async function prepareForSwap(
  connection: Connection,
  wallet: any,
  inputTokenMint: PublicKey,
  outputTokenMint: PublicKey
) {
  console.log('Preparing for swap transaction with V3');
  
  // Create a new transaction
  const transaction = new Transaction();
  
  // Ensure all token accounts exist
  const tokenAccounts = new Map<string, PublicKey>();
  
  // Input token
  const inputTokenAccount = await getAssociatedTokenAddress(
    inputTokenMint,
    wallet.publicKey
  );
  const inputAccountInfo = await connection.getAccountInfo(inputTokenAccount);
  if (!inputAccountInfo) {
    console.log('Creating input token account...');
    const createAtaIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      inputTokenAccount,
      wallet.publicKey,
      inputTokenMint
    );
    transaction.add(createAtaIx);
  }
  tokenAccounts.set(inputTokenMint.toString(), inputTokenAccount);
  
  // Output token
  const outputTokenAccount = await getAssociatedTokenAddress(
    outputTokenMint,
    wallet.publicKey
  );
  const outputAccountInfo = await connection.getAccountInfo(outputTokenAccount);
  if (!outputAccountInfo) {
    console.log('Creating output token account...');
    const createAtaIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      outputTokenAccount,
      wallet.publicKey,
      outputTokenMint
    );
    transaction.add(createAtaIx);
  }
  tokenAccounts.set(outputTokenMint.toString(), outputTokenAccount);
  
  // YOS token
  const yosTokenAccount = await getAssociatedTokenAddress(
    YOS_TOKEN_MINT,
    wallet.publicKey
  );
  const yosAccountInfo = await connection.getAccountInfo(yosTokenAccount);
  if (!yosAccountInfo) {
    console.log('Creating YOS token account...');
    const createAtaIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      yosTokenAccount,
      wallet.publicKey,
      YOS_TOKEN_MINT
    );
    transaction.add(createAtaIx);
  }
  tokenAccounts.set(YOS_TOKEN_MINT.toString(), yosTokenAccount);
  
  return {
    transaction,
    tokenAccounts,
    yosTokenAccount,
    needsSetup: transaction.instructions.length > 0
  };
}

/**
 * Perform a token swap using the multi-hub approach with V3
 */
export async function performMultiHubSwap(
  wallet: any,
  tokenFrom: TokenInfo,
  tokenTo: TokenInfo,
  amountIn: number,
  swapEstimate: SwapEstimate,
  provider: SwapProvider = 'multihub'
): Promise<string> {
  console.log(`Preparing Multi-Hub Swap V3: ${tokenFrom.symbol} → ${tokenTo.symbol}`);
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
  
  // Now perform the actual swap
  return MultihubSwapV3.performSwap(
    connection,
    wallet,
    inputMint,
    outputMint,
    amountIn,
    Math.floor(swapEstimate.outAmount * 0.99) // Allow 1% slippage
  );
}

/**
 * Initialize the program with default values
 */
export async function initializeMultihubSwapV3(wallet: any): Promise<string> {
  console.log('Initializing Multi-Hub Swap V3 program...');
  const connection = new Connection(DEVNET_ENDPOINT);
  
  return MultihubSwapV3.initializeProgram(connection, wallet);
}

/**
 * Close the program (admin only)
 */
export async function closeMultihubSwapV3(wallet: any): Promise<string> {
  console.log('Closing Multi-Hub Swap V3 program...');
  const connection = new Connection(DEVNET_ENDPOINT);
  
  return MultihubSwapV3.closeProgram(connection, wallet);
}

/**
 * Export a clean API for the integration
 */
export const MultihubIntegrationV3 = {
  PROGRAM_ID_V3,
  YOT_TOKEN_MINT: YOT_TOKEN_MINT.toString(),
  YOS_TOKEN_MINT: YOS_TOKEN_MINT.toString(),
  performMultiHubSwap,
  prepareForSwap,
  initializeMultihubSwapV3,
  closeMultihubSwapV3
};

export default MultihubIntegrationV3;