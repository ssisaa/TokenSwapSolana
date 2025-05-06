/**
 * SOL to YOT swap implementation with dedicated account creation instruction
 * This implementation addresses the "account already borrowed" error by
 * using a special instruction (#8) that explicitly creates the account first.
 */

import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { solanaConfig } from './config';
import { connection } from './solana';

// Constants from config
const MULTI_HUB_SWAP_PROGRAM_ID = new PublicKey(solanaConfig.multiHubSwap.programId);
const POOL_SOL_ACCOUNT = new PublicKey(solanaConfig.pool.solAccount);
const POOL_AUTHORITY = new PublicKey(solanaConfig.pool.authority);
const YOT_TOKEN_ADDRESS = new PublicKey(solanaConfig.tokens.yot.address);
const YOS_TOKEN_ADDRESS = new PublicKey(solanaConfig.tokens.yos.address);

/**
 * Find program state PDA
 */
function findProgramStateAddress(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    programId
  );
}

/**
 * Find program authority PDA
 */
function findProgramAuthority(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    programId
  );
}

/**
 * Find the liquidity contribution address for a user wallet
 */
function findLiquidityContributionAddress(userWallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.toBuffer()],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
}

/**
 * Ensure token account exists for the user
 */
async function ensureTokenAccount(wallet: any, mint: PublicKey): Promise<PublicKey> {
  try {
    const tokenAddress = await getAssociatedTokenAddress(mint, wallet.publicKey);
    
    try {
      // Check if account exists
      await connection.getTokenAccountBalance(tokenAddress);
      console.log(`[CREATE-FIRST] Token account exists: ${tokenAddress.toString()}`);
      return tokenAddress;
    } catch (error) {
      // Account doesn't exist, create it
      console.log(`[CREATE-FIRST] Creating token account for mint ${mint.toString()}`);
      
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
      
      console.log(`[CREATE-FIRST] Token account created: ${tokenAddress.toString()}`);
      return tokenAddress;
    }
  } catch (error) {
    console.error('[CREATE-FIRST] Error ensuring token account:', error);
    throw error;
  }
}

/**
 * Create transaction for instruction #8: CREATE_LIQUIDITY_ACCOUNT
 * This uses a dedicated instruction (if available in the program) 
 * specifically for creating the liquidity contribution account
 */
async function createAccountTransaction(
  wallet: any,
  liquidityContributionAccount: PublicKey
): Promise<Transaction> {
  console.log('[CREATE-FIRST] Creating account creation transaction');
  
  const [programStateAddress] = findProgramStateAddress(MULTI_HUB_SWAP_PROGRAM_ID);
  const [programAuthority] = findProgramAuthority(MULTI_HUB_SWAP_PROGRAM_ID);
  
  // Instruction data: [8 (CREATE_LIQUIDITY_ACCOUNT), 0, 0] 
  // The zeros are placeholders as we don't need to specify SOL amount
  const data = Buffer.alloc(17);
  data.writeUint8(8, 0); // Instruction #8 - CREATE_LIQUIDITY_ACCOUNT
  data.writeBigUInt64LE(BigInt(0), 1); // No SOL transfer needed
  data.writeBigUInt64LE(BigInt(0), 9); // No min amount needed
  
  // Only include the minimal accounts needed for account creation
  const accounts = [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: programStateAddress, isSigner: false, isWritable: false },
    { pubkey: programAuthority, isSigner: false, isWritable: false },
    { pubkey: POOL_SOL_ACCOUNT, isSigner: false, isWritable: true },
    { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
  
  const ix = new TransactionInstruction({
    programId: MULTI_HUB_SWAP_PROGRAM_ID,
    keys: accounts,
    data
  });
  
  // Create transaction with compute budget
  const transaction = new Transaction();
  
  const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400000
  });
  
  transaction.add(computeUnits);
  transaction.add(ix);
  
  // Set transaction properties
  transaction.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  return transaction;
}

/**
 * Create SOL to YOT swap transaction (instruction #7)
 */
