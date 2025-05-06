/**
 * Two-step SOL to YOT swap implementation
 * This is a complete rewrite to solve the "account already borrowed" error
 * by separating the process into two distinct transactions:
 * 1. First transaction to create the liquidity contribution account
 * 2. Second transaction to perform the actual swap
 */

import {
  PublicKey,
  Transaction,
  SystemProgram,
  Connection,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { findLiquidityContributionAddress } from './createLiquidityContribution';
import { solanaConfig } from './config';
import { connection } from './solana';

// Constants from config
const MULTI_HUB_SWAP_PROGRAM_ID = solanaConfig.multiHubSwap.programId;
const POOL_SOL_ACCOUNT = solanaConfig.pool.solAccount;
const YOT_TOKEN_ADDRESS = solanaConfig.tokens.yot.address;
const YOS_TOKEN_ADDRESS = solanaConfig.tokens.yos.address;

/**
 * Find program state PDA
 */
export function findProgramStateAddress(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    programId
  );
}

/**
 * Find program authority PDA
 */
export function findProgramAuthority(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    programId
  );
}

/**
 * Ensure a token account exists for the specified token mint
 */
export async function ensureTokenAccount(
  wallet: any,
  connection: Connection,
  tokenMint: PublicKey
): Promise<{
  needsTokenAccount: boolean;
  userTokenAccount: string;
  transaction?: Transaction;
}> {
  try {
    const associatedTokenAddress = await getAssociatedTokenAddress(
      tokenMint,
      wallet.publicKey
    );

    try {
      // Check if the account exists
      await connection.getTokenAccountBalance(associatedTokenAddress);
      
      // Account exists
      return {
        needsTokenAccount: false,
        userTokenAccount: associatedTokenAddress.toString()
      };
    } catch (error) {
      // Account doesn't exist, create transaction to create it
      const transaction = new Transaction();
      
      // Add create associated token account instruction
      const createATAIx = require('@solana/spl-token').createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        associatedTokenAddress,
        wallet.publicKey,
        tokenMint
      );
      
      transaction.add(createATAIx);
      
      // Set transaction properties
      transaction.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      
      return {
        needsTokenAccount: true,
        userTokenAccount: associatedTokenAddress.toString(),
        transaction
      };
    }
  } catch (error) {
    console.error('Error in ensureTokenAccount:', error);
    return {
      error: true,
      message: error instanceof Error ? error.message : String(error)
    } as any;
  }
}

/**
 * Helper function to calculate expected YOT output based on SOL input
 */
export async function calculateSolToYot(solAmount: number): Promise<number> {
  try {
    const solPoolAccount = new PublicKey(POOL_SOL_ACCOUNT);
    const poolAuthority = new PublicKey(solanaConfig.pool.authority);
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);

    // Get the pool's YOT token account
    const yotPoolAccount = await getAssociatedTokenAddress(
      yotMint,
      poolAuthority
    );

    // Get SOL pool balance
    const solBalance = await connection.getBalance(solPoolAccount);
    
    // Get YOT pool balance
    const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotBalance = yotAccountInfo.value.uiAmount || 0;
    
    // Calculate the constant product (k = x * y)
    const k = (solBalance / LAMPORTS_PER_SOL) * yotBalance;
    
    // Calculate new SOL balance after swap (x' = x + amount_in)
    const newSolBalance = (solBalance / LAMPORTS_PER_SOL) + solAmount;
    
    // Calculate new YOT balance (y' = k / x')
    const newYotBalance = k / newSolBalance;
    
    // Calculate YOT output (y - y')
    const yotOutput = yotBalance - newYotBalance;
    
    // Apply 1% swap fee
    const yotOutputAfterFee = yotOutput * 0.99;
    
    return yotOutputAfterFee;
  } catch (error) {
    console.error('Error calculating expected YOT output:', error);
    return 0;
  }
}

/**
 * Create a liquidity contribution account as a separate transaction
 */
