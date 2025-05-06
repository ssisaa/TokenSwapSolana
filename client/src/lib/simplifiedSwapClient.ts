/**
 * Client for the Simplified SOL to YOT Swap Program
 * This is a completely separate program from the multi-hub swap contract
 * It's designed for reliability and simplicity, focusing only on the SOL to YOT swap
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  Keypair,
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  TOKEN_PROGRAM_ID, 
  createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';
import {
  YOT_MINT,
  YOS_MINT,
  SOL_POOL_WALLET,
  YOT_POOL_TOKEN_ACCOUNT,
  COMMON_WALLET_ADDRESS,
} from './config';
import { Buffer } from 'buffer';

// The new program ID (will be replaced after deployment)
const SIMPLIFIED_SWAP_PROGRAM_ID = 'SimpleSwapPDCsXVzAi7i2UmXt3VY6K79Po4wY3zLGwu';

/**
 * Find the program state PDA
 * @returns [PDA, bump]
 */
function findProgramStatePda(): [PublicKey, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID)
  );
  return [pda, bump];
}

/**
 * Find the program authority PDA
 * @returns [PDA, bump]
 */
function findProgramAuthorityPda(): [PublicKey, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID)
  );
  return [pda, bump];
}

/**
 * Create instruction to initialize the simplified swap program
 * This would typically be called by an admin wallet
 */
