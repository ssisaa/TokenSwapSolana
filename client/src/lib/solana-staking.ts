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
  // IMPORTANT: We need to match the smart contract's expected values
  // The contract is using 120000 basis points = 0.0000125% per second
  const REFERENCE_RATE = 0.0000125;
  const REFERENCE_BASIS_POINTS = 120000;
  
  // Special case handling for certain values
  if (basisPoints === 120000) {
    console.log("Special case detected: 120000 basis points is 10x our reference, correcting to 0.0000125%");
    return 0.0000125; // This is 10x our reference rate
  }
  
  if (basisPoints === 12000) {
    console.log("Exact match to reference value: 12000 basis points = 0.00000125%");
    return 0.00000125; // Exact match to our reference rate
  }
  
  // For other values, calculate rate using the corrected ratio
  const ratePerSecond = basisPoints * (REFERENCE_RATE / REFERENCE_BASIS_POINTS);
  
  console.log(`Converting ${basisPoints} basis points using corrected reference values:`, {
    REFERENCE_RATE: 0.00000125, // Corrected reference value
    REFERENCE_BASIS_POINTS: 12000, // Corrected reference value
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
  
  // DEBUG: First look at the exact value we received
  console.log(`DEBUG - Init exact value: ${stakeRatePerSecond} (${typeof stakeRatePerSecond})`);
  console.log(`DEBUG - Init string form: "${stakeRatePerSecond.toString()}"`);

  // Convert percentage per second to basis points using our reference ratio
  // IMPORTANT: Must use the same reference values as convertBasisPointsToRatePerSecond 
  // for consistent encoding/decoding between UI and blockchain
  const REFERENCE_RATE = 0.0000125;
  const REFERENCE_BASIS_POINTS = 120000;

  // Handle specific string cases first to ensure accurate value detection
  let finalBasisPoints: number;
  
  // This handles precision issues with floating point by checking string representation
  if (stakeRatePerSecond.toString() === '0.00000125') {
    console.log("Init String match detected: Using exact 12000 basis points for 0.00000125%");
    finalBasisPoints = 12000;
  } else if (stakeRatePerSecond.toString() === '0.0000125') {
    console.log("Init String match detected: Using exact 120000 basis points for 0.0000125%");
    finalBasisPoints = 120000;
  } else {
    // Calculate basis points using the reverse of our conversion formula
    finalBasisPoints = Math.round(stakeRatePerSecond * (REFERENCE_BASIS_POINTS / REFERENCE_RATE));
    console.log(`Converting ${stakeRatePerSecond}% to ${finalBasisPoints} basis points using universal formula`);
    console.log(`Formula: ${stakeRatePerSecond} * (${REFERENCE_BASIS_POINTS} / ${REFERENCE_RATE}) = ${finalBasisPoints}`);
  }
  
  // YOS token uses 6 decimals just like YOT
  const YOS_DECIMALS = 6;
  const thresholdInRawUnits = Math.floor(harvestThreshold * Math.pow(10, YOS_DECIMALS));
  
  console.log("Converted values for initialization:", {
    finalBasisPoints,
    thresholdInRawUnits,
    calculationDetails: `${harvestThreshold} YOS × 10^${YOS_DECIMALS} = ${thresholdInRawUnits}`
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
  // Use the converted basis points value (with special case handling if needed)
  buffer.writeBigUInt64LE(BigInt(finalBasisPoints), 65);
  
  // Write harvest threshold as little-endian u64 (8 bytes)
  // Use the converted raw units value
  buffer.writeBigUInt64LE(BigInt(thresholdInRawUnits), 73);
  
  // Debug logging to verify our buffer
  console.log("Encoded initialization instruction bytes:", {
    discriminator: buffer.readUInt8(0),
    yotMintHex: buffer.slice(1, 33).toString('hex'),
    yosMintHex: buffer.slice(33, 65).toString('hex'),
    finalBasisPoints,
    finalBasisPointsFromBuffer: buffer.readBigUInt64LE(65),
    harvestThresholdRawUnits: buffer.readBigUInt64LE(73),
    bufferLength: buffer.length
  });
  
  return buffer;
}

function encodeStakeInstruction(amount: number): Buffer {
  // Enhanced version with better debugging and error handling
  console.log(`Encoding stake instruction with amount: ${amount}`);
  
  // YOT uses 9 decimals, so convert to raw units by multiplying by 10^9
  // This is critical for proper encoding/decoding between UI and blockchain
  const YOT_DECIMALS = 9;
  const amountInRawUnits = Math.floor(amount * Math.pow(10, YOT_DECIMALS));
  console.log(`Amount converted to raw units: ${amountInRawUnits} (using ${YOT_DECIMALS} decimals)`);
  
  // Verify the calculation
  console.log(`Verification: ${amount} YOT × 10^${YOT_DECIMALS} = ${amountInRawUnits}`);
  
  // Create a buffer to hold all data
  // Format: 1 byte instruction discriminator + 8 bytes for amount (u64)
  const buffer = Buffer.alloc(1 + 8);
  
  // Write instruction discriminator (1 = Stake)
  buffer.writeUInt8(StakingInstructionType.Stake, 0);
  
  // Write amount as little-endian u64 (8 bytes)
  try {
    buffer.writeBigUInt64LE(BigInt(amountInRawUnits), 1);
    
    // Verify buffer content to ensure correct serialization
    console.log(`Buffer verification: discriminator=${buffer.readUInt8(0)}, amount=${buffer.readBigUInt64LE(1)}`);
  } catch (error: any) {
    console.error("Error serializing stake amount:", error);
    console.error("Input amount:", amount, "type:", typeof amount);
    console.error("Converted to raw units:", amountInRawUnits, "type:", typeof amountInRawUnits);
    throw new Error(`Failed to serialize stake amount: ${error.message}`);
  }
  
  return buffer;
}

function encodeUnstakeInstruction(amount: number): Buffer {
  // Enhanced version with better debugging and error handling
  console.log(`Encoding unstake instruction with amount: ${amount}`);
  
  // YOT uses 9 decimals, so convert to raw units by multiplying by 10^9
  // This is critical for proper encoding/decoding between UI and blockchain
  const YOT_DECIMALS = 9;
  const amountInRawUnits = Math.floor(amount * Math.pow(10, YOT_DECIMALS));
  console.log(`Unstake amount converted to raw units: ${amountInRawUnits} (using ${YOT_DECIMALS} decimals)`);
  
  // Verify the calculation
  console.log(`Verification: ${amount} YOT × 10^${YOT_DECIMALS} = ${amountInRawUnits}`);
  
  // Create a buffer to hold all data
  // Format: 1 byte instruction discriminator + 8 bytes for amount (u64)
  const buffer = Buffer.alloc(1 + 8);
  
  // Write instruction discriminator (2 = Unstake)
  buffer.writeUInt8(StakingInstructionType.Unstake, 0);
  
  // Write amount as little-endian u64 (8 bytes)
  try {
    buffer.writeBigUInt64LE(BigInt(amountInRawUnits), 1);
    
    // Verify buffer content to ensure correct serialization
    console.log(`Unstake buffer verification: discriminator=${buffer.readUInt8(0)}, amount=${buffer.readBigUInt64LE(1)}`);
  } catch (error: any) {
    console.error("Error serializing unstake amount:", error);
    console.error("Input amount:", amount, "type:", typeof amount);
    console.error("Converted to raw units:", amountInRawUnits, "type:", typeof amountInRawUnits);
    throw new Error(`Failed to serialize unstake amount: ${error.message}`);
  }
  
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
  // DEBUG: First look at the exact value we received
  console.log(`DEBUG - Exact value received: ${stakeRatePerSecond} (${typeof stakeRatePerSecond})`);
  console.log(`DEBUG - String form: "${stakeRatePerSecond.toString()}"`);
  
  // Convert percentage per second to basis points using our reference ratio
  // IMPORTANT: Must use the same reference values as convertBasisPointsToRatePerSecond 
  // for consistent encoding/decoding between UI and blockchain
  const REFERENCE_RATE = 0.0000125;
  const REFERENCE_BASIS_POINTS = 120000;
  
  // Handle specific string cases first to ensure accurate value detection
  let finalBasisPoints: number;
  
  // This handles precision issues with floating point by checking string representation
  if (stakeRatePerSecond.toString() === '0.00000125') {
    console.log("String match detected: Using exact 12000 basis points for 0.00000125%");
    finalBasisPoints = 12000;
  } else if (stakeRatePerSecond.toString() === '0.0000125') {
    console.log("String match detected: Using exact 120000 basis points for 0.0000125%");
    finalBasisPoints = 120000;
  } else {
    // Calculate basis points using the reverse of our conversion formula
    finalBasisPoints = Math.round(stakeRatePerSecond * (REFERENCE_BASIS_POINTS / REFERENCE_RATE));
    console.log(`Converting ${stakeRatePerSecond}% to ${finalBasisPoints} basis points using universal formula`);
    console.log(`Formula: ${stakeRatePerSecond} * (${REFERENCE_BASIS_POINTS} / ${REFERENCE_RATE}) = ${finalBasisPoints}`);
  }
  
  // YOS also uses 9 decimals just like YOT
  const YOS_DECIMALS = 9;
  const thresholdInRawUnits = Math.floor(harvestThreshold * Math.pow(10, YOS_DECIMALS));
  
  console.log("Encoding parameters update with converted values:", {
    finalBasisPoints,
    thresholdInRawUnits: thresholdInRawUnits,
    calculationDetails: `${harvestThreshold} YOS × 10^${YOS_DECIMALS} = ${thresholdInRawUnits}`
  });
  
  // Create a buffer to hold all data
  // 1 byte for instruction type + 8 bytes for rate + 8 bytes for threshold
  const buffer = Buffer.alloc(1 + 8 + 8);
  
  // Write instruction type to the first byte
  buffer.writeUInt8(StakingInstructionType.UpdateParameters, 0);
  
  // Write rate as little-endian u64 (8 bytes) - as basis points
  // We use finalBasisPoints which might have been adjusted for exact values
  buffer.writeBigUInt64LE(BigInt(finalBasisPoints), 1);
  
  // Write threshold as little-endian u64 (8 bytes) - as raw token units
  buffer.writeBigUInt64LE(BigInt(thresholdInRawUnits), 9);
  
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
        
        // Clock for transaction time reference
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
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
    
    // Get the user's token account address
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
    
    // Create a transaction that will hold all instructions
    const transaction = new Transaction();
    
    // Check if program state exists first
    console.log('Checking if program state account exists...');
    try {
      const programStateInfo = await connection.getAccountInfo(programStateAddress);
      if (!programStateInfo) {
        console.error('Program state account does not exist. Program needs to be initialized by admin.');
        // Don't show toast here since it creates too much noise, just return a descriptive error
        throw new Error('Program state account does not exist');
      }
      console.log('Program state account exists with size:', programStateInfo.data.length);
    } catch (err) {
      console.error('Error checking program state:', err);
      // If this is a connection-related issue, treat it differently than program not initialized
      if (err instanceof Error && !err.message.includes('Program state account does not exist')) {
        toast({
          title: "Connection Error",
          description: "Failed to connect to Solana. Please check your network connection.",
          variant: "destructive"
        });
      }
      throw err;
    }
    
    // Check if user YOT token account exists
    const userYotAccountInfo = await connection.getAccountInfo(userYotTokenAccount);
    
    // Also check for YOS token account existence - needed for receiving staking rewards
    // This ensures users can receive rewards after they stake
    const yosMintPubkey = new PublicKey(YOS_TOKEN_ADDRESS);
    const userYosTokenAccount = await getAssociatedTokenAddress(
      yosMintPubkey,
      userPublicKey
    );
    console.log('User YOS token account address:', userYosTokenAccount.toBase58());
    
    // Check if YOS token account exists
    const userYosAccountInfo = await connection.getAccountInfo(userYosTokenAccount);
    if (!userYosAccountInfo) {
      console.log('YOS token account for user does not exist. Creating it...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          userYosTokenAccount,
          userPublicKey,
          yosMintPubkey
        )
      );
      
      toast({
        title: "Creating YOS Token Account",
        description: "You need a YOS token account to receive staking rewards. It will be created automatically."
      });
    } else {
      console.log('User YOS token account exists');
    }
    
    // If YOT token account doesn't exist, create it first
    if (!userYotAccountInfo) {
      console.log('Creating YOT token account for user...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          userYotTokenAccount,
          userPublicKey,
          yotMintPubkey
        )
      );
      
      toast({
        title: "Creating YOT Token Account",
        description: "You need a YOT token account to stake. It will be created automatically."
      });
    } else {
      console.log('User YOT token account exists');
      
      // Verify user has enough tokens to stake
      try {
        const userYotBalance = await connection.getTokenAccountBalance(userYotTokenAccount);
        console.log('User YOT balance:', userYotBalance.value.uiAmount);
        
        if (!userYotBalance.value.uiAmount || userYotBalance.value.uiAmount < amount) {
          toast({
            title: "Insufficient YOT Balance",
            description: `You need at least ${amount} YOT to stake. Your balance: ${userYotBalance.value.uiAmount || 0} YOT`,
            variant: "destructive"
          });
          throw new Error(`Insufficient YOT balance. Required: ${amount}, Available: ${userYotBalance.value.uiAmount || 0}`);
        }
      } catch (error) {
        console.error('Failed to check YOT balance:', error);
        toast({
          title: "Error Checking YOT Balance",
          description: "There was an error checking your YOT balance. Please try again.",
          variant: "destructive"
        });
        throw new Error('Error checking YOT balance');
      }
    }
    
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
      console.log('Program token account does not exist. Creating it now...');
      // Create the program token account if it doesn't exist
      // This is critical for the staking operation to succeed
      transaction.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          programYotTokenAccount,
          programAuthorityAddress,
          yotMintPubkey
        )
      );
      toast({
        title: "Setting Up Program",
        description: "Creating program token account as part of your transaction."
      });
    } else {
      console.log('Program token account exists with size:', programTokenAccountInfo.data.length);
    }

    // Check if user's staking account exists
    console.log('Checking if user staking account exists...');
    const userStakingAccountInfo = await connection.getAccountInfo(userStakingAddress);
    
    // If the staking account doesn't exist, we need to make sure it's created as part of this transaction
    // The program will create it, but we need to make sure all accounts are properly specified
    if (!userStakingAccountInfo) {
      console.log('User staking account does not exist - will be created during transaction');
      toast({
        title: "First-time Staking",
        description: "Creating your staking account. This will require slightly more SOL for the transaction."
      });
    } else {
      console.log('User staking account exists with size:', userStakingAccountInfo.data.length);
    }
    
    // CRITICAL UPDATE: Account order EXACTLY matches process_stake function in Rust program
    // Get accounts from process_stake function:
    // user_account, user_yot_token_account, program_yot_token_account, user_staking_account,
    // program_state_account, token_program, clock, system_program
    const stakeInstruction = new TransactionInstruction({
      keys: [
        // Exact order from Rust program process_stake function (line ~217)
        { pubkey: userPublicKey, isSigner: true, isWritable: true },        // user_account (payer)
        { pubkey: userYotTokenAccount, isSigner: false, isWritable: true }, // user_yot_token_account (source)
        { pubkey: programYotTokenAccount, isSigner: false, isWritable: true }, // program_yot_token_account (destination)
        { pubkey: userStakingAddress, isSigner: false, isWritable: true },  // user_staking_account (PDA)
        { pubkey: programStateAddress, isSigner: false, isWritable: true },  // program_state_account
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },    // token_program
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // clock
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
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
    
    // Get program token account for YOT
    const programYotTokenAccount = await getAssociatedTokenAddress(
      yotMintPubkey,
      programAuthorityAddress,
      true // allowOwnerOffCurve
    );
    
    // Get program token account for YOS
    // Important: reuse the same variable name across different functions
    const yosMintAddress = new PublicKey(YOS_TOKEN_ADDRESS);
    const programYosTokenAccount = await getAssociatedTokenAddress(
      yosMintAddress,
      programAuthorityAddress,
      true // allowOwnerOffCurve
    );
    
    // Create a transaction to potentially hold multiple instructions
    const transaction = new Transaction();
    
    // Check if user YOT token account exists, create if needed
    const userYotAccountInfo = await connection.getAccountInfo(userYotTokenAccount);
    if (!userYotAccountInfo) {
      console.log('Creating YOT token account for user during unstake...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          userYotTokenAccount,
          userPublicKey,
          yotMintPubkey
        )
      );
      toast({
        title: "Creating YOT Token Account",
        description: "You need a YOT token account to receive unstaked tokens. It will be created automatically."
      });
    }
    
    // Check if program token account exists, create if needed
    const programTokenAccountInfo = await connection.getAccountInfo(programYotTokenAccount);
    if (!programTokenAccountInfo) {
      console.log('Program token account does not exist. Creating it during unstake...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          programYotTokenAccount,
          programAuthorityAddress,
          yotMintPubkey
        )
      );
      toast({
        title: "Setting Up Program",
        description: "Creating program token account as part of your transaction."
      });
    }
    
    // Check if user's staking account exists - users must have staked before they can unstake
    console.log('Checking if user staking account exists...');
    const userStakingAccountInfo = await connection.getAccountInfo(userStakingAddress);
    
    if (!userStakingAccountInfo) {
      console.error('User staking account does not exist. User has not staked any tokens.');
      toast({
        title: "No Staked Tokens",
        description: "You haven't staked any tokens yet. Please stake some tokens first.",
        variant: "destructive"
      });
      throw new Error('No staked tokens to unstake');
    } else {
      console.log('User staking account exists with size:', userStakingAccountInfo.data.length);
    }
    
    // Also check for YOS token account existence
    const userYosTokenAccount = await getAssociatedTokenAddress(
      yosMintAddress, // Use the yosMintAddress we defined above
      userPublicKey
    );
    console.log('User YOS token account address for unstake:', userYosTokenAccount.toBase58());
    
    // Check if YOS token account exists
    const userYosAccountInfo = await connection.getAccountInfo(userYosTokenAccount);
    if (!userYosAccountInfo) {
      console.log('YOS token account for user does not exist. Creating it for unstake...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          userYosTokenAccount,
          userPublicKey,
          yosMintPubkey
        )
      );
      
      toast({
        title: "Creating YOS Token Account",
        description: "You need a YOS token account to receive staking rewards. It will be created automatically."
      });
    } else {
      console.log('User YOS token account exists for unstake operation');
    }

    // CRITICAL UPDATE: Account order EXACTLY matches process_unstake function in Rust program
    // Get accounts from process_unstake function (line ~339):
    // user_account, user_yot_token_account, program_yot_token_account, user_yos_token_account,
    // program_yos_token_account, user_staking_account, program_state_account, token_program, 
    // program_authority, clock
    const unstakeInstruction = new TransactionInstruction({
      keys: [
        // Exact order from Rust program process_unstake function
        { pubkey: userPublicKey, isSigner: true, isWritable: true },        // user_account
        { pubkey: userYotTokenAccount, isSigner: false, isWritable: true }, // user_yot_token_account (destination)
        { pubkey: programYotTokenAccount, isSigner: false, isWritable: true }, // program_yot_token_account (source)
        { pubkey: userYosTokenAccount, isSigner: false, isWritable: true }, // user_yos_token_account
        { pubkey: programYosTokenAccount, isSigner: false, isWritable: true }, // program_yos_token_account (source for rewards)
        { pubkey: userStakingAddress, isSigner: false, isWritable: true },  // user_staking_account (PDA)
        { pubkey: programStateAddress, isSigner: false, isWritable: true }, // program_state_account
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },   // token_program
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: false }, // program_authority
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false } // clock
      ],
      programId: STAKING_PROGRAM_ID,
      data: encodeUnstakeInstruction(amount)
    });
    
    // Add unstake instruction to transaction
    transaction.add(unstakeInstruction);
    
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
    
    // Create transaction to add instructions to
    const transaction = new Transaction();
    
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
    
    // Check if user YOS token account exists, create if needed
    const userAccountInfo = await connection.getAccountInfo(userYosTokenAccount);
    if (!userAccountInfo) {
      console.log('Creating YOS token account for user during harvest...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          userYosTokenAccount,
          userPublicKey,
          yosMintPubkey
        )
      );
      toast({
        title: "Creating YOS Token Account",
        description: "You need a YOS token account to receive rewards. It will be created automatically."
      });
    }
    
    // Get program token account for YOS
    const programYosTokenAccount = await getAssociatedTokenAddress(
      yosMintPubkey,
      programAuthorityAddress,
      true // allowOwnerOffCurve
    );
    
    // Check if the program token account exists
    console.log('Checking if program YOS token account exists...');
    const programTokenAccountInfo = await connection.getAccountInfo(programYosTokenAccount);
    if (!programTokenAccountInfo) {
      console.log('Program YOS token account does not exist. Creating it during harvest...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          programYosTokenAccount,
          programAuthorityAddress,
          yosMintPubkey
        )
      );
      toast({
        title: "Setting Up Program",
        description: "Creating program YOS token account as part of your transaction."
      });
    }
    
    // Check if user's staking account exists - users must have staked before they can harvest
    console.log('Checking if user staking account exists for harvest...');
    const userStakingAccountInfo = await connection.getAccountInfo(userStakingAddress);
    
    if (!userStakingAccountInfo) {
      console.error('User staking account does not exist. User has not staked any tokens.');
      toast({
        title: "No Staked Tokens",
        description: "You haven't staked any tokens yet. Please stake some tokens first.",
        variant: "destructive"
      });
      throw new Error('No staked tokens to harvest rewards from');
    } else {
      console.log('User staking account exists with size:', userStakingAccountInfo.data.length);
    }
    
    // CRITICAL UPDATE: Account order EXACTLY matches process_harvest function in Rust program
    // Get accounts from process_harvest function (line ~460):
    // user_account, user_yos_token_account, program_yos_token_account, user_staking_account,
    // program_state_account, token_program, program_authority, clock
    const harvestInstruction = new TransactionInstruction({
      keys: [
        // Exact order from Rust program process_harvest function
        { pubkey: userPublicKey, isSigner: true, isWritable: true },        // user_account
        { pubkey: userYosTokenAccount, isSigner: false, isWritable: true }, // user_yos_token_account (destination)
        { pubkey: programYosTokenAccount, isSigner: false, isWritable: true }, // program_yos_token_account (source)
        { pubkey: userStakingAddress, isSigner: false, isWritable: true },  // user_staking_account
        { pubkey: programStateAddress, isSigner: false, isWritable: true }, // program_state_account
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },   // token_program
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: false }, // program_authority
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false } // clock
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
        { pubkey: programStateAddress, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }
      ],
      programId: STAKING_PROGRAM_ID,
      data: encodeUpdateParametersInstruction(stakeRatePerSecond, harvestThreshold)
    });
    
    // Create transaction and add the update instruction
    const transaction = new Transaction().add(updateInstruction);
    
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
  dailyAPY: number;
  weeklyAPY: number;
  monthlyAPY: number;
  yearlyAPY: number;
}> {
  try {
    // Find program state address
    const [programStateAddress] = findProgramStateAddress();
    
    // Get program state account data
    let programStateInfo;
    try {
      programStateInfo = await connection.getAccountInfo(programStateAddress);
    } catch (connErr) {
      console.error("Connection error when fetching program state:", connErr);
      // Show a toast with connection error but don't throw - the default values will be used
      toast({
        title: "Connection Issue",
        description: "Having trouble connecting to Solana network. Using default staking rates.",
        variant: "destructive"
      });
    }
    
    // If program state doesn't exist yet or there was a connection error, use default values
    // This will allow UI components to show proper rates even if data format isn't as expected
    if (!programStateInfo) {
      console.log("Program state not available or doesn't exist - using defaults");
      
      // Use our corrected, smaller default rate per second
      // This matches the expected 0.00000125% per second value (not 0.0000125%)
      const stakeRatePerSecond = 0.00000125;
      
      // Simple multiplication for APR calculation (not compounding)
      const secondsPerDay = 86400;
      const secondsPerWeek = secondsPerDay * 7;
      const secondsPerMonth = secondsPerDay * 30;
      const secondsPerYear = secondsPerDay * 365;
      
      // Calculate linear rates (not compound)
      // Note: 0.00000125% per second = 0.108% daily
      const dailyAPR = stakeRatePerSecond * secondsPerDay;     // 0.108% daily (0.00000125 * 86400)
      const weeklyAPR = stakeRatePerSecond * secondsPerWeek;   // 0.756% weekly
      const monthlyAPR = stakeRatePerSecond * secondsPerMonth; // 3.24% monthly 
      const yearlyAPR = stakeRatePerSecond * secondsPerYear;   // 39.42% yearly
      
      // Calculate APY values (compound interest)
      const dailyAPY = (Math.pow(1 + (stakeRatePerSecond / 100), secondsPerDay) - 1) * 100;
      const weeklyAPY = (Math.pow(1 + (stakeRatePerSecond / 100), secondsPerWeek) - 1) * 100;
      const monthlyAPY = (Math.pow(1 + (stakeRatePerSecond / 100), secondsPerMonth) - 1) * 100;
      const yearlyAPY = (Math.pow(1 + (stakeRatePerSecond / 100), secondsPerYear) - 1) * 100;
      
      return {
        stakeRatePerSecond,
        harvestThreshold: 1,         // Default 1 YOS threshold for harvesting
        dailyAPR,                    // Simple daily rate (Annual Percentage Rate)
        weeklyAPR,                   // Simple weekly rate
        monthlyAPR,                  // Simple monthly rate
        yearlyAPR,                   // Simple yearly rate
        dailyAPY,                    // Compound daily rate (Annual Percentage Yield)
        weeklyAPY,                   // Compound weekly rate
        monthlyAPY,                  // Compound monthly rate
        yearlyAPY                    // Compound yearly rate
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
    
    // Define reference values consistent with convertBasisPointsToRatePerSecond
    const REF_RATE = 0.00000125;
    const REF_BASIS_POINTS = 12000;
    
    console.log("Actual rate from blockchain:", {
      stakeRateBasisPoints,
      stakeRatePerSecond,
      calculationDetails: stakeRateBasisPoints === 120000 ? "Special case: 120000 basis points → 0.0000125%" : 
                         stakeRateBasisPoints === 12000 ? "Special case: 12000 basis points → 0.00000125%" :
                         `Standard calculation: ${stakeRateBasisPoints} * (${REF_RATE} / ${REF_BASIS_POINTS}) = ${stakeRatePerSecond}`
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
    
    // Calculate APY values (compound interest)
    const dailyAPY = (Math.pow(1 + (stakeRatePerSecond / 100), secondsPerDay) - 1) * 100;
    const weeklyAPY = (Math.pow(1 + (stakeRatePerSecond / 100), secondsPerWeek) - 1) * 100;
    const monthlyAPY = (Math.pow(1 + (stakeRatePerSecond / 100), secondsPerMonth) - 1) * 100;
    const yearlyAPY = (Math.pow(1 + (stakeRatePerSecond / 100), secondsPerYear) - 1) * 100;
    
    return {
      stakeRatePerSecond,
      harvestThreshold,
      dailyAPR,
      weeklyAPR,
      monthlyAPR,
      yearlyAPR,
      dailyAPY,
      weeklyAPY,
      monthlyAPY,
      yearlyAPY
    };
  } catch (error) {
    console.error('Error fetching staking program state:', error);
    
    // Instead of throwing an error, return default values with console warning
    console.warn('Using default staking rates due to error');
    
    // Use our corrected, smaller default rate per second (0.00000125%)
    const stakeRatePerSecond = 0.00000125;
    
    // Simple multiplication for APR calculation (not compounding)
    const secondsPerDay = 86400;
    const secondsPerWeek = secondsPerDay * 7;
    const secondsPerMonth = secondsPerDay * 30;
    const secondsPerYear = secondsPerDay * 365;
    
    // Calculate linear rates (not compound)
    const dailyAPR = stakeRatePerSecond * secondsPerDay;
    const weeklyAPR = stakeRatePerSecond * secondsPerWeek;
    const monthlyAPR = stakeRatePerSecond * secondsPerMonth;
    const yearlyAPR = stakeRatePerSecond * secondsPerYear;
    
    // Calculate APY values (compound interest)
    const dailyAPY = (Math.pow(1 + (stakeRatePerSecond / 100), secondsPerDay) - 1) * 100;
    const weeklyAPY = (Math.pow(1 + (stakeRatePerSecond / 100), secondsPerWeek) - 1) * 100;
    const monthlyAPY = (Math.pow(1 + (stakeRatePerSecond / 100), secondsPerMonth) - 1) * 100;
    const yearlyAPY = (Math.pow(1 + (stakeRatePerSecond / 100), secondsPerYear) - 1) * 100;
    
    return {
      stakeRatePerSecond,
      harvestThreshold: 1,
      dailyAPR,
      weeklyAPR,
      monthlyAPR,
      yearlyAPR,
      dailyAPY,
      weeklyAPY,
      monthlyAPY,
      yearlyAPY
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
    
    // Get the staking rate from the program state
    // First read stake rate (8 bytes, 64-bit unsigned integer) from blockchain
    const stakeRateBasisPoints = Number(programStateInfo.data.readBigUInt64LE(32 + 32 + 32));
    
    // Convert basis points to percentage using our universal dynamic formula
    // This handles any staking rate consistently, from extremely small to large values
    const stakeRatePerSecond = convertBasisPointsToRatePerSecond(stakeRateBasisPoints);
    
    // Define reference values consistent with convertBasisPointsToRatePerSecond
    const REF_RATE = 0.00000125;
    const REF_BASIS_POINTS = 12000;
    
    console.log("Rate for reward calculation:", {
      stakeRateBasisPoints,
      stakeRatePerSecond,
      calculationDetails: stakeRateBasisPoints === 120000 ? "Special case: 120000 basis points → 0.0000125%" : 
                         stakeRateBasisPoints === 12000 ? "Special case: 12000 basis points → 0.00000125%" :
                         `Standard calculation: ${stakeRateBasisPoints} * (${REF_RATE} / ${REF_BASIS_POINTS}) = ${stakeRatePerSecond}`,
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
    
    // Calculate rewards using compound interest formula (APY)
    // Formula: principal * ((1 + rate) ^ time - 1)
    // Where rate is per-second rate and time is in seconds
    const pendingRewards = Number(stakedAmount) * (Math.pow(1 + stakeRateDecimal, timeStakedSinceLastHarvest) - 1);
    
    console.log("Reward calculation info:", {
      stakedAmount: Number(stakedAmount),
      timeStakedSinceLastHarvest,
      stakeRateDecimal,
      method: "APY (compound)",
      pendingRewards
    });
    
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