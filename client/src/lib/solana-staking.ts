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
    [Buffer.from('state')], // Changed to match Rust program seed
    STAKING_PROGRAM_ID
  );
}

function findStakingAccountAddress(walletAddress: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('staking'), walletAddress.toBuffer()],
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
  // Create a buffer to hold all data
  // 1 byte for instruction type + 32 bytes for yotMint + 32 bytes for yosMint + 8 bytes for rate + 8 bytes for threshold
  const buffer = Buffer.alloc(1 + 32 + 32 + 8 + 8);
  
  // Write instruction type to the first byte
  buffer.writeUInt8(StakingInstructionType.Initialize, 0);
  
  // Write YOT mint pubkey bytes (32 bytes)
  buffer.set(yotMint.toBytes(), 1);
  
  // Write YOS mint pubkey bytes (32 bytes)
  buffer.set(yosMint.toBytes(), 33);
  
  // Write rate as little-endian u64 (8 bytes)
  buffer.writeBigUInt64LE(BigInt(stakeRatePerSecond), 65);
  
  // Write threshold as little-endian u64 (8 bytes)
  buffer.writeBigUInt64LE(BigInt(harvestThreshold), 73);
  
  return buffer;
}

function encodeStakeInstruction(amount: number): Buffer {
  // Create a buffer to hold all data
  // 1 byte for instruction type + 8 bytes for amount (u64)
  const buffer = Buffer.alloc(1 + 8);
  
  // Write instruction type to the first byte
  buffer.writeUInt8(StakingInstructionType.Stake, 0);
  
  // Write amount as little-endian u64 (8 bytes)
  // JavaScript can only handle 53 bits safely, so we're using writeBigUInt64LE
  buffer.writeBigUInt64LE(BigInt(amount), 1);
  
  return buffer;
}

function encodeUnstakeInstruction(amount: number): Buffer {
  // Create a buffer to hold all data
  // 1 byte for instruction type + 8 bytes for amount (u64)
  const buffer = Buffer.alloc(1 + 8);
  
  // Write instruction type to the first byte
  buffer.writeUInt8(StakingInstructionType.Unstake, 0);
  
  // Write amount as little-endian u64 (8 bytes)
  buffer.writeBigUInt64LE(BigInt(amount), 1);
  
  return buffer;
}

function encodeHarvestInstruction(): Buffer {
  // Create a buffer with just the instruction type
  const buffer = Buffer.alloc(1);
  
  // Write instruction type to the buffer
  buffer.writeUInt8(StakingInstructionType.Harvest, 0);
  
  return buffer;
}

function encodeUpdateParametersInstruction(
  stakeRatePerSecond: number,
  harvestThreshold: number
): Buffer {
  // Create a buffer to hold all data
  // 1 byte for instruction type + 8 bytes for rate + 8 bytes for threshold
  const buffer = Buffer.alloc(1 + 8 + 8);
  
  // Write instruction type to the first byte
  buffer.writeUInt8(StakingInstructionType.UpdateParameters, 0);
  
  // Write rate as little-endian u64 (8 bytes)
  buffer.writeBigUInt64LE(BigInt(stakeRatePerSecond), 1);
  
  // Write threshold as little-endian u64 (8 bytes)
  buffer.writeBigUInt64LE(BigInt(harvestThreshold), 9);
  
  return buffer;
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
 * Stake YOT tokens using the deployed program
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
    
    // Get the user's token account
    const userYotTokenAccount = await getAssociatedTokenAddress(
      yotMintPubkey,
      userPublicKey
    );

    // Find program state address
    const [programStateAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      STAKING_PROGRAM_ID
    );
    
    // Find user staking account address
    const [userStakingAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('staking'), userPublicKey.toBuffer()],
      STAKING_PROGRAM_ID
    );
    
    // Find program authority address
    const [programAuthorityAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority')],
      STAKING_PROGRAM_ID
    );
    
    // Get program token account
    const programYotTokenAccount = await getAssociatedTokenAddress(
      yotMintPubkey,
      programAuthorityAddress,
      true // allowOwnerOffCurve
    );
    
    // Create the stake instruction
    const stakeInstruction = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: userYotTokenAccount, isSigner: false, isWritable: true },
        { pubkey: programYotTokenAccount, isSigner: false, isWritable: true },
        { pubkey: userStakingAddress, isSigner: false, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
      ],
      programId: STAKING_PROGRAM_ID,
      data: encodeStakeInstruction(amount)
    });
    
    // Create transaction
    let transaction = new Transaction().add(stakeInstruction);
    
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
      title: "Staking Successful",
      description: `You have staked ${amount} YOT tokens successfully.`
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
 * Unstake YOT tokens using the deployed program
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
    
    // Get the user's token account
    const userYotTokenAccount = await getAssociatedTokenAddress(
      yotMintPubkey,
      userPublicKey
    );
    
    // Find program state address
    const [programStateAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      STAKING_PROGRAM_ID
    );
    
    // Find user staking account address
    const [userStakingAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('staking'), userPublicKey.toBuffer()],
      STAKING_PROGRAM_ID
    );
    
    // Find program authority address
    const [programAuthorityAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority')],
      STAKING_PROGRAM_ID
    );
    
    // Get program token account
    const programYotTokenAccount = await getAssociatedTokenAddress(
      yotMintPubkey,
      programAuthorityAddress,
      true // allowOwnerOffCurve
    );
    
    // Create the unstake instruction
    const unstakeInstruction = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: userYotTokenAccount, isSigner: false, isWritable: true },
        { pubkey: programYotTokenAccount, isSigner: false, isWritable: true },
        { pubkey: userStakingAddress, isSigner: false, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: false }
      ],
      programId: STAKING_PROGRAM_ID,
      data: encodeUnstakeInstruction(amount)
    });
    
    // Create transaction
    let transaction = new Transaction().add(unstakeInstruction);
    
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
      title: "Unstaking Successful",
      description: `You have unstaked ${amount} YOT tokens successfully.`
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
 * Harvest YOS rewards using the deployed program
 */
