import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import { SOLANA_RPC_URL, MULTI_HUB_SWAP_PROGRAM_ID } from './constants';

/**
 * Find a program-derived address
 * @param seeds Seeds used to derive the address
 * @param programId Program ID
 * @returns Program address and bump seed
 */
export function findProgramAddress(
  seeds: (Buffer | Uint8Array)[],
  programId: PublicKey
): [PublicKey, number] {
  const [address, bump] = PublicKey.findProgramAddressSync(seeds, programId);
  return [address, bump];
}

/**
 * Creates a buffer containing the encoded swap instruction
 * @param amount Amount to swap (in raw token units)
 * @returns Encoded instruction data
 */
export function encodeSwapInstruction(amount: bigint): Buffer {
  const instructionBuffer = Buffer.alloc(9);
  
  // Instruction index for the swap operation (e.g., 1 for 'swap')
  instructionBuffer.writeUInt8(1, 0);
  
  // Write the amount as a 64-bit value (8 bytes)
  instructionBuffer.writeBigUInt64LE(amount, 1);
  
  return instructionBuffer;
}

/**
 * Creates a buffer containing the encoded claim rewards instruction
 * @returns Encoded instruction data
 */
export function encodeClaimRewardsInstruction(): Buffer {
  const instructionBuffer = Buffer.alloc(1);
  
  // Instruction index for the claim rewards operation (e.g., 2 for 'claim_rewards')
  instructionBuffer.writeUInt8(2, 0);
  
  return instructionBuffer;
}

/**
 * Creates a buffer containing the encoded update parameters instruction
 * @param liquidityContributionPercent Percentage of swap to contribute to liquidity (e.g., 20)
 * @param yosCashbackPercent Percentage of swap to convert to YOS rewards (e.g., 5)
 * @param ownerCommissionPercent Percentage of SOL swap for owner commission (e.g., 0.1)
 * @returns Encoded instruction data
 */
export function encodeUpdateParametersInstruction(
  liquidityContributionPercent: number,
  yosCashbackPercent: number,
  ownerCommissionPercent: number
): Buffer {
  const instructionBuffer = Buffer.alloc(13);
  
  // Instruction index for update parameters (e.g., 3 for 'update_parameters')
  instructionBuffer.writeUInt8(3, 0);
  
  // Write the parameters
  instructionBuffer.writeUInt32LE(Math.floor(liquidityContributionPercent * 100), 1); // As basis points
  instructionBuffer.writeUInt32LE(Math.floor(yosCashbackPercent * 100), 5); // As basis points
  instructionBuffer.writeUInt32LE(Math.floor(ownerCommissionPercent * 100), 9); // As basis points
  
  return instructionBuffer;
}

/**
 * Gets stats for a specific user from the swap program
 * @param walletAddress User's wallet address
 * @returns User's swap stats or null if not found
 */
export async function getUserSwapStats(walletAddress: string): Promise<any | null> {
  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const programId = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    const userPubkey = new PublicKey(walletAddress);
    
    // Find user swap account address
    const [swapAccountPDA] = findProgramAddress(
      [Buffer.from('swap_account'), userPubkey.toBuffer()],
      programId
    );
    
    // Get the account data
    const accountInfo = await connection.getAccountInfo(swapAccountPDA);
    
    if (!accountInfo) {
      // Account doesn't exist yet
      return null;
    }
    
    // In a real implementation, the account data would be deserialized 
    // according to the program's account structure
    
    // For demonstration, we return mock data for visualization
    return {
      totalSwapped: 0.5,  // SOL
      totalContributed: 0.1,  // SOL
      pendingRewards: 25,  // YOS
      totalRewardsClaimed: 10  // YOS
    };
  } catch (error) {
    console.error('Error fetching user swap stats:', error);
    return null;
  }
}

/**
 * Gets global statistics from the swap program
 * @returns Global swap program statistics
 */
export async function getGlobalSwapStats(): Promise<any> {
  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const programId = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    
    // Find program state address
    const [programState] = findProgramAddress(
      [Buffer.from('program_state')],
      programId
    );
    
    // Get the account data
    const accountInfo = await connection.getAccountInfo(programState);
    
    if (!accountInfo) {
      // Account doesn't exist yet
      return {
        totalSwapVolume: 0,
        totalLiquidityContributed: 0,
        totalRewardsDistributed: 0,
        uniqueUsers: 0
      };
    }
    
    // In a real implementation, the account data would be deserialized 
    // according to the program's account structure
    
    // For demonstration, we return mock data for visualization
    return {
      totalSwapVolume: 1250.75,  // SOL
      totalLiquidityContributed: 250.15,  // SOL
      totalRewardsDistributed: 6250.5,  // YOS
      uniqueUsers: 28
    };
  } catch (error) {
    console.error('Error fetching global swap stats:', error);
    return {
      totalSwapVolume: 0,
      totalLiquidityContributed: 0,
      totalRewardsDistributed: 0,
      uniqueUsers: 0
    };
  }
}

/**
 * Gets current parameters from the swap program
 * @returns Swap program parameters
 */
export async function getSwapParameters(): Promise<any> {
  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const programId = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    
    // Find program state address
    const [programState] = findProgramAddress(
      [Buffer.from('program_state')],
      programId
    );
    
    // Get the account data
    const accountInfo = await connection.getAccountInfo(programState);
    
    if (!accountInfo) {
      // Account doesn't exist yet, return default values
      return {
        liquidityContributionPercent: 20,
        yosCashbackPercent: 5,
        ownerCommissionPercent: 0.1
      };
    }
    
    // In a real implementation, the account data would be deserialized 
    // according to the program's account structure
    
    // For demonstration, we return configured values
    return {
      liquidityContributionPercent: 20,
      yosCashbackPercent: 5,
      ownerCommissionPercent: 0.1
    };
  } catch (error) {
    console.error('Error fetching swap parameters:', error);
    return {
      liquidityContributionPercent: 20,
      yosCashbackPercent: 5,
      ownerCommissionPercent: 0.1
    };
  }
}