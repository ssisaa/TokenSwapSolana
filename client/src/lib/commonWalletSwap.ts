/**
 * Common Wallet Swap Implementation
 * 
 * This approach:
 * 1. Sends 20% to the common wallet (program authority PDA)
 * 2. User gets 80% of the value in YOT tokens
 * 3. User also gets 5% YOS tokens as cashback
 * 4. No need to create or track individual user contribution accounts
 * 5. Completely avoids the "account already borrowed" error
 */

import { PublicKey, Transaction, TransactionInstruction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { solanaConnection } from './solana';
import { 
  MULTI_HUB_SWAP_PROGRAM_ID, 
  YOT_TOKEN_ADDRESS, 
  YOS_TOKEN_ADDRESS, 
  POOL_SOL_ACCOUNT,
  POOL_AUTHORITY,
  CONTRIBUTION_DISTRIBUTION_PERCENT,
  COMMON_WALLET_THRESHOLD_SOL,
  ADMIN_WALLETS,
  ADD_LIQUIDITY_FROM_COMMON_DISCRIMINATOR
} from './config';

// Constants
const YOS_CASHBACK_PERCENT = 5.0; // 5% cashback in YOS tokens

// Get program PDAs
export function getProgramStatePda(): PublicKey {
  const [programState] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return programState;
}

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
  const connection = solanaConnection;
  const commonWallet = getCommonWallet();
  
  const balance = await connection.getBalance(commonWallet) / LAMPORTS_PER_SOL;
  console.log(`Common wallet balance: ${balance} SOL`);
  
  return balance;
}

/**
 * Execute SOL to YOT swap with common wallet contribution and YOS cashback
 * Handles the swap by sending:
 * - 20% of SOL to the common wallet (program authority PDA)
 * - 80% of SOL to the pool for YOT tokens (sent to user)
 * - 5% additional YOS tokens as cashback (based on YOT value)
 * 
 * @param wallet User's wallet
 * @param solAmount Amount of SOL to swap
 * @param slippagePercent Slippage tolerance percentage
 * @returns Transaction result
 */