export async function createLiquidityContributionAccountTransaction(
  wallet: any,
  connection: Connection
): Promise<{
  exists: boolean;
  accountAddress: PublicKey;
  transaction?: Transaction;
}> {
  try {
    if (!wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    // Get the liquidity contribution account PDA
    const programId = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    const [liquidityAccount, bump] = findLiquidityContributionAddress(wallet.publicKey, programId);

    console.log(`[Complete Swap] Checking liquidity contribution account: ${liquidityAccount.toString()}`);

    // Check if the account exists
    const accountInfo = await connection.getAccountInfo(liquidityAccount);
    
    if (accountInfo !== null) {
      console.log('[Complete Swap] Liquidity contribution account already exists');
      return {
        exists: true,
        accountAddress: liquidityAccount
      };
    }

    console.log('[Complete Swap] Liquidity contribution account does not exist, creating transaction...');

    // For new approach, we'll create a custom transaction to allocate space for the account
    // This transaction will be signed by the user and create an account owned by the program
    const space = 128; // Size for liquidity contribution account
    const lamports = await connection.getMinimumBalanceForRentExemption(space);

    // Create a transaction
    const transaction = new Transaction();
    
    // Add compute budget instructions
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000
    });
    
    transaction.add(computeUnits);
    
    // Create the custom instruction that just creates the liquidity contribution account
    // We will use a variant of the SOL to YOT swap instruction but with a special flag
    // to indicate that it should only create the account and not perform a swap
    
    // Instruction data: [8 (CREATE_LIQUIDITY_ACCOUNT), amount=0, minAmount=0]
    const data = Buffer.alloc(17);
    data.writeUint8(8, 0); // Instruction #8 - CREATE_LIQUIDITY_ACCOUNT_ONLY
    data.writeBigUInt64LE(BigInt(0), 1); // Amount (0 for account creation only)
    data.writeBigUInt64LE(BigInt(0), 9); // Min amount (0 for account creation only)
    
    // We'll use the same set of accounts, but with 0 amount to indicate account creation only
    const [programStateAddress] = findProgramStateAddress(programId);
    const [programAuthority] = findProgramAuthority(programId);
    
    // Minimum required accounts for account creation
    const accounts = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: false },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(POOL_SOL_ACCOUNT), isSigner: false, isWritable: true },
      { pubkey: liquidityAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    const accountCreationIx = new TransactionInstruction({
      programId,
      keys: accounts,
      data
    });
    
    transaction.add(accountCreationIx);
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    return {
      exists: false,
      accountAddress: liquidityAccount,
      transaction
    };
  } catch (error) {
    console.error('[Complete Swap] Error creating liquidity contribution account transaction:', error);
    throw error;
  }
}

