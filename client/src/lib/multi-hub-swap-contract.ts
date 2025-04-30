import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { ENDPOINT, MULTI_HUB_SWAP_PROGRAM_ID, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS } from './constants';
import { sendTransaction } from './transaction-helper';

/**
 * Connection to Solana network
 */
const connection = new Connection(ENDPOINT, 'confirmed');

/**
 * Program ID as PublicKey object
 */
const programId = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);

/**
 * YOT token mint address as PublicKey
 */
const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);

/**
 * YOS token mint address as PublicKey
 */
const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);

/**
 * Calculate PDA for program state
 */
export function findProgramStateAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    programId
  );
}

/**
 * Calculate PDA for user liquidity contribution
 */
export function findLiquidityContributionAddress(userWallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liquidity'), userWallet.toBuffer()],
    programId
  );
}

/**
 * Calculate PDA for program authority
 */
export function findProgramAuthorityAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    programId
  );
}

/**
 * Create instruction data for swap-and-distribute instruction
 */
function encodeSwapAndDistributeInstruction(amountIn: number, minAmountOut: number): Buffer {
  // Layout:
  // u8 instruction discriminator (0 for SwapAndDistribute)
  // u64 amount_in
  // u64 min_amount_out
  
  const buffer = Buffer.alloc(1 + 8 + 8);
  
  // Instruction discriminator
  buffer.writeUInt8(0, 0);
  
  // amount_in as u64 (8 bytes)
  buffer.writeBigUInt64LE(BigInt(amountIn), 1);
  
  // min_amount_out as u64 (8 bytes)
  buffer.writeBigUInt64LE(BigInt(minAmountOut), 9);
  
  return buffer;
}

/**
 * Create instruction data for claim-reward instruction
 */
function encodeClaimRewardInstruction(): Buffer {
  // Layout:
  // u8 instruction discriminator (1 for ClaimReward)
  
  const buffer = Buffer.alloc(1);
  
  // Instruction discriminator
  buffer.writeUInt8(1, 0);
  
  return buffer;
}

/**
 * Create instruction data for withdraw-liquidity instruction
 */
function encodeWithdrawLiquidityInstruction(): Buffer {
  // Layout:
  // u8 instruction discriminator (2 for WithdrawLiquidity)
  
  const buffer = Buffer.alloc(1);
  
  // Instruction discriminator
  buffer.writeUInt8(2, 0);
  
  return buffer;
}

/**
 * Create instruction data for update-parameters instruction
 */
function encodeUpdateParametersInstruction(
  buyUserPercent: number,
  buyLiquidityPercent: number,
  buyCashbackPercent: number,
  sellUserPercent: number,
  sellLiquidityPercent: number,
  sellCashbackPercent: number,
  weeklyRewardRate: number,
  commissionPercent: number
): Buffer {
  // Layout:
  // u8 instruction discriminator (3 for UpdateParameters)
  // u8 buy_user_percent
  // u8 buy_liquidity_percent
  // u8 buy_cashback_percent
  // u8 sell_user_percent
  // u8 sell_liquidity_percent
  // u8 sell_cashback_percent
  // u16 weekly_reward_rate_basis_points (rate * 100 for 2 decimal precision)
  // u16 owner_commission_basis_points (rate * 100 for 2 decimal precision)
  
  const buffer = Buffer.alloc(1 + 6 + 2 + 2);
  
  // Instruction discriminator
  buffer.writeUInt8(3, 0);
  
  // Distribution percentages as u8 (1 byte each)
  buffer.writeUInt8(buyUserPercent, 1);
  buffer.writeUInt8(buyLiquidityPercent, 2);
  buffer.writeUInt8(buyCashbackPercent, 3);
  buffer.writeUInt8(sellUserPercent, 4);
  buffer.writeUInt8(sellLiquidityPercent, 5);
  buffer.writeUInt8(sellCashbackPercent, 6);
  
  // Weekly reward rate as u16 basis points
  buffer.writeUInt16LE(Math.round(weeklyRewardRate * 100), 7);
  
  // Owner commission as u16 basis points
  buffer.writeUInt16LE(Math.round(commissionPercent * 100), 9);
  
  return buffer;
}

