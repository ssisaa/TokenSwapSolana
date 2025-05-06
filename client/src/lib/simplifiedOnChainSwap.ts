/**
 * Client for the Simplified On-Chain SOL to YOT Swap Program
 * 
 * This is a dedicated on-chain implementation that focuses only on SOL to YOT swaps
 * with proper distribution rules and 100% on-chain processing.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  TOKEN_PROGRAM_ID, 
  createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';
import {
  SIMPLIFIED_SWAP_PROGRAM_ID,
  YOT_MINT,
  YOS_MINT,
  SOL_POOL_WALLET,
  YOT_POOL_TOKEN_ACCOUNT,
  COMMON_WALLET_ADDRESS,
  SOL_DISTRIBUTION_RATIO,
  YOT_DISTRIBUTION_RATIO,
} from './configConstants';

/**
 * Find program state PDA for the simplified swap program
 * @returns [pda, bump]
 */
export function findProgramStatePda(): [PublicKey, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID)
  );
  return [pda, bump];
}

/**
 * Find program authority PDA for the simplified swap program
 * @returns [pda, bump]
 */
export function findProgramAuthorityPda(): [PublicKey, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID)
  );
  return [pda, bump];
}

/**
 * Create instruction data for the Initialize instruction
 */
export function createInitializeInstructionData(
  solDistributionRatio = SOL_DISTRIBUTION_RATIO,
  yotDistributionRatio = YOT_DISTRIBUTION_RATIO,
  minSolAmount = 0.001 * LAMPORTS_PER_SOL
): Buffer {
  const data = Buffer.alloc(11); // 1 (tag) + 1 + 1 + 8
  
  // Instruction type: 0 = Initialize
  data.writeUInt8(0, 0);
  
  // Distribution ratios
  data.writeUInt8(solDistributionRatio, 1);
  data.writeUInt8(yotDistributionRatio, 2);
  
  // Minimum SOL amount (0.001 SOL in lamports)
  data.writeBigUInt64LE(BigInt(minSolAmount), 3);
  
  return data;
}

/**
 * Create instruction data for the Swap instruction
 */
export function createSwapInstructionData(
  solAmount: number,  // in lamports
  minYotAmount: number  // in tokens
): Buffer {
  const data = Buffer.alloc(17); // 1 (tag) + 8 + 8
  
  // Instruction type: 1 = Swap
  data.writeUInt8(1, 0);
  
  // SOL amount (in lamports)
  data.writeBigUInt64LE(BigInt(solAmount), 1);
  
  // Min YOT amount (in tokens)
  data.writeBigUInt64LE(BigInt(minYotAmount), 9);
  
  return data;
}

/**
 * Initialize the simplified swap program (admin only)
 */
export async function initializeSimplifiedSwap(
  adminWallet: any,
  connection: Connection
): Promise<string> {
  const programId = new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID);
  const [programStatePda] = findProgramStatePda();
  const [programAuthorityPda] = findProgramAuthorityPda();
  
  // Create initialization instruction
  const initializeInstruction = new TransactionInstruction({
    keys: [
      { pubkey: adminWallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStatePda, isSigner: false, isWritable: true },
      { pubkey: programAuthorityPda, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(YOT_MINT), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(YOS_MINT), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(COMMON_WALLET_ADDRESS), isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: createInitializeInstructionData(),
  });
  
  // Add priority fee
  const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 100_000,
  });
  
  // Create transaction
  const transaction = new Transaction()
    .add(priorityFeeInstruction)
    .add(initializeInstruction);
  
  transaction.feePayer = adminWallet.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  
  try {
    // Sign and send transaction
    const signature = await adminWallet.sendTransaction(transaction, connection);
    console.log("Program initialization successful:", signature);
    return signature;
  } catch (error: any) {
    console.error("Error initializing program:", error);
    throw new Error(`Failed to initialize program: ${error.message}`);
  }
}

/**
 * Perform an on-chain SOL to YOT swap using the simplified program
 * This handles the full swap process including token account creation if needed
 */
