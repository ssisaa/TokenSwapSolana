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
export const PROGRAM_ID_V3 = MultihubSwapV3.MULTIHUB_SWAP_PROGRAM_ID; // Updated to SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE

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
  provider: SwapProvider = SwapProvider.Contract
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
  
  // Make sure decimals are considered for token calculations
  const tokenFromDecimals = tokenFrom.decimals || 9;
  const tokenToDecimals = tokenTo.decimals || 9;
  
  console.log(`Using token decimals - From: ${tokenFromDecimals}, To: ${tokenToDecimals}`);
  
  // Check if the program state is initialized before attempting a swap
  try {
    // Get program state address
    const [programStateAddress] = MultihubSwapV3.findProgramStateAddress();
    
    // Check if the state account exists and has data
    const programStateAccount = await connection.getAccountInfo(programStateAddress);
    if (!programStateAccount || !programStateAccount.data || programStateAccount.data.length === 0) {
      console.error('Program state account is not initialized. Attempting to initialize...');
      
      // Attempt to initialize the program first
      try {
        const initSignature = await initializeMultihubSwapV3(wallet);
        console.log('Program successfully initialized:', initSignature);
        console.log('Please try your swap again in a few seconds.');
        throw new Error('Program needed initialization. We\'ve set it up for you. Please try your swap again.');
      } catch (initError: any) {
        if (initError.message.includes('We\'ve set it up for you')) {
          throw initError; // Re-throw our custom message
        }
        console.error('Failed to auto-initialize program:', initError);
        throw new Error('Program is not initialized. Please visit the admin page to initialize it first.');
      }
    }
    
    // Now check if the program has enough token balances to complete the swap
    // Especially important for SOL -> YOT swaps
    if (tokenFrom.symbol === 'SOL' && tokenTo.symbol === 'YOT') {
      // For SOL -> YOT swaps, need to check if program has YOT tokens
      const [programAuthorityAddress] = MultihubSwapV3.findProgramAuthorityAddress();
      
      try {
        // Check YOT balance in program's token account
        const yotMint = new PublicKey(tokenTo.address);
        const tokenAccountAddress = await getAssociatedTokenAddress(
          yotMint,
          programAuthorityAddress,
          true // allowOwnerOffCurve for PDAs
        );
        
        // See if token account exists by getting its balance
        try {
          const balance = await connection.getTokenAccountBalance(tokenAccountAddress);
          const availableYOT = parseFloat(balance.value.uiAmount?.toString() || '0');
          
          // We need at least 110% of the expected output amount (being conservative)
          const minNeeded = swapEstimate.outAmount * 1.1;
          if (availableYOT < minNeeded) {
            console.error(`Program only has ${availableYOT} YOT but needs at least ${minNeeded} YOT for this swap`);
            throw new Error(`The swap program doesn't have enough YOT tokens to complete this swap. Please try a smaller amount or try YOT → SOL swap direction first to fund the program, or visit the admin page to fund the program with YOT tokens.`);
          }
        } catch (balanceError) {
          console.error('Error getting program YOT balance:', balanceError);
          throw new Error('Program YOT token account not found or has no balance. Please visit the admin page to set up and fund the program with YOT tokens.');
        }
      } catch (error) {
        console.error('Error checking program token accounts:', error);
        throw error;
      }
    }
  } catch (stateCheckError: any) {
    // Only re-throw if it's not our custom error about needing to try again
    if (stateCheckError.message && !stateCheckError.message.includes('We\'ve set it up for you')) {
      console.error('Error checking program state:', stateCheckError);
    }
    throw stateCheckError;
  }
  
  // Now perform the actual swap with improved slippage calculation
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