/**
 * Implementation of a two-phase SOL to YOT swap that solves the "account already borrowed" error
 * 
 * This implementation addresses the problem by:
 * 1. First creating the liquidity contribution account in a separate transaction
 * 2. Then executing the actual swap in a second transaction
 */

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  SYSVAR_RENT_PUBKEY,
  ComputeBudgetProgram,
  TransactionInstruction,
  Keypair
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import { solanaConfig } from './config';

// Connection with reasonable timeout and commitment level
// Import the connection from solana.ts to ensure consistency
import { connection } from './solana';

// Program and token addresses
const MULTI_HUB_SWAP_PROGRAM_ID = new PublicKey(solanaConfig.multiHubSwap.programId);
const YOT_TOKEN_ADDRESS = new PublicKey(solanaConfig.tokens.yot.address);
const YOS_TOKEN_ADDRESS = new PublicKey(solanaConfig.tokens.yos.address);
const POOL_SOL_ACCOUNT = new PublicKey(solanaConfig.pool.solAccount);
const POOL_AUTHORITY = new PublicKey(solanaConfig.pool.authority);

// PDA derivation functions
export function getProgramStatePda(): PublicKey {
  const [programState] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
  return programState;
}

export function getProgramAuthorityPda(): PublicKey {
  const [programAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
  return programAuthority;
}

export function getLiquidityContributionPda(userPublicKey: PublicKey): PublicKey {
  const [liquidityContribution] = PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userPublicKey.toBuffer()],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
  return liquidityContribution;
}

// Ensure token accounts exist for user
async function ensureTokenAccounts(wallet: any): Promise<{
  yotAccount: PublicKey;
  yosAccount: PublicKey;
}> {
  try {
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    
    let yotAccount = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
    let yosAccount = await getAssociatedTokenAddress(yosMint, wallet.publicKey);
    
    // Check if YOT account exists, create if not
    try {
      const yotAccountInfo = await connection.getAccountInfo(yotAccount);
      if (!yotAccountInfo) {
        console.log('[TWO_PHASE_SWAP] Creating YOT token account');
        const createYotTx = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            yotAccount,
            wallet.publicKey,
            yotMint
          )
        );
        
        createYotTx.feePayer = wallet.publicKey;
        const blockhash = await connection.getLatestBlockhash();
        createYotTx.recentBlockhash = blockhash.blockhash;
        
        const signedTx = await wallet.signTransaction(createYotTx);
        const signature = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(signature);
        console.log(`[TWO_PHASE_SWAP] Created YOT token account: ${signature}`);
      } else {
        console.log('[TWO_PHASE_SWAP] YOT token account already exists');
      }
    } catch (error) {
      console.log('[TWO_PHASE_SWAP] Error checking YOT account, creating new one');
      const createYotTx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          yotAccount,
          wallet.publicKey,
          yotMint
        )
      );
      
      createYotTx.feePayer = wallet.publicKey;
      const blockhash = await connection.getLatestBlockhash();
      createYotTx.recentBlockhash = blockhash.blockhash;
      
      const signedTx = await wallet.signTransaction(createYotTx);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature);
      console.log(`[TWO_PHASE_SWAP] Created YOT token account: ${signature}`);
    }
    
    // Check if YOS account exists, create if not
    try {
      const yosAccountInfo = await connection.getAccountInfo(yosAccount);
      if (!yosAccountInfo) {
        console.log('[TWO_PHASE_SWAP] Creating YOS token account');
        const createYosTx = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            yosAccount,
            wallet.publicKey,
            yosMint
          )
        );
        
        createYosTx.feePayer = wallet.publicKey;
        const blockhash = await connection.getLatestBlockhash();
        createYosTx.recentBlockhash = blockhash.blockhash;
        
        const signedTx = await wallet.signTransaction(createYosTx);
        const signature = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(signature);
        console.log(`[TWO_PHASE_SWAP] Created YOS token account: ${signature}`);
      } else {
        console.log('[TWO_PHASE_SWAP] YOS token account already exists');
      }
    } catch (error) {
      console.log('[TWO_PHASE_SWAP] Error checking YOS account, creating new one');
      const createYosTx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          yosAccount,
          wallet.publicKey,
          yosMint
        )
      );
      
      createYosTx.feePayer = wallet.publicKey;
      const blockhash = await connection.getLatestBlockhash();
      createYosTx.recentBlockhash = blockhash.blockhash;
      
      const signedTx = await wallet.signTransaction(createYosTx);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature);
      console.log(`[TWO_PHASE_SWAP] Created YOS token account: ${signature}`);
    }
    
    return { yotAccount, yosAccount };
  } catch (error) {
    console.error('[TWO_PHASE_SWAP] Error ensuring token accounts:', error);
    throw error;
  }
}

