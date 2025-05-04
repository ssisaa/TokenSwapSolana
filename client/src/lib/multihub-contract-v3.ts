/**
 * MultihubSwap V3 Contract
 * 
 * This is an upgraded version of the multihub swap contract with improved
 * token account validation, error handling, and robust instruction serialization.
 * 
 * IMPORTANT: This implementation uses direct buffer serialization instead of Borsh to avoid
 * various issues with Borsh implementation differences between JavaScript and Rust:
 * 
 * 1. Version inconsistencies between borsh in JS and Rust
 * 2. Inexact field typing (e.g., BigInt vs u64 confusion)
 * 3. Lack of enum support — JS borsh doesn't natively support Rust-style enums
 * 4. Silent failures with vague BorshIoError: Unknown errors
 * 
 * By manually building byte buffers, we:
 * - Avoid schema errors entirely
 * - Exactly control the layout to match Rust expectations
 * - Future-proof our instruction encoding
 */

import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { config } from './config';

// Program ID for the multihub swap V3/V4 contract from central config
export const MULTIHUB_SWAP_PROGRAM_ID = config.programs.multiHub.v4;

// Token addresses from central config
export const YOT_TOKEN_MINT = config.tokens.YOT;
export const YOS_TOKEN_MINT = config.tokens.YOS;

// Constants for the program from central config
export const LP_CONTRIBUTION_RATE = config.parameters.swap.liquidityContributionRate;
export const ADMIN_FEE_RATE = config.parameters.swap.adminFeeRate;
export const YOS_CASHBACK_RATE = config.parameters.swap.yosCashbackRate;
export const SWAP_FEE_RATE = config.parameters.swap.swapFeeRate;
export const REFERRAL_RATE = config.parameters.swap.referralRate;

/**
 * Manual buffer serialization for initialization instruction
 * This matches the Rust enum variant MultihubSwapInstruction::Initialize exactly
 */
export function buildInitializeInstruction({
  admin,
  yotMint,
  yosMint,
  rates,
}: {
  admin: PublicKey;
  yotMint: PublicKey;
  yosMint: PublicKey;
  rates: {
    lp: bigint;
    fee: bigint;
    cashback: bigint;
    swap: bigint;
    referral: bigint;
  };
}): Buffer {
  const discriminator = Buffer.from([0]); // enum variant for Initialize
  const buffer = Buffer.alloc(1 + 32 * 3 + 8 * 5);
  let offset = 0;

  discriminator.copy(buffer, offset);
  offset += 1;

  admin.toBuffer().copy(buffer, offset);
  offset += 32;

  yotMint.toBuffer().copy(buffer, offset);
  offset += 32;

  yosMint.toBuffer().copy(buffer, offset);
  offset += 32;

  buffer.writeBigUInt64LE(rates.lp, offset);
  offset += 8;

  buffer.writeBigUInt64LE(rates.fee, offset);
  offset += 8;

  buffer.writeBigUInt64LE(rates.cashback, offset);
  offset += 8;

  buffer.writeBigUInt64LE(rates.swap, offset);
  offset += 8;

  buffer.writeBigUInt64LE(rates.referral, offset);
  offset += 8;

  return buffer;
}

/**
 * Manual buffer serialization for swap instruction
 * This matches the Rust enum variant MultihubSwapInstruction::Swap exactly
 */
export function buildSwapInstruction({
  amountIn,
  minAmountOut,
}: {
  amountIn: bigint;
  minAmountOut: bigint;
}): Buffer {
  const discriminator = Buffer.from([1]); // enum variant for Swap
  const buffer = Buffer.alloc(1 + 8 + 8); // 1 byte for enum + 2 * u64

  let offset = 0;
  discriminator.copy(buffer, offset);
  offset += 1;

  buffer.writeBigUInt64LE(amountIn, offset);
  offset += 8;

  buffer.writeBigUInt64LE(minAmountOut, offset);

  return buffer;
}

/**
 * Manual buffer serialization for close program instruction
 * This matches the Rust enum variant MultihubSwapInstruction::CloseProgram exactly
 */
export function buildCloseProgramInstruction(): Buffer {
  return Buffer.from([2]); // enum variant for CloseProgram, no payload
}

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
 * Fund the program authority account with SOL to fix 'InsufficientFunds' errors
 * This is needed to ensure the program can create token accounts and process swaps
 */
