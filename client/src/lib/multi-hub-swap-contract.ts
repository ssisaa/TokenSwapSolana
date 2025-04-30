import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import {
  ENDPOINT,
  PROGRAM_ID,
  YOT_TOKEN_ADDRESS,
  YOS_TOKEN_ADDRESS,
  SOL_TOKEN_ADDRESS,
  YOT_DECIMALS,
  YOS_DECIMALS,
  POOL_AUTHORITY,
  POOL_SOL_ACCOUNT,
  DISTRIBUTION
} from './constants';

const connection = new Connection(ENDPOINT);

// Buffer layout for swap and distribute instruction
enum MultiHubSwapInstructionType {
  Initialize = 0,
  SwapAndDistribute = 1,
  ClaimRewards = 2,
  WithdrawLiquidity = 3,
  UpdateParameters = 4
}

/**
 * Find a program address for a seed
 * @param seeds Seeds for the PDA
 * @param programId Program ID
 * @returns Program address and bump seed
 */
function findProgramAddress(seeds: Buffer[], programId: PublicKey): [PublicKey, number] {
  let nonce = 255;
  while (nonce > 0) {
    try {
      const seedsWithNonce = seeds.concat(Buffer.from([nonce]));
      const address = PublicKey.createProgramAddressSync(seedsWithNonce, programId);
      return [address, nonce];
    } catch (err) {
      nonce--;
      if (nonce <= 0) throw err;
    }
  }
  throw new Error('Unable to find a viable program address nonce');
}

/**
 * Find the program state PDA
 * @returns Program state address and bump seed
 */
function findProgramStateAddress(): [PublicKey, number] {
  return findProgramAddress(
    [Buffer.from('program_state')],
    new PublicKey(PROGRAM_ID)
  );
}

/**
 * Find the program authority PDA
 * @returns Program authority address and bump seed
 */
function findProgramAuthorityAddress(): [PublicKey, number] {
  return findProgramAddress(
    [Buffer.from('authority')],
    new PublicKey(PROGRAM_ID)
  );
}

/**
 * Find the swap account PDA for a wallet
 * @param walletAddress User's wallet address
 * @returns Swap account address and bump seed
 */
function findSwapAccountAddress(walletAddress: PublicKey): [PublicKey, number] {
  return findProgramAddress(
    [Buffer.from('swap_account'), walletAddress.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
}

/**
 * Find the contribution account PDA for a wallet
 * @param walletAddress User's wallet address
 * @returns Contribution account address and bump seed
 */
function findContributionAccountAddress(walletAddress: PublicKey): [PublicKey, number] {
  return findProgramAddress(
    [Buffer.from('contribution'), walletAddress.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
}

/**
 * Encode a swap and distribute instruction
 * @param amount Amount of tokens to swap
 * @param minAmountOut Minimum amount of tokens to receive (with slippage)
 * @returns Encoded instruction data
 */
function encodeSwapInstruction(amount: number, minAmountOut: number): Buffer {
  // Convert to raw token amounts
  const rawAmount = Math.floor(amount * (10 ** YOT_DECIMALS));
  const rawMinAmount = Math.floor(minAmountOut * (10 ** YOT_DECIMALS));
  
  // Create buffer for instruction data
  const instructionData = Buffer.alloc(17);
  
  // Set instruction type
  instructionData.writeUInt8(MultiHubSwapInstructionType.SwapAndDistribute, 0);
  
  // Set amount (8 bytes for u64)
  instructionData.writeBigUInt64LE(BigInt(rawAmount), 1);
  
  // Set minimum amount out (8 bytes for u64)
  instructionData.writeBigUInt64LE(BigInt(rawMinAmount), 9);
  
  return instructionData;
}

/**
 * Execute a swap with automatic liquidity contribution and YOS rewards
 * @param wallet Connected wallet
 * @param amount Amount of tokens to swap
 * @param minAmountOut Minimum amount of tokens to receive (with slippage)
 * @returns Transaction signature
 */
export async function executeSwapAndDistribute(
  wallet: any,
  amount: number,
  minAmountOut: number
): Promise<string> {
  try {
    const walletPublicKey = wallet.publicKey;
    
    // Derive program addresses
    const [programStateAddress] = findProgramStateAddress();
    const [programAuthorityAddress] = findProgramAuthorityAddress();
    const [swapAccountAddress] = findSwapAccountAddress(walletPublicKey);
    const [contributionAccountAddress] = findContributionAccountAddress(walletPublicKey);
    
    // Get token accounts
    const fromTokenMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const toTokenMint = new PublicKey(SOL_TOKEN_ADDRESS);
    const yosTokenMint = new PublicKey(YOS_TOKEN_ADDRESS);
    
    const fromTokenAccount = await getAssociatedTokenAddress(fromTokenMint, walletPublicKey);
    const toTokenAccount = await getAssociatedTokenAddress(toTokenMint, walletPublicKey);
    const yosTokenAccount = await getAssociatedTokenAddress(yosTokenMint, walletPublicKey);
    
    // Pooled token accounts
    const poolFromTokenAccount = await getAssociatedTokenAddress(fromTokenMint, new PublicKey(POOL_AUTHORITY));
    const poolToTokenAccount = new PublicKey(POOL_SOL_ACCOUNT);
    
    // Create transaction
    const transaction = new Transaction();
    
    // Check if token accounts exist and create if needed
    const fromTokenAccountInfo = await connection.getAccountInfo(fromTokenAccount);
    const yosTokenAccountInfo = await connection.getAccountInfo(yosTokenAccount);
    
    if (!fromTokenAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          walletPublicKey,
          fromTokenAccount,
          walletPublicKey,
          fromTokenMint
        )
      );
    }
    
    if (!yosTokenAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          walletPublicKey,
          yosTokenAccount,
          walletPublicKey,
          yosTokenMint
        )
      );
    }
    
    // Create swap instruction
    const swapInstruction = new TransactionInstruction({
      programId: new PublicKey(PROGRAM_ID),
      keys: [
        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: true },
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: false },
        { pubkey: swapAccountAddress, isSigner: false, isWritable: true },
        { pubkey: contributionAccountAddress, isSigner: false, isWritable: true },
        { pubkey: fromTokenAccount, isSigner: false, isWritable: true },
        { pubkey: toTokenAccount, isSigner: false, isWritable: true },
        { pubkey: yosTokenAccount, isSigner: false, isWritable: true },
        { pubkey: poolFromTokenAccount, isSigner: false, isWritable: true },
        { pubkey: poolToTokenAccount, isSigner: false, isWritable: true },
        { pubkey: fromTokenMint, isSigner: false, isWritable: false },
        { pubkey: toTokenMint, isSigner: false, isWritable: false },
        { pubkey: yosTokenMint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: encodeSwapInstruction(amount, minAmountOut)
    });
    
    transaction.add(swapInstruction);
    
    // Sign and send transaction
    const signature = await wallet.sendTransaction(transaction, connection);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    return signature;
  } catch (error) {
    console.error('Error executing swap:', error);
    throw error;
  }
}

