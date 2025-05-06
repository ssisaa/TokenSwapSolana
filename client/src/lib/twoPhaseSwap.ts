import { 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import { 
  MULTI_HUB_SWAP_PROGRAM_ID, 
  POOL_SOL_ACCOUNT,
  POOL_AUTHORITY,
  YOT_TOKEN_ADDRESS,
  YOS_TOKEN_ADDRESS 
} from './config';
import { connection } from './solana';

// Helper functions for PDA derivation
function findProgramStatePda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

function findProgramAuthorityPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

// Export this function so it can be used by other components
export function findLiquidityContributionPda(walletPublicKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), walletPublicKey.toBuffer()],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

// Helper function to ensure token account exists
async function ensureTokenAccount(
  wallet: any, 
  tokenMint: PublicKey
): Promise<PublicKey> {
  try {
    // Get the associated token address
    const tokenAddress = await getAssociatedTokenAddress(tokenMint, wallet.publicKey);
    
    try {
      // Check if the account already exists
      const accountInfo = await connection.getAccountInfo(tokenAddress);
      if (accountInfo) {
        console.log(`[TWO-PHASE-SWAP] Token account exists: ${tokenAddress.toString()}`);
        return tokenAddress;
      }
      
      // If we get here, the account doesn't exist and we need to create it
      console.log(`[TWO-PHASE-SWAP] Creating token account for ${tokenMint.toString()}`);
      
      // Create a transaction to create the token account
      const transaction = new Transaction();
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey, // payer
          tokenAddress, // associated token account
          wallet.publicKey, // owner
          tokenMint // mint
        )
      );
      
      // Get blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;
      
      // Sign and send the transaction
      const signedTx = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      
      console.log(`[TWO-PHASE-SWAP] Token account created: ${tokenAddress.toString()}`);
      return tokenAddress;
    } catch (error) {
      console.error("[TWO-PHASE-SWAP] Error checking/creating token account:", error);
      throw error;
    }
  } catch (error) {
    console.error("[TWO-PHASE-SWAP] Error in ensureTokenAccount:", error);
    throw error;
  }
}

/**
 * Two-Phase Swap implementation:
 * 1. First create the liquidity contribution account
 * 2. Then perform the actual swap
 * 
 * This corrects the "insufficient account keys" error by ensuring all accounts
 * are correctly included in the transaction
 */
export async function twoPhaseSwap(wallet: any, solAmount: number) {
  if (!wallet || !wallet.publicKey) {
    return { success: false, error: 'Wallet not connected' };
  }

  try {
    console.log(`[TWO-PHASE-SWAP] Starting with amount: ${solAmount} SOL`);

    // Phase 1: Create the liquidity contribution account (if needed)
    const liquidityResult = await createLiquidityAccountIfNeeded(wallet);
    if (!liquidityResult.success) {
      throw new Error(`Failed to create liquidity account: ${liquidityResult.error}`);
    }

    // Phase 2: Execute the actual swap
    console.log(`[TWO-PHASE-SWAP] Phase 1 successful, proceeding to Phase 2...`);
    return await executeSwapTransaction(wallet, solAmount);
  } catch (error) {
    console.error("[TWO-PHASE-SWAP] Error during two-phase swap:", error);
    return {
      success: false,
      error: error.message || 'Unknown error during two-phase swap'
    };
  }
}

/**
 * Phase 1: Create the liquidity contribution account if it doesn't exist
 * This matches exactly what the Rust program expects for instruction #5
 */
async function createLiquidityAccountIfNeeded(wallet: any) {
  if (!wallet.publicKey) {
    return { success: false, error: 'Wallet not connected' };
  }

  try {
    // Get the liquidity contribution account address
    const [liquidityContributionAddress] = findLiquidityContributionPda(wallet.publicKey);
    
    // Check if account already exists
    const accountInfo = await connection.getAccountInfo(liquidityContributionAddress);
    if (accountInfo) {
      console.log('[TWO-PHASE-SWAP] Liquidity contribution account already exists');
      return { success: true };
    }
    
    console.log(`[TWO-PHASE-SWAP] Creating liquidity contribution account: ${liquidityContributionAddress.toString()}`);
    
    // Create the transaction
    const transaction = new Transaction();
    
    // Add compute budget instruction
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 })
    );
    
    // Encode instruction data for create liquidity account (instruction 5)
    const createLiqAccountData = Buffer.from([5]); 
    
    // Get program accounts
    const [programStatePda] = findProgramStatePda();
    const [programAuthority] = findProgramAuthorityPda();
    
    // Add the instruction with EXACTLY the accounts the program expects
    // Based on the Rust code in process_create_liquidity_account
    transaction.add(
      new TransactionInstruction({
        programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: createLiqAccountData,
      })
    );
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    console.log("[TWO-PHASE-SWAP] Requesting signature for Phase 1...");
    const signedTx = await wallet.signTransaction(transaction);
    
    console.log("[TWO-PHASE-SWAP] Sending Phase 1 transaction...");
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    console.log(`[TWO-PHASE-SWAP] Phase 1 transaction sent: ${signature}`);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    console.log("[TWO-PHASE-SWAP] Phase 1 transaction confirmed!");
    
    return {
      success: true,
      signature
    };
  } catch (error) {
    console.error("[TWO-PHASE-SWAP] Error in Phase 1:", error);
    return {
      success: false,
      error: error.message || 'Unknown error in Phase 1'
    };
  }
}

