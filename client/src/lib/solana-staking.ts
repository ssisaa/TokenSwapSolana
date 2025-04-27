import {
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction, 
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction,
  Keypair
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import { Buffer } from 'buffer';
import { toast } from '@/hooks/use-toast';
import { connection } from '@/lib/completeSwap';
import { 
  YOT_TOKEN_ADDRESS, 
  YOS_TOKEN_ADDRESS
} from '@/lib/constants';

// Import the staking program ID from constants
import { STAKING_PROGRAM_ID as PROGRAM_ID_STRING } from '@/lib/constants';

// Convert the program ID string to a PublicKey object
const STAKING_PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);

// Instructions enum matching our Rust program
enum StakingInstructionType {
  Initialize = 0,
  Stake = 1,
  Unstake = 2,
  Harvest = 3,
  UpdateParameters = 4
}

// Find Program Derived Addresses
function findProgramStateAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('program_state')],
    STAKING_PROGRAM_ID
  );
}

function findStakingAccountAddress(walletAddress: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('staking_account'), walletAddress.toBuffer()],
    STAKING_PROGRAM_ID
  );
}

function findProgramAuthorityAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    STAKING_PROGRAM_ID
  );
}

// Encode instructions - we use these functions to create the serialized instruction data
// that matches our Rust program's Borsh deserialization

function encodeInitializeInstruction(
  yotMint: PublicKey,
  yosMint: PublicKey,
  stakeRatePerSecond: number,
  harvestThreshold: number
): Buffer {
  // Create instruction type byte
  const instructionBuffer = Buffer.from([StakingInstructionType.Initialize]);
  
  // Create pubkey bytes
  const yotMintBuffer = Buffer.from(yotMint.toBytes());
  const yosMintBuffer = Buffer.from(yosMint.toBytes());
  
  // Create rate and threshold bytes
  const rateBuffer = Buffer.from(new BigUint64Array([BigInt(stakeRatePerSecond)]).buffer);
  const thresholdBuffer = Buffer.from(new BigUint64Array([BigInt(harvestThreshold)]).buffer);
  
  // Concatenate all buffers
  return Buffer.concat([
    instructionBuffer,
    yotMintBuffer,
    yosMintBuffer,
    rateBuffer,
    thresholdBuffer
  ]);
}

function encodeStakeInstruction(amount: number): Buffer {
  // Create instruction type byte
  const instructionBuffer = Buffer.from([StakingInstructionType.Stake]);
  
  // Create amount bytes
  const amountBuffer = Buffer.from(new BigUint64Array([BigInt(amount)]).buffer);
  
  // Concatenate buffers
  return Buffer.concat([instructionBuffer, amountBuffer]);
}

function encodeUnstakeInstruction(amount: number): Buffer {
  // Create instruction type byte
  const instructionBuffer = Buffer.from([StakingInstructionType.Unstake]);
  
  // Create amount bytes
  const amountBuffer = Buffer.from(new BigUint64Array([BigInt(amount)]).buffer);
  
  // Concatenate buffers
  return Buffer.concat([instructionBuffer, amountBuffer]);
}

function encodeHarvestInstruction(): Buffer {
  return Buffer.from([StakingInstructionType.Harvest]);
}

function encodeUpdateParametersInstruction(
  stakeRatePerSecond: number,
  harvestThreshold: number
): Buffer {
  // Create instruction type byte
  const instructionBuffer = Buffer.from([StakingInstructionType.UpdateParameters]);
  
  // Create rate and threshold bytes
  const rateBuffer = Buffer.from(new BigUint64Array([BigInt(stakeRatePerSecond)]).buffer);
  const thresholdBuffer = Buffer.from(new BigUint64Array([BigInt(harvestThreshold)]).buffer);
  
  // Concatenate buffers
  return Buffer.concat([instructionBuffer, rateBuffer, thresholdBuffer]);
}

// Client functions that interface with our Solana program
// All these functions require wallet signatures for security