/**
 * Claim available YOS rewards
 * @param wallet Connected wallet
 * @returns Transaction signature
 */
export async function claimYosRewards(wallet: any): Promise<string> {
  try {
    const walletPublicKey = wallet.publicKey;
    
    // Derive program addresses
    const [programStateAddress] = findProgramStateAddress();
    const [programAuthorityAddress] = findProgramAuthorityAddress();
    const [swapAccountAddress] = findSwapAccountAddress(walletPublicKey);
    const [contributionAccountAddress] = findContributionAccountAddress(walletPublicKey);
    
    // Get YOS token account
    const yosTokenMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const yosTokenAccount = await getAssociatedTokenAddress(yosTokenMint, walletPublicKey);
    
    // Create transaction
    const transaction = new Transaction();
    
    // Check if YOS token account exists and create if needed
    const yosTokenAccountInfo = await connection.getAccountInfo(yosTokenAccount);
    
    if (!yosTokenAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          walletPublicKey,
          yosTokenAccount,
          walletPublicKey,
          yosTokenMint
        )
      );
    }
    
    // Create claim instruction
    const claimInstruction = new TransactionInstruction({
      programId: new PublicKey(PROGRAM_ID),
      keys: [
        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: true },
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: false },
        { pubkey: swapAccountAddress, isSigner: false, isWritable: true },
        { pubkey: contributionAccountAddress, isSigner: false, isWritable: true },
        { pubkey: yosTokenAccount, isSigner: false, isWritable: true },
        { pubkey: yosTokenMint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([MultiHubSwapInstructionType.ClaimRewards])
    });
    
    transaction.add(claimInstruction);
    
    // Sign and send transaction
    const signature = await wallet.sendTransaction(transaction, connection);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    return signature;
  } catch (error) {
    console.error('Error claiming rewards:', error);
    throw error;
  }
}

/**
 * Get swap and contribution information for a user
 * @param walletAddress User's wallet address string
 * @returns Swap and contribution information
 */
export async function getSwapContributionInfo(walletAddress: string): Promise<{
  totalSwapped: number,
  totalContributed: number,
  totalRewarded: number,
  pendingRewards: number,
  lastClaimTime: number,
  canClaimRewards: boolean,
  nextClaimTime: number
}> {
  try {
    const walletPublicKey = new PublicKey(walletAddress);
    
    // Derive program addresses
    const [swapAccountAddress] = findSwapAccountAddress(walletPublicKey);
    const [contributionAccountAddress] = findContributionAccountAddress(walletPublicKey);
    
    // For now, return simulated data
    // In a real implementation, we'd fetch the account data from the blockchain
    return {
      totalSwapped: 100,
      totalContributed: 20, // 20% of totalSwapped
      totalRewarded: 5, // 5% of totalSwapped
      pendingRewards: 2.5,
      lastClaimTime: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
      canClaimRewards: true,
      nextClaimTime: 0 // Can claim now
    };
  } catch (error) {
    console.error('Error getting swap info:', error);
    throw error;
  }
}

/**
 * Get global swap stats for all users
 * @returns Global swap and contribution statistics
 */
export async function getSwapGlobalStats(): Promise<{
  totalUsersSwapped: number,
  totalVolumeSwapped: number,
  totalLiquidityContributed: number,
  totalRewardsDistributed: number
}> {
  try {
    // Derive program state address
    const [programStateAddress] = findProgramStateAddress();
    
    // For now, return simulated data
    // In a real implementation, we'd fetch the program state data from the blockchain
    return {
      totalUsersSwapped: 250,
      totalVolumeSwapped: 25000,
      totalLiquidityContributed: 5000, // 20% of totalVolumeSwapped
      totalRewardsDistributed: 1250 // 5% of totalVolumeSwapped
    };
  } catch (error) {
    console.error('Error getting global stats:', error);
    throw error;
  }
}