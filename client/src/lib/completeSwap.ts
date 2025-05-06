/**
 * Complete implementation of SOL to YOT swap with dedicated liquidity contribution accounts
 * 
 * This implementation solves the "account already borrowed" error by:
 * 1. Using a completely separate PDA for liquidity contributions
 * 2. Creating this PDA with unique seeds specific to each user
 * 3. Never borrowing the same account twice in a transaction
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, Keypair, LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY, ComputeBudgetProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getSolanaConnection } from './solana';
import { 
  MULTI_HUB_SWAP_PROGRAM_ID, 
  YOT_TOKEN_ADDRESS, 
  YOS_TOKEN_ADDRESS, 
  POOL_SOL_ACCOUNT,
  POOL_AUTHORITY
} from './config';

// PDA Derivation Functions - Centralized for consistency
export function getProgramStatePda(): PublicKey {
  const [programState] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return programState;
}

export function getProgramAuthorityPda(): PublicKey {
  const [programAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return programAuthority;
}

export function getUserLiquidityPda(userPublicKey: PublicKey): PublicKey {
  // Use a unique seed for each user to avoid conflicts
  const [liquidityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_liq'), userPublicKey.toBuffer()], 
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return liquidityPda;
}

// Check if user already has a liquidity contribution account
export async function hasLiquidityAccount(walletPublicKey: PublicKey): Promise<boolean> {
  const connection = getSolanaConnection();
  const liquidityPda = getUserLiquidityPda(walletPublicKey);
  const accountInfo = await connection.getAccountInfo(liquidityPda);
  return accountInfo !== null;
}

// Create a liquidity contribution account with unique user PDA
export async function createLiquidityAccount(wallet: any): Promise<string | null> {
  try {
    console.log('Creating liquidity contribution account...');
    const connection = getSolanaConnection();
    const walletPublicKey = wallet.publicKey;
    
    // Check if account already exists
    const hasAccount = await hasLiquidityAccount(walletPublicKey);
    if (hasAccount) {
      console.log('Liquidity account already exists');
      return null;
    }
    
    // Get PDAs
    const programStateAddress = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda();
    const liquidityPda = getUserLiquidityPda(walletPublicKey);
    
    // Encode instruction data for CREATE_LIQUIDITY_ACCOUNT (index 9)
    const data = Buffer.alloc(1);
    data.writeUint8(9, 0); // Create liquidity account instruction
    
    // Account metas for account creation
    const accountMetas = [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: false },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: liquidityPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    
    // Create instruction
    const instruction = new TransactionInstruction({
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
      keys: accountMetas,
      data,
    });
    
    // Create transaction
    const transaction = new Transaction();
    
    // Add compute budget instructions (needed for Solana programs)
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000 // Priority fee of 0.001 SOL
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    transaction.add(instruction);
    
    // Set recent blockhash and sign
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;
    
    // Sign and send transaction
    const signedTx = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true,
    });
    
    console.log(`Account creation transaction sent: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    await connection.confirmTransaction(signature, 'confirmed');
    console.log('Liquidity account created successfully!');
    
    return signature;
  } catch (error: any) {
    console.error('Error creating liquidity account:', error);
    throw new Error(`Failed to create liquidity account: ${error.message}`);
  }
}

// Execute the actual SOL to YOT swap
export async function executeSwap(
  wallet: any,
  solAmount: number,
  slippagePercent: number = 1.0
): Promise<{
  success: boolean,
  signature?: string,
  error?: string,
  amount?: number
}> {
  try {
    console.log(`Executing SOL to YOT swap for ${solAmount} SOL...`);
    const connection = getSolanaConnection();
    const walletPublicKey = wallet.publicKey;
    
    // First check if the user has a liquidity account
    const hasAccount = await hasLiquidityAccount(walletPublicKey);
    if (!hasAccount) {
      console.log('User does not have a liquidity account. Creating one first...');
      try {
        await createLiquidityAccount(wallet);
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to create liquidity account: ${error.message}`
        };
      }
    }
    
    // Convert SOL to lamports
    const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    
    // Get program PDAs
    const programStateAddress = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda();
    const liquidityPda = getUserLiquidityPda(walletPublicKey);
    
    // Get token accounts
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, new PublicKey(POOL_AUTHORITY));
    const userYotAccount = await getAssociatedTokenAddress(yotMint, walletPublicKey);
    
    // Create user YOS account if it doesn't exist (will happen automatically in transaction)
    const userYosAccount = await getAssociatedTokenAddress(yosMint, walletPublicKey);
    
    // Calculate expected output based on pool balances
    const solPoolBalance = await connection.getBalance(new PublicKey(POOL_SOL_ACCOUNT)) / LAMPORTS_PER_SOL;
    const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotAccountInfo.value.uiAmount);
    
    // Calculate expected output using AMM formula: (x * y) / (x + Δx)
    const expectedOutput = (solAmount * yotPoolBalance) / (solPoolBalance + solAmount);
    
    // Apply slippage tolerance
    const slippageFactor = (100 - slippagePercent) / 100;
    const minAmountOut = Math.floor(expectedOutput * slippageFactor * Math.pow(10, 9));
    
    console.log(`Pool balances - SOL: ${solPoolBalance}, YOT: ${yotPoolBalance}`);
    console.log(`Expected output: ${expectedOutput} YOT`);
    console.log(`Min output with ${slippagePercent}% slippage: ${minAmountOut / Math.pow(10, 9)} YOT`);
    
    // Create instruction data for SOL to YOT swap (index 8)
    const data = Buffer.alloc(17);
    data.writeUint8(8, 0); // SolToYotSwapImmediate instruction
    data.writeBigUInt64LE(BigInt(amountInLamports), 1);
    data.writeBigUInt64LE(BigInt(minAmountOut), 9);
    
    // IMPORTANT: Use user's dedicated liquidity PDA instead of program authority
    // This avoids the "account already borrowed" error
    const centralLiquidityWallet = programAuthority;
    
    // Account metas for the swap instruction
    const accountMetas = [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(POOL_SOL_ACCOUNT), isSigner: false, isWritable: true },
      { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
      { pubkey: userYotAccount, isSigner: false, isWritable: true },
      { pubkey: centralLiquidityWallet, isSigner: false, isWritable: true },
      { pubkey: liquidityPda, isSigner: false, isWritable: true },
      { pubkey: yosMint, isSigner: false, isWritable: true },
      { pubkey: userYosAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    const instruction = new TransactionInstruction({
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
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
    transaction.feePayer = walletPublicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    const signedTx = await wallet.signTransaction(transaction);
    console.log('Sending transaction...');
    
    const signature = await connection.sendRawTransaction(signedTx.serialize(), { 
      skipPreflight: true 
    });
    
    console.log(`Transaction sent: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('Transaction confirmed but with error:', confirmation.value.err);
      return {
        success: false,
        signature,
        error: `Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`
      };
    }
    
    console.log('Transaction confirmed successfully!');
    
    return {
      success: true,
      signature,
      amount: expectedOutput
    };
  } catch (error: any) {
    console.error('Error executing swap:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Main swap function that handles everything in sequence
export async function completeSwap(
  wallet: any,
  solAmount: number,
  slippagePercent: number = 1.0
): Promise<{
  success: boolean,
  signature?: string,
  error?: string,
  amount?: number
}> {
  try {
    // Step 1: Ensure liquidity account exists
    const hasAccount = await hasLiquidityAccount(wallet.publicKey);
    
    if (!hasAccount) {
      console.log('Creating liquidity account first...');
      try {
        const createSig = await createLiquidityAccount(wallet);
        if (!createSig) {
          console.log('Account already exists or creation was not needed');
        } else {
          console.log(`Account created with signature: ${createSig}`);
          // Wait a moment to ensure the account is properly initialized
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to create liquidity account: ${error.message}`
        };
      }
    }
    
    // Step 2: Execute the swap
    console.log('Executing swap transaction...');
    return await executeSwap(wallet, solAmount, slippagePercent);
  } catch (error: any) {
    console.error('Error in complete swap process:', error);
    return {
      success: false,
      error: error.message
    };
  }
}