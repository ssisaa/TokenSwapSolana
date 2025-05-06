/**
 * SOL to YOT Swap Implementation with Common Wallet Contribution and YOS Cashback
 * 
 * This implementation:
 * 1. Sends 20% to the common wallet (program authority PDA)
 * 2. Uses 80% for the actual swap to user's wallet
 * 3. Provides 5% YOS tokens as cashback to the user
 * 4. Completely avoids the "account already borrowed" error
 */

import { PublicKey, Transaction, TransactionInstruction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { connection as solanaConnection } from './solana';
import { 
  MULTI_HUB_SWAP_PROGRAM_ID, 
  YOT_TOKEN_ADDRESS, 
  YOS_TOKEN_ADDRESS, 
  POOL_SOL_ACCOUNT,
  POOL_AUTHORITY,
  CONTRIBUTION_DISTRIBUTION_PERCENT
} from './config';

// Constants
const YOS_CASHBACK_PERCENT = 5.0; // 5% cashback in YOS tokens

/**
 * Get the common wallet address (Program Authority PDA)
 * @returns Program Authority PDA
 */
export function getCommonWallet(): PublicKey {
  const [programAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return programAuthority;
}

/**
 * Check common wallet balance
 * @returns Current balance in SOL
 */
export async function getCommonWalletBalance(): Promise<number> {
  const commonWallet = getCommonWallet();
  const balance = await solanaConnection.getBalance(commonWallet) / LAMPORTS_PER_SOL;
  console.log(`Common wallet balance: ${balance} SOL`);
  return balance;
}

/**
 * Execute SOL to YOT swap with common wallet contribution and YOS cashback
 * 
 * @param wallet User's wallet
 * @param solAmount Amount of SOL to swap
 * @param slippagePercent Slippage tolerance percentage
 * @returns Transaction result
 */
export async function executeSwapWithCashback(
  wallet: any,
  solAmount: number,
  slippagePercent: number = 1.0
): Promise<{
  success: boolean,
  signature?: string,
  error?: string,
  yotAmount?: number,
  yosAmount?: number,
  contributionAmount?: number
}> {
  try {
    console.log(`Executing SOL to YOT swap with common wallet and YOS cashback for ${solAmount} SOL...`);
    const walletPublicKey = wallet.publicKey;
    
    // Calculate split amounts
    // 20% to common wallet, 80% for swap
    const contributionAmount = solAmount * (CONTRIBUTION_DISTRIBUTION_PERCENT / 100);
    const swapAmount = solAmount - contributionAmount;
    
    console.log(`Common wallet contribution: ${contributionAmount} SOL (${CONTRIBUTION_DISTRIBUTION_PERCENT}%)`);
    console.log(`Swap amount: ${swapAmount} SOL (${100 - CONTRIBUTION_DISTRIBUTION_PERCENT}%)`);
    
    // Convert amounts to lamports
    const contributionLamports = Math.floor(contributionAmount * LAMPORTS_PER_SOL);
    const swapLamports = Math.floor(swapAmount * LAMPORTS_PER_SOL);
    
    // Get token accounts
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const commonWallet = getCommonWallet();
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, new PublicKey(POOL_AUTHORITY));
    const userYotAccount = await getAssociatedTokenAddress(yotMint, walletPublicKey);
    
    // Check if user has YOT account, if not we'll create it in the transaction
    let needsYotAccount = false;
    try {
      await solanaConnection.getTokenAccountBalance(userYotAccount);
    } catch (error) {
      console.log('User does not have a YOT token account, will create one');
      needsYotAccount = true;
    }
    
    // Check or create YOS account for cashback
    const userYosAccount = await getAssociatedTokenAddress(yosMint, walletPublicKey);
    const programYosAccount = await getAssociatedTokenAddress(yosMint, commonWallet);
    
    // Check if user has YOS account, if not we'll create it
    let needsYosAccount = false;
    try {
      await solanaConnection.getTokenAccountBalance(userYosAccount);
    } catch (error) {
      console.log('User does not have a YOS token account, will create one for cashback');
      needsYosAccount = true;
    }
    
    // Calculate expected YOT output based on pool balances
    const solPoolBalance = await solanaConnection.getBalance(new PublicKey(POOL_SOL_ACCOUNT)) / LAMPORTS_PER_SOL;
    const yotAccountInfo = await solanaConnection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotAccountInfo.value.uiAmount);
    
    // Calculate expected YOT output using AMM formula (x * y) / (x + Δx)
    const expectedYotOutput = (swapAmount * yotPoolBalance) / (solPoolBalance + swapAmount);
    
    // Apply slippage tolerance to YOT amount
    const slippageFactor = (100 - slippagePercent) / 100;
    const minYotAmountOut = Math.floor(expectedYotOutput * slippageFactor * Math.pow(10, 9));
    
    // Calculate YOS cashback (5% of YOT value)
    const expectedYosAmount = expectedYotOutput * (YOS_CASHBACK_PERCENT / 100);
    
    console.log(`Pool balances - SOL: ${solPoolBalance}, YOT: ${yotPoolBalance}`);
    console.log(`Expected YOT output: ${expectedYotOutput}`);
    console.log(`Min YOT output with ${slippagePercent}% slippage: ${minYotAmountOut / Math.pow(10, 9)}`);
    console.log(`Expected YOS cashback: ${expectedYosAmount} (${YOS_CASHBACK_PERCENT}% of YOT)`);
    
    // Create transaction
    const transaction = new Transaction();
    
    // Add compute budget instructions for better transaction handling
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    
    // Create token accounts if needed
    if (needsYotAccount) {
      const createYotAccountIx = createAssociatedTokenAccountInstruction(
        walletPublicKey,
        userYotAccount,
        walletPublicKey,
        yotMint
      );
      transaction.add(createYotAccountIx);
    }
    
    if (needsYosAccount) {
      const createYosAccountIx = createAssociatedTokenAccountInstruction(
        walletPublicKey,
        userYosAccount,
        walletPublicKey,
        yosMint
      );
      transaction.add(createYosAccountIx);
    }
    
    // 1. Add SOL transfer to common wallet (20%)
    const commonWalletTransfer = SystemProgram.transfer({
      fromPubkey: walletPublicKey,
      toPubkey: commonWallet,
      lamports: contributionLamports
    });
    
    // 2. Add SOL transfer to pool (80%)
    const poolTransfer = SystemProgram.transfer({
      fromPubkey: walletPublicKey,
      toPubkey: new PublicKey(POOL_SOL_ACCOUNT),
      lamports: swapLamports
    });
    
    // Add transfers to transaction
    transaction.add(commonWalletTransfer);
    transaction.add(poolTransfer);
    
    // Create instruction data for SOL_YOT_SWAP_WITH_CASHBACK (index 15)
    const data = Buffer.alloc(17); // 1 byte for instruction index + 8 bytes for SOL amount + 8 bytes for min YOT out
    data.writeUint8(15, 0); // Instruction index
    data.writeBigUInt64LE(BigInt(swapLamports), 1); // SOL amount in lamports
    data.writeBigUInt64LE(BigInt(minYotAmountOut), 9); // Min YOT out in smallest units
    
    // Account metas for the swap with cashback instruction
    const accountMetas = [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: commonWallet, isSigner: false, isWritable: true }, // Common wallet
      { pubkey: new PublicKey(POOL_SOL_ACCOUNT), isSigner: false, isWritable: true }, // Pool SOL account
      { pubkey: new PublicKey(POOL_AUTHORITY), isSigner: false, isWritable: false }, // Pool authority
      { pubkey: yotMint, isSigner: false, isWritable: false }, // YOT mint
      { pubkey: yotPoolAccount, isSigner: false, isWritable: true }, // Pool YOT account
      { pubkey: userYotAccount, isSigner: false, isWritable: true }, // User YOT account
      { pubkey: yosMint, isSigner: false, isWritable: false }, // YOS mint
      { pubkey: programYosAccount, isSigner: false, isWritable: true }, // Program YOS account
      { pubkey: userYosAccount, isSigner: false, isWritable: true }, // User YOS account
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];
    
    // Add instruction for YOT transfer and YOS cashback
    const instruction = new TransactionInstruction({
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
      keys: accountMetas,
      data,
    });
    
    transaction.add(instruction);
    
    // Set transaction properties
    transaction.feePayer = walletPublicKey;
    const { blockhash } = await solanaConnection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    const signedTx = await wallet.signTransaction(transaction);
    console.log('Sending transaction...');
    
    const signature = await solanaConnection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true
    });
    
    console.log(`Transaction sent: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    await solanaConnection.confirmTransaction(signature, 'confirmed');
    
    console.log('Transaction confirmed successfully!');
    
    return {
      success: true,
      signature,
      yotAmount: expectedYotOutput,
      yosAmount: expectedYosAmount,
      contributionAmount
    };
  } catch (error: any) {
    console.error('Error executing swap with cashback:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Simplified swap function for direct usage in application
 * 
 * @param wallet User's wallet
 * @param solAmount Amount of SOL to swap
 * @returns Transaction result
 */
export async function swapSolToYotWithCashback(
  wallet: any,
  solAmount: number
): Promise<{
  success: boolean,
  signature?: string,
  error?: string,
  yotAmount?: number,
  yosAmount?: number
}> {
  try {
    // Use standard slippage of 1%
    const result = await executeSwapWithCashback(wallet, solAmount, 1.0);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }
    
    console.log(`Swap successful! ${solAmount} SOL to ${result.yotAmount} YOT`);
    console.log(`Common wallet contribution: ${result.contributionAmount} SOL`);
    console.log(`YOS cashback: ${result.yosAmount} YOS`);
    
    return {
      success: true,
      signature: result.signature,
      yotAmount: result.yotAmount,
      yosAmount: result.yosAmount
    };
  } catch (error: any) {
    console.error('Error in simplified swap function:', error);
    return {
      success: false,
      error: error.message
    };
  }
}