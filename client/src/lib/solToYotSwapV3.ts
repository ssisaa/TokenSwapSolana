/**
 * Enhanced SOL to YOT swap implementation that properly handles liquidity contribution account creation
 * This implementation splits the process into two steps to avoid the "account already borrowed" error:
 * 1. Check and create liquidity contribution account if needed
 * 2. Execute the actual swap once the account exists
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { solanaConfig } from './config';
import { connection, calculateSolToYot } from './solana';
import { ensureLiquidityContributionAccount } from './createLiquidityContribution';

// Extract necessary constants from solanaConfig
const POOL_SOL_ACCOUNT = solanaConfig.pool.solAccount;
const YOT_TOKEN_ADDRESS = solanaConfig.tokens.yot.address;
const YOS_TOKEN_ADDRESS = solanaConfig.tokens.yos.address;
const MULTI_HUB_SWAP_PROGRAM_ID = solanaConfig.multiHubSwap.programId;

// Helper functions
export function findProgramStateAddress(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    programId
  );
}

export function findProgramAuthority(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    programId
  );
}

export function findLiquidityContributionAddress(userWallet: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.toBuffer()],
    programId
  );
}

// Ensure user has a token account for the specified mint
export async function ensureTokenAccount(
  wallet: any,
  connection: Connection,
  tokenMint: PublicKey
): Promise<{
  needsTokenAccount: boolean;
  transaction?: Transaction;
  userTokenAccount: string;
}> {
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  const associatedTokenAddress = await getAssociatedTokenAddress(
    tokenMint,
    wallet.publicKey
  );
  
  try {
    // Check if account exists
    await connection.getTokenAccountBalance(associatedTokenAddress);
    
    // Account exists
    return {
      needsTokenAccount: false,
      userTokenAccount: associatedTokenAddress.toString()
    };
  } catch (error) {
    // Need to create token account
    const transaction = new Transaction();
    transaction.add(
      require('@solana/spl-token').createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        associatedTokenAddress, // ata
        wallet.publicKey, // owner
        tokenMint // mint
      )
    );
    
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    return {
      needsTokenAccount: true,
      transaction,
      userTokenAccount: associatedTokenAddress.toString()
    };
  }
}

/**
 * Check if the liquidity contribution account exists for a user
 * @param wallet The user's wallet
 * @param connection Solana connection
 * @returns Object with status and transaction to create the account if needed
 */
export async function checkLiquidityContributionAccount(
  wallet: any,
  connection: Connection
): Promise<{
  exists: boolean;
  transaction?: Transaction;
  liquidityContributionAccount: PublicKey;
  signature?: string;
}> {
  try {
    console.log('[SOL-YOT SWAP V3] Checking/creating liquidity contribution account using dedicated module');
    
    // Use our dedicated function to handle all aspects of liquidity contribution account
    const result = await ensureLiquidityContributionAccount(wallet, connection);
    
    // Return the information in a format compatible with our existing code
    return {
      exists: result.exists,
      liquidityContributionAccount: result.accountAddress,
      signature: result.signature
    };
  } catch (error) {
    console.error('[SOL-YOT SWAP V3] Error checking liquidity contribution account:', error);
    throw error;
  }
}

// Function to create a SOL to YOT swap instruction
export function createSolToYotSwapInstruction(
  userWallet: PublicKey,
  amountInLamports: number,
  minAmountOutTokens: number,
  programId: PublicKey,
  programStateAddress: PublicKey,
  programAuthority: PublicKey,
  solPoolAccount: PublicKey,
  yotPoolAccount: PublicKey,
  userYotAccount: PublicKey,
  liquidityContributionAccount: PublicKey,
  yosMint: PublicKey,
  userYosAccount: PublicKey,
): TransactionInstruction {
  // Instruction data: [7 (SOL-YOT Swap), amountIn (8 bytes), minAmountOut (8 bytes)]
  // Use the original format the deployed program expects (no flag)
  const data = Buffer.alloc(17);
  data.writeUint8(7, 0); // SOL-YOT Swap instruction (index 7)
  data.writeBigUInt64LE(BigInt(amountInLamports), 1); // Original offset at position 1
  data.writeBigUInt64LE(BigInt(minAmountOutTokens), 9); // Original offset at position 9
  
  // Required accounts for the SOL to YOT swap - must exactly match program expectation
  const accounts = [
    { pubkey: userWallet, isSigner: true, isWritable: true },                 // user wallet
    { pubkey: programStateAddress, isSigner: false, isWritable: false },      // program state
    { pubkey: programAuthority, isSigner: false, isWritable: false },         // program authority (PDA)
    { pubkey: solPoolAccount, isSigner: false, isWritable: true },            // SOL pool account
    { pubkey: yotPoolAccount, isSigner: false, isWritable: true },            // YOT pool account
    { pubkey: userYotAccount, isSigner: false, isWritable: true },            // user's YOT token account
    { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true }, // user's liquidity contribution account
    { pubkey: yosMint, isSigner: false, isWritable: true },                   // YOS mint
    { pubkey: userYosAccount, isSigner: false, isWritable: true },            // user's YOS token account
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId,
    keys: accounts,
    data,
  });
}