/**
 * Initialize the staking program (admin only)
 */
export async function initializeStakingProgram(
  adminWallet: any,
  stakeRatePerSecond: number,
  harvestThreshold: number
): Promise<string> {
  try {
    // Validate parameters
    if (!adminWallet || !adminWallet.publicKey) {
      throw new Error('Admin wallet not connected');
    }
    
    const adminPublicKey = adminWallet.publicKey;
    const yotMintPubkey = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMintPubkey = new PublicKey(YOS_TOKEN_ADDRESS);
    
    // Find program state address
    const [programStateAddress] = findProgramStateAddress();
    
    // Create transaction instruction
    const initInstruction = new TransactionInstruction({
      keys: [
        { pubkey: adminPublicKey, isSigner: true, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId: STAKING_PROGRAM_ID,
      data: encodeInitializeInstruction(
        yotMintPubkey,
        yosMintPubkey, 
        stakeRatePerSecond,
        harvestThreshold
      )
    });
    
    // Create transaction
    const transaction = new Transaction().add(initInstruction);
    
    // Set recent blockhash and fee payer
    transaction.feePayer = adminPublicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Request signature from admin (this triggers a wallet signature request)
    const signedTransaction = await adminWallet.signTransaction(transaction);
    
    // Send signed transaction
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    // Confirm transaction
    await connection.confirmTransaction(signature, 'confirmed');
    
    toast({
      title: "Staking Program Initialized",
      description: "The staking program has been initialized successfully."
    });
    
    return signature;
  } catch (error) {
    console.error('Error initializing staking program:', error);
    toast({
      title: "Initialization Failed",
      description: error.message,
      variant: "destructive"
    });
    throw error;
  }
}

/**
 * Stake YOT tokens
 */
export async function stakeYOTTokens(
  wallet: any,
  amount: number
): Promise<string> {
  try {
    // Validate parameters
    if (!wallet || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    
    const userPublicKey = wallet.publicKey;
    const yotMintPubkey = new PublicKey(YOT_TOKEN_ADDRESS);
    
    // Find staking account address
    const [stakingAccountAddress] = findStakingAccountAddress(userPublicKey);
    
    // Find program state address
    const [programStateAddress] = findProgramStateAddress();
    
    // Find program authority
    const [programAuthority] = findProgramAuthorityAddress();
    
    // Get token accounts
    const userYotTokenAccount = await getAssociatedTokenAddress(
      yotMintPubkey,
      userPublicKey
    );
    
    const programYotTokenAccount = await getAssociatedTokenAddress(
      yotMintPubkey,
      programAuthority,
      true // allowOwnerOffCurve
    );
    
    // Check if program token account exists
    let transaction = new Transaction();
    const programAccountInfo = await connection.getAccountInfo(programYotTokenAccount);
    
    if (!programAccountInfo) {
      // Create associated token account for program
      transaction.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          programYotTokenAccount,
          programAuthority,
          yotMintPubkey
        )
      );
    }
    
    // Create stake instruction
    const stakeInstruction = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: userYotTokenAccount, isSigner: false, isWritable: true },
        { pubkey: programYotTokenAccount, isSigner: false, isWritable: true },
        { pubkey: stakingAccountAddress, isSigner: false, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId: STAKING_PROGRAM_ID,
      data: encodeStakeInstruction(amount)
    });
    
    // Add stake instruction to transaction
    transaction.add(stakeInstruction);
    
    // Set recent blockhash and fee payer
    transaction.feePayer = userPublicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Request signature from user (this triggers a wallet signature request)
    const signedTransaction = await wallet.signTransaction(transaction);
    
    // Send signed transaction
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    // Confirm transaction
    await connection.confirmTransaction(signature, 'confirmed');
    
    toast({
      title: "Tokens Staked",
      description: `You have successfully staked ${amount} YOT tokens.`
    });
    
    return signature;
  } catch (error) {
    console.error('Error staking tokens:', error);
    toast({
      title: "Staking Failed",
      description: error.message,
      variant: "destructive"
    });
    throw error;
  }
}