async function createSwapTransaction(
  wallet: any,
  solAmount: number,
  userYotAccount: PublicKey,
  userYosAccount: PublicKey,
  liquidityContributionAccount: PublicKey
): Promise<Transaction> {
  console.log(`[CREATE-FIRST] Creating swap transaction for ${solAmount} SOL`);
  
  // Convert SOL to lamports
  const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  
  // Allow 0 min output during testing/retry scenarios
  const minAmountOut = 0; // In a production environment, calculate this from expected output and slippage
  
  // Get PDAs for the transaction
  const [programStateAddress] = findProgramStateAddress(MULTI_HUB_SWAP_PROGRAM_ID);
  const [programAuthority] = findProgramAuthority(MULTI_HUB_SWAP_PROGRAM_ID);
  
  // Get YOT pool token account
  const yotPoolAccount = await getAssociatedTokenAddress(
    new PublicKey(YOT_TOKEN_ADDRESS),
    POOL_AUTHORITY
  );
  
  // Instruction data: [7 (SOL-YOT Swap), amountIn (8 bytes), minAmountOut (8 bytes)]
  const data = Buffer.alloc(17);
  data.writeUint8(7, 0); // SOL-YOT Swap instruction (index 7)
  data.writeBigUInt64LE(BigInt(amountInLamports), 1);
  data.writeBigUInt64LE(BigInt(minAmountOut), 9);
  
  // Required accounts for the SOL to YOT swap
  const accounts = [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: programStateAddress, isSigner: false, isWritable: false },
    { pubkey: programAuthority, isSigner: false, isWritable: false },
    { pubkey: POOL_SOL_ACCOUNT, isSigner: false, isWritable: true },
    { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
    { pubkey: userYotAccount, isSigner: false, isWritable: true },
    { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true },
    { pubkey: new PublicKey(YOS_TOKEN_ADDRESS), isSigner: false, isWritable: true },
    { pubkey: userYosAccount, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  const swapInstruction = new TransactionInstruction({
    programId: MULTI_HUB_SWAP_PROGRAM_ID,
    keys: accounts,
    data,
  });
  
  // Create transaction with compute budget instructions
  const transaction = new Transaction();
  
  // Add compute budget
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
  
  return transaction;
}

/**
 * Execute the createAccountFirst approach for SOL to YOT swap
 * This implementation:
 * 1. Checks if liquidity contribution account exists
 * 2. If not, creates it first with a dedicated instruction
 * 3. Then performs the actual swap
 */
export async function createAccountFirstSwap(
  wallet: any,
  solAmount: number
): Promise<{
  success: boolean;
  signature?: string;
  accountCreationSignature?: string;
  error?: string;
  message?: string;
}> {
  console.log(`[CREATE-FIRST] Starting SOL to YOT swap for ${solAmount} SOL with create-account-first approach`);
  
  if (!wallet || !wallet.publicKey) {
    return {
      success: false,
      error: 'Wallet not connected',
      message: 'Please connect your wallet to continue'
    };
  }
  
  try {
    // Ensure user has token accounts for YOT and YOS
    console.log('[CREATE-FIRST] Ensuring token accounts exist');
    const userYotAccount = await ensureTokenAccount(wallet, new PublicKey(YOT_TOKEN_ADDRESS));
    const userYosAccount = await ensureTokenAccount(wallet, new PublicKey(YOS_TOKEN_ADDRESS));
    
    // Check if liquidity contribution account exists
    const [liquidityContributionAccount] = findLiquidityContributionAddress(wallet.publicKey);
    console.log(`[CREATE-FIRST] Liquidity contribution account address: ${liquidityContributionAccount.toString()}`);
    
    const accountInfo = await connection.getAccountInfo(liquidityContributionAccount);
    const accountExists = accountInfo !== null;
    console.log(`[CREATE-FIRST] Liquidity account exists: ${accountExists}`);
    
    let accountCreationSignature: string | undefined;
    
    // If the account doesn't exist, create it first in a separate transaction
    if (!accountExists) {
      try {
        console.log('[CREATE-FIRST] Creating liquidity contribution account first...');
        const createAccountTx = await createAccountTransaction(
          wallet,
          liquidityContributionAccount
        );
        
        const signedTx = await wallet.signTransaction(createAccountTx);
        accountCreationSignature = await connection.sendRawTransaction(signedTx.serialize());
        console.log(`[CREATE-FIRST] Account creation transaction sent: ${accountCreationSignature}`);
        
        // Wait for confirmation
        const createResult = await connection.confirmTransaction(accountCreationSignature);
        
        if (createResult.value.err) {
          console.error('[CREATE-FIRST] Account creation failed:', createResult.value.err);
          return {
            success: false,
            accountCreationSignature,
            error: 'Account creation failed',
            message: `Failed to create liquidity contribution account: ${JSON.stringify(createResult.value.err)}`
          };
        }
        
        console.log('[CREATE-FIRST] Account created successfully, waiting 2 seconds before swap...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check again if the account was created
        const newAccountInfo = await connection.getAccountInfo(liquidityContributionAccount);
        if (!newAccountInfo) {
          console.error('[CREATE-FIRST] Account still does not exist after successful creation transaction');
          return {
            success: false,
            accountCreationSignature,
            error: 'Account verification failed',
            message: 'Liquidity contribution account was not found after creation transaction'
          };
        }
        
        console.log(`[CREATE-FIRST] Account verified, size: ${newAccountInfo.data.length} bytes`);
      } catch (error) {
        console.error('[CREATE-FIRST] Error during account creation:', error);
        return {
          success: false,
          accountCreationSignature,
          error: 'Account creation error',
          message: error instanceof Error ? error.message : String(error)
        };
      }
    }
    
    // Now perform the actual swap
    console.log('[CREATE-FIRST] Creating and sending swap transaction...');
    const swapTransaction = await createSwapTransaction(
      wallet,
      solAmount,
      userYotAccount,
      userYosAccount,
      liquidityContributionAccount
    );
    
    const signedSwapTx = await wallet.signTransaction(swapTransaction);
    const swapSignature = await connection.sendRawTransaction(signedSwapTx.serialize());
    console.log(`[CREATE-FIRST] Swap transaction sent: ${swapSignature}`);
    
    // Wait for confirmation
    const swapResult = await connection.confirmTransaction(swapSignature);
    
    if (swapResult.value.err) {
      console.error('[CREATE-FIRST] Swap transaction failed:', swapResult.value.err);
      return {
        success: false,
        signature: swapSignature,
        accountCreationSignature,
        error: 'Swap failed',
        message: `Transaction error: ${JSON.stringify(swapResult.value.err)}`
      };
    }
    
    console.log('[CREATE-FIRST] Swap transaction succeeded!');
    return {
      success: true,
      signature: swapSignature,
      accountCreationSignature,
      message: `Successfully swapped ${solAmount} SOL for YOT tokens`
    };
  } catch (error) {
    console.error('[CREATE-FIRST] Error during swap process:', error);
    return {
      success: false,
      error: 'Error during swap',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Simplified export function for compatibility with multi-hub-swap-contract.ts
 */
export async function solToYotSwap(wallet: any, solAmount: number): Promise<string> {
  console.log(`[CREATE-FIRST] Starting swap of ${solAmount} SOL`);
  
  const result = await createAccountFirstSwap(wallet, solAmount);
  
  if (result.success) {
    return result.signature || '';
  } else {
    throw new Error(result.message || 'Swap failed');
  }
}