// PHASE 1: Create liquidity contribution account in a separate transaction
async function createLiquidityAccountTransaction(
  wallet: any
): Promise<{ 
  success: boolean; 
  signature?: string; 
  accountExists?: boolean; 
  error?: string; 
}> {
  try {
    // Get the liquidity contribution account PDA
    const liquidityContributionAddress = getLiquidityContributionPda(wallet.publicKey);
    
    // Check if account already exists
    const accountInfo = await connection.getAccountInfo(liquidityContributionAddress);
    if (accountInfo) {
      console.log(`[TWO_PHASE_SWAP] Liquidity contribution account already exists: ${liquidityContributionAddress.toString()}`);
      return { success: true, accountExists: true };
    }
    
    console.log(`[TWO_PHASE_SWAP] Creating liquidity account at: ${liquidityContributionAddress.toString()}`);
    
    // Get program PDAs
    const programStateAddress = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda();
    
    // Ensure token accounts exist
    await ensureTokenAccounts(wallet);
    
    // Get token accounts
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosPoolAccount = await getAssociatedTokenAddress(
      new PublicKey(YOS_TOKEN_ADDRESS),
      POOL_AUTHORITY
    );
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, POOL_AUTHORITY);
    const userYotAccount = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
    const userYosAccount = await getAssociatedTokenAddress(
      new PublicKey(YOS_TOKEN_ADDRESS),
      wallet.publicKey
    );
    
    // Create transaction with compute budget
    const transaction = new Transaction();
    
    // Add compute budget instructions for more compute units
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    
    // Create instruction data for CreateLiquidityAccount (index 7)
    const data = Buffer.alloc(1);
    data.writeUint8(7, 0);
    
    // IMPORTANT: Use program authority as central liquidity wallet
    const centralLiquidityWallet = programAuthority;
    
    // Account list must match EXACTLY what the program expects
    const accountMetas = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
      { pubkey: POOL_SOL_ACCOUNT, isSigner: false, isWritable: false },
      { pubkey: yotPoolAccount, isSigner: false, isWritable: false },
      { pubkey: centralLiquidityWallet, isSigner: false, isWritable: false },
      { pubkey: yosPoolAccount, isSigner: false, isWritable: false },
      { pubkey: yotMint, isSigner: false, isWritable: false },
      { pubkey: userYotAccount, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(YOS_TOKEN_ADDRESS), isSigner: false, isWritable: false },
      { pubkey: userYosAccount, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    const instruction = new TransactionInstruction({
      programId: MULTI_HUB_SWAP_PROGRAM_ID,
      keys: accountMetas,
      data,
    });
    
    transaction.add(instruction);
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send the transaction
    const signedTx = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true
    });
    
    console.log(`[TWO_PHASE_SWAP] Liquidity account creation transaction sent: ${signature}`);
    
    // Wait for confirmation with retry
    try {
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('[TWO_PHASE_SWAP] Liquidity account creation confirmed!');
      return { success: true, signature };
    } catch (error) {
      console.warn('[TWO_PHASE_SWAP] Could not confirm liquidity account creation, but it may have succeeded');
      return { success: true, signature, error: 'Confirmation timeout' };
    }
  } catch (error: any) {
    console.error('[TWO_PHASE_SWAP] Error creating liquidity account:', error);
    return { success: false, error: error.message };
  }
}

