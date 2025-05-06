import { 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  ComputeBudgetProgram,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL
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

/**
 * Direct SOL to YOT swap implementation
 * This uses instruction 8 (SOL_TO_YOT_SWAP_IMMEDIATE) which performs the swap in a single step
 */
export async function directSolYotSwap(wallet: any, solAmount: number) {
  if (!wallet || !wallet.publicKey) {
    return { success: false, error: 'Wallet not connected' };
  }

  try {
    console.log(`[DIRECT-SWAP] Starting direct swap of ${solAmount} SOL`);
    const amountInLamports = solAmount * LAMPORTS_PER_SOL;

    // Create a new transaction
    const transaction = new Transaction();
    
    // Add compute budget instructions to increase limit (needed for complex operations)
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 })
    );
    
    // Make sure wallet has YOT token account
    console.log("[DIRECT-SWAP] Checking YOT token account...");
    const userYotAccount = await ensureTokenAccount(
      wallet, 
      new PublicKey(YOT_TOKEN_ADDRESS)
    );
    console.log(`[DIRECT-SWAP] User YOT account: ${userYotAccount.toString()}`);
    
    // Make sure wallet has YOS token account
    console.log("[DIRECT-SWAP] Checking YOS token account...");
    const userYosAccount = await ensureTokenAccount(
      wallet, 
      new PublicKey(YOS_TOKEN_ADDRESS)
    );
    console.log(`[DIRECT-SWAP] User YOS account: ${userYosAccount.toString()}`);
    
    // Encode instruction data for SOL_TO_YOT_SWAP (Instruction 10, not 8)
    // Use the original instruction to avoid PDA issues
    const data = Buffer.alloc(17);
    data.writeUInt8(10, 0); // Instruction 10: SOL_TO_YOT_SWAP (original)
    data.writeBigUInt64LE(BigInt(amountInLamports), 1); // SOL amount in
    
    // Set minimum amount out with 1% slippage protection
    const expectedYotAmount = amountInLamports * 134102185.86562961 / LAMPORTS_PER_SOL;
    const minAmountOut = Math.floor(expectedYotAmount * 0.99); // 1% slippage protection
    data.writeBigUInt64LE(BigInt(minAmountOut), 9); // Min YOT amount out
    
    // Get addresses
    const [programStatePda] = findProgramStatePda();
    const [programAuthority] = findProgramAuthorityPda();
    
    // Get pool token accounts
    const poolAuthority = new PublicKey(POOL_AUTHORITY || "CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9");
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const poolYotAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
    const poolYosAccount = await getAssociatedTokenAddress(yosMint, poolAuthority);
    
    console.log(`[DIRECT-SWAP] Using addresses:`);
    console.log(`Program State: ${programStatePda.toString()}`);
    console.log(`Program Authority: ${programAuthority.toString()}`);
    console.log(`Pool SOL Account: ${POOL_SOL_ACCOUNT.toString()}`);
    console.log(`Pool YOT Account: ${poolYotAccount.toString()}`);
    
    // Check Rust code for process_sol_to_yot_swap() to see exact account order
    transaction.add(
      new TransactionInstruction({
        programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
        keys: [
          // User account (payer & signer)
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          
          // Program state account 
          { pubkey: programStatePda, isSigner: false, isWritable: true },
          
          // SOL pool account (destination for SOL)
          { pubkey: new PublicKey(POOL_SOL_ACCOUNT), isSigner: false, isWritable: true },
          
          // YOT pool account (source of YOT)
          { pubkey: poolYotAccount, isSigner: false, isWritable: true },
          
          // User's YOT account (destination for YOT)
          { pubkey: userYotAccount, isSigner: false, isWritable: true },
          
          // Program authority account
          { pubkey: programAuthority, isSigner: false, isWritable: true },
          
          // YOS mint account
          { pubkey: yosMint, isSigner: false, isWritable: true },
          
          // User's YOS account (for cashback)
          { pubkey: userYosAccount, isSigner: false, isWritable: true },
          
          // Pool authority account
          { pubkey: poolAuthority, isSigner: false, isWritable: false },
          
          // System program
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          
          // Token program
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          
          // Rent sysvar
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        data,
      })
    );
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    console.log("[DIRECT-SWAP] Requesting signature...");
    const signedTx = await wallet.signTransaction(transaction);
    
    console.log("[DIRECT-SWAP] Sending transaction...");
    const signature = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: true });
    
    console.log(`[DIRECT-SWAP] Transaction sent: ${signature}`);
    console.log(`[DIRECT-SWAP] View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    console.log("[DIRECT-SWAP] Transaction confirmed!");
    
    return {
      success: true,
      signature
    };
  } catch (error: any) {
    console.error("[DIRECT-SWAP] Error during swap:", error);
    return {
      success: false,
      error: error.message || 'Unknown error during swap'
    };
  }
}

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

// Helper function to ensure token account exists
async function ensureTokenAccount(
  wallet: any, 
  tokenMint: PublicKey
): Promise<PublicKey> {
  const walletPublicKey = wallet.publicKey;
  const ata = await getAssociatedTokenAddress(tokenMint, walletPublicKey);

  try {
    // Check if the account already exists
    const accountInfo = await connection.getAccountInfo(ata);
    if (accountInfo) {
      console.log(`[DIRECT-SWAP] Token account exists: ${ata.toString()}`);
      return ata;
    }
    
    // If we get here, the account doesn't exist and we need to create it
    console.log(`[DIRECT-SWAP] Creating token account for ${tokenMint.toString()}`);
    
    // Create a transaction to create the token account
    const transaction = new Transaction();
    transaction.add(
      createAssociatedTokenAccountInstruction(
        walletPublicKey, // payer
        ata, // associated token account
        walletPublicKey, // owner
        tokenMint // mint
      )
    );
    
    // Get blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;
    
    // Sign and send the transaction
    const signedTx = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log(`[DIRECT-SWAP] Token account created: ${ata.toString()}`);
    return ata;
  } catch (error) {
    console.error("[DIRECT-SWAP] Error checking/creating token account:", error);
    throw error;
  }
}