// Main function to perform SOL to YOT swap with the two-step approach
export async function solToYotSwapV3(
  wallet: any,
  solAmount: number,
  slippagePercent: number = 1.0
): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
  message?: string;
  accountCreated?: boolean;
  accountCreationSignature?: string;
}> {
  try {
    console.log(`[SOL-YOT SWAP V3] Starting swap of ${solAmount} SOL with ${slippagePercent}% slippage`);
    
    if (!wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    // Convert SOL to lamports
    const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    
    // Essential addresses
    const programId = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    const solPoolAccount = new PublicKey(POOL_SOL_ACCOUNT);
    const poolAuthority = new PublicKey(solanaConfig.pool.authority);
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    
    // Get PDAs
    const [programStateAddress] = findProgramStateAddress(programId);
    const [programAuthority] = findProgramAuthority(programId);
    
    // STEP 1: Check if the user has token accounts for YOT and YOS
    // Ensure user has YOT token account
    const userYotResult = await ensureTokenAccount(
      wallet,
      connection,
      yotMint
    );
    
    if (userYotResult.needsTokenAccount && userYotResult.transaction) {
      console.log('[SOL-YOT SWAP V3] Creating YOT token account...');
      const signedTxn = await wallet.signTransaction(userYotResult.transaction);
      const signature = await connection.sendRawTransaction(signedTxn.serialize());
      await connection.confirmTransaction(signature);
      console.log('[SOL-YOT SWAP V3] YOT token account created:', userYotResult.userTokenAccount);
    }
    
    // Ensure user has YOS token account
    const userYosResult = await ensureTokenAccount(
      wallet,
      connection,
      yosMint
    );
    
    if (userYosResult.needsTokenAccount && userYosResult.transaction) {
      console.log('[SOL-YOT SWAP V3] Creating YOS token account...');
      const signedTxn = await wallet.signTransaction(userYosResult.transaction);
      const signature = await connection.sendRawTransaction(signedTxn.serialize());
      await connection.confirmTransaction(signature);
      console.log('[SOL-YOT SWAP V3] YOS token account created:', userYosResult.userTokenAccount);
    }
    
    // Get user token accounts
    const userYotAccount = new PublicKey(userYotResult.userTokenAccount);
    const userYosAccount = new PublicKey(userYosResult.userTokenAccount);
    
    // STEP 2: Check and create liquidity contribution account if needed
    let accountCreated = false;
    let accountCreationSignature = '';
    
    const liquidityResult = await checkLiquidityContributionAccount(wallet, connection);
    const liquidityContributionAccount = liquidityResult.liquidityContributionAccount;
    
    // If account was just created by our external function, get the signature and flag it
    if (!liquidityResult.exists && liquidityResult.signature) {
      accountCreationSignature = liquidityResult.signature;
      accountCreated = true;
      console.log('[SOL-YOT SWAP V3] Liquidity contribution account created with signature:', accountCreationSignature);
      
      // Sleep briefly to ensure account propagation
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    }
    
    // STEP 3: Perform the actual swap now that all accounts exist
    
    // Get the pool's YOT token account
    const yotPoolAccount = await getAssociatedTokenAddress(
      yotMint,
      poolAuthority
    );
    
    // Calculate expected output with slippage
    const expectedOutput = await calculateSolToYot(solAmount);
    console.log(`[SOL-YOT SWAP V3] Expected YOT output: ${expectedOutput}`);
    
    const minAmountOut = Math.floor(
      expectedOutput * (1 - slippagePercent / 100) * Math.pow(10, 9)
    );
    
    console.log(`[SOL-YOT SWAP V3] Min YOT output with slippage: ${minAmountOut / Math.pow(10, 9)}`);
    
    // Create the swap instruction
    const swapInstruction = createSolToYotSwapInstruction(
      wallet.publicKey,
      amountInLamports,
      minAmountOut,
      programId,
      programStateAddress,
      programAuthority,
      solPoolAccount,
      yotPoolAccount,
      userYotAccount,
      liquidityContributionAccount,
      yosMint,
      userYosAccount
    );
    
    // Create the transaction with compute budget instructions
    const transaction = new Transaction();
    
    // Add compute budget instructions
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    transaction.add(swapInstruction);
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send the swap transaction
    console.log('[SOL-YOT SWAP V3] Sending SOL to YOT swap transaction...');
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    console.log(`[SOL-YOT SWAP V3] Swap transaction sent: ${signature}`);
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature);
    
    if (confirmation.value.err) {
      console.error('[SOL-YOT SWAP V3] Transaction failed:', confirmation.value.err);
      return {
        success: false,
        error: 'Transaction failed on-chain',
        message: JSON.stringify(confirmation.value.err),
        accountCreated,
        accountCreationSignature
      };
    }
    
    console.log('[SOL-YOT SWAP V3] SOL to YOT swap completed successfully!');
    return {
      success: true,
      signature,
      message: `Successfully swapped ${solAmount} SOL for YOT tokens`,
      accountCreated,
      accountCreationSignature
    };
  } catch (error) {
    console.error('[SOL-YOT SWAP V3] Error during swap:', error);
    return {
      success: false,
      error: 'Error during swap',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

// Main export function for compatibility with multi-hub-swap-contract.ts
export async function solToYotSwap(wallet: any, solAmount: number): Promise<string | any> {
  console.log(`[SOL-YOT SWAP V3] Initiating with SOL amount: ${solAmount}`);
  
  try {
    // Use 1% slippage by default
    const slippagePercent = 1.0;
    
    // Execute the enhanced swap function
    const result = await solToYotSwapV3(wallet, solAmount, slippagePercent);
    
    if (result.success) {
      console.log(`[SOL-YOT SWAP V3] Swap successful! Signature: ${result.signature}`);
      return result.signature;
    } else {
      console.error(`[SOL-YOT SWAP V3] Swap failed: ${result.message}`);
      throw new Error(result.message || "Swap failed. Please try again.");
    }
  } catch (error) {
    console.error("[SOL-YOT SWAP V3] Error:", error);
    throw error;
  }
}