/**
 * Unstake YOT tokens
 */
export async function unstakeYOTTokens(
  wallet: any,
  amount: number
): Promise<string> {
  try {
    // Validate parameters
    if (!wallet || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    
    const userPublicKey = wallet.publicKey;
    const yotMintPubkey = new PublicKey(YOT_TOKEN_ADDRESS);
    
    // Find staking account address
    const [stakingAccountAddress] = findStakingAccountAddress(userPublicKey);
    
    // Find program state address
    const [programStateAddress] = findProgramStateAddress();
    
    // Find program authority
    const [programAuthority] = findProgramAuthorityAddress();
    
    // Get token accounts
    const userYotTokenAccount = await getAssociatedTokenAddress(
      yotMintPubkey,
      userPublicKey
    );
    
    const programYotTokenAccount = await getAssociatedTokenAddress(
      yotMintPubkey,
      programAuthority,
      true // allowOwnerOffCurve
    );
    
    // Create unstake instruction
    const unstakeInstruction = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: userYotTokenAccount, isSigner: false, isWritable: true },
        { pubkey: programYotTokenAccount, isSigner: false, isWritable: true },
        { pubkey: stakingAccountAddress, isSigner: false, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: programAuthority, isSigner: false, isWritable: false }
      ],
      programId: STAKING_PROGRAM_ID,
      data: encodeUnstakeInstruction(amount)
    });
    
    // Create transaction
    const transaction = new Transaction().add(unstakeInstruction);
    
    // Set recent blockhash and fee payer
    transaction.feePayer = userPublicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Request signature from user (this triggers a wallet signature request)
    const signedTransaction = await wallet.signTransaction(transaction);
    
    // Send signed transaction
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    // Confirm transaction
    await connection.confirmTransaction(signature, 'confirmed');
    
    toast({
      title: "Tokens Unstaked",
      description: `You have successfully unstaked ${amount} YOT tokens.`
    });
    
    return signature;
  } catch (error) {
    console.error('Error unstaking tokens:', error);
    toast({
      title: "Unstaking Failed",
      description: error.message,
      variant: "destructive"
    });
    throw error;
  }
}

/**
 * Harvest YOS rewards
 */
export async function harvestYOSRewards(wallet: any): Promise<string> {
  try {
    // Validate parameters
    if (!wallet || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    const userPublicKey = wallet.publicKey;
    const yosMintPubkey = new PublicKey(YOS_TOKEN_ADDRESS);
    
    // Find staking account address
    const [stakingAccountAddress] = findStakingAccountAddress(userPublicKey);
    
    // Find program state address
    const [programStateAddress] = findProgramStateAddress();
    
    // Find program authority
    const [programAuthority] = findProgramAuthorityAddress();
    
    // Get token accounts
    const userYosTokenAccount = await getAssociatedTokenAddress(
      yosMintPubkey,
      userPublicKey
    );
    
    const programYosTokenAccount = await getAssociatedTokenAddress(
      yosMintPubkey,
      programAuthority,
      true // allowOwnerOffCurve
    );
    
    // Check if user YOS token account exists
    let transaction = new Transaction();
    const userAccountInfo = await connection.getAccountInfo(userYosTokenAccount);
    
    if (!userAccountInfo) {
      // Create associated token account for user
      transaction.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          userYosTokenAccount,
          userPublicKey,
          yosMintPubkey
        )
      );
    }
    
    // Create harvest instruction
    const harvestInstruction = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: userYosTokenAccount, isSigner: false, isWritable: true },
        { pubkey: programYosTokenAccount, isSigner: false, isWritable: true },
        { pubkey: stakingAccountAddress, isSigner: false, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: programAuthority, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }
      ],
      programId: STAKING_PROGRAM_ID,
      data: encodeHarvestInstruction()
    });
    
    // Add harvest instruction to transaction
    transaction.add(harvestInstruction);
    
    // Set recent blockhash and fee payer
    transaction.feePayer = userPublicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Request signature from user (this triggers a wallet signature request)
    const signedTransaction = await wallet.signTransaction(transaction);
    
    // Send signed transaction
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    // Confirm transaction
    await connection.confirmTransaction(signature, 'confirmed');
    
    toast({
      title: "Rewards Harvested",
      description: "You have successfully harvested your YOS rewards."
    });
    
    return signature;
  } catch (error) {
    console.error('Error harvesting rewards:', error);
    toast({
      title: "Harvesting Failed",
      description: error.message,
      variant: "destructive"
    });
    throw error;
  }
}