/**
 * Swap tokens and distribute according to protocol rules
 * @param wallet Connected wallet
 * @param amountIn Amount to swap
 * @param minAmountOut Minimum amount to receive (with slippage)
 * @returns Transaction signature
 */
export async function executeSwapAndDistribute(
  wallet: any,
  amountIn: number,
  minAmountOut: number
): Promise<string> {
  try {
    // Check wallet connection
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }
    
    // Create transaction
    const transaction = new Transaction();
    
    // Add instruction to swap and distribute
    transaction.add({
      programId: programId,
      keys: [
        // Add required account metas here
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        // ... add more accounts based on program requirements
      ],
      data: encodeSwapAndDistributeInstruction(amountIn, minAmountOut)
    });
    
    // Send transaction
    return await sendTransaction(wallet, transaction);
  } catch (error) {
    console.error("Error in executeSwapAndDistribute:", error);
    throw error;
  }
}

/**
 * Claim weekly YOS rewards
 * @param wallet Connected wallet
 * @returns Transaction signature
 */
export async function executeClaimWeeklyReward(wallet: any): Promise<string> {
  try {
    // Check wallet connection
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }
    
    // Create transaction
    const transaction = new Transaction();
    
    // Add instruction to claim reward
    transaction.add({
      programId: programId,
      keys: [
        // Add required account metas here
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        // ... add more accounts based on program requirements
      ],
      data: encodeClaimRewardInstruction()
    });
    
    // Send transaction
    return await sendTransaction(wallet, transaction);
  } catch (error) {
    console.error("Error in executeClaimWeeklyReward:", error);
    throw error;
  }
}

/**
 * Withdraw liquidity contribution
 * @param wallet Connected wallet
 * @returns Transaction signature
 */
export async function executeWithdrawLiquidity(wallet: any): Promise<string> {
  try {
    // Check wallet connection
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }
    
    // Create transaction
    const transaction = new Transaction();
    
    // Add instruction to withdraw liquidity
    transaction.add({
      programId: programId,
      keys: [
        // Add required account metas here
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        // ... add more accounts based on program requirements
      ],
      data: encodeWithdrawLiquidityInstruction()
    });
    
    // Send transaction
    return await sendTransaction(wallet, transaction);
  } catch (error) {
    console.error("Error in executeWithdrawLiquidity:", error);
    throw error;
  }
}

/**
 * Update program parameters (admin only)
 * @param wallet Admin wallet
 * @param parameters Updated parameters
 * @returns Transaction signature
 */
export async function executeUpdateParameters(
  wallet: any,
  parameters: {
    buyUserPercent: number,
    buyLiquidityPercent: number,
    buyCashbackPercent: number,
    sellUserPercent: number,
    sellLiquidityPercent: number,
    sellCashbackPercent: number,
    weeklyRewardRate: number,
    commissionPercent: number
  }
): Promise<string> {
  try {
    // Check wallet connection
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }
    
    // Create transaction
    const transaction = new Transaction();
    
    // Extract parameters
    const {
      buyUserPercent,
      buyLiquidityPercent,
      buyCashbackPercent,
      sellUserPercent,
      sellLiquidityPercent,
      sellCashbackPercent,
      weeklyRewardRate,
      commissionPercent
    } = parameters;
    
    // Add instruction to update parameters
    transaction.add({
      programId: programId,
      keys: [
        // Add required account metas here
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        // ... add more accounts based on program requirements
      ],
      data: encodeUpdateParametersInstruction(
        buyUserPercent,
        buyLiquidityPercent,
        buyCashbackPercent,
        sellUserPercent,
        sellLiquidityPercent,
        sellCashbackPercent,
        weeklyRewardRate,
        commissionPercent
      )
    });
    
    // Send transaction
    return await sendTransaction(wallet, transaction);
  } catch (error) {
    console.error("Error in executeUpdateParameters:", error);
    throw error;
  }
}