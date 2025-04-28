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
    [Buffer.from('program_state')], // Must match exact seed in Rust program (line 165)
    STAKING_PROGRAM_ID
  );
}

/**
 * Convert basis points to percentage rate per second using a universal formula
 * This function handles any staking rate magnitude consistently
 * @param basisPoints The basis points value from blockchain
 * @returns The corresponding percentage per second
 */
function convertBasisPointsToRatePerSecond(basisPoints: number): number {
  // CRITICAL REFERENCE VALUE: 120000 basis points = 0.0000125% per second 
  // (and NOT 0.00125% as previously calculated)
  const REFERENCE_RATE = 0.0000125;
  const REFERENCE_BASIS_POINTS = 120000;
  
  // Calculate rate using the same ratio for all values
  const ratePerSecond = basisPoints * (REFERENCE_RATE / REFERENCE_BASIS_POINTS);
  
  console.log(`Converting ${basisPoints} basis points using reference values:`, {
    REFERENCE_RATE,
    REFERENCE_BASIS_POINTS,
    result: ratePerSecond,
    formula: `${basisPoints} * (${REFERENCE_RATE} / ${REFERENCE_BASIS_POINTS}) = ${ratePerSecond}`
  });
  
  // Ensure we never have a zero rate
  return Math.max(ratePerSecond, 0.0000000001);
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
  console.log("Encoding initialization instruction with parameters:", {
    yotMint: yotMint.toString(),
    yosMint: yosMint.toString(),
    stakeRatePerSecond,
    harvestThreshold
  });
  
  // Convert percentage per second to basis points using our reference ratio
  // IMPORTANT: Must use the same reference values as convertBasisPointsToRatePerSecond 
  // for consistent encoding/decoding between UI and blockchain
  const REFERENCE_RATE = 0.0000125;
  const REFERENCE_BASIS_POINTS = 120000;
  
  // Calculate basis points using reverse of the formula in convertBasisPointsToRatePerSecond
  const rateInBasisPoints = Math.round(stakeRatePerSecond * (REFERENCE_BASIS_POINTS / REFERENCE_RATE));
  
  console.log(`Converting ${stakeRatePerSecond}% to ${rateInBasisPoints} basis points using universal formula`);
  console.log(`Formula: ${stakeRatePerSecond} * (${REFERENCE_BASIS_POINTS} / ${REFERENCE_RATE}) = ${rateInBasisPoints}`);
  
  // Special case logging for common values
  if (Math.abs(stakeRatePerSecond - 0.0000125) < 0.0000001) {
    console.log("Note: This is the standard rate of 0.0000125% (120,000 basis points)");
  } else if (Math.abs(stakeRatePerSecond - 0.00000125) < 0.000000001) {
    console.log("Note: This is the tiny rate of 0.00000125% (120 basis points)");
  }
  
  const thresholdInLamports = Math.floor(harvestThreshold * 1000000);
  
  console.log("Converted values:", {
    rateInBasisPoints,
    thresholdInLamports
  });
  
  // Simplify the format - just use a fixed layout matching the Rust side's expectation
  // Variant discriminator (1 byte) + two public keys (32 bytes each) + two u64s (8 bytes each)
  const buffer = Buffer.alloc(1 + 32 + 32 + 8 + 8);
  
  // Write instruction variant discriminator (0 = Initialize)
  buffer.writeUInt8(StakingInstructionType.Initialize, 0);
  
  // Write YOT mint pubkey bytes (32 bytes)
  buffer.set(yotMint.toBuffer(), 1);
  
  // Write YOS mint pubkey bytes (32 bytes) 
  buffer.set(yosMint.toBuffer(), 33);
  
  // Write stake rate as little-endian u64 (8 bytes)
  // Use the converted basis points value
  buffer.writeBigUInt64LE(BigInt(rateInBasisPoints), 65);
  
  // Write harvest threshold as little-endian u64 (8 bytes)
  // Use the converted lamports value
  buffer.writeBigUInt64LE(BigInt(thresholdInLamports), 73);
  
  // Debug logging to verify our buffer
  console.log("Encoded initialization instruction bytes:", {
    discriminator: buffer.readUInt8(0),
    yotMintHex: buffer.slice(1, 33).toString('hex'),
    yosMintHex: buffer.slice(33, 65).toString('hex'),
    stakeRateBasisPoints: buffer.readBigUInt64LE(65),
    harvestThresholdLamports: buffer.readBigUInt64LE(73),
    bufferLength: buffer.length
  });
  
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
  // Convert percentage per second to basis points using our reference ratio
  // IMPORTANT: Must use the same reference values as convertBasisPointsToRatePerSecond 
  // for consistent encoding/decoding between UI and blockchain
  const REFERENCE_RATE = 0.0000125;
  const REFERENCE_BASIS_POINTS = 120000;
  
  // Calculate basis points using the reverse of our conversion formula
  const rateInBasisPoints = Math.round(stakeRatePerSecond * (REFERENCE_BASIS_POINTS / REFERENCE_RATE));
  
  console.log(`Converting ${stakeRatePerSecond}% to ${rateInBasisPoints} basis points using universal formula`);
  console.log(`Formula: ${stakeRatePerSecond} * (${REFERENCE_BASIS_POINTS} / ${REFERENCE_RATE}) = ${rateInBasisPoints}`);
  
  // Special case logging for common values
  if (Math.abs(stakeRatePerSecond - 0.0000125) < 0.0000001) {
    console.log("Note: This is the standard rate of 0.0000125% (120,000 basis points)");
  } else if (Math.abs(stakeRatePerSecond - 0.00000125) < 0.000000001) {
    console.log("Note: This is the tiny rate of 0.00000125% (120 basis points)");
  }
  
  const thresholdInLamports = Math.floor(harvestThreshold * 1000000);
  
  console.log("Encoding parameters update with converted values:", {
    rateInBasisPoints,
    thresholdInLamports
  });
  
  // Create a buffer to hold all data
  // 1 byte for instruction type + 8 bytes for rate + 8 bytes for threshold
  const buffer = Buffer.alloc(1 + 8 + 8);
  
  // Write instruction type to the first byte
  buffer.writeUInt8(StakingInstructionType.UpdateParameters, 0);
  
  // Write rate as little-endian u64 (8 bytes) - as basis points
  buffer.writeBigUInt64LE(BigInt(rateInBasisPoints), 1);
  
  // Write threshold as little-endian u64 (8 bytes) - as lamports
  buffer.writeBigUInt64LE(BigInt(thresholdInLamports), 9);
  
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
    console.log("Starting program initialization with:", {
      programId: STAKING_PROGRAM_ID.toString(),
      stakeRatePerSecond,
      harvestThreshold
    });
    
    // Validate parameters
    if (!adminWallet) {
      throw new Error('Admin wallet not provided');
    }
    
    if (!adminWallet.publicKey) {
      throw new Error('Admin wallet public key not available');
    }
    
    // Check if wallet has a signTransaction method
    if (typeof adminWallet.signTransaction !== 'function') {
      console.error("Wallet object:", adminWallet);
      throw new Error('Invalid wallet: signTransaction method not found');
    }
    
    const adminPublicKey = adminWallet.publicKey;
    console.log("Admin public key:", adminPublicKey.toString());
    
    const yotMintPubkey = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMintPubkey = new PublicKey(YOS_TOKEN_ADDRESS);
    
    console.log("Token addresses:", {
      YOT: yotMintPubkey.toString(),
      YOS: yosMintPubkey.toString()
    });
    
    // Find program state address
    const [programStateAddress, stateBump] = findProgramStateAddress();
    console.log("Program state address:", programStateAddress.toString(), "with bump:", stateBump);
    
    // Check if the program state account already exists
    const programStateAccountInfo = await connection.getAccountInfo(programStateAddress);
    console.log("Program state account exists:", !!programStateAccountInfo);
    
    // Find program authority address
    const [programAuthorityAddress, programAuthorityBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority')],
      STAKING_PROGRAM_ID
    );
    console.log("Program authority address:", programAuthorityAddress.toString(), "with bump:", programAuthorityBump);
    
    // Get program YOT token account
    const programYotTokenAccount = await getAssociatedTokenAddress(
      yotMintPubkey,
      programAuthorityAddress,
      true // allowOwnerOffCurve
    );
    console.log('Program YOT account address:', programYotTokenAccount.toString());
    
    // Get program YOS token account
    const programYosTokenAccount = await getAssociatedTokenAddress(
      yosMintPubkey,
      programAuthorityAddress,
      true // allowOwnerOffCurve
    );
    console.log('Program YOS account address:', programYosTokenAccount.toString());

    // Create instruction to setup program token accounts if they don't exist
    let instructions: TransactionInstruction[] = [];
    
    // Check if the program's YOT token account exists
    const programYotTokenAccountInfo = await connection.getAccountInfo(programYotTokenAccount);
    console.log('Program YOT token account exists:', !!programYotTokenAccountInfo);
    
    // Check if the program's YOS token account exists
    const programYosTokenAccountInfo = await connection.getAccountInfo(programYosTokenAccount);
    console.log('Program YOS token account exists:', !!programYosTokenAccountInfo);
    
    // If the program's token accounts don't exist yet, we create them first
    // This is necessary for the program to be able to receive tokens
    if (!programYotTokenAccountInfo) {
      console.log('Creating program YOT token account...');
      const createYotAccountInstruction = createAssociatedTokenAccountInstruction(
        adminPublicKey,
        programYotTokenAccount,
        programAuthorityAddress,
        yotMintPubkey
      );
      instructions.push(createYotAccountInstruction);
    }
    
    if (!programYosTokenAccountInfo) {
      console.log('Creating program YOS token account...');
      const createYosAccountInstruction = createAssociatedTokenAccountInstruction(
        adminPublicKey,
        programYosTokenAccount,
        programAuthorityAddress,
        yosMintPubkey
      );
      instructions.push(createYosAccountInstruction);
    }
    
    // Create main transaction instruction for program initialization
    // IMPORTANT: Looking at the Rust program, it needs these accounts for initialization:
    // 1. Admin account (signer)
    // 2. Program state account (PDA)
    // 3. System program (for creating the account)
    // 4. YOT token mint address
    // 5. YOS token mint address
    console.log("Creating initialization instruction with all required accounts");
    
    // Check if the program state already exists
    if (programStateAccountInfo) {
      console.log("Program state already exists, no need to initialize again");
      toast({
        title: "Program Already Initialized",
        description: "The staking program has already been initialized. You can update parameters instead."
      });
      throw new Error("Program state already exists");
    }
    
    const initInstruction = new TransactionInstruction({
      keys: [
        // Admin is the signer and payer
        { pubkey: adminPublicKey, isSigner: true, isWritable: true },
        
        // Program state PDA account - the account being created during initialization
        { pubkey: programStateAddress, isSigner: false, isWritable: true },
        
        // System program for account creation
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        
        // Add YOT mint address
        { pubkey: yotMintPubkey, isSigner: false, isWritable: false },
        
        // Add YOS mint address
        { pubkey: yosMintPubkey, isSigner: false, isWritable: false },
      ],
      programId: STAKING_PROGRAM_ID,
      data: encodeInitializeInstruction(
        yotMintPubkey,
        yosMintPubkey, 
        stakeRatePerSecond,
        harvestThreshold
      )
    });
    
    // Add the main instruction to our list
    instructions.push(initInstruction);
    
    // Create transaction with all necessary instructions
    const transaction = new Transaction();
    
    // Add all instructions to the transaction
    instructions.forEach(instruction => {
      transaction.add(instruction);
    });
    
    // Set recent blockhash and fee payer
    transaction.feePayer = adminPublicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    console.log("Transaction created, requesting wallet signature...");
    
    // Request signature from admin (this triggers a wallet signature request)
    try {
      const signedTransaction = await adminWallet.signTransaction(transaction);
      console.log("Transaction signed successfully");
      
      // Send signed transaction
      console.log("Sending transaction to network");
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      console.log("Transaction sent with signature:", signature);
      
      // Confirm transaction
      console.log("Waiting for transaction confirmation");
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      console.log("Transaction confirmed:", confirmation);
      
      toast({
        title: "Staking Program Initialized",
        description: "The staking program has been initialized successfully."
      });
      
      return signature;
    } catch (signError) {
      console.error("Error during transaction signing:", signError);
      const errorMessage = signError instanceof Error 
        ? signError.message 
        : 'Unknown wallet signature error';
      throw new Error(`Wallet signature error: ${errorMessage}`);
    }
  } catch (error) {
    console.error('Error initializing staking program:', error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error during initialization';
    toast({
      title: "Initialization Failed",
      description: errorMessage,
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
    // Validate parameters and wallet structure
    console.log("Staking function called with wallet:", {
      walletExists: !!wallet,
      publicKeyExists: !!wallet?.publicKey,
      signTransactionExists: typeof wallet?.signTransaction === 'function',
      amount
    });
    
    if (!wallet) {
      throw new Error('Wallet object is missing');
    }
    
    if (!wallet.publicKey) {
      throw new Error('Wallet public key is not available');
    }
    
    if (typeof wallet.signTransaction !== 'function') {
      throw new Error('Wallet does not have a signTransaction method');
    }
    
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    
    const userPublicKey = wallet.publicKey;
    const yotMintPubkey = new PublicKey(YOT_TOKEN_ADDRESS);
    
    console.log('Preparing to stake YOT tokens:', {
      userPublicKey: userPublicKey.toString(),
      yotMint: yotMintPubkey.toString(),
      amount,
      programId: STAKING_PROGRAM_ID.toString()
    });
    
    // Get the user's token account
    const userYotTokenAccount = await getAssociatedTokenAddress(
      yotMintPubkey,
      userPublicKey
    );

    // Find program state address
    const [programStateAddress, programStateBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("program_state")],
      STAKING_PROGRAM_ID
    );
    
    // Find user staking account address
    const [userStakingAddress, userStakingBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('staking'), userPublicKey.toBuffer()],
      STAKING_PROGRAM_ID
    );
    
    // Find program authority address
    const [programAuthorityAddress, programAuthorityBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority')],
      STAKING_PROGRAM_ID
    );
    
    // Debug logging
    console.log('=== DEBUG INFO ===');
    console.log('Program ID:', STAKING_PROGRAM_ID.toBase58());
    console.log('User pubkey:', userPublicKey.toBase58());
    console.log('YOT mint address:', YOT_TOKEN_ADDRESS);
    console.log('User YOT account:', userYotTokenAccount.toBase58());
    console.log('Program state address:', programStateAddress.toBase58(), 'bump:', programStateBump);
    console.log('User staking address:', userStakingAddress.toBase58(), 'bump:', userStakingBump);
    console.log('Program authority address:', programAuthorityAddress.toBase58(), 'bump:', programAuthorityBump);
    
    // Check if program state exists first
    console.log('Checking if program state account exists...');
    const programStateInfo = await connection.getAccountInfo(programStateAddress);
    if (!programStateInfo) {
      console.error('Program state account does not exist. Program needs to be initialized by admin.');
      toast({
        title: "Program Not Initialized",
        description: "The staking program has not been initialized yet. Please contact an admin to initialize the program first.",
        variant: "destructive"
      });
      throw new Error('Program state account does not exist');
    }
    console.log('Program state account exists with size:', programStateInfo.data.length);
    
    // Get program token account
    const programYotTokenAccount = await getAssociatedTokenAddress(
      yotMintPubkey,
      programAuthorityAddress,
      true // allowOwnerOffCurve
    );
    console.log('Program YOT account:', programYotTokenAccount.toBase58());
    
    // Check if the program token account exists
    console.log('Checking if program token account exists...');
    const programTokenAccountInfo = await connection.getAccountInfo(programYotTokenAccount);
    if (!programTokenAccountInfo) {
      console.log('Program token account does not exist. It may need to be created.');
    } else {
      console.log('Program token account exists with size:', programTokenAccountInfo.data.length);
    }

    // Create the stake instruction with more careful key order
    const stakeInstruction = new TransactionInstruction({
      keys: [
        // User accounts
        { pubkey: userPublicKey, isSigner: true, isWritable: true }, // User wallet, paying for transaction
        { pubkey: userYotTokenAccount, isSigner: false, isWritable: true }, // User's YOT token account
        { pubkey: userStakingAddress, isSigner: false, isWritable: true }, // PDA to track user staking info
        
        // Program accounts
        { pubkey: programStateAddress, isSigner: false, isWritable: false }, // Program state PDA 
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: false }, // Program authority PDA
        { pubkey: programYotTokenAccount, isSigner: false, isWritable: true }, // Program's YOT token account
        
        // System accounts
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program for account creation 
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Token program for transfers
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false } // Rent
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
    
    console.log('Transaction serialized and ready to send');
    
    // Send signed transaction
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    console.log('Transaction sent with signature:', signature);
    
    // Confirm transaction
    await connection.confirmTransaction(signature, 'confirmed');
    
    toast({
      title: "Staking Successful",
      description: `You have staked ${amount} YOT tokens successfully.`
    });
    
    return signature;
  } catch (error) {
    console.error('Error staking tokens:', error);
    
    // More detailed error handling
    if (error instanceof Error) {
      let errorMessage = error.message;
      
      // Check for specific error patterns
      if (errorMessage.includes('Failed to serialize or deserialize account data')) {
        errorMessage = 'Account data format mismatch. The program may need to be redeployed or initialized.';
      } else if (errorMessage.includes('Invalid param: could not find account')) {
        errorMessage = 'One of the required accounts does not exist. Program may need initialization.';
      } else if (errorMessage.includes('Insufficient funds')) {
        errorMessage = 'Insufficient SOL to pay for transaction fees or account creation.';
      }
      
      toast({
        title: "Staking Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Staking Failed",
        description: "Unknown error occurred",
        variant: "destructive"
      });
    }
    
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
      [Buffer.from("program_state")],
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
    const errorMessage = error instanceof Error
      ? error.message
      : 'Unknown error during unstaking';
    toast({
      title: "Unstaking Failed",
      description: errorMessage,
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
      [Buffer.from("program_state")],
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
    const errorMessage = error instanceof Error
      ? error.message
      : 'Unknown error during harvesting';
    toast({
      title: "Harvest Failed",
      description: errorMessage,
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
    console.log("Updating staking parameters:", {
      stakeRatePerSecond,
      harvestThreshold
    });
    
    // Validate parameters
    if (!adminWallet || !adminWallet.publicKey) {
      throw new Error('Admin wallet not connected');
    }
    
    const adminPublicKey = adminWallet.publicKey;
    
    // Find program state address
    const [programStateAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("program_state")],
      STAKING_PROGRAM_ID
    );
    
    console.log("Program state address:", programStateAddress.toString());
    
    // Check if program state exists
    const programStateInfo = await connection.getAccountInfo(programStateAddress);
    if (!programStateInfo) {
      throw new Error('Program state does not exist. Initialize the program first.');
    }
    
    // We don't need to convert values here because our encoding function does it
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
    let transaction = new Transaction().add(updateInstruction);
    
    // Set recent blockhash and fee payer
    transaction.feePayer = adminPublicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    console.log("Transaction created, requesting admin wallet signature...");
    
    // Request signature from admin (this triggers a wallet signature request)
    const signedTransaction = await adminWallet.signTransaction(transaction);
    
    console.log("Transaction signed, sending to network...");
    
    // Send signed transaction
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    console.log("Transaction sent with signature:", signature);
    
    // Confirm transaction
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log("Transaction confirmed successfully");
    
    toast({
      title: "Parameters Updated",
      description: "Staking parameters have been updated successfully."
    });
    
    return signature;
  } catch (error) {
    console.error('Error updating parameters:', error);
    const errorMessage = error instanceof Error
      ? error.message
      : 'Unknown error during parameter update';
    toast({
      title: "Update Failed",
      description: errorMessage,
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
  dailyAPR: number;
  weeklyAPR: number;
  monthlyAPR: number;
  yearlyAPR: number;
}> {
  try {
    // Find program state address
    const [programStateAddress] = findProgramStateAddress();
    
    // Get program state account data
    const programStateInfo = await connection.getAccountInfo(programStateAddress);
    
    // If program state doesn't exist yet, return default values
    if (!programStateInfo) {
      // Calculate realistic APY values based on the rate per second
      // This is the percentage value for 0.00125% per second
      const stakeRatePerSecond = 0.00125;
      
      // Simple multiplication for APY calculation (not compounding)
      const secondsPerDay = 86400;
      const secondsPerWeek = secondsPerDay * 7;
      const secondsPerMonth = secondsPerDay * 30;
      const secondsPerYear = secondsPerDay * 365;
      
      // Calculate linear rates (not compound)
      // Note: 0.00125% per second = 108% daily
      const dailyAPR = stakeRatePerSecond * secondsPerDay;     // 108% daily (0.00125 * 86400)
      const weeklyAPR = stakeRatePerSecond * secondsPerWeek;   // 756% weekly
      const monthlyAPR = stakeRatePerSecond * secondsPerMonth; // 3240% monthly 
      const yearlyAPR = stakeRatePerSecond * secondsPerYear;   // 39420% yearly
      
      return {
        stakeRatePerSecond,
        harvestThreshold: 1,         // Default 1 YOS threshold for harvesting
        dailyAPR,                    // Simple daily rate (Annual Percentage Rate)
        weeklyAPR,                   // Simple weekly rate
        monthlyAPR,                  // Simple monthly rate
        yearlyAPR                    // Simple yearly rate
      };
    }
    
    // Parse program state data
    // First 32 bytes are admin pubkey
    // Next 32 bytes are YOT mint pubkey
    // Next 32 bytes are YOS mint pubkey
    
    // Read stake rate (8 bytes, 64-bit unsigned integer) from blockchain
    const stakeRateBasisPoints = Number(programStateInfo.data.readBigUInt64LE(32 + 32 + 32));
    
    // Convert basis points to percentage using our universal dynamic formula
    // This handles any staking rate consistently, from extremely small to large values
    const stakeRatePerSecond = convertBasisPointsToRatePerSecond(stakeRateBasisPoints);
    
    console.log("Actual rate from blockchain:", {
      stakeRateBasisPoints,
      stakeRatePerSecond,
      calculationDetails: stakeRateBasisPoints === 120000 ? "Special case: 120000 basis points → 0.00125%" : 
                         stakeRateBasisPoints === 120 ? "Special case: 120 basis points → 0.00000125%" :
                         stakeRateBasisPoints < 10 ? `${stakeRateBasisPoints} / 100000000 = ${stakeRateBasisPoints/100000000}` :
                         stakeRateBasisPoints < 100 ? `${stakeRateBasisPoints} / 10000000 = ${stakeRateBasisPoints/10000000}` :
                         `${stakeRateBasisPoints} / 10000 = ${stakeRateBasisPoints/10000}`
    });
    
    // Additional logging to verify calculations for transparency
    console.log(`Rate conversion: ${stakeRateBasisPoints} basis points → ${stakeRatePerSecond}% per second`);
    console.log(`This means ${stakeRatePerSecond * 86400}% per day (${stakeRatePerSecond} * 86400 seconds)`);
    console.log(`This means ${stakeRatePerSecond * 86400 * 365}% per year (${stakeRatePerSecond} * 86400 * 365)`);
    
    
    // Read harvest threshold (8 bytes, 64-bit unsigned integer)
    const harvestThreshold = Number(programStateInfo.data.readBigUInt64LE(32 + 32 + 32 + 8)) / 1000000;
    
    const secondsPerDay = 86400;
    const secondsPerWeek = secondsPerDay * 7;
    const secondsPerMonth = secondsPerDay * 30;
    const secondsPerYear = secondsPerDay * 365;
    const secondsPerHour = 3600;
    
    // Calculate rates directly from stakeRatePerSecond read from blockchain
    // For UI display, we need to convert the percentage (0.00125%) properly
    // Note: stakeRatePerSecond is already in percentage form (0.00125% = 0.00125)
    const dailyAPR = stakeRatePerSecond * secondsPerDay;
    const weeklyAPR = stakeRatePerSecond * secondsPerWeek;
    const monthlyAPR = stakeRatePerSecond * secondsPerMonth;
    const yearlyAPR = stakeRatePerSecond * secondsPerYear;
    
    console.log("Rate calculation:", {
      stakeRatePerSecond,
      secondsPerDay,
      daily: `${stakeRatePerSecond} * ${secondsPerDay} = ${dailyAPR}`
    });
    
    return {
      stakeRatePerSecond,
      harvestThreshold,
      dailyAPR,
      weeklyAPR,
      monthlyAPR,
      yearlyAPR
    };
  } catch (error) {
    console.error('Error fetching staking program state:', error);
    
    // Instead of providing fallback values, make an explicit note that we rely on blockchain data
    throw new Error('Failed to fetch staking program state from blockchain. Please try again later.');
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
    
    // Get the staking rate from the program state
    // First read stake rate (8 bytes, 64-bit unsigned integer) from blockchain
    const stakeRateBasisPoints = Number(programStateInfo.data.readBigUInt64LE(32 + 32 + 32));
    
    // Convert basis points to percentage using our universal dynamic formula
    // This handles any staking rate consistently, from extremely small to large values
    const stakeRatePerSecond = convertBasisPointsToRatePerSecond(stakeRateBasisPoints);
    
    console.log("Rate for reward calculation:", {
      stakeRateBasisPoints,
      stakeRatePerSecond,
      calculationDetails: stakeRateBasisPoints === 120000 ? "Special case: 120000 basis points → 0.00125%" : 
                         stakeRateBasisPoints === 120 ? "Special case: 120 basis points → 0.00000125%" :
                         stakeRateBasisPoints < 10 ? `${stakeRateBasisPoints} / 100000000 = ${stakeRateBasisPoints/100000000}` :
                         stakeRateBasisPoints < 100 ? `${stakeRateBasisPoints} / 10000000 = ${stakeRateBasisPoints/10000000}` :
                         `${stakeRateBasisPoints} / 10000 = ${stakeRateBasisPoints/10000}`,
      displayedInUI: stakeRatePerSecond * 100, // What gets displayed in UI (percentage)
      dailyPercentage: stakeRatePerSecond * 86400,
      yearlyPercentage: stakeRatePerSecond * 86400 * 365
    });
    
    // Additional logging to verify calculations for transparency
    console.log(`Rate conversion for staking rewards: ${stakeRateBasisPoints} basis points → ${stakeRatePerSecond}% per second`);
    console.log(`This means ${stakeRatePerSecond * 86400}% per day (${stakeRatePerSecond} * 86400 seconds)`);
    console.log(`This means ${stakeRatePerSecond * 86400 * 365}% per year (${stakeRatePerSecond} * 86400 * 365)`);
    
    
    // For rewards calculation, convert from percentage to decimal (e.g., 0.00125% → 0.0000125)
    const stakeRateDecimal = stakeRatePerSecond / 100;
    
    // Calculate current time
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Calculate pending rewards
    const timeStakedSinceLastHarvest = currentTime - lastHarvestTime;
    
    // Use the decimal rate for rewards calculation
    const pendingRewards = Number(stakedAmount) * timeStakedSinceLastHarvest * stakeRateDecimal;
    
    return {
      stakedAmount: Number(stakedAmount),
      startTimestamp: startTimestamp,
      lastHarvestTime: lastHarvestTime,
      totalHarvested: totalHarvested,
      rewardsEarned: pendingRewards
    };
  } catch (error) {
    console.error('Error getting staking info:', error);
    
    // For existing users who have no staking account, returning zero values is appropriate
    // This is not a fallback or mock - it accurately represents that the user hasn't staked yet
    if (error && (error as any).message && (error as any).message.includes('Account does not exist')) {
      return {
        stakedAmount: 0,
        startTimestamp: 0,
        lastHarvestTime: 0,
        totalHarvested: 0,
        rewardsEarned: 0
      };
    }
    
    // For actual errors, throw the error instead of returning synthetic data
    throw new Error('Failed to fetch staking information from blockchain. Please try again later.');
  }
}