/**
 * Update staking parameters (admin only)
 */
export async function updateStakingParameters(
  adminWallet: any,
  stakeRatePerSecond: number,
  harvestThreshold: number
): Promise<string> {
  try {
    // Validate parameters
    if (!adminWallet || !adminWallet.publicKey) {
      throw new Error('Admin wallet not connected');
    }
    
    const adminPublicKey = adminWallet.publicKey;
    
    // Find program state address
    const [programStateAddress] = findProgramStateAddress();
    
    // Create update parameters instruction
    const updateInstruction = new TransactionInstruction({
      keys: [
        { pubkey: adminPublicKey, isSigner: true, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: true }
      ],
      programId: STAKING_PROGRAM_ID,
      data: encodeUpdateParametersInstruction(stakeRatePerSecond, harvestThreshold)
    });
    
    // Create transaction
    const transaction = new Transaction().add(updateInstruction);
    
    // Set recent blockhash and fee payer
    transaction.feePayer = adminPublicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Request signature from admin (this triggers a wallet signature request)
    const signedTransaction = await adminWallet.signTransaction(transaction);
    
    // Send signed transaction
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    // Confirm transaction
    await connection.confirmTransaction(signature, 'confirmed');
    
    toast({
      title: "Parameters Updated",
      description: "Staking parameters have been updated successfully."
    });
    
    return signature;
  } catch (error) {
    console.error('Error updating parameters:', error);
    toast({
      title: "Update Failed",
      description: error.message,
      variant: "destructive"
    });
    throw error;
  }
}

/**
 * Get staking program state with rates information
 */
export async function getStakingProgramState(): Promise<{
  stakeRatePerSecond: number;
  harvestThreshold: number;
  dailyAPY: number;
  weeklyAPY: number;
  monthlyAPY: number;
  yearlyAPY: number;
}> {
  try {
    // Find program state address
    const [programStateAddress] = findProgramStateAddress();
    
    // Get program state account data
    const programStateInfo = await connection.getAccountInfo(programStateAddress);
    
    // If program state doesn't exist yet, return default values
    if (!programStateInfo) {
      return {
        stakeRatePerSecond: 0.00125, // Default 0.00125% per second
        harvestThreshold: 1,         // Default 1 YOS threshold for harvesting
        dailyAPY: 108,               // Default daily rate
        weeklyAPY: 756,              // Default weekly rate 
        monthlyAPY: 3240,            // Default monthly rate
        yearlyAPY: 39420             // Default yearly rate
      };
    }
    
    // Parse program state data
    // First 32 bytes are admin pubkey
    // Next 32 bytes are YOT mint pubkey
    // Next 32 bytes are YOS mint pubkey
    
    // Read stake rate (8 bytes, 64-bit unsigned integer)
    const stakeRatePerSecond = Number(programStateInfo.data.readBigUInt64LE(32 + 32 + 32)) / 10000;
    
    // Read harvest threshold (8 bytes, 64-bit unsigned integer)
    const harvestThreshold = Number(programStateInfo.data.readBigUInt64LE(32 + 32 + 32 + 8)) / 1000000;
    
    // Calculate compounded returns
    // For simplicity, we multiply the per-second rate by the number of seconds
    // A more precise calculation would compound: (1 + rate)^seconds - 1
    const secondsPerDay = 86400;
    const secondsPerWeek = secondsPerDay * 7;
    const secondsPerMonth = secondsPerDay * 30;
    const secondsPerYear = secondsPerDay * 365;
    
    // Calculate APY for different time periods
    const dailyAPY = stakeRatePerSecond * secondsPerDay * 100;
    const weeklyAPY = stakeRatePerSecond * secondsPerWeek * 100;
    const monthlyAPY = stakeRatePerSecond * secondsPerMonth * 100;
    const yearlyAPY = stakeRatePerSecond * secondsPerYear * 100;
    
    return {
      stakeRatePerSecond,
      harvestThreshold,
      dailyAPY,
      weeklyAPY,
      monthlyAPY,
      yearlyAPY
    };
  } catch (error) {
    console.error('Error fetching staking program state:', error);
    
    // Return default values on error
    return {
      stakeRatePerSecond: 0.00125, 
      harvestThreshold: 1,
      dailyAPY: 108,
      weeklyAPY: 756,
      monthlyAPY: 3240,
      yearlyAPY: 39420
    };
  }
}