export async function harvestYOSRewards(wallet: any): Promise<string> {
  try {
    // Validate parameters
    if (!wallet || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    const userPublicKey = wallet.publicKey;
    const yosMintPubkey = new PublicKey(YOS_TOKEN_ADDRESS);
    
    // Get the user's token account
    const userYosTokenAccount = await getAssociatedTokenAddress(
      yosMintPubkey,
      userPublicKey
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
    
    // Find program state address
    const [programStateAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      STAKING_PROGRAM_ID
    );
    
    // Find user staking account address
    const [userStakingAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('staking'), userPublicKey.toBuffer()],
      STAKING_PROGRAM_ID
    );
    
    // Find program authority address
    const [programAuthorityAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority')],
      STAKING_PROGRAM_ID
    );
    
    // Get program token account for YOS
    const programYosTokenAccount = await getAssociatedTokenAddress(
      yosMintPubkey,
      programAuthorityAddress,
      true // allowOwnerOffCurve
    );
    
    // Create the harvest instruction
    const harvestInstruction = new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: userYosTokenAccount, isSigner: false, isWritable: true },
        { pubkey: programYosTokenAccount, isSigner: false, isWritable: true },
        { pubkey: userStakingAddress, isSigner: false, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: false },
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
      title: "Harvest Successful",
      description: "You have harvested your YOS rewards successfully."
    });
    
    return signature;
  } catch (error) {
    console.error('Error harvesting rewards:', error);
    toast({
      title: "Harvest Failed",
      description: error.message,
      variant: "destructive"
    });
    throw error;
  }
}

/**
 * Update staking parameters (admin only) using deployed program
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
    const [programStateAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      STAKING_PROGRAM_ID
    );
    
    // Convert to basis points for on-chain storage
    // Rate: multiply by 10000 to store as basis points
    // Threshold: multiply by 1000000 to store as lamports
    const rateInBasisPoints = Math.floor(stakeRatePerSecond * 10000);
    const thresholdInLamports = Math.floor(harvestThreshold * 1000000);
    
    // Create update parameters instruction
    const updateInstruction = new TransactionInstruction({
      keys: [
        { pubkey: adminPublicKey, isSigner: true, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: true }
      ],
      programId: STAKING_PROGRAM_ID,
      data: encodeUpdateParametersInstruction(rateInBasisPoints, thresholdInLamports)
    });
    
    // Create transaction
    let transaction = new Transaction().add(updateInstruction);
    
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
export async function getStakingInfo(walletAddressStr: string): Promise<{
  stakedAmount: number;
  startTimestamp: number;
  lastHarvestTime: number;
  totalHarvested: number;
  rewardsEarned: number;
}> {
  try {
    // Convert string to PublicKey
    const walletPublicKey = new PublicKey(walletAddressStr);
    
    // Find staking account address
    const [stakingAccountAddress] = findStakingAccountAddress(walletPublicKey);
    
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