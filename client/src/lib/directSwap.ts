/**
 * Direct SOL to YOT swap implementation using common wallet mechanism
 * 
 * This implementation:
 * 1. Sends 20% to common wallet (program authority PDA)
 * 2. Directly swaps 80% using on-chain AMM rates
 * 3. Does NOT create any user-specific liquidity accounts
 * 4. Uses native program instructions only
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { connection } from './solana';
import { 
  MULTI_HUB_SWAP_PROGRAM_ID, 
  YOT_TOKEN_ADDRESS, 
  YOS_TOKEN_ADDRESS, 
  POOL_SOL_ACCOUNT,
  POOL_AUTHORITY,
  COMMON_WALLET_THRESHOLD_SOL,
  CONTRIBUTION_DISTRIBUTION_PERCENT
} from './config';

// PDA Derivation Functions
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

/**
 * Check common wallet balance against threshold
 * @returns Balance and whether threshold has been reached
 */
export async function checkCommonWalletBalance(): Promise<{balance: number, thresholdReached: boolean}> {
  // Use imported connection object
  const commonWallet = getProgramAuthorityPda();
  
  const balance = await connection.getBalance(commonWallet) / LAMPORTS_PER_SOL;
  const thresholdReached = balance >= COMMON_WALLET_THRESHOLD_SOL;
  
  console.log(`Common wallet balance: ${balance} SOL, threshold: ${COMMON_WALLET_THRESHOLD_SOL} SOL`);
  console.log(`Threshold reached: ${thresholdReached}`);
  
  return { balance, thresholdReached };
}

/**
 * Execute direct SOL to YOT swap with common wallet contribution
 * @param wallet User's wallet
 * @param solAmount Amount of SOL to swap
 * @param slippagePercent Slippage tolerance percentage
 * @returns Transaction result
 */
export async function directSwap(
  wallet: any,
  solAmount: number,
  slippagePercent: number = 1.0
): Promise<{
  success: boolean,
  signature?: string,
  error?: string,
  amount?: number,
  contributionAmount?: number
}> {
  try {
    console.log(`Executing SOL to YOT swap with common wallet contribution for ${solAmount} SOL...`);
    // Use imported connection object
    const walletPublicKey = wallet.publicKey;
    
    // Calculate contribution amount (20% to common wallet)
    const contributionAmount = solAmount * (CONTRIBUTION_DISTRIBUTION_PERCENT / 100);
    const swapAmount = solAmount - contributionAmount;
    
    console.log(`Contribution to common wallet: ${contributionAmount} SOL (${CONTRIBUTION_DISTRIBUTION_PERCENT}%)`);
    console.log(`Direct swap amount: ${swapAmount} SOL (${100 - CONTRIBUTION_DISTRIBUTION_PERCENT}%)`);
    
    // Convert amounts to lamports
    const amountInLamports = Math.floor(swapAmount * LAMPORTS_PER_SOL);
    const contributionLamports = Math.floor(contributionAmount * LAMPORTS_PER_SOL);
    
    // Get program PDAs
    const programStateAddress = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda(); // Common wallet
    
    // Get token accounts
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, new PublicKey(POOL_AUTHORITY));
    const userYotAccount = await getAssociatedTokenAddress(yotMint, walletPublicKey);
    
    // Calculate expected output based on pool balances (using only the swap amount)
    const solPoolBalance = await connection.getBalance(new PublicKey(POOL_SOL_ACCOUNT)) / LAMPORTS_PER_SOL;
    const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotAccountInfo.value.uiAmount);
    
    // Calculate expected output using AMM formula (x * y) / (x + Δx)
    const expectedOutput = (swapAmount * yotPoolBalance) / (solPoolBalance + swapAmount);
    
    // Apply slippage tolerance
    const slippageFactor = (100 - slippagePercent) / 100;
    const minAmountOut = Math.floor(expectedOutput * slippageFactor * Math.pow(10, 9));
    
    console.log(`Pool balances - SOL: ${solPoolBalance}, YOT: ${yotPoolBalance}`);
    console.log(`Expected output: ${expectedOutput} YOT`);
    console.log(`Min output with ${slippagePercent}% slippage: ${minAmountOut / Math.pow(10, 9)} YOT`);
    
    // Create instruction data for DIRECT_SWAP (index 5)
    const data = Buffer.alloc(17);
    data.writeUint8(5, 0); // DirectSwap instruction
    data.writeBigUInt64LE(BigInt(amountInLamports), 1);
    data.writeBigUInt64LE(BigInt(minAmountOut), 9);
    
    // Account metas for the direct swap instruction
    const accountMetas = [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: true }, // Common wallet receives contribution
      { pubkey: new PublicKey(POOL_SOL_ACCOUNT), isSigner: false, isWritable: true },
      { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
      { pubkey: userYotAccount, isSigner: false, isWritable: true },
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
      units: 300000
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
    
    // Check if common wallet balance exceeds threshold after this contribution
    const { thresholdReached } = await checkCommonWalletBalance();
    if (thresholdReached) {
      console.log('Common wallet threshold reached! Automatic liquidity addition should be triggered.');
      // In production, this would be handled by an admin notification or server function
    }
    
    console.log('Transaction confirmed successfully!');
    
    return {
      success: true,
      signature,
      amount: expectedOutput,
      contributionAmount
    };
  } catch (error: any) {
    console.error('Error executing direct swap:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Add liquidity to pool from common wallet (admin operation)
 * @param wallet Admin wallet
 * @returns Transaction result
 */
export async function addLiquidityFromCommonWallet(
  wallet: any
): Promise<{
  success: boolean,
  signature?: string,
  error?: string
}> {
  try {
    // Use imported connection object
    const walletPublicKey = wallet.publicKey;
    
    // Get common wallet balance
    const { balance, thresholdReached } = await checkCommonWalletBalance();
    
    if (!thresholdReached) {
      return {
        success: false,
        error: `Common wallet balance (${balance} SOL) has not reached threshold (${COMMON_WALLET_THRESHOLD_SOL} SOL)`
      };
    }
    
    console.log(`Adding liquidity from common wallet. Current balance: ${balance} SOL`);
    
    // Get program PDAs
    const programStateAddress = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda();
    
    // Create instruction data for ADD_LIQUIDITY (index 7)
    const data = Buffer.alloc(1);
    data.writeUint8(7, 0); // AddLiquidity instruction
    
    // Account metas for the add liquidity instruction
    const accountMetas = [
      { pubkey: walletPublicKey, isSigner: true, isWritable: false }, // Admin
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: true }, // Common wallet
      { pubkey: new PublicKey(POOL_SOL_ACCOUNT), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(POOL_AUTHORITY), isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    
    const instruction = new TransactionInstruction({
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
      keys: accountMetas,
      data,
    });
    
    // Create transaction
    const transaction = new Transaction();
    
    // Add compute budget instructions
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000
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
    
    console.log('Liquidity added successfully!');
    
    // Check the new balance
    const { balance: newBalance } = await checkCommonWalletBalance();
    console.log(`New common wallet balance: ${newBalance} SOL`);
    
    return {
      success: true,
      signature
    };
  } catch (error: any) {
    console.error('Error adding liquidity from common wallet:', error);
    return {
      success: false,
      error: error.message
    };
  }
}