/**
 * Phase 2: Execute the actual swap transaction
 * This uses the BUY_AND_DISTRIBUTE instruction (7) with all required accounts
 */
async function executeSwapTransaction(wallet: any, solAmount: number) {
  if (!wallet.publicKey) {
    return { success: false, error: 'Wallet not connected' };
  }

  try {
    console.log(`[TWO-PHASE-SWAP] Preparing swap of ${solAmount} SOL...`);
    const amountInLamports = solAmount * LAMPORTS_PER_SOL;

    // Create a new transaction
    const transaction = new Transaction();
    
    // Add compute budget instructions
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 })
    );
    
    // Make sure wallet has YOT token account
    console.log("[TWO-PHASE-SWAP] Checking YOT token account...");
    const userYotAccount = await ensureTokenAccount(
      wallet, 
      new PublicKey(YOT_TOKEN_ADDRESS)
    );
    console.log(`[TWO-PHASE-SWAP] User YOT account: ${userYotAccount.toString()}`);
    
    // Make sure wallet has YOS token account
    console.log("[TWO-PHASE-SWAP] Checking YOS token account...");
    const userYosAccount = await ensureTokenAccount(
      wallet, 
      new PublicKey(YOS_TOKEN_ADDRESS)
    );
    console.log(`[TWO-PHASE-SWAP] User YOS account: ${userYosAccount.toString()}`);
    
    // Encode instruction data for BUY_AND_DISTRIBUTE
    const data = Buffer.alloc(9);
    data.writeUInt8(7, 0); // Instruction 7: BUY_AND_DISTRIBUTE
    data.writeBigUInt64LE(BigInt(amountInLamports), 1);
    
    // Get addresses
    const [programStatePda] = findProgramStatePda();
    const [programAuthority] = findProgramAuthorityPda();
    const [liquidityContributionAddress] = findLiquidityContributionPda(wallet.publicKey);
    
    // Get pool token accounts
    const poolAuthority = new PublicKey(POOL_AUTHORITY || "CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9");
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const poolYotAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
    const poolYosAccount = await getAssociatedTokenAddress(yosMint, poolAuthority);
    
    console.log(`[TWO-PHASE-SWAP] Using addresses:`);
    console.log(`Program State: ${programStatePda.toString()}`);
    console.log(`Program Authority: ${programAuthority.toString()}`);
    console.log(`Liquidity Contribution: ${liquidityContributionAddress.toString()}`);
    console.log(`Pool SOL Account: ${POOL_SOL_ACCOUNT.toString()}`);
    console.log(`Pool YOT Account: ${poolYotAccount.toString()}`);
    console.log(`Pool YOS Account: ${poolYosAccount.toString()}`);
    
    // Add the swap instruction with the exact accounts the program expects
    // IMPORTANT: The order must match what the program expects in process_buy_and_distribute
    transaction.add(
      new TransactionInstruction({
        programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
        keys: [
          // User accounts
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: userYotAccount, isSigner: false, isWritable: true },
          { pubkey: userYosAccount, isSigner: false, isWritable: true },
          
          // Program state
          { pubkey: programStatePda, isSigner: false, isWritable: true },
          
          // Program authority/wallet
          { pubkey: programAuthority, isSigner: false, isWritable: true },
          
          // Pool accounts
          { pubkey: new PublicKey(POOL_SOL_ACCOUNT), isSigner: false, isWritable: true },
          { pubkey: poolYotAccount, isSigner: false, isWritable: true },
          { pubkey: poolYosAccount, isSigner: false, isWritable: true },
          
          // Liquidity contribution account
          { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
          
          // System program
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          
          // Token program
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data,
      })
    );
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    console.log("[TWO-PHASE-SWAP] Requesting signature for Phase 2...");
    const signedTx = await wallet.signTransaction(transaction);
    
    console.log("[TWO-PHASE-SWAP] Sending Phase 2 transaction...");
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    console.log(`[TWO-PHASE-SWAP] Phase 2 transaction sent: ${signature}`);
    console.log(`[TWO-PHASE-SWAP] View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    console.log("[TWO-PHASE-SWAP] Phase 2 transaction confirmed!");
    
    return {
      success: true,
      signature
    };
  } catch (error) {
    console.error("[TWO-PHASE-SWAP] Error in Phase 2:", error);
    return {
      success: false,
      error: error.message || 'Unknown error in Phase 2'
    };
  }
}