export function createInitializeInstruction(
  adminWallet: PublicKey,
  yotMint: PublicKey,
  yosMint: PublicKey,
  centralLiquidityWallet: PublicKey
): TransactionInstruction {
  // Default values
  const solDistributionRatio = 80; // 80% to pool, 20% to liquidity wallet
  const yotDistributionRatio = 95; // 95% to user as YOT, 5% as YOS cashback
  const minSolAmount = 0.001 * LAMPORTS_PER_SOL; // Minimum 0.001 SOL
  
  // Get PDAs
  const [programStatePda] = findProgramStatePda();
  const [programAuthorityPda] = findProgramAuthorityPda();
  
  // Create instruction data
  const data = Buffer.alloc(10); // 1 + 1 + 8
  
  // Instruction type: 0 = Initialize
  data.writeUInt8(0, 0);
  
  // Distribution ratios
  data.writeUInt8(solDistributionRatio, 1);
  data.writeUInt8(yotDistributionRatio, 2);
  
  // Minimum SOL amount
  data.writeBigUInt64LE(BigInt(minSolAmount), 3);
  
  return new TransactionInstruction({
    programId: new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID),
    keys: [
      { pubkey: adminWallet, isSigner: true, isWritable: true },
      { pubkey: programStatePda, isSigner: false, isWritable: true },
      { pubkey: programAuthorityPda, isSigner: false, isWritable: false },
      { pubkey: yotMint, isSigner: false, isWritable: false },
      { pubkey: yosMint, isSigner: false, isWritable: false },
      { pubkey: centralLiquidityWallet, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Create instruction to swap SOL for YOT
 */
export function createSwapInstruction(
  userWallet: PublicKey,
  solPoolWallet: PublicKey,
  yotPoolAccount: PublicKey,
  userYotAccount: PublicKey,
  centralLiquidityWallet: PublicKey,
  yosMint: PublicKey,
  userYosAccount: PublicKey,
  solAmount: number,
  minYotAmount: number
): TransactionInstruction {
  // Convert SOL to lamports
  const solAmountLamports = solAmount * LAMPORTS_PER_SOL;
  const minYotAmountTokens = minYotAmount * LAMPORTS_PER_SOL;
  
  // Get PDAs
  const [programStatePda] = findProgramStatePda();
  const [programAuthorityPda] = findProgramAuthorityPda();
  
  // Create instruction data
  const data = Buffer.alloc(17); // 1 + 8 + 8
  
  // Instruction type: 1 = Swap
  data.writeUInt8(1, 0);
  
  // SOL amount
  data.writeBigUInt64LE(BigInt(solAmountLamports), 1);
  
  // Min YOT amount
  data.writeBigUInt64LE(BigInt(minYotAmountTokens), 9);
  
  return new TransactionInstruction({
    programId: new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID),
    keys: [
      { pubkey: userWallet, isSigner: true, isWritable: true },
      { pubkey: programStatePda, isSigner: false, isWritable: true },
      { pubkey: programAuthorityPda, isSigner: false, isWritable: false },
      { pubkey: solPoolWallet, isSigner: false, isWritable: true },
      { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
      { pubkey: userYotAccount, isSigner: false, isWritable: true },
      { pubkey: centralLiquidityWallet, isSigner: false, isWritable: true },
      { pubkey: yosMint, isSigner: false, isWritable: true },
      { pubkey: userYosAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Initialize the simplified swap program
 * This should be called once by an admin/owner wallet
 */
export async function initializeSimplifiedSwap(
  adminWallet: any,
  connection: Connection
): Promise<string> {
  const yotMint = new PublicKey(YOT_MINT);
  const yosMint = new PublicKey(YOS_MINT);
  const centralLiquidityWallet = new PublicKey(COMMON_WALLET_ADDRESS);
  
  const initInstruction = createInitializeInstruction(
    adminWallet.publicKey,
    yotMint,
    yosMint,
    centralLiquidityWallet
  );
  
  // Add priority fee to help the transaction succeed
  const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 500_000,
  });
  
  const transaction = new Transaction()
    .add(priorityFeeInstruction)
    .add(initInstruction);
  
  transaction.feePayer = adminWallet.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  
  try {
    // Sign and send the transaction
    const signature = await adminWallet.sendTransaction(transaction, connection);
    console.log("Initialization transaction sent successfully:", signature);
    return signature;
  } catch (error) {
    console.error("Error initializing simplified swap program:", error);
    throw error;
  }
}

/**
 * Execute a simplified SOL to YOT swap using the dedicated program
 * This is an end-to-end function that handles all the steps
 * @param wallet Connected user wallet
 * @param solAmount Amount of SOL to swap
 * @returns Transaction details
 */
export async function executeSimplifiedSwap(
  wallet: any,
  solAmount: number
): Promise<any> {
  console.log(`Executing simplified swap with ${solAmount} SOL`);
  
  // Validate inputs
  if (!wallet || !wallet.publicKey) {
    throw new Error("Wallet not connected");
  }
  if (solAmount <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  
  try {
    const connection = new Connection(process.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com');
    
    // Get user token accounts
    const userYotAccount = await getAssociatedTokenAddress(
      new PublicKey(YOT_MINT),
      wallet.publicKey
    );
    
    const userYosAccount = await getAssociatedTokenAddress(
      new PublicKey(YOS_MINT),
      wallet.publicKey
    );
    
    // Check if token accounts exist, create if needed
    const userYotAccountInfo = await connection.getAccountInfo(userYotAccount);
    const userYosAccountInfo = await connection.getAccountInfo(userYosAccount);
    
    const createAccountInstructions = [];
    
    if (!userYotAccountInfo) {
      console.log("Creating YOT token account...");
      createAccountInstructions.push(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userYotAccount,
          wallet.publicKey,
          new PublicKey(YOT_MINT)
        )
      );
    }
    
    if (!userYosAccountInfo) {
      console.log("Creating YOS token account...");
      createAccountInstructions.push(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userYosAccount,
          wallet.publicKey,
          new PublicKey(YOS_MINT)
        )
      );
    }
    
    // Calculate minimum amount out (5% slippage tolerance)
    const minYotAmount = solAmount * 0.95;
    
    // Create swap instruction
    const swapInstruction = createSwapInstruction(
      wallet.publicKey,
      new PublicKey(SOL_POOL_WALLET),
      new PublicKey(YOT_POOL_TOKEN_ACCOUNT),
      userYotAccount,
      new PublicKey(COMMON_WALLET_ADDRESS),
      new PublicKey(YOS_MINT),
      userYosAccount,
      solAmount,
      minYotAmount
    );
    
    // Add priority fee instruction
    const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 500_000,
    });
    
    // Build transaction
    const transaction = new Transaction();
    transaction.feePayer = wallet.publicKey;
    
    // Get blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    
    // Add all instructions
    transaction.add(priorityFeeInstruction);
    
    // Add account creation instructions if needed
    if (createAccountInstructions.length > 0) {
      transaction.add(...createAccountInstructions);
    }
    
    // Add the swap instruction
    transaction.add(swapInstruction);
    
    // Sign and send the transaction
    console.log("Sending transaction...");
    try {
      // Try with simulation first
      console.log("Simulating transaction...");
      const simulation = await connection.simulateTransaction(transaction);
      
      if (simulation.value.err) {
        console.error("Simulation error:", simulation.value.err);
        
        // If simulation fails, try with skipPreflight
        console.log("Transaction failed preflight checks, trying with skipPreflight=true");
        const signature = await wallet.sendTransaction(transaction, connection, { skipPreflight: true });
        console.log("Transaction sent successfully:", signature);
        return { success: true, signature };
      } else {
        console.log("Simulation successful, sending transaction");
        const signature = await wallet.sendTransaction(transaction, connection);
        console.log("Transaction sent successfully:", signature);
        return { success: true, signature };
      }
    } catch (error) {
      console.error("Error during simulation or transaction:", error);
      return { success: false, error };
    }
  } catch (error) {
    console.error("Error in executeSimplifiedSwap:", error);
    return { success: false, error };
  }
}