/**
 * Get staking information for a user
 */
export async function getStakingInfo(walletAddress: PublicKey): Promise<{
  stakedAmount: number;
  startTimestamp: number;
  lastHarvestTime: number;
  totalHarvested: number;
  rewardsEarned: number;
}> {
  try {
    // Find staking account address
    const [stakingAccountAddress] = findStakingAccountAddress(walletAddress);
    
    // Get staking account data
    const accountInfo = await connection.getAccountInfo(stakingAccountAddress);
    
    // Return default values if account doesn't exist
    if (!accountInfo) {
      return {
        stakedAmount: 0,
        startTimestamp: 0,
        lastHarvestTime: 0,
        totalHarvested: 0,
        rewardsEarned: 0
      };
    }
    
    // Get program state to calculate rewards
    const [programStateAddress] = findProgramStateAddress();
    const programStateInfo = await connection.getAccountInfo(programStateAddress);
    
    if (!programStateInfo) {
      throw new Error('Program state not initialized');
    }
    
    // Parse staking account data
    // This is a simplified version - in a real implementation you'd use borsh deserialize
    const data = accountInfo.data;
    
    // First 32 bytes are the owner pubkey
    const owner = new PublicKey(data.slice(0, 32));
    
    // Read staked amount (8 bytes, 64-bit unsigned integer)
    const stakedAmount = data.readBigUInt64LE(32);
    
    // Read timestamps (8 bytes each, 64-bit signed integers)
    const startTimestamp = Number(data.readBigInt64LE(40));
    const lastHarvestTime = Number(data.readBigInt64LE(48));
    
    // Read total harvested rewards (8 bytes, 64-bit unsigned integer)
    const totalHarvested = Number(data.readBigUInt64LE(56));
    
    // Parse program state data
    const stakeRatePerSecond = Number(programStateInfo.data.readBigUInt64LE(32 + 32 + 32)) / 10000;
    
    // Calculate current time
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Calculate pending rewards
    const timeStakedSinceLastHarvest = currentTime - lastHarvestTime;
    const pendingRewards = Number(stakedAmount) * timeStakedSinceLastHarvest * stakeRatePerSecond;
    
    return {
      stakedAmount: Number(stakedAmount),
      startTimestamp: startTimestamp,
      lastHarvestTime: lastHarvestTime,
      totalHarvested: totalHarvested,
      rewardsEarned: pendingRewards
    };
  } catch (error) {
    console.error('Error getting staking info:', error);
    
    // Return empty data on error
    return {
      stakedAmount: 0,
      startTimestamp: 0,
      lastHarvestTime: 0,
      totalHarvested: 0,
      rewardsEarned: 0
    };
  }
}