/**
 * Create SOL to YOT swap instruction
 */
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
  const data = Buffer.alloc(17);
  data.writeUint8(7, 0); // SOL-YOT Swap instruction (index 7)
  
  // Write the amount as little-endian 64-bit integer
  data.writeBigUInt64LE(BigInt(amountInLamports), 1);
  
  // Write the min amount out as little-endian 64-bit integer
  data.writeBigUInt64LE(BigInt(minAmountOutTokens), 9);
  
  // Required accounts for the SOL to YOT swap
  const accounts = [
    { pubkey: userWallet, isSigner: true, isWritable: true },
    { pubkey: programStateAddress, isSigner: false, isWritable: false },
    { pubkey: programAuthority, isSigner: false, isWritable: false },
    { pubkey: solPoolAccount, isSigner: false, isWritable: true },
    { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
    { pubkey: userYotAccount, isSigner: false, isWritable: true },
    { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true },
    { pubkey: yosMint, isSigner: false, isWritable: true },
    { pubkey: userYosAccount, isSigner: false, isWritable: true },
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

/**
 * Perform SOL to YOT swap with a complete two-step approach
 * This implementation properly handles the "account already borrowed" error
 */
export async function completeSwap(
  wallet: any,
  solAmount: number,
  slippagePercent: number = 1.0
): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
  message?: string;
  accountCreated?: boolean;
}> {
  try {
    console.log(`[Complete Swap] Starting swap of ${solAmount} SOL with ${slippagePercent}% slippage`);
    
    if (!wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    // Use imported connection
    
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
      console.log('[Complete Swap] Creating YOT token account...');
      const signedTxn = await wallet.signTransaction(userYotResult.transaction);
      const signature = await connection.sendRawTransaction(signedTxn.serialize());
      await connection.confirmTransaction(signature);
      console.log('[Complete Swap] YOT token account created:', userYotResult.userTokenAccount);
    }
    
    // Ensure user has YOS token account
    const userYosResult = await ensureTokenAccount(
      wallet,
      connection,
      yosMint
    );
    
    if (userYosResult.needsTokenAccount && userYosResult.transaction) {
      console.log('[Complete Swap] Creating YOS token account...');
      const signedTxn = await wallet.signTransaction(userYosResult.transaction);
      const signature = await connection.sendRawTransaction(signedTxn.serialize());
      await connection.confirmTransaction(signature);
      console.log('[Complete Swap] YOS token account created:', userYosResult.userTokenAccount);
    }
    
    // Get user token accounts
    const userYotAccount = new PublicKey(userYotResult.userTokenAccount);
    const userYosAccount = new PublicKey(userYosResult.userTokenAccount);
    
    // STEP 2: Check if liquidity contribution account exists and create it if needed
    let accountCreated = false;
    
    const liquidityResult = await createLiquidityContributionAccountTransaction(
      wallet,
      connection
    );
    
    const liquidityContributionAccount = liquidityResult.accountAddress;
    
    // If account doesn't exist, create it in a separate transaction
    if (!liquidityResult.exists && liquidityResult.transaction) {
      console.log('[Complete Swap] Sending transaction to create liquidity contribution account...');
      
      const signedTxn = await wallet.signTransaction(liquidityResult.transaction);
      try {
        const signature = await connection.sendRawTransaction(signedTxn.serialize());
        console.log('[Complete Swap] Waiting for liquidity account creation confirmation...');
        await connection.confirmTransaction(signature);
        console.log('[Complete Swap] Liquidity contribution account created successfully!');
        accountCreated = true;
        
        // Sleep briefly to ensure account propagation
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('[Complete Swap] Error creating liquidity account:', error);
        // We'll continue anyway because the error might just be that the account already exists
        // The swap transaction will fail properly if there's a real issue
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
    console.log(`[Complete Swap] Expected YOT output: ${expectedOutput}`);
    
    const minAmountOut = Math.floor(
      expectedOutput * (1 - slippagePercent / 100) * Math.pow(10, 9)
    );
    
    console.log(`[Complete Swap] Min YOT output with slippage: ${minAmountOut / Math.pow(10, 9)}`);
    
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
    
    // Create transaction with compute budget instructions
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
    console.log('[Complete Swap] Sending SOL to YOT swap transaction...');
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    console.log(`[Complete Swap] Swap transaction sent: ${signature}`);
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature);
    
    if (confirmation.value.err) {
      console.error('[Complete Swap] Transaction failed:', confirmation.value.err);
      return {
        success: false,
        error: 'Transaction failed on-chain',
        message: JSON.stringify(confirmation.value.err),
        accountCreated
      };
    }
    
    console.log('[Complete Swap] SOL to YOT swap completed successfully!');
    return {
      success: true,
      signature,
      message: `Successfully swapped ${solAmount} SOL for YOT tokens`,
      accountCreated
    };
  } catch (error) {
    console.error('[Complete Swap] Error during swap:', error);
    return {
      success: false,
      error: 'Error during swap',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Main export function for compatibility with multi-hub-swap-contract.ts
 */
export async function solToYotSwap(wallet: any, solAmount: number): Promise<string> {
  console.log(`[Complete Swap] Initiating with SOL amount: ${solAmount}`);
  
  try {
    // Use 1% slippage by default
    const slippagePercent = 1.0;
    
    // Execute the enhanced swap function
    const result = await completeSwap(wallet, solAmount, slippagePercent);
    
    if (result.success) {
      console.log(`[Complete Swap] Swap successful! Signature: ${result.signature}`);
      return result.signature || '';
    } else {
      console.error(`[Complete Swap] Swap failed: ${result.message}`);
      throw new Error(result.message || "Swap failed. Please try again.");
    }
  } catch (error) {
    console.error("[Complete Swap] Error:", error);
    throw error;
  }
}