export async function fundProgramAuthority(
  connection: Connection,
  wallet: any,
  amountSOL: number = 0.05 // Default to 0.05 SOL which is enough for several token accounts
): Promise<string> {
  try {
    // Get program authority address
    const [programAuthorityAddress] = findProgramAuthorityAddress();
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Set fee payer
    transaction.feePayer = wallet.publicKey;
    
    // Add a recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Convert SOL amount to lamports (1 SOL = 1,000,000,000 lamports)
    const lamports = Math.floor(amountSOL * 1_000_000_000);
    
    // Add transfer instruction to the transaction
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: programAuthorityAddress,
        lamports,
      })
    );
    
    console.log(`Sending ${amountSOL} SOL to program authority at ${programAuthorityAddress.toBase58()}`);
    
    // Sign and send the transaction
    const signature = await wallet.sendTransaction(transaction, connection);
    
    console.log(`Transaction sent with signature ${signature}`);
    console.log(`Program authority funded successfully with ${amountSOL} SOL`);
    
    return signature;
  } catch (error) {
    console.error('Error funding program authority:', error);
    throw error;
  }
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
    
    // Add a SOL transfer to fund the Program Authority with SOL to prevent InsufficientFunds errors
    console.log(`Adding funding instruction for Program Authority: ${programAuthorityAddress.toString()}`);
    const fundingInstruction = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: programAuthorityAddress,
      lamports: 1000000, // 0.001 SOL (1,000,000 lamports) for program operations
    });
    transaction.add(fundingInstruction);
    
    console.log('Creating initialize instruction with:');
    console.log('Admin:', wallet.publicKey.toBase58());
    console.log('YOT Mint:', YOT_TOKEN_MINT);
    console.log('YOS Mint:', YOS_TOKEN_MINT);
    console.log('LP Contribution Rate:', LP_CONTRIBUTION_RATE);
    console.log('Admin Fee Rate:', ADMIN_FEE_RATE);
    console.log('YOS Cashback Rate:', YOS_CASHBACK_RATE);
    console.log('Swap Fee Rate:', SWAP_FEE_RATE);
    console.log('Referral Rate:', REFERRAL_RATE);
    
    // Create the instruction data using our improved direct buffer serialization
    const instructionData = buildInitializeInstruction({
      admin: wallet.publicKey,
      yotMint: new PublicKey(YOT_TOKEN_MINT),
      yosMint: new PublicKey(YOS_TOKEN_MINT),
      rates: {
        lp: BigInt(LP_CONTRIBUTION_RATE),
        fee: BigInt(ADMIN_FEE_RATE),
        cashback: BigInt(YOS_CASHBACK_RATE),
        swap: BigInt(SWAP_FEE_RATE),
        referral: BigInt(REFERRAL_RATE)
      }
    });
    
    console.log('Using direct byte serialization for Initialize instruction');
    console.log('Initialize instruction data length:', instructionData.length);
    console.log('Instruction data in bytes:', Array.from(new Uint8Array(instructionData)));
    
    // Add the initialize instruction to the transaction with EXACT accounts
    // as expected by the program (see process_initialize function)
    transaction.add({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // payer_account
        { pubkey: programStateAddress, isSigner: false, isWritable: true }, // program_state_account
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: true }, // program_authority_account - must be writable!
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
    
    // Get all the program addresses up front to avoid redeclaration issues
    const [programStateAddress, swapStateBump] = findProgramStateAddress();
    const [programAuthorityAddress, swapAuthorityBump] = findProgramAuthorityAddress();
    
    // Add a small SOL transfer to fund the Program Authority with SOL
    // This helps prevent InsufficientFunds error when using the PDA for token operations
    console.log(`Adding funding instruction for Program Authority: ${programAuthorityAddress.toString()}`);
    const fundingInstruction = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: programAuthorityAddress,
      lamports: 1000000, // 0.001 SOL (1,000,000 lamports) for program operations - increased to ensure sufficient funds
    });
    transaction.add(fundingInstruction);
    
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
    
    // Create a direct buffer encoding for the Rust-side SwapInstruction enum
    // The Swap variant has amount_in and min_amount_out fields
    
    // Convert floating-point amounts to integer lamports
    const DECIMALS = 9; // Most tokens use 9 decimals on Solana
    const amountInLamports = Math.floor(amountIn * (10 ** DECIMALS));
    const minAmountOutLamports = Math.floor(minAmountOut * (10 ** DECIMALS));
    
    console.log(`Converting ${amountIn} tokens to ${amountInLamports} lamports`);
    console.log(`Converting ${minAmountOut} min output to ${minAmountOutLamports} lamports`);
    
    // Create the swap instruction data using our improved direct buffer serialization approach
    const instructionData = buildSwapInstruction({
      amountIn: BigInt(amountInLamports),
      minAmountOut: BigInt(minAmountOutLamports)
    });
    
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
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: true }, // Program authority for token transfers - CRITICAL: must be writable!
        
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
    
    // Add a SOL transfer to fund the Program Authority with SOL to prevent InsufficientFunds errors
    console.log(`Adding funding instruction for Program Authority: ${programAuthorityAddress.toString()}`);
    const fundingInstruction = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: programAuthorityAddress,
      lamports: 1000000, // 0.001 SOL (1,000,000 lamports) for program operations
    });
    transaction.add(fundingInstruction);
    
    // Create the close program instruction data using our improved direct buffer serialization
    const instructionData = buildCloseProgramInstruction();
    
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
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: true }, // Program authority - must be writable!
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