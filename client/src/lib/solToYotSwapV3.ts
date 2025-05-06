/**
 * SOL to YOT swap implementation with non-PDA account
 * This implementation addresses the "account already borrowed" error by
 * creating a standard account (not a PDA) and using that for the swap
 */

import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
  Keypair
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { solanaConfig } from './config';
import { connection } from './solana';

// Constants from config - all from app.config.json with NO hardcoded values
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
 * Ensure token account exists for the user
 */
async function ensureTokenAccount(wallet: any, mint: PublicKey): Promise<PublicKey> {
  try {
    const tokenAddress = await getAssociatedTokenAddress(mint, wallet.publicKey);
    
    try {
      // Check if account exists
      await connection.getTokenAccountBalance(tokenAddress);
      console.log(`[SOL-YOT-SWAP-V3] Token account exists: ${tokenAddress.toString()}`);
      return tokenAddress;
    } catch (error) {
      // Account doesn't exist, create it
      console.log(`[SOL-YOT-SWAP-V3] Creating token account for mint ${mint.toString()}`);
      
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
      
      console.log(`[SOL-YOT-SWAP-V3] Token account created: ${tokenAddress.toString()}`);
      return tokenAddress;
    }
  } catch (error) {
    console.error('[SOL-YOT-SWAP-V3] Error ensuring token account:', error);
    throw error;
  }
}

/**
 * Create a standard account (not a PDA) and assign it to the program
 */
async function createStandardAccount(
  wallet: any,
  size: number = 128
): Promise<Keypair> {
  console.log('[SOL-YOT-SWAP-V3] Creating standard account and assigning to program');
  
  // Generate a new keypair for the account
  const newAccount = Keypair.generate();
  console.log(`[SOL-YOT-SWAP-V3] Generated account: ${newAccount.publicKey.toString()}`);
  
  // Calculate lamports needed for rent exemption
  const lamports = await connection.getMinimumBalanceForRentExemption(size);
  
  // Create transaction with transfer, allocate, and assign instructions
  const transaction = new Transaction();
  
  // Add compute budget to ensure enough compute units
  const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400000
  });
  transaction.add(computeUnits);
  
  // Transfer SOL to the new account
  const transferIx = SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: newAccount.publicKey,
    lamports
  });
  
  // Allocate space in the account
  const allocateIx = SystemProgram.allocate({
    accountPubkey: newAccount.publicKey,
    space: size
  });
  
  // Assign the account to the program
  const assignIx = SystemProgram.assign({
    accountPubkey: newAccount.publicKey,
    programId: MULTI_HUB_SWAP_PROGRAM_ID
  });
  
  transaction.add(transferIx);
  transaction.add(allocateIx);
  transaction.add(assignIx);
  
  // Set transaction properties
  transaction.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  // Sign the transaction with both the wallet and the new account
  try {
    const signedTx = await wallet.signTransaction(transaction);
    // Add the new account's signature
    signedTx.partialSign(newAccount);
    
    // Send the transaction
    console.log('[SOL-YOT-SWAP-V3] Sending account creation transaction...');
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    console.log(`[SOL-YOT-SWAP-V3] Transaction sent: ${signature}`);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature);
    console.log('[SOL-YOT-SWAP-V3] Account creation confirmed!');
    
    // Verify account was created and assigned correctly
    const accountInfo = await connection.getAccountInfo(newAccount.publicKey);
    if (!accountInfo) {
      throw new Error('Account was not created');
    }
    
    if (!accountInfo.owner.equals(MULTI_HUB_SWAP_PROGRAM_ID)) {
      throw new Error(`Account not assigned to program. Owner: ${accountInfo.owner.toString()}`);
    }
    
    console.log(`[SOL-YOT-SWAP-V3] Account created and assigned to program: ${newAccount.publicKey.toString()}`);
    return newAccount;
  } catch (error) {
    console.error('[SOL-YOT-SWAP-V3] Error creating and assigning account:', error);
    throw error;
  }
}

/**
 * Create SOL to YOT swap transaction using the standard account
 */
async function createSwapTransaction(
  wallet: any,
  solAmount: number,
  userYotAccount: PublicKey,
  userYosAccount: PublicKey,
  liquidityContributionAccount: PublicKey
): Promise<Transaction> {
  console.log(`[SOL-YOT-SWAP-V3] Creating swap transaction for ${solAmount} SOL`);
  
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
 * Execute the SOL to YOT swap using a standard account
 */
export async function solToYotSwapV3(
  wallet: any,
  solAmount: number
): Promise<{
  success: boolean;
  signature?: string;
  accountCreationSignature?: string;
  error?: string;
  message?: string;
}> {
  console.log(`[SOL-YOT-SWAP-V3] Starting SOL to YOT swap for ${solAmount} SOL with standard account approach`);
  
  if (!wallet || !wallet.publicKey) {
    return {
      success: false,
      error: 'Wallet not connected',
      message: 'Please connect your wallet to continue'
    };
  }
  
  try {
    // Ensure user has token accounts for YOT and YOS
    console.log('[SOL-YOT-SWAP-V3] Ensuring token accounts exist');
    const userYotAccount = await ensureTokenAccount(wallet, new PublicKey(YOT_TOKEN_ADDRESS));
    const userYosAccount = await ensureTokenAccount(wallet, new PublicKey(YOS_TOKEN_ADDRESS));
    
    // Create standard account (not a PDA) and assign it to the program
    const standardAccount = await createStandardAccount(wallet);
    const liquidityContributionAccount = standardAccount.publicKey;
    
    // Now perform the swap using the standard account
    console.log('[SOL-YOT-SWAP-V3] Creating and sending swap transaction...');
    const swapTransaction = await createSwapTransaction(
      wallet,
      solAmount,
      userYotAccount,
      userYosAccount,
      liquidityContributionAccount
    );
    
    // Sign the transaction
    const signedSwapTx = await wallet.signTransaction(swapTransaction);
    
    // Send the swap transaction
    const swapSignature = await connection.sendRawTransaction(signedSwapTx.serialize());
    console.log(`[SOL-YOT-SWAP-V3] Swap transaction sent: ${swapSignature}`);
    
    // Wait for confirmation
    try {
      const swapResult = await connection.confirmTransaction(swapSignature);
      
      if (swapResult.value.err) {
        console.error('[SOL-YOT-SWAP-V3] Swap transaction failed:', swapResult.value.err);
        return {
          success: false,
          signature: swapSignature,
          error: 'Swap failed',
          message: `Transaction error: ${JSON.stringify(swapResult.value.err)}`
        };
      }
      
      console.log('[SOL-YOT-SWAP-V3] Swap transaction succeeded!');
      return {
        success: true,
        signature: swapSignature,
        message: `Successfully swapped ${solAmount} SOL for YOT tokens using account ${liquidityContributionAccount.toString()}`
      };
    } catch (error) {
      console.error('[SOL-YOT-SWAP-V3] Error confirming swap transaction:', error);
      return {
        success: false,
        signature: swapSignature,
        error: 'Confirmation error',
        message: `Error confirming swap transaction: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  } catch (error) {
    console.error('[SOL-YOT-SWAP-V3] Error during swap process:', error);
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
  console.log(`[SOL-YOT-SWAP-V3] Starting swap of ${solAmount} SOL`);
  
  const result = await solToYotSwapV3(wallet, solAmount);
  
  if (result.success) {
    return result.signature || '';
  } else {
    throw new Error(result.message || 'Swap failed');
  }
}