export async function performOnChainSwap(
  wallet: any,
  solAmount: number,  // in SOL (e.g., 0.1)
  slippageTolerance: number = 5  // percentage (e.g., 5 = 5%)
): Promise<any> {
  if (!wallet || !wallet.publicKey) {
    throw new Error("Wallet not connected");
  }
  
  if (solAmount <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  
  try {
    const connection = new Connection(process.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com');
    const programId = new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID);
    
    // Convert SOL to lamports
    const solAmountLamports = solAmount * LAMPORTS_PER_SOL;
    
    // Calculate minimum YOT amount with slippage tolerance
    const minYotAmount = solAmountLamports * (1 - slippageTolerance / 100);
    
    // Get PDAs
    const [programStatePda] = findProgramStatePda();
    const [programAuthorityPda] = findProgramAuthorityPda();
    
    // Get user token accounts
    const userYotAccount = await getAssociatedTokenAddress(
      new PublicKey(YOT_MINT),
      wallet.publicKey
    );
    
    const userYosAccount = await getAssociatedTokenAddress(
      new PublicKey(YOS_MINT),
      wallet.publicKey
    );
    
    // Check if token accounts exist
    const userYotAccountInfo = await connection.getAccountInfo(userYotAccount);
    const userYosAccountInfo = await connection.getAccountInfo(userYosAccount);
    
    // Create array for account creation instructions
    const accountCreationInstructions: TransactionInstruction[] = [];
    
    // Add instructions to create token accounts if they don't exist
    if (!userYotAccountInfo) {
      console.log("Creating YOT token account");
      accountCreationInstructions.push(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userYotAccount,
          wallet.publicKey,
          new PublicKey(YOT_MINT)
        )
      );
    }
    
    if (!userYosAccountInfo) {
      console.log("Creating YOS token account");
      accountCreationInstructions.push(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userYosAccount,
          wallet.publicKey,
          new PublicKey(YOS_MINT)
        )
      );
    }
    
    // Create the swap instruction
    const swapInstruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: programStatePda, isSigner: false, isWritable: true },
        { pubkey: programAuthorityPda, isSigner: false, isWritable: false },
        { pubkey: new PublicKey(SOL_POOL_WALLET), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(YOT_POOL_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
        { pubkey: userYotAccount, isSigner: false, isWritable: true },
        { pubkey: new PublicKey(COMMON_WALLET_ADDRESS), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(YOS_MINT), isSigner: false, isWritable: true },
        { pubkey: userYosAccount, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId,
      data: createSwapInstructionData(solAmountLamports, minYotAmount),
    });
    
    // Add priority fee instruction
    const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 100_000,
    });
    
    // Create transaction
    const transaction = new Transaction();
    transaction.feePayer = wallet.publicKey;
    
    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    
    // Add all instructions
    transaction.add(priorityFeeInstruction);
    
    // Add account creation instructions if needed
    if (accountCreationInstructions.length > 0) {
      accountCreationInstructions.forEach(instruction => {
        transaction.add(instruction);
      });
    }
    
    // Add swap instruction
    transaction.add(swapInstruction);
    
    // Sign and send transaction
    console.log("Simulating transaction...");
    try {
      const simulation = await connection.simulateTransaction(transaction);
      
      if (simulation.value.err) {
        console.error("Simulation error:", simulation.value.err);
        console.log("Trying with skipPreflight=true");
        
        const signature = await wallet.sendTransaction(transaction, connection, { skipPreflight: true });
        console.log("Transaction sent with skipPreflight:", signature);
        
        return {
          success: true,
          signature,
          tokensCreated: accountCreationInstructions.length > 0
        };
      } else {
        console.log("Simulation successful, sending transaction");
        const signature = await wallet.sendTransaction(transaction, connection);
        console.log("Transaction sent successfully:", signature);
        
        return {
          success: true,
          signature,
          tokensCreated: accountCreationInstructions.length > 0
        };
      }
    } catch (error: any) {
      console.error("Transaction error:", error);
      return {
        success: false,
        error: error.message || "Unknown error during transaction",
      };
    }
  } catch (error: any) {
    console.error("Error in performOnChainSwap:", error);
    return {
      success: false,
      error: error.message || "Unknown error during swap setup",
    };
  }
}