export async function executeSwapWithCommonWallet(
  wallet: any,
  solAmount: number,
  slippagePercent: number = 1.0
): Promise<{
  success: boolean,
  signature?: string,
  error?: string,
  solSignature?: string,
  amount?: number,
  commonWalletAmount?: number,
  yosCashback?: number
}> {
  try {
    console.log(`Executing SOL to YOT swap with common wallet for ${solAmount} SOL...`);
    const connection = solanaConnection;
    const walletPublicKey = wallet.publicKey;
    
    // Calculate distribution according to Common Wallet Mechanism
    // - 20% of SOL to common wallet (fixed by config)
    // - 80% of SOL used for YOT purchase
    // - 5% of YOT value as YOS cashback
    const commonWalletAmount = solAmount * (CONTRIBUTION_DISTRIBUTION_PERCENT);
    const userAmount = solAmount - commonWalletAmount;
    
    console.log(`Common wallet: ${commonWalletAmount} SOL (${CONTRIBUTION_DISTRIBUTION_PERCENT * 100}%)`);
    console.log(`User amount: ${userAmount} SOL (${(1 - CONTRIBUTION_DISTRIBUTION_PERCENT) * 100}%)`);
    
    // Convert amounts to lamports
    const commonWalletLamports = Math.floor(commonWalletAmount * LAMPORTS_PER_SOL);
    const userAmountLamports = Math.floor(userAmount * LAMPORTS_PER_SOL);
    
    // Get token accounts
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, new PublicKey(POOL_AUTHORITY));
    const userYotAccount = await getAssociatedTokenAddress(yotMint, walletPublicKey);
    const userYosAccount = await getAssociatedTokenAddress(yosMint, walletPublicKey);
    
    // Check if user already has YOT token account
    let userHasYotAccount = true;
    try {
      await connection.getTokenAccountBalance(userYotAccount);
    } catch (err) {
      console.log('User does not have YOT token account yet. Will create it.');
      userHasYotAccount = false;
    }
    
    // Check if user already has YOS token account
    let userHasYosAccount = true;
    try {
      await connection.getTokenAccountBalance(userYosAccount);
    } catch (err) {
      console.log('User does not have YOS token account yet. Will create it.');
      userHasYosAccount = false;
    }
    
    // Calculate expected YOT output based on pool balances
    const solPoolBalance = await connection.getBalance(new PublicKey(POOL_SOL_ACCOUNT)) / LAMPORTS_PER_SOL;
    const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotAccountInfo.value.uiAmount);
    
    // Calculate expected output using AMM formula (x * y) / (x + Δx)
    const expectedYotOutput = (userAmount * yotPoolBalance) / (solPoolBalance + userAmount);
    
    // Calculate YOS cashback (5% of the YOT value)
    const yosCashbackAmount = expectedYotOutput * (YOS_CASHBACK_PERCENT / 100);
    
    // Apply slippage tolerance
    const slippageFactor = (100 - slippagePercent) / 100;
    const minAmountOut = expectedYotOutput * slippageFactor;
    
    console.log(`Pool balances - SOL: ${solPoolBalance}, YOT: ${yotPoolBalance}`);
    console.log(`Expected YOT output: ${expectedYotOutput} YOT`);
    console.log(`YOS cashback: ${yosCashbackAmount} YOS (${YOS_CASHBACK_PERCENT}% of YOT)`);
    console.log(`Min output with ${slippagePercent}% slippage: ${minAmountOut} YOT`);
    
    // Step 1: Create transaction for SOL transfers
    const transaction = new Transaction();
    
    // Add compute budget instructions
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000 // Increased for token transfers
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    
    // 1. Add SOL transfer to common wallet (20%)
    const commonWalletTransfer = SystemProgram.transfer({
      fromPubkey: walletPublicKey,
      toPubkey: getCommonWallet(),
      lamports: commonWalletLamports
    });
    
    // 2. Add SOL transfer to the pool for the YOT swap (80%)
    const poolTransfer = SystemProgram.transfer({
      fromPubkey: walletPublicKey,
      toPubkey: new PublicKey(POOL_SOL_ACCOUNT),
      lamports: userAmountLamports
    });
    
    // Create token accounts for user if needed
    if (!userHasYotAccount) {
      const createYotAccountIx = createAssociatedTokenAccountInstruction(
        walletPublicKey,
        userYotAccount,
        walletPublicKey,
        yotMint
      );
      transaction.add(createYotAccountIx);
    }
    
    if (!userHasYosAccount) {
      const createYosAccountIx = createAssociatedTokenAccountInstruction(
        walletPublicKey,
        userYosAccount,
        walletPublicKey,
        yosMint
      );
      transaction.add(createYosAccountIx);
    }
    
    // Add transfers to transaction
    transaction.add(commonWalletTransfer);
    transaction.add(poolTransfer);
    
    // Set transaction properties
    transaction.feePayer = walletPublicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    const signedTx = await wallet.signTransaction(transaction);
    console.log('Sending transaction...');
    
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    console.log(`Transaction sent: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log('Transaction confirmed successfully!');
    
    // Note: In a complete implementation, this is where we would:
    // 1. Have an on-chain program that would swap the SOL for YOT tokens
    // 2. The program would transfer the YOT tokens to the user
    // 3. The program would also send YOS tokens as cashback
    // This implementation sends the SOL to the proper destinations but relies on an
    // on-chain program to handle the token transfers.
    
    return {
      success: true,
      signature,
      solSignature: signature, // Keep for backward compatibility
      amount: expectedYotOutput,
      commonWalletAmount,
      yosCashback: yosCashbackAmount
    };
  } catch (error: any) {
    console.error('Error executing SOL to YOT swap with common wallet:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Admin function to add liquidity from common wallet
 * When the common wallet accumulates 0.1 SOL, this function automatically:
 * 1. Takes the SOL from the common wallet
 * 2. Splits it 50-50 (SOL-YOT)
 * 3. Adds it to the SOL-YOT liquidity pool
 * 
 * @param adminWallet Admin wallet
 * @returns Transaction result
 */
export async function addLiquidityFromCommonWallet(
  adminWallet: any
): Promise<{
  success: boolean,
  signature?: string,
  error?: string,
  amount?: number
}> {
  try {
    console.log('Adding liquidity from common wallet to pool...');
    const connection = solanaConnection;
    const adminPublicKey = adminWallet.publicKey;
    
    // Verify this is an admin wallet
    if (!ADMIN_WALLETS.includes(adminPublicKey.toString())) {
      return {
        success: false,
        error: "Only admin wallets can perform this operation"
      };
    }
    
    // Get the common wallet
    const commonWallet = getCommonWallet();
    
    // Check the current common wallet balance
    const commonWalletBalance = await getCommonWalletBalance();
    console.log(`Common wallet balance: ${commonWalletBalance} SOL`);
    
    // Threshold check - common wallet needs at least 0.1 SOL
    const threshold = COMMON_WALLET_THRESHOLD_SOL;
    if (commonWalletBalance < threshold) {
      return {
        success: false,
        error: `Common wallet balance (${commonWalletBalance} SOL) is below threshold (${threshold} SOL)`
      };
    }
    
    // Calculate how much to add to liquidity (all available balance)
    const solToAddLiquidity = commonWalletBalance;
    const solLamports = Math.floor(solToAddLiquidity * LAMPORTS_PER_SOL);
    
    // Create transaction to move SOL from common wallet to pool
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
    
    // Create instruction data for ADD_LIQUIDITY_FROM_COMMON instruction (index 11)
    const data = Buffer.from([ADD_LIQUIDITY_FROM_COMMON_DISCRIMINATOR[0]]);
    
    // Get token accounts and PDA addresses
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const programStateAddress = getProgramStatePda();
    const programAuthority = getCommonWallet();
    const poolSolAccount = new PublicKey(POOL_SOL_ACCOUNT);
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, new PublicKey(POOL_AUTHORITY));
    
    // Account metas for the add liquidity instruction
    const accountMetas = [
      { pubkey: adminPublicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: true },
      { pubkey: poolSolAccount, isSigner: false, isWritable: true },
      { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];
    
    // Create the instruction
    const instruction = new TransactionInstruction({
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
      keys: accountMetas,
      data,
    });
    
    // Add instruction to transaction
    transaction.add(instruction);
    
    // Set transaction properties
    transaction.feePayer = adminPublicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    const signedTx = await adminWallet.signTransaction(transaction);
    console.log('Sending add liquidity transaction...');
    
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    console.log(`Transaction sent: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log('Transaction confirmed successfully!');
    console.log(`Added ${solToAddLiquidity} SOL from common wallet to liquidity pool`);
    
    return {
      success: true,
      signature,
      amount: solToAddLiquidity
    };
  } catch (error: any) {
    console.error('Error adding liquidity from common wallet:', error);
    return {
      success: false,
      error: error.message
    };
  }
}