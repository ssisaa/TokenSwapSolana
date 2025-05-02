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

/**
 * Helper function to write a BigInt as a little-endian 64-bit value
 * This is needed because the DataView API doesn't have built-in BigInt support in some environments
 */
function writeBigUInt64LE(dataView: DataView, byteOffset: number, value: bigint) {
  const lsb = Number(value & BigInt(0xFFFFFFFF));
  const msb = Number(value >> BigInt(32));
  dataView.setUint32(byteOffset, lsb, true);
  dataView.setUint32(byteOffset + 4, msb, true);
}

// Program ID for the multihub swap V3 contract
export const MULTIHUB_SWAP_PROGRAM_ID = 'Cohae9agySEgC9gyJL1QHCJWw4q58R7Wshr3rpPJHU7L';

// Token addresses (same as original contract)
export const YOT_TOKEN_MINT = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
export const YOS_TOKEN_MINT = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';

// Constants for the program
export const LP_CONTRIBUTION_RATE = 2000; // 20%
export const ADMIN_FEE_RATE = 10; // 0.1%
export const YOS_CASHBACK_RATE = 300; // 3%  
export const SWAP_FEE_RATE = 30; // 0.3%
export const REFERRAL_RATE = 50; // 0.5%

/**
 * Find the program's authority PDA
 */
export function findProgramAuthorityAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(MULTIHUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Find the program's state PDA
 */
export function findProgramStateAddress(): [PublicKey, number] {
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
    const [programStateAddress, _] = findProgramStateAddress();
    const [programAuthorityAddress, __] = findProgramAuthorityAddress();
    
    // Create the initialize instruction using a simple Buffer
    // This is a safer approach than using BorshCoder with an empty IDL
    const INSTRUCTION_INITIALIZE = 0; // Initialize instruction is index 0
    
    // Create a buffer for the instruction data
    const dataLayout = Buffer.alloc(107); // 1 + 32 + 32 + 32 + 2 + 2 + 2 + 2 + 2
    
    // Instruction index
    dataLayout.writeUInt8(INSTRUCTION_INITIALIZE, 0);
    
    // Admin pubkey
    wallet.publicKey.toBuffer().copy(dataLayout, 1);
    
    // YOT mint
    new PublicKey(YOT_TOKEN_MINT).toBuffer().copy(dataLayout, 33);
    
    // YOS mint
    new PublicKey(YOS_TOKEN_MINT).toBuffer().copy(dataLayout, 65);
    
    // Rates as little-endian u16 values
    dataLayout.writeUInt16LE(LP_CONTRIBUTION_RATE, 97);
    dataLayout.writeUInt16LE(ADMIN_FEE_RATE, 99);
    dataLayout.writeUInt16LE(YOS_CASHBACK_RATE, 101);
    dataLayout.writeUInt16LE(SWAP_FEE_RATE, 103);
    dataLayout.writeUInt16LE(REFERRAL_RATE, 105);
    
    const initializeData = dataLayout;
    
    // Add the initialize instruction to the transaction
    transaction.add({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: true },
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: false },
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
        { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }
      ],
      programId: new PublicKey(MULTIHUB_SWAP_PROGRAM_ID),
      data: Buffer.from(initializeData)
    });
    
    // Simulate the transaction to check for errors
    console.log('Simulating initialize program transaction...');
    const simulation = await connection.simulateTransaction(transaction);
    if (simulation.value.err) {
      console.error('Initialization simulation failed:', simulation.value.err);
      throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }
    
    // Send the transaction
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
    const [programStateAddress, _] = findProgramStateAddress();
    const [programAuthorityAddress, __] = findProgramAuthorityAddress();
    
    // Create the swap instruction using a simple Buffer
    // This is a safer approach than using BorshCoder with an empty IDL
    const INSTRUCTION_SWAP = 1; // Swap instruction is index 1
    
    // Create a buffer for the instruction data
    const dataLayout = Buffer.alloc(1 + 8 + 8);
    
    // Instruction index
    dataLayout.writeUInt8(INSTRUCTION_SWAP, 0);
    
    // Amount in (u64 / 8 bytes)
    const amountInBigInt = BigInt(amountIn);
    let bufferView = new DataView(dataLayout.buffer, dataLayout.byteOffset + 1, 8);
    writeBigUInt64LE(bufferView, 0, amountInBigInt);
    
    // Min amount out (u64 / 8 bytes)
    const minAmountOutBigInt = BigInt(minAmountOut);
    bufferView = new DataView(dataLayout.buffer, dataLayout.byteOffset + 9, 8);
    writeBigUInt64LE(bufferView, 0, minAmountOutBigInt);
    
    const swapData = dataLayout;
    
    // Add the swap instruction to the transaction
    transaction.add({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: false },
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: false },
        { pubkey: tokenFromAccount, isSigner: false, isWritable: true },
        { pubkey: tokenToAccount, isSigner: false, isWritable: true },
        { pubkey: yosTokenAccount, isSigner: false, isWritable: true },
        { pubkey: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), isSigner: false, isWritable: false }
      ],
      programId: new PublicKey(MULTIHUB_SWAP_PROGRAM_ID),
      data: Buffer.from(swapData)
    });
    
    // Simulate the transaction to check for errors
    console.log('Simulating swap transaction...');
    const simulation = await connection.simulateTransaction(transaction);
    if (simulation.value.err) {
      console.error('Swap simulation failed:', simulation.value.err);
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
    const [programStateAddress, _] = findProgramStateAddress();
    const [programAuthorityAddress, __] = findProgramAuthorityAddress();
    
    // Create the close program instruction using a simple Buffer
    // This is a safer approach than using BorshCoder with an empty IDL
    const INSTRUCTION_CLOSE_PROGRAM = 2; // Close program instruction is index 2
    
    // Create a buffer for the instruction data (just the instruction index)
    const dataLayout = Buffer.alloc(1);
    
    // Instruction index
    dataLayout.writeUInt8(INSTRUCTION_CLOSE_PROGRAM, 0);
    
    const closeProgramData = dataLayout;
    
    // Add the close program instruction to the transaction
    // IMPORTANT: Include ONLY the accounts required by the smart contract
    // From the Rust code, only these accounts are needed:
    // 1. Admin account (signer)
    // 2. Program state account (PDA)
    transaction.add({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // Admin account that receives the rent
        { pubkey: programStateAddress, isSigner: false, isWritable: true }, // Program state account to be closed
      ],
      programId: new PublicKey(MULTIHUB_SWAP_PROGRAM_ID),
      data: Buffer.from(closeProgramData)
    });
    
    // Simulate the transaction to check for errors
    console.log('Simulating close program transaction...');
    const simulation = await connection.simulateTransaction(transaction);
    if (simulation.value.err) {
      console.error('Transaction simulation failed:', simulation.value.err);
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