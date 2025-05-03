/**
 * MultihubSwap V3 Contract
 * 
 * This is an upgraded version of the multihub swap contract with improved
 * token account validation and error handling.
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import * as borsh from 'borsh';

/**
 * Borsh compatible class for InitializeInstruction
 * This must exactly match the Rust struct definition
 */
class InitializeInstruction {
  admin: Uint8Array;
  yot_mint: Uint8Array;
  yos_mint: Uint8Array;
  lp_contribution_rate: bigint;
  admin_fee_rate: bigint;
  yos_cashback_rate: bigint;
  swap_fee_rate: bigint;
  referral_rate: bigint;

  constructor(fields: {
    admin: Uint8Array;
    yot_mint: Uint8Array;
    yos_mint: Uint8Array;
    lp_contribution_rate: bigint;
    admin_fee_rate: bigint;
    yos_cashback_rate: bigint;
    swap_fee_rate: bigint;
    referral_rate: bigint;
  }) {
    this.admin = fields.admin;
    this.yot_mint = fields.yot_mint;
    this.yos_mint = fields.yos_mint;
    this.lp_contribution_rate = fields.lp_contribution_rate;
    this.admin_fee_rate = fields.admin_fee_rate;
    this.yos_cashback_rate = fields.yos_cashback_rate;
    this.swap_fee_rate = fields.swap_fee_rate;
    this.referral_rate = fields.referral_rate;
  }
}

/**
 * Borsh compatible class for SwapInstruction
 * This must exactly match the Rust struct definition
 */
class SwapInstruction {
  amount_in: number;
  min_amount_out: number;

  constructor(amount_in: number, min_amount_out: number) {
    this.amount_in = amount_in;
    this.min_amount_out = min_amount_out;
  }
}

/**
 * Borsh compatible class for CloseProgramInstruction
 * This must exactly match the Rust struct definition
 */
class CloseProgramInstruction {
  constructor() {
    // Empty constructor since the struct has no fields
  }
}

// Define Borsh Schema for InitializeInstruction
const InitializeInstructionSchema = new Map([
  [
    InitializeInstruction,
    {
      kind: "struct",
      fields: [
        ["admin", [32]],
        ["yot_mint", [32]],
        ["yos_mint", [32]],
        ["lp_contribution_rate", "u64"],
        ["admin_fee_rate", "u64"],
        ["yos_cashback_rate", "u64"],
        ["swap_fee_rate", "u64"],
        ["referral_rate", "u64"],
      ],
    },
  ],
]);

// Define Borsh Schema for SwapInstruction
const SwapInstructionSchema = new Map([
  [
    SwapInstruction,
    {
      kind: "struct",
      fields: [
        ["amount_in", "u64"],
        ["min_amount_out", "u64"],
      ],
    },
  ],
]);

// Define Borsh Schema for CloseProgramInstruction
const CloseProgramInstructionSchema = new Map([
  [
    CloseProgramInstruction,
    {
      kind: "struct",
      fields: [],
    },
  ],
]);

// Program ID for the multihub swap V3 contract
export const MULTIHUB_SWAP_PROGRAM_ID = 'Cohae9agySEgC9gyJL1QHCJWw4q58R7Wshr3rpPJHU7L';

// Token addresses (same as original contract)
export const YOT_TOKEN_MINT = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
export const YOS_TOKEN_MINT = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';

// ====== Instruction types matching the Rust contract definitions =======
// Rust-compatible instruction variants for the V3 contract
// These must match exactly the structure in the Rust program

// Enum variants
enum InstructionVariant {
  Initialize = 0,
  Swap = 1,
  CloseProgram = 2
}

// Constants for the program
export const LP_CONTRIBUTION_RATE = 2000; // 20%
export const ADMIN_FEE_RATE = 10; // 0.1%
export const YOS_CASHBACK_RATE = 300; // 3%  
export const SWAP_FEE_RATE = 30; // 0.3%
export const REFERRAL_RATE = 50; // 0.5%

/**
 * Find the program's authority PDA
 * From multihub_swap.rs: let (authority_pubkey, authority_bump_seed) = Pubkey::find_program_address(&[b"authority"], program_id);
 */
export function findProgramAuthorityAddress(): [PublicKey, number] {
  // Must match EXACTLY what the program uses for the seed
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(MULTIHUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Find the program's state PDA
 * From multihub_swap_v3.rs: Pubkey::find_program_address(&[b"state"], program_id)
 */
export function findProgramStateAddress(): [PublicKey, number] {
  // Must match EXACTLY what the program uses for the seed
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(MULTIHUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Initialize the multihub swap program
 */
export async function initializeProgram(
  connection: Connection,
  wallet: any
): Promise<string> {
  try {
    // Create a new transaction
    const transaction = new Transaction();
    
    // Set fee payer immediately
    transaction.feePayer = wallet.publicKey;
    
    // Add a recent blockhash immediately
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Get program state address
    const [programStateAddress, stateBump] = findProgramStateAddress();
    const [programAuthorityAddress, authorityBump] = findProgramAuthorityAddress();
    
    // Create the initialize instruction data using Borsh serialization
    // This will exactly match what the contract expects
    
    console.log('Creating initialize instruction with:');
    console.log('Admin:', wallet.publicKey.toBase58());
    console.log('YOT Mint:', YOT_TOKEN_MINT);
    console.log('YOS Mint:', YOS_TOKEN_MINT);
    console.log('LP Contribution Rate:', LP_CONTRIBUTION_RATE);
    console.log('Admin Fee Rate:', ADMIN_FEE_RATE);
    console.log('YOS Cashback Rate:', YOS_CASHBACK_RATE);
    console.log('Swap Fee Rate:', SWAP_FEE_RATE);
    console.log('Referral Rate:', REFERRAL_RATE);
    
    // Create the instruction object
    const initializeInstructionObj = new InitializeInstruction(
      wallet.publicKey.toBuffer(),
      new PublicKey(YOT_TOKEN_MINT).toBuffer(),
      new PublicKey(YOS_TOKEN_MINT).toBuffer(),
      LP_CONTRIBUTION_RATE,
      ADMIN_FEE_RATE,
      YOS_CASHBACK_RATE,
      SWAP_FEE_RATE,
      REFERRAL_RATE
    );
    
    // Serialize the instruction data using Borsh
    const serializedData = borsh.serialize(
      initializeInstructionSchema,
      initializeInstructionObj
    );
    
    // Create the final instruction buffer with the variant index at the beginning
    const instructionData = Buffer.alloc(1 + serializedData.length);
    instructionData.writeUInt8(InstructionVariant.Initialize, 0); // Write the variant index
    
    // Copy the serialized data after the variant
    for (let i = 0; i < serializedData.length; i++) {
      instructionData[i + 1] = serializedData[i];
    }
    
    console.log('Using direct buffer encoding for Initialize instruction');
    console.log('Initialize instruction data length:', instructionData.length);
    console.log('Instruction data in bytes:', Array.from(new Uint8Array(instructionData)));
    
    // Add the initialize instruction to the transaction with EXACT accounts
    // as expected by the program (see process_initialize function)
    transaction.add({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // payer_account
        { pubkey: programStateAddress, isSigner: false, isWritable: true }, // program_state_account
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: false }, // program_authority_account
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }, // system_program_account
        { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }, // rent_sysvar_account
      ],
      programId: new PublicKey(MULTIHUB_SWAP_PROGRAM_ID),
      data: instructionData
    });
    
    // Simulate the transaction to check for errors
    console.log('Simulating initialize program transaction...');
    const simulation = await connection.simulateTransaction(transaction, undefined, true);
    
    // Log detailed simulation results
    console.log('Detailed simulation logs:', simulation.value.logs);
    
    if (simulation.value.err) {
      console.error('Initialization simulation failed:', simulation.value.err);
      console.error('Simulation error details:', JSON.stringify(simulation.value.err));
      throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }
    
    // Send the transaction
    console.log('Sending initialization transaction...');
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log('Program initialization transaction sent:', signature);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    return signature;
  } catch (error) {
    console.error('Error in initialize program function:', error);
    throw error;
  }
}

/**
 * Ensure a token account exists, or create it if it doesn't
 */
async function ensureTokenAccount(
  connection: Connection,
  wallet: any,
  mint: PublicKey,
  transaction: Transaction
): Promise<PublicKey> {
  // Get the associated token address for the wallet
  const tokenAccount = await getAssociatedTokenAddress(
    mint,
    wallet.publicKey
  );
  
  // Check if the account exists
  const accountInfo = await connection.getAccountInfo(tokenAccount);
  
  // If account doesn't exist, create it
  if (!accountInfo) {
    console.log('Creating token account for mint:', mint.toString());
    const createAtaIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      tokenAccount,
      wallet.publicKey,
      mint
    );
    transaction.add(createAtaIx);
  }
  
  return tokenAccount;
}

/**
 * Perform a token swap using the multihub swap V3 program
 */
export async function performSwap(
  connection: Connection,
  wallet: any,
  tokenFromMint: PublicKey,
  tokenToMint: PublicKey,
  amountIn: number,
  minAmountOut: number
): Promise<string> {
  try {
    // Create a new transaction
    const transaction = new Transaction();
    
    // Set fee payer immediately
    transaction.feePayer = wallet.publicKey;
    
    // Add a recent blockhash immediately
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Ensure token accounts exist
    const tokenFromAccount = await ensureTokenAccount(
      connection, 
      wallet, 
      tokenFromMint, 
      transaction
    );
    
    const tokenToAccount = await ensureTokenAccount(
      connection, 
      wallet, 
      tokenToMint, 
      transaction
    );
    
    // Ensure YOS token account exists
    const yosTokenAccount = await ensureTokenAccount(
      connection,
      wallet,
      new PublicKey(YOS_TOKEN_MINT),
      transaction
    );
    
    // Get program addresses
    const [programStateAddress, swapStateBump] = findProgramStateAddress();
    const [programAuthorityAddress, swapAuthorityBump] = findProgramAuthorityAddress();
    
    // Create a direct buffer encoding for the Rust-side SwapInstruction enum
    // The Swap variant has amount_in and min_amount_out fields
    
    // Convert floating-point amounts to integer lamports
    const DECIMALS = 9; // Most tokens use 9 decimals on Solana
    const amountInLamports = Math.floor(amountIn * (10 ** DECIMALS));
    const minAmountOutLamports = Math.floor(minAmountOut * (10 ** DECIMALS));
    
    console.log(`Converting ${amountIn} tokens to ${amountInLamports} lamports`);
    console.log(`Converting ${minAmountOut} min output to ${minAmountOutLamports} lamports`);
    
    // Create the swap instruction data using Borsh serialization
    // This will exactly match what the contract expects
    
    // Create the swap instruction object
    const swapInstructionObj = new SwapInstruction(
      amountInLamports,
      minAmountOutLamports
    );
    
    // Serialize the instruction data using Borsh
    const serializedData = borsh.serialize(
      swapInstructionSchema,
      swapInstructionObj
    );
    
    // Create the final instruction buffer with the variant index at the beginning
    const instructionData = Buffer.alloc(1 + serializedData.length);
    instructionData.writeUInt8(InstructionVariant.Swap, 0); // Write the variant index
    
    // Copy the serialized data after the variant
    for (let i = 0; i < serializedData.length; i++) {
      instructionData[i + 1] = serializedData[i];
    }
    
    console.log('Using direct buffer encoding for Swap instruction');
    console.log('Swap instruction data length:', instructionData.length);
    console.log('Swap instruction data bytes:', Array.from(new Uint8Array(instructionData)));
    
    const swapData = instructionData;
    
    // Find all Token Program PDAs for token account verification
    const tokenFromMintATA = await getAssociatedTokenAddress(
      tokenFromMint,
      programAuthorityAddress,
      true  // allowOwnerOffCurve: true for PDAs
    );
    
    const tokenToMintATA = await getAssociatedTokenAddress(
      tokenToMint, 
      programAuthorityAddress,
      true // allowOwnerOffCurve: true for PDAs
    );
    
    const yosTokenProgramATA = await getAssociatedTokenAddress(
      new PublicKey(YOS_TOKEN_MINT),
      programAuthorityAddress,
      true // allowOwnerOffCurve: true for PDAs
    );
    
    // Check if program token accounts exist and create them if needed
    try {
      // Check the program's token accounts
      const tokenFromProgramAccount = await connection.getAccountInfo(tokenFromMintATA);
      if (!tokenFromProgramAccount) {
        console.log('Creating program token account for tokenFromMint:', tokenFromMint.toString());
        const ix = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          tokenFromMintATA,
          programAuthorityAddress,
          tokenFromMint
        );
        transaction.add(ix);
      }
      
      const tokenToProgramAccount = await connection.getAccountInfo(tokenToMintATA);
      if (!tokenToProgramAccount) {
        console.log('Creating program token account for tokenToMint:', tokenToMint.toString());
        const ix = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          tokenToMintATA,
          programAuthorityAddress,
          tokenToMint
        );
        transaction.add(ix);
      }
      
      const yosProgramAccount = await connection.getAccountInfo(yosTokenProgramATA);
      if (!yosProgramAccount) {
        console.log('Creating program token account for YOS mint');
        const ix = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          yosTokenProgramATA,
          programAuthorityAddress,
          new PublicKey(YOS_TOKEN_MINT)
        );
        transaction.add(ix);
      }
    } catch (err) {
      console.warn('Error checking program token accounts:', err);
      // Continue anyway as this may not be fatal
    }
    
    console.log('Token accounts for program operation:', {
      tokenFromAccount: tokenFromAccount.toBase58(),
      tokenToAccount: tokenToAccount.toBase58(),
      tokenFromMintATA: tokenFromMintATA.toBase58(),
      tokenToMintATA: tokenToMintATA.toBase58(),
      yosTokenAccount: yosTokenAccount.toBase58(),
      yosTokenProgramATA: yosTokenProgramATA.toBase58(),
      programAuthorityAddress: programAuthorityAddress.toBase58()
    });
    
    // Add token mint accounts to the transaction
    // Including the mint accounts is often required for proper validation
    const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
    const SYSVAR_RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');
    
    // Perform additional validation and ensure APR accounts exist
    console.log(`Using tokenFromMint: ${tokenFromMint.toString()}`);
    console.log(`Using tokenToMint: ${tokenToMint.toString()}`);
    console.log(`Using YOS mint: ${YOS_TOKEN_MINT}`);
    
    // Add the swap instruction to the transaction with more complete account list
    transaction.add({
      keys: [
        // User accounts
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // User wallet
        { pubkey: programStateAddress, isSigner: false, isWritable: true }, // Program state for updating
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: false }, // Program authority for token transfers
        
        // User token accounts
        { pubkey: tokenFromAccount, isSigner: false, isWritable: true }, // User's source token account
        { pubkey: tokenToAccount, isSigner: false, isWritable: true }, // User's destination token account
        { pubkey: yosTokenAccount, isSigner: false, isWritable: true }, // User's YOS token account for cashback
        
        // Program token accounts
        { pubkey: tokenFromMintATA, isSigner: false, isWritable: true }, // Program's token account for source token
        { pubkey: tokenToMintATA, isSigner: false, isWritable: true }, // Program's token account for destination token
        { pubkey: yosTokenProgramATA, isSigner: false, isWritable: true }, // Program's YOS token account
        
        // Token mints
        { pubkey: tokenFromMint, isSigner: false, isWritable: false }, // From token mint
        { pubkey: tokenToMint, isSigner: false, isWritable: false }, // To token mint
        { pubkey: new PublicKey(YOS_TOKEN_MINT), isSigner: false, isWritable: false }, // YOS token mint
        
        // System programs
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // SPL Token program
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false }, // System program
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // Rent sysvar
      ],
      programId: new PublicKey(MULTIHUB_SWAP_PROGRAM_ID),
      data: Buffer.from(swapData)
    });
    
    // Simulate the transaction to check for errors with detailed output
    console.log('Simulating swap transaction...');
    const simulation = await connection.simulateTransaction(transaction, undefined, true);
    
    // Log detailed simulation results
    console.log('Detailed swap simulation logs:', simulation.value.logs);
    
    if (simulation.value.err) {
      console.error('Swap simulation failed:', simulation.value.err);
      console.error('Simulation error details:', JSON.stringify(simulation.value.err));
      throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }
    
    // Send the transaction
    console.log('Sending swap transaction...');
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log('Swap transaction sent:', signature);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    return signature;
  } catch (error) {
    console.error('Error in swap function:', error);
    throw error;
  }
}

/**
 * Close the program (admin only)
 */
export async function closeProgram(
  connection: Connection,
  wallet: any
): Promise<string> {
  try {
    // Create a new transaction
    const transaction = new Transaction();
    
    // Set fee payer immediately
    transaction.feePayer = wallet.publicKey;
    
    // Add a recent blockhash immediately
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Get program state and authority addresses
    const [programStateAddress, closeProgramStateBump] = findProgramStateAddress();
    const [programAuthorityAddress, closeProgramAuthorityBump] = findProgramAuthorityAddress();
    
    // Create the close program instruction data using Borsh serialization
    // This will exactly match what the contract expects
    
    // Create the close program instruction object
    const closeProgramInstructionObj = new CloseProgramInstruction();
    
    // Serialize the instruction data using Borsh
    const serializedData = borsh.serialize(
      closeProgramInstructionSchema,
      closeProgramInstructionObj
    );
    
    // Create the final instruction buffer with the variant index at the beginning
    const instructionData = Buffer.alloc(1 + serializedData.length);
    instructionData.writeUInt8(InstructionVariant.CloseProgram, 0); // Write the variant index
    
    // Copy the serialized data after the variant
    if (serializedData.length > 0) {
      for (let i = 0; i < serializedData.length; i++) {
        instructionData[i + 1] = serializedData[i];
      }
    }
    
    console.log('Using direct buffer encoding for CloseProgram instruction');
    console.log('CloseProgram instruction data length:', instructionData.length);
    console.log('CloseProgram instruction data bytes:', Array.from(new Uint8Array(instructionData)));
    
    const closeProgramData = instructionData;
    
    // Add the close program instruction to the transaction
    // IMPORTANT: Ensure we include ALL the required accounts:
    // 1. Admin account (signer)
    // 2. Program state account (PDA)
    // 3. Program authority account (PDA used for token operations)
    transaction.add({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // Admin account that receives the rent
        { pubkey: programStateAddress, isSigner: false, isWritable: true }, // Program state account to be closed
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: false }, // Program authority - may be needed
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }, // System Program - needed for closing accounts
      ],
      programId: new PublicKey(MULTIHUB_SWAP_PROGRAM_ID),
      data: Buffer.from(closeProgramData)
    });
    
    // Simulate the transaction to check for errors
    console.log('Simulating close program transaction...');
    const simulation = await connection.simulateTransaction(transaction, undefined, true);
    
    // Log detailed information
    console.log('Detailed simulation logs:', simulation.value.logs);
    
    if (simulation.value.err) {
      console.error('Transaction simulation failed:', simulation.value.err);
      console.error('Simulation error details:', JSON.stringify(simulation.value.err));
      throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }
    
    // Send the transaction
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log('Program close transaction sent:', signature);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    return signature;
  } catch (error) {
    console.error('Error in close program function:', error);
    throw error;
  }
}

export default {
  MULTIHUB_SWAP_PROGRAM_ID,
  YOT_TOKEN_MINT,
  YOS_TOKEN_MINT,
  findProgramAuthorityAddress,
  findProgramStateAddress,
  initializeProgram,
  performSwap,
  closeProgram
};