// PHASE 2: Execute the swap in a separate transaction
async function executeSwapTransaction(wallet: any, solAmount: number): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
  outputAmount?: number;
}> {
  try {
    console.log(`[TWO_PHASE_SWAP] Executing swap transaction for ${solAmount} SOL`);
    
    // Convert SOL to lamports
    const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    
    // Get program PDAs
    const programStateAddress = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda();
    const liquidityContributionAddress = getLiquidityContributionPda(wallet.publicKey);
    
    // Get token accounts
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, POOL_AUTHORITY);
    const userYotAccount = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
    const userYosAccount = await getAssociatedTokenAddress(yosMint, wallet.publicKey);
    
    // IMPORTANT: Create associated token address for the program authority to receive YOT tokens
    const centralLiquidityWalletAuthority = programAuthority; // The PDA that can sign for program
    const centralLiquidityWalletYotAccount = await getAssociatedTokenAddress(
      yotMint,
      centralLiquidityWalletAuthority,
      true // allowOwnerOffCurve = true for PDAs
    );
    
    console.log(`[TWO_PHASE_SWAP] Central liquidity wallet YOT account: ${centralLiquidityWalletYotAccount.toString()}`);
    
    // Calculate expected output based on pool balances
    const solPoolBalance = await connection.getBalance(POOL_SOL_ACCOUNT) / LAMPORTS_PER_SOL;
    const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotAccountInfo.value.uiAmount);
    
    // Calculate expected output using AMM formula
    const expectedOutput = (solAmount * yotPoolBalance) / (solPoolBalance + solAmount);
    
    // Apply slippage tolerance (1%)
    const minAmountOut = Math.floor(expectedOutput * 0.99 * Math.pow(10, 9));
    
    console.log(`[TWO_PHASE_SWAP] Pool balances - SOL: ${solPoolBalance}, YOT: ${yotPoolBalance}`);
    console.log(`[TWO_PHASE_SWAP] Expected output: ${expectedOutput} YOT`);
    console.log(`[TWO_PHASE_SWAP] Min output with slippage: ${minAmountOut / Math.pow(10, 9)} YOT`);
    
    // Create instruction data for SOL to YOT swap (index 8 = SolToYotSwapImmediate)
    const data = Buffer.alloc(17);
    data.writeUint8(8, 0);
    data.writeBigUInt64LE(BigInt(amountInLamports), 1);
    data.writeBigUInt64LE(BigInt(minAmountOut), 9);
    
    // For the transaction, we need both the authority and its token account
    const centralLiquidityWallet = centralLiquidityWalletAuthority;
    
    // Log all account addresses for debugging
    console.log(`[TWO_PHASE_SWAP] Key accounts for swap transaction:`);
    console.log(`• User wallet: ${wallet.publicKey.toString()}`);
    console.log(`• Program state: ${programStateAddress.toString()}`);
    console.log(`• Program authority: ${programAuthority.toString()}`);
    console.log(`• SOL pool account: ${POOL_SOL_ACCOUNT.toString()}`);
    console.log(`• YOT pool account: ${yotPoolAccount.toString()}`);
    console.log(`• User YOT account: ${userYotAccount.toString()}`);
    console.log(`• Central liquidity wallet (authority): ${centralLiquidityWallet.toString()}`);
    console.log(`• Central liquidity wallet YOT account: ${centralLiquidityWalletYotAccount.toString()}`);
    console.log(`• Liquidity contribution: ${liquidityContributionAddress.toString()}`);
    
    // First check if central liquidity wallet YOT account exists, if not create it
    let centralYotAccountExists = false;
    try {
      const accountInfo = await connection.getAccountInfo(centralLiquidityWalletYotAccount);
      centralYotAccountExists = accountInfo !== null;
    } catch (err) {
      console.log("[TWO_PHASE_SWAP] Error checking central liquidity YOT account:", err);
    }
    
    console.log(`[TWO_PHASE_SWAP] Central liquidity YOT account exists: ${centralYotAccountExists}`);
    
    // If the account doesn't exist, we should create it first
    if (!centralYotAccountExists) {
      console.log("[TWO_PHASE_SWAP] Creating central liquidity wallet YOT account...");
      // This instruction creates the associated token account if it doesn't already exist
      const createAtaInstruction = createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        centralLiquidityWalletYotAccount, // associated token account to create
        centralLiquidityWalletAuthority, // owner of the new account
        yotMint // token mint
      );
      
      const createAtaTransaction = new Transaction();
      createAtaTransaction.add(createAtaInstruction);
      createAtaTransaction.feePayer = wallet.publicKey;
      createAtaTransaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      
      const signedCreateAtaTx = await wallet.signTransaction(createAtaTransaction);
      const createAtaSignature = await connection.sendRawTransaction(signedCreateAtaTx.serialize());
      
      console.log(`[TWO_PHASE_SWAP] Sent create central YOT account transaction: ${createAtaSignature}`);
      await connection.confirmTransaction(createAtaSignature);
      console.log(`[TWO_PHASE_SWAP] Created central YOT account successfully`);
    }
    
    // Account metas for the swap instruction - IMPORTANT: Use the token account for central liquidity
    const accountMetas = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: POOL_SOL_ACCOUNT, isSigner: false, isWritable: true },
      { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
      { pubkey: userYotAccount, isSigner: false, isWritable: true },
      { pubkey: centralLiquidityWalletYotAccount, isSigner: false, isWritable: true }, // Use token account!
      { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
      { pubkey: yosMint, isSigner: false, isWritable: true },
      { pubkey: userYosAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    const instruction = new TransactionInstruction({
      programId: MULTI_HUB_SWAP_PROGRAM_ID,
      keys: accountMetas,
      data,
    });
    
    // Create transaction with compute budget
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
    transaction.add(instruction);
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign transaction
    const signedTx = await wallet.signTransaction(transaction);
    
    // Try to simulate the transaction first
    console.log('[TWO_PHASE_SWAP] Simulating transaction...');
    try {
      // Just use the default simulateTransaction without extra options
      // This avoids the "Cannot read properties of undefined (reading 'numRequiredSignatures')" error
      const simulation = await connection.simulateTransaction(signedTx);
      
      if (simulation.value.err) {
        console.warn('[TWO_PHASE_SWAP] Simulation warning:', simulation.value.err);
        console.log('[TWO_PHASE_SWAP] Logs:', simulation.value.logs?.join('\n'));
      } else {
        console.log('[TWO_PHASE_SWAP] Simulation successful');
      }
    } catch (error) {
      console.warn('[TWO_PHASE_SWAP] Simulation error, continuing anyway:', error);
      // Continue with the transaction even if simulation fails
      // The wallet will show any potential errors to the user
    }
    
    // Send the transaction with skipPreflight to allow it through even with simulation errors
    console.log('[TWO_PHASE_SWAP] Sending swap transaction...');
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true
    });
    
    console.log(`[TWO_PHASE_SWAP] Swap transaction sent: ${signature}`);
    console.log(`[TWO_PHASE_SWAP] View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    try {
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('[TWO_PHASE_SWAP] Swap transaction confirmed!');
      
      // Check if YOT was received
      try {
        const finalYotBalance = await connection.getTokenAccountBalance(userYotAccount);
        console.log(`[TWO_PHASE_SWAP] Final YOT balance: ${finalYotBalance.value.uiAmount}`);
        
        return {
          success: true,
          signature,
          outputAmount: expectedOutput // Return approximate amount
        };
      } catch (error) {
        console.log('[TWO_PHASE_SWAP] Could not fetch final YOT balance');
        return { success: true, signature };
      }
    } catch (error: any) {
      console.error('[TWO_PHASE_SWAP] Error confirming transaction:', error);
      return { success: false, signature, error: error.message };
    }
  } catch (error: any) {
    console.error('[TWO_PHASE_SWAP] Error executing swap:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Two-phase SOL to YOT swap implementation
 * This implementation addresses the "account already borrowed" error by using
 * two separate transactions for creating the liquidity account and performing the swap
 */
export async function twoPhaseSwap(
  wallet: any,
  solAmount: number
): Promise<{
  success: boolean;
  signatures?: { create?: string; swap?: string };
  error?: string;
  outputAmount?: number;
}> {
  try {
    console.log(`[TWO_PHASE_SWAP] Starting two-phase swap for ${solAmount} SOL`);
    
    // Validate input
    if (!wallet || !wallet.publicKey) {
      return { success: false, error: 'Wallet not connected' };
    }
    
    if (solAmount <= 0 || solAmount > 1000) {
      return { success: false, error: 'Invalid SOL amount (must be between 0 and 1000)' };
    }
    
    // Check if user has sufficient balance
    const solBalance = await connection.getBalance(wallet.publicKey);
    if (solBalance < solAmount * LAMPORTS_PER_SOL) {
      return {
        success: false,
        error: `Insufficient SOL balance. You have ${solBalance / LAMPORTS_PER_SOL} SOL, need ${solAmount} SOL`
      };
    }
    
    // PHASE 1: Create the liquidity contribution account if it doesn't exist
    console.log('[TWO_PHASE_SWAP] Phase 1: Creating liquidity contribution account...');
    const createResult = await createLiquidityAccountTransaction(wallet);
    
    if (!createResult.success && !createResult.accountExists) {
      return {
        success: false,
        error: `Failed to create liquidity account: ${createResult.error}`,
        signatures: { create: createResult.signature }
      };
    }
    
    // Wait a few seconds between transactions
    console.log('[TWO_PHASE_SWAP] Waiting 2 seconds before executing swap...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // PHASE 2: Execute the actual swap
    console.log('[TWO_PHASE_SWAP] Phase 2: Executing swap transaction...');
    const swapResult = await executeSwapTransaction(wallet, solAmount);
    
    return {
      success: swapResult.success,
      signatures: { 
        create: createResult.signature, 
        swap: swapResult.signature 
      },
      error: swapResult.error,
      outputAmount: swapResult.outputAmount
    };
  } catch (error: any) {
    console.error('[TWO_PHASE_SWAP] Unexpected error during two-phase swap:', error);
    return { success: false, error: error.message };
  }
}