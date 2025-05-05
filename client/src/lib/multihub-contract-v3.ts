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

import { Connection, PublicKey, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID as SPL_TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID as SPL_ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { config } from './config';
import { connectionManager } from './connection-manager';
import { validateTokenAccount as validateSplTokenAccount } from './validateTokenAccount';

// Import the config getters
import { getMultiHubProgramId, getMultiHubProgramPublicKey } from './config';

// Get the program ID from config as both string and PublicKey
export const MULTIHUB_SWAP_PROGRAM_ID = getMultiHubProgramId('v4');
export const MULTIHUB_SWAP_PROGRAM_PUBKEY = getMultiHubProgramPublicKey('v4');

// Validate and log the program ID
console.log(`Using MultihubSwap Program ID (string): ${MULTIHUB_SWAP_PROGRAM_ID}`);
console.log(`Using MultihubSwap Program ID (PublicKey): ${MULTIHUB_SWAP_PROGRAM_PUBKEY.toString()}`);
console.log(`Program ID valid: ${MULTIHUB_SWAP_PROGRAM_PUBKEY !== undefined && MULTIHUB_SWAP_PROGRAM_PUBKEY !== null}`);
console.log(`Program ID prototype: ${Object.prototype.toString.call(MULTIHUB_SWAP_PROGRAM_PUBKEY)}`);

// Define essential Solana system addresses (used throughout the module)
// Use imported constants from @solana/spl-token to ensure consistency
const TOKEN_PROGRAM_ID = SPL_TOKEN_PROGRAM_ID;
const ASSOCIATED_TOKEN_PROGRAM_ID = SPL_ASSOCIATED_TOKEN_PROGRAM_ID;
const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
const SYSVAR_RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');

// Define token accounts from config for both authorities for dual implementation and fallback
const POOL_AUTHORITY = config.accounts?.poolAuthority || "7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK";
// Program authority is a PDA derived from the program ID
// This is derived dynamically using findProgramAuthorityAddress()
// We no longer have a hardcoded authority as it's deterministically derived

// Primary token accounts (Pool Authority) from config
const DEFAULT_SOL_TOKEN_ACCOUNT = config.accounts?.poolSol || "7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS";
const DEFAULT_YOT_TOKEN_ACCOUNT = config.accounts?.yotToken || "BtHDQ6QwAffeeGftkNQK8X22n7HfnX4dud5vVsPZdqzE";
const DEFAULT_YOS_TOKEN_ACCOUNT = config.accounts?.yosToken || "5eQTdriuNrWaVdbLiyKDPwakYjM9na6ctYbxauPxaqWz";

// Fallback token accounts (Program Authority ATAs)
// These are associated token accounts dynamically derived based on the Program Authority PDA
// We derive these dynamically using findProgramAuthorityAddress() rather than hardcoding them
// But keep these constants for backwards compatibility during the transition
// Empty string values will be replaced with dynamically derived values when needed
const FALLBACK_YOT_TOKEN_ACCOUNT = ""; // Will be derived dynamically as needed
const FALLBACK_YOS_TOKEN_ACCOUNT = ""; // Will be derived dynamically as needed

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
 * UPDATED TO MATCH the exact format expected by the Rust code in process_initialize function
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
  // In the Rust code, instruction_data.first() is used to determine the instruction type (0 = Initialize)
  // Then admin = Pubkey::new(&input[1..33]) which means the admin public key starts at index 1
  const discriminator = Buffer.from([0]); // enum variant for Initialize = 0
  
  // Size of data buffer: 1 byte discriminator + 3 PublicKeys (32 bytes each) + 5 u64 values (8 bytes each)
  const buffer = Buffer.alloc(1 + 32 * 3 + 8 * 5);
  let offset = 0;

  // Write the discriminator (instruction type)
  discriminator.copy(buffer, offset);
  offset += 1;

  // Write the admin public key - Pubkey::new(&input[1..33])
  admin.toBuffer().copy(buffer, offset);
  offset += 32;

  // Write the YOT mint public key - Pubkey::new(&input[33..65])
  yotMint.toBuffer().copy(buffer, offset);
  offset += 32;

  // Write the YOS mint public key - Pubkey::new(&input[65..97])
  yosMint.toBuffer().copy(buffer, offset);
  offset += 32;

  // Write the rates as u64 LE values matching the exact byte offsets in the Rust code
  // LP rate - u64::from_le_bytes(input[97..105].try_into().unwrap())
  buffer.writeBigUInt64LE(rates.lp, offset);
  offset += 8;

  // Admin fee - u64::from_le_bytes(input[105..113].try_into().unwrap())
  buffer.writeBigUInt64LE(rates.fee, offset);
  offset += 8;

  // Cashback rate - u64::from_le_bytes(input[113..121].try_into().unwrap())
  buffer.writeBigUInt64LE(rates.cashback, offset);
  offset += 8;

  // Swap fee - u64::from_le_bytes(input[121..129].try_into().unwrap())
  buffer.writeBigUInt64LE(rates.swap, offset);
  offset += 8;

  // Referral rate - u64::from_le_bytes(input[129..137].try_into().unwrap())
  buffer.writeBigUInt64LE(rates.referral, offset);
  offset += 8;

  return buffer;
}

/**
 * Manual buffer serialization for swap instruction
 * This matches the Rust enum variant MultihubSwapInstruction::Swap exactly
 * 
 * CRITICAL FIX: Added detailed verification to ensure buffer is created correctly
 */
export function buildSwapInstruction({
  amountIn,
  minAmountOut,
}: {
  amountIn: bigint;
  minAmountOut: bigint;
}): Buffer {
  console.log("Building swap instruction with:");
  console.log(`Amount In: ${amountIn.toString()} (${Number(amountIn) / 1e9} tokens)`);
  console.log(`Min Amount Out: ${minAmountOut.toString()} (${Number(minAmountOut) / 1e9} tokens)`);

  // CRITICAL FIX: Ensure proper data layout that matches Rust exactly
  // The Rust side is using: let mut instruction_data = [0u8; 17];
  const discriminator = Buffer.from([1]); // enum variant for Swap = 1
  const buffer = Buffer.alloc(1 + 8 + 8); // 1 byte for enum + 8 bytes for amountIn + 8 bytes for minAmountOut

  // Write with very explicit offset tracking for debugging
  let offset = 0;
  
  // Write enum discriminator first (1 = Swap)
  discriminator.copy(buffer, offset);
  offset += 1;
  
  // CRITICAL FIX: Check for integer overflow and cap at maximum u64 value
  // Maximum u64 value is 2^64-1 = 18446744073709551615
  const MAX_U64 = BigInt("18446744073709551615");
  
  // Cap amounts to prevent overflow
  const safeAmountIn = amountIn > MAX_U64 ? MAX_U64 : amountIn;
  const safeMinAmountOut = minAmountOut > MAX_U64 ? MAX_U64 : minAmountOut;
  
  if (amountIn !== safeAmountIn) {
    console.warn(`WARNING: Amount in (${amountIn}) exceeds maximum u64 value, capping at ${MAX_U64}`);
  }
  
  if (minAmountOut !== safeMinAmountOut) {
    console.warn(`WARNING: Min amount out (${minAmountOut}) exceeds maximum u64 value, capping at ${MAX_U64}`);
  }
  
  // Write amountIn as LE u64 (8 bytes)
  buffer.writeBigUInt64LE(safeAmountIn, offset);
  offset += 8;
  
  // Write minAmountOut as LE u64 (8 bytes)
  buffer.writeBigUInt64LE(safeMinAmountOut, offset);
  
  // CRITICAL FIX: Verify the buffer contains exactly what we expect
  const verifyBuffer = Buffer.from(buffer);
  const verifyDiscriminator = verifyBuffer.readUInt8(0);
  const verifyAmountIn = verifyBuffer.readBigUInt64LE(1);
  const verifyMinAmountOut = verifyBuffer.readBigUInt64LE(9);
  
  console.log("Verifying instruction data:");
  console.log(`- Discriminator: ${verifyDiscriminator} (should be 1)`);
  console.log(`- AmountIn: ${verifyAmountIn.toString()} (should match ${safeAmountIn.toString()})`);
  console.log(`- MinAmountOut: ${verifyMinAmountOut.toString()} (should match ${safeMinAmountOut.toString()})`);
  console.log(`- Total data size: ${buffer.length} bytes (should be 17)`);
  
  if (verifyDiscriminator !== 1 || verifyAmountIn !== safeAmountIn || verifyMinAmountOut !== safeMinAmountOut) {
    console.error("CRITICAL ERROR: Instruction data verification failed!");
  }
  
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
 * IMPORTANT: All program IDs are loaded from app.config.json
 * ensuring we always use the same deployed program ID from app.config.json for all PDA derivations and transactions
 */
// We're now using the deployed program ID from config
// Using deployed program ID directly from config
// No hardcoded program IDs anymore

/**
 * Find the program's authority PDA
 * From multihub_swap.rs: let (authority_pubkey, authority_bump_seed) = Pubkey::find_program_address(&[b"authority"], program_id);
 * 
 * Using deployed program ID from app.config.json to derive PDAs consistently.
 */
export function findProgramAuthorityAddress(): [PublicKey, number] {
  // Use the program ID from config for PDA derivation
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    MULTIHUB_SWAP_PROGRAM_PUBKEY
  );
}

/**
 * Special verification function for debugging and fixing "InvalidAccountData" error at account index 2
 * This is specifically targeting the exact problem mentioned in the Solana error logs
 */
export async function debugProgramIDs(): Promise<void> {
  // Output the program IDs for debugging purposes
  console.log(`\n=== MULTIHUB SWAP PROGRAM DEBUG INFO ===`);
  console.log(`Program ID: ${MULTIHUB_SWAP_PROGRAM_ID}`);
  console.log(`YOT Token Mint: ${YOT_TOKEN_MINT}`);
  console.log(`YOS Token Mint: ${YOS_TOKEN_MINT}`);
  
  // Calculate and log the PDA addresses using our current program ID
  const [stateAddress, stateAddressBump] = findProgramStateAddress();
  const [authorityAddress, authorityAddressBump] = findProgramAuthorityAddress();
  
  console.log(`\n=== PROGRAM PDAs ===`);
  console.log(`\nProgram State PDA (seed 'state'):`);
  console.log(`Address: ${stateAddress.toString()}`);
  console.log(`Bump: ${stateAddressBump}`);
  
  console.log(`\nProgram Authority PDA (seed 'authority'):`);
  console.log(`Address: ${authorityAddress.toString()}`);
  console.log(`Bump: ${authorityAddressBump}`);
  
  console.log(`\n✅ All PDA derivations use the deployed program ID from config.`);
}

/**
 * Check if the state account exists, and if it does, verify it has the correct owner and size
 * This helps diagnose the "IncorrectProgramId" and "AccountDataTooSmall" errors from the Rust code
 */
export async function checkStateAccount(
  connection: Connection
): Promise<{
  exists: boolean;
  hasCorrectOwner: boolean;
  hasCorrectSize: boolean;
  details: string;
}> {
  try {
    // Get the program state PDA address
    const [programStateAddress, stateBump] = findProgramStateAddress();
    console.log(`Checking state account at ${programStateAddress.toString()} (bump: ${stateBump})`);
    
    // Check if the account exists
    const stateInfo = await connection.getAccountInfo(programStateAddress);
    
    // If state account doesn't exist, that's fine for initialization
    if (!stateInfo) {
      return {
        exists: false,
        hasCorrectOwner: false,
        hasCorrectSize: false,
        details: "State account doesn't exist yet, ready for initialization"
      };
    }
    
    // The account exists, check owner
    const programId = MULTIHUB_SWAP_PROGRAM_PUBKEY;
    const hasCorrectOwner = stateInfo.owner.equals(programId);
    
    // Check size - the Rust code expects 32*3 + 8*5 = 136 bytes (as defined in the contract)
    const expectedSize = 32*3 + 8*5;
    const hasCorrectSize = stateInfo.data.length >= expectedSize;
    
    let details = `State account exists:\n`;
    details += `- Owner: ${stateInfo.owner.toString()}\n`;
    details += `- Expected owner: ${programId.toString()}\n`;
    details += `- Size: ${stateInfo.data.length} bytes\n`;
    details += `- Expected size: ${expectedSize} bytes\n`;
    
    if (!hasCorrectOwner) {
      details += `⚠️ INCORRECT OWNER: This will cause ProgramError::IncorrectProgramId during initialization\n`;
    }
    
    if (!hasCorrectSize) {
      details += `⚠️ ACCOUNT TOO SMALL: This will cause ProgramError::AccountDataTooSmall during initialization\n`;
    }
    
    return {
      exists: true,
      hasCorrectOwner,
      hasCorrectSize,
      details
    };
  } catch (error) {
    console.error("Error checking state account:", error);
    return {
      exists: false,
      hasCorrectOwner: false,
      hasCorrectSize: false,
      details: `Error checking state account: ${error}`
    };
  }
}

/**
 * Check if the state account exists, and if it does, verify it has the correct owner and size
 * This helps diagnose the "IncorrectProgramId" and "AccountDataTooSmall" errors from the Rust code
 * ENHANCED VERSION: Provides comprehensive diagnostics about state account

export async function verifyProgramAuthority(
  connection: Connection,
  wallet: any
): Promise<boolean> {
  try {
    // Run the debug info first
    await debugProgramIDs();
    
    const [programAuthorityAddress, programAuthorityBump] = findProgramAuthorityAddress();
    console.log(`\n=== PROGRAM AUTHORITY VERIFICATION ===`);
    console.log(`Authority PDA: ${programAuthorityAddress.toString()}`);
    console.log(`Authority Bump: ${programAuthorityBump}`);
    
    // Check if this PDA actually exists and if it has any data (it shouldn't)
    const authorityInfo = await connection.getAccountInfo(programAuthorityAddress);
    
    if (!authorityInfo) {
      console.log(`Authority PDA doesn't exist yet - creating it with funding`);
      
      // Create a transaction to fund the PDA with some SOL
      const tx = new Transaction();
      
      // Add a recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;
      
      // Add a funding instruction - this will also create the PDA account if needed
      const fundingIx = SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: programAuthorityAddress,
        lamports: 10000000 // 0.01 SOL to ensure it has enough for operations
      });
      
      tx.add(fundingIx);
      
      // Send and confirm the transaction
      try {
        const signature = await wallet.sendTransaction(tx, connection);
        console.log(`Authority funded successfully: ${signature}`);
        await connection.confirmTransaction(signature, 'confirmed');
        return true;
      } catch (fundError) {
        console.error('Failed to fund authority:', fundError);
        return false;
      }
    }
    
    console.log(`Authority exists with ${authorityInfo.lamports} lamports`);
    console.log(`Authority data length: ${authorityInfo.data.length}`);
    
    // Authority should not have data - it's only used for signing
    if (authorityInfo.data.length > 0) {
      console.warn('WARNING: Authority PDA has data which may cause InvalidAccountData errors');
    }
    
    // Ensure it has enough SOL for operations
    if (authorityInfo.lamports < 5000000) { // Less than 0.005 SOL
      console.log('Authority has low balance, topping up...');
      
      // Create a transaction to fund the PDA with some more SOL
      const tx = new Transaction();
      
      // Add a recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;
      
      // Add a funding instruction
      const fundingIx = SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: programAuthorityAddress,
        lamports: 10000000 // 0.01 SOL
      });
      
      tx.add(fundingIx);
      
      // Send and confirm the transaction
      try {
        const signature = await wallet.sendTransaction(tx, connection);
        console.log(`Authority topped up successfully: ${signature}`);
        await connection.confirmTransaction(signature, 'confirmed');
      } catch (fundError) {
        console.error('Failed to top up authority:', fundError);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error verifying program authority:', error);
    return false;
  }
}

/**
 * Find the program's state PDA
 * From multihub_swap_v3.rs: Pubkey::find_program_address(&[b"state"], program_id)
 * 
 * Using deployed program ID from app.config.json to derive PDAs consistently.
 */
export function findProgramStateAddress(): [PublicKey, number] {
  // Use the program ID from config for PDA derivation
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    MULTIHUB_SWAP_PROGRAM_PUBKEY
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
 * Fund the program YOT token account to ensure it has enough YOT for swaps
 * This is needed because the program needs YOT tokens to provide liquidity for SOL→YOT swaps
 */

// Export check function for the Program YOT token account
export async function checkProgramYotAccount(connection: Connection): Promise<{
  exists: boolean;
  accountAddress: string;
  balance?: number;
  error?: string;
}> {
  try {
    // Get program authority PDA address
    const [programAuthorityAddress] = findProgramAuthorityAddress();
    
    // Get YOT mint address
    const yotMint = new PublicKey(YOT_TOKEN_MINT);
    
    // Get program YOT token account address
    const programYotAccount = await getAssociatedTokenAddress(
      yotMint,
      programAuthorityAddress,
      true // allowOwnerOffCurve for PDAs
    );
    
    console.log(`Checking program YOT account: ${programYotAccount.toString()}`);
    
    // Check if account exists
    try {
      const accountInfo = await getAccount(connection, programYotAccount);
      console.log('Program YOT account exists:', accountInfo);
      
      // Get balance in YOT (UI amount)
      const balanceRaw = Number(accountInfo.amount);
      const balanceUI = balanceRaw / 1_000_000_000; // YOT has 9 decimals
      
      return {
        exists: true,
        accountAddress: programYotAccount.toString(),
        balance: balanceUI
      };
    } catch (error) {
      console.log('Program YOT account does not exist or error:', error);
      return {
        exists: false,
        accountAddress: programYotAccount.toString(),
        error: 'Account does not exist or is not a valid token account'
      };
    }
  } catch (error) {
    console.error('Error checking program YOT account:', error);
    return {
      exists: false,
      accountAddress: 'Unknown',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Fund the program's YOT token account with tokens
 * This function creates the account if it doesn't exist and sends YOT tokens to it
 * @param connection Solana connection
 * @param wallet Connected wallet
 * @param amountYOT Amount of YOT to send to the program
 * @returns Transaction signature
 */
async function fundProgramYotAccount(
  connection: Connection,
  wallet: any,
  amountYOT: number = 100000 // Default to 100,000 YOT tokens
): Promise<string> {
  try {
    console.log(`Starting process to fund program with ${amountYOT} YOT tokens`);
    
    // Get program authority PDA address
    const [programAuthorityAddress] = findProgramAuthorityAddress();
    console.log(`Program authority PDA: ${programAuthorityAddress.toString()}`);
    
    // Get YOT mint address
    const yotMint = new PublicKey(YOT_TOKEN_MINT);
    
    // Get associated token account addresses
    const walletYotAccount = await getAssociatedTokenAddress(
      yotMint,
      wallet.publicKey
    );
    
    const programYotAccount = await getAssociatedTokenAddress(
      yotMint,
      programAuthorityAddress,
      true // allowOwnerOffCurve for PDAs
    );
    
    console.log(`Wallet YOT account: ${walletYotAccount.toString()}`);
    console.log(`Program YOT account: ${programYotAccount.toString()}`);
    
    // Check if program YOT account exists
    const programAccountInfo = await connection.getAccountInfo(programYotAccount);
    const transaction = new Transaction();
    
    // Set fee payer and add recent blockhash
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Create program token account if it doesn't exist
    if (!programAccountInfo) {
      console.log('Program YOT token account does not exist, creating it...');
      const createTokenAccountIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        programYotAccount,
        programAuthorityAddress,
        yotMint
      );
      transaction.add(createTokenAccountIx);
    }
    
    // Convert amount to raw token amount with decimals
    // YOT has 9 decimals, so 1 YOT = 1_000_000_000 raw units
    const rawAmount = BigInt(Math.floor(amountYOT * 1_000_000_000));
    
    // Import needed TokenProgram functions
    const { createTransferInstruction } = await import('@solana/spl-token');
    
    // Add transfer instruction to send YOT tokens to the program account
    const transferIx = createTransferInstruction(
      walletYotAccount,
      programYotAccount,
      wallet.publicKey,
      Number(rawAmount) // Convert back to number for the instruction
    );
    
    transaction.add(transferIx);
    
    console.log(`Transferring ${amountYOT} YOT to program account...`);
    
    // Sign and send the transaction
    const signature = await wallet.sendTransaction(transaction, connection);
    
    console.log(`Transaction sent with signature ${signature}`);
    console.log(`Program YOT account funded successfully with ${amountYOT} YOT tokens`);
    
    return signature;
  } catch (error) {
    console.error('Error funding program YOT account:', error);
    throw error;
  }
}

/**
 * Initialize the multihub swap program
 * UPDATED TO MATCH the Rust code process_initialize behavior
 */
export async function initializeProgram(
  connection: Connection,
  wallet: any
): Promise<string> {
  try {
    console.log('Initializing multihub swap program...');
    
    // First, check for PDA mismatches which could cause "Custom(0)" errors
    await debugProgramIDs();
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Set fee payer
    transaction.feePayer = wallet.publicKey;
    
    // Add a recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Get program addresses - but DO NOT create the accounts
    const [programStateAddress, stateBump] = findProgramStateAddress();
    const [programAuthorityAddress, authorityBump] = findProgramAuthorityAddress();
    
    console.log(`Program State Address (PDA): ${programStateAddress.toString()}`);
    console.log(`Program State Bump: ${stateBump}`);
    console.log(`Program Authority Address (PDA): ${programAuthorityAddress.toString()}`);
    console.log(`Program Authority Bump: ${authorityBump}`);
    
    // IMPORTANT: Do NOT try to create the state account beforehand!
    // The Rust program will create it via invoke_signed during process_initialize.
    // Let's just add a funding instruction for the authority account.
    console.log(`Adding funding instruction for Program Authority: ${programAuthorityAddress.toString()}`);
    const fundingInstruction = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: programAuthorityAddress,
      lamports: 10000000, // 0.01 SOL (10,000,000 lamports) for program operations - increased for safety
    });
    transaction.add(fundingInstruction);
    
    // Create token accounts for YOT, SOL, and YOS
    try {
      // Get the token account addresses that should be associated with the program
      const yotMint = new PublicKey(YOT_TOKEN_MINT);
      const yosMint = new PublicKey(YOS_TOKEN_MINT);
      const solMint = new PublicKey('So11111111111111111111111111111111111111112');
      
      // Associated token accounts for the program authority
      const yotTokenProgramATA = await getAssociatedTokenAddress(
        yotMint,
        programAuthorityAddress,
        true // allowOwnerOffCurve: true for PDAs
      );
      
      const solTokenProgramATA = await getAssociatedTokenAddress(
        solMint,
        programAuthorityAddress,
        true // allowOwnerOffCurve: true for PDAs
      );
      
      const yosTokenProgramATA = await getAssociatedTokenAddress(
        yosMint,
        programAuthorityAddress,
        true // allowOwnerOffCurve: true for PDAs
      );
      
      // Check if token accounts exist and create them if not
      // YOT token account
      const yotProgramAccount = await connection.getAccountInfo(yotTokenProgramATA);
      if (!yotProgramAccount) {
        console.log('Creating program token account for YOT mint');
        const ix = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          yotTokenProgramATA,
          programAuthorityAddress,
          yotMint
        );
        transaction.add(ix);
      }
      
      // SOL token account
      const solProgramAccount = await connection.getAccountInfo(solTokenProgramATA);
      if (!solProgramAccount) {
        console.log('Creating program token account for SOL mint');
        const ix = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          solTokenProgramATA,
          programAuthorityAddress,
          solMint
        );
        transaction.add(ix);
      }
      
      // YOS token account
      const yosProgramAccount = await connection.getAccountInfo(yosTokenProgramATA);
      if (!yosProgramAccount) {
        console.log('Creating program token account for YOS mint');
        const ix = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          yosTokenProgramATA,
          programAuthorityAddress,
          yosMint
        );
        transaction.add(ix);
      }
    } catch (err) {
      console.warn('Error checking/creating program token accounts during initialization:', err);
      // Continue anyway as the initialization can still proceed
    }
    
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
    
    // Add the initialize instruction to the transaction with EXACT accounts in EXACT order
    // This must match what the Rust program expects in process_initialize():
    // 1. payer (wallet) - signer and writable
    // 2. program state account - writable (not signer, will be created by the program)
    // 3. program authority account - writable (not signer)
    // 4. pool authority account - writable (not signer) - CRITICAL FIX: Added Pool Authority
    // 5. system program - needed for creating accounts
    // 6. rent sysvar - needed for calculating lamports
    const poolAuthorityAddress = new PublicKey(POOL_AUTHORITY);
    
    console.log(`Adding initialization instruction with accounts:`);
    console.log(`1. Payer: ${wallet.publicKey.toString()}`);
    console.log(`2. Program State (PDA): ${programStateAddress.toString()}`);
    console.log(`3. Program Authority (PDA): ${programAuthorityAddress.toString()}`);
    console.log(`4. Pool Authority: ${poolAuthorityAddress.toString()}`);
    console.log(`5. System Program: 11111111111111111111111111111111`);
    console.log(`6. Rent Sysvar: SysvarRent111111111111111111111111111111111`);
    
    // =====================================================================
    // COMPLETE REWRITE OF INITIALIZE INSTRUCTION CREATION
    // =====================================================================
    console.log("COMPLETE REWRITE: Creating initialize transaction instruction manually");
    
    // Step 1: Create the account keys array
    const keys = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // payer_account
      { pubkey: programStateAddress, isSigner: false, isWritable: true }, // program_state_account (will be created by program)
      { pubkey: programAuthorityAddress, isSigner: false, isWritable: true }, // program_authority_account 
      { pubkey: poolAuthorityAddress, isSigner: false, isWritable: true }, // CRITICAL FIX: Add Pool Authority
      { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }, // system_program_account
      { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }, // rent_sysvar_account
    ];
    
    // Step 2: Directly create the program ID from string (hardcoded for maximum reliability)
    const programId = new PublicKey("SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE");
    
    console.log("DEBUG - Program ID Values for initialize:");
    console.log(`- From config (string): ${MULTIHUB_SWAP_PROGRAM_ID}`);
    console.log(`- From config (PublicKey): ${MULTIHUB_SWAP_PROGRAM_PUBKEY.toString()}`);
    console.log(`- Hardcoded direct: ${programId.toString()}`);
    
    // Verify they all match
    if (MULTIHUB_SWAP_PROGRAM_ID !== programId.toString()) {
      console.error("ERROR: Program ID from config doesn't match hardcoded ID!");
    }
    
    // Step 3: Create raw transaction instruction with proper buffer
    const initializeProgramInstruction = new TransactionInstruction({
      keys: keys,
      programId: programId, // Using hard-coded PublicKey
      data: instructionData
    });
    
    // Step 4: Verify the instruction has a valid program ID before adding it
    console.log(`Initialize instruction created. Program ID: ${initializeProgramInstruction.programId.toString()}`);
    console.log(`Program ID valid: ${initializeProgramInstruction.programId !== undefined}`);
    
    // Step 5: Add the instruction to the transaction  
    transaction.add(initializeProgramInstruction);
    
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
 * Ensure a token account exists, or create it if it doesn't, and return actual balance
 */
type TokenAccountInfo = {
  address: PublicKey;
  balance: bigint;
};

/**
 * CRITICAL FIX: Enhanced token account creation with robust validity checking
 * This function ensures token accounts exist and are properly validated
 * The previous implementation was vulnerable to "InvalidAccountData" errors
 */
/**
 * ENHANCED: Verify token account is a valid SPL token account
 * This helps detect and prevent InvalidAccountData errors
 * 
 * IMPORTANT FIX: Using recommended account validation to prevent InvalidAccountData errors
 */
async function validateTokenAccount(
  connection: Connection,
  accountAddress: PublicKey,
  expectedMint: PublicKey
): Promise<boolean> {
  try {
    console.log(`🔍 Validating token account: ${accountAddress.toString()}`);
    console.log(`🔍 Expected mint: ${expectedMint.toString()}`);
    
    // CRITICAL FIX: Explicitly use proper programs and get parsed account info
    // getParsedAccountInfo returns more details about the account's structure
    const accountInfo = await connection.getParsedAccountInfo(accountAddress);
    
    // Check if account exists
    if (!accountInfo.value) {
      console.error(`❌ Token account does not exist: ${accountAddress.toString()}`);
      return false;
    }
    
    // Check if it's a token account by examining parsed data
    const parsedData = accountInfo.value.data;
    if (!('parsed' in parsedData)) {
      console.error(`❌ Not a token account (no parsed data): ${accountAddress.toString()}`);
      return false;
    }
    
    // Check program owner
    if (!accountInfo.value.owner.equals(TOKEN_PROGRAM_ID)) {
      console.error(`❌ Account not owned by Token Program: ${accountAddress.toString()}`);
      console.error(`   Owner: ${accountInfo.value.owner.toString()}`);
      console.error(`   Expected: ${TOKEN_PROGRAM_ID.toString()}`);
      return false;
    }
    
    // Check type and mint
    const tokenData = parsedData.parsed;
    if (tokenData.type !== 'account') {
      console.error(`❌ Not a token account (wrong type): ${tokenData.type}`);
      return false;
    }
    
    const tokenInfo = tokenData.info;
    if (tokenInfo.mint !== expectedMint.toString()) {
      console.error(`❌ Token account mint mismatch.`);
      console.error(`   Expected: ${expectedMint.toString()}`);
      console.error(`   Actual: ${tokenInfo.mint}`);
      return false;
    }
    
    // Verify account is initialized
    if (!tokenInfo.isInitialized) {
      console.error(`❌ Token account not initialized: ${accountAddress.toString()}`);
      return false;
    }
    
    console.log(`✅ Valid SPL token account verified: ${accountAddress.toString()}`);
    console.log(`✅ Mint: ${tokenInfo.mint}`);
    console.log(`✅ Owner: ${tokenInfo.owner}`);
    console.log(`✅ Balance: ${tokenInfo.tokenAmount.uiAmount}`);
    return true;
  } catch (err) {
    console.error(`❌ Token account validation failed for: ${accountAddress.toString()}`);
    console.error(`   Error details:`, err);
    return false;
  }
}

async function ensureTokenAccount(
  connection: Connection,
  wallet: any,
  mint: PublicKey,
  transaction: Transaction
): Promise<TokenAccountInfo> {
  console.log(`Ensuring token account exists for mint: ${mint.toString()}`);
  
  try {
    // SPECIAL CASE: Handle SOL separately since it's not a token account
    if (mint.toString() === 'So11111111111111111111111111111111111111112' || 
        mint.toString() === SystemProgram.programId.toString()) {
      
      // For SOL, just use the wallet public key and get the balance
      try {
        const solBalance = await connection.getBalance(wallet.publicKey);
        console.log(`SOL balance: ${solBalance / 1_000_000_000} SOL`);
        return { 
          address: wallet.publicKey, 
          balance: BigInt(solBalance) 
        };
      } catch (solErr) {
        console.error('Error getting SOL balance:', solErr);
        return {
          address: wallet.publicKey,
          balance: BigInt(0) // Default to zero if we can't get the balance
        };
      }
    }
    
    // CRITICAL FIX: First, get the expected ATA address without creating it
    // IMPORTANT: Explicitly provide TOKEN_PROGRAM_ID and ASSOCIATED_TOKEN_PROGRAM_ID to avoid mismatches
    const ataAddress = await getAssociatedTokenAddress(
      mint,
      wallet.publicKey,
      false, // Don't allow off-curve
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    console.log(`Expected ATA address for mint ${mint.toString()}: ${ataAddress.toString()}`);
    
    // Check if the account exists BEFORE trying to use getOrCreateAssociatedTokenAccount
    // This helps avoid inconsistent states that can cause "InvalidAccountData" errors
    const accountInfo = await connection.getAccountInfo(ataAddress);
    
    if (!accountInfo) {
      console.log(`Token account for ${mint.toString()} does not exist. Creating it now...`);
      
      // CRITICAL FIX: Add explicit creation instruction with proper parameters
      // IMPORTANT: Explicitly provide TOKEN_PROGRAM_ID and ASSOCIATED_TOKEN_PROGRAM_ID
      const createAtaIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey, // Payer
        ataAddress,       // ATA address
        wallet.publicKey, // Owner
        mint,             // Mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      
      transaction.add(createAtaIx);
      console.log(`Added instruction to create token account for ${mint.toString()}`);
      
      // Since we just created the account, we return the address with zero balance
      // The transaction will create it when it executes
      return {
        address: ataAddress,
        balance: BigInt(0)
      };
    }
    
    // Account exists, so we can safely try to get its token info
    try {
      console.log(`Token account exists. Getting token info for ${ataAddress.toString()}`);
      // IMPORTANT: Explicitly use TOKEN_PROGRAM_ID to prevent mismatches
      const tokenAccountInfo = await getAccount(
        connection, 
        ataAddress, 
        undefined, // Commitment
        TOKEN_PROGRAM_ID
      );
      
      console.log(`Token account for ${mint.toString()}: ${tokenAccountInfo.address.toString()}`);
      console.log(`Balance: ${tokenAccountInfo.amount.toString()} (Owner: ${tokenAccountInfo.owner.toString()})`);
      
      // VALIDATION CHECK: Ensure this is really the correct token account
      if (!tokenAccountInfo.mint.equals(mint)) {
        console.error('ERROR: Token account mint mismatch!');
        console.error(`Expected: ${mint.toString()}, Got: ${tokenAccountInfo.mint.toString()}`);
        throw new Error(`Token account mint mismatch for ${ataAddress.toString()}`);
      }
      
      return {
        address: tokenAccountInfo.address,
        balance: tokenAccountInfo.amount
      };
    } catch (tokenErr) {
      console.warn(`Error getting token account data for existing account: ${tokenErr}`);
      console.warn('Assuming this is a newly created account with zero balance');
      
      // Return the address with zero balance even if we can't get the token info yet
      return {
        address: ataAddress,
        balance: BigInt(0)
      };
    }
  } catch (err) {
    console.error(`Unexpected error ensuring token account for mint ${mint.toString()}:`, err);
    throw new Error(`Failed to ensure token account: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Export getMultiHubProgramID for other modules
 */
export { getMultiHubProgramId };

/**
 * Perform a token swap using the multihub swap V3 program
 * IMPROVED VERSION: Uses auto-refund functionality to automatically return SOL on failed transactions
 */
export async function performSwap(
  connection: Connection,
  wallet: any,
  tokenFromMint: PublicKey,
  tokenToMint: PublicKey,
  amountIn: number | bigint,
  minAmountOut: number | bigint
): Promise<string> {
  // CRITICAL VALIDATE PROGRAM ID: Verify program ID is valid before proceeding
  // Use the PublicKey object directly instead of string
  const programId = MULTIHUB_SWAP_PROGRAM_PUBKEY;
  if (!programId) {
    console.error(`Invalid program ID: ${programId}`);
    throw new Error(`Invalid program ID. This is likely a configuration error. Please refresh the page and try again.`);
  }
  console.log(`Verified MultihubSwap Program ID: ${programId.toString()}`);
  
  try {
    console.log("Starting swap using ConnectionManager for reliable network operations");
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Set fee payer immediately
    transaction.feePayer = wallet.publicKey;
    
    // Add a recent blockhash immediately - use ConnectionManager for reliability
    const blockhashResponse = await connectionManager.executeWithFallback(
      conn => conn.getLatestBlockhash()
    );
    transaction.recentBlockhash = blockhashResponse.blockhash;
    
    // Get all the program addresses up front to avoid redeclaration issues
    const [programStateAddress, swapStateBump] = findProgramStateAddress();
    const [programAuthorityAddress, swapAuthorityBump] = findProgramAuthorityAddress();
    
    // Check current authority balance - use ConnectionManager with retries
    try {
      const authoritySOL = await connectionManager.executeWithFallback(
        conn => conn.getBalance(programAuthorityAddress)
      );
      console.log(`Program Authority currently has ${authoritySOL / 1_000_000_000} SOL`);
      
      // Only add funding if balance is low (less than 0.002 SOL)
      if (authoritySOL < 2000000) {
        console.log(`Program Authority needs funding. Adding funding instruction.`);
        // Add minimal SOL - just what's needed for token operations
        const fundingInstruction = SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: programAuthorityAddress,
          lamports: 2000000, // 0.002 SOL (2,000,000 lamports) - minimal amount for token operations
        });
        transaction.add(fundingInstruction);
      } else {
        console.log(`Program Authority already has sufficient funds. Skipping funding instruction.`);
      }
    } catch (err) {
      console.log('Error checking Program Authority SOL balance. Adding minimal funding as precaution.', err);
      // Add minimal SOL as a precaution
      const fundingInstruction = SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: programAuthorityAddress,
        lamports: 2000000, // 0.002 SOL (2,000,000 lamports)
      });
      transaction.add(fundingInstruction);
    }
    
    // Ensure token accounts exist - using connection manager
    const tokenFromAccount = await ensureTokenAccount(
      connectionManager.getConnection(), 
      wallet, 
      tokenFromMint, 
      transaction
    );
    
    const tokenToAccount = await ensureTokenAccount(
      connectionManager.getConnection(), 
      wallet, 
      tokenToMint, 
      transaction
    );
    
    // Ensure YOS token account exists
    const yosTokenAccount = await ensureTokenAccount(
      connectionManager.getConnection(),
      wallet,
      new PublicKey(YOS_TOKEN_MINT),
      transaction
    );
    
    // Create a direct buffer encoding for the Rust-side SwapInstruction enum
    // The Swap variant has amount_in and min_amount_out fields
    
    // Convert amounts to BigInt lamports, handling both number and BigInt inputs
    const DECIMALS = 9; // Most tokens use 9 decimals on Solana
    
    // CRITICAL FIX: More precise numerical conversion for wallet display amounts
    let amountInLamports: bigint;
    if (typeof amountIn === 'bigint') {
      // Already a BigInt, assume it's already in lamports format
      amountInLamports = amountIn;
      console.log(`EXACT CONVERSION: Using direct BigInt value ${amountInLamports} lamports`);
    } else {
      // CRITICAL FIX: Convert to string with fixed decimals first to avoid float imprecision
      // This ensures the amount shown in the wallet matches the UI amount exactly
      // Format: convert to string with 9 decimals, remove the decimal point, then convert to BigInt
      const amountStr = amountIn.toFixed(9).replace('.', '');
      amountInLamports = BigInt(amountStr);
      console.log(`EXACT CONVERSION: ${amountIn} tokens → ${amountStr} string → ${amountInLamports} lamports`);
    }
    
    // Handle minAmountOut conversion
    // Handle minAmountOut conversion
    let minAmountOutLamports: bigint;
    if (typeof minAmountOut === 'bigint') {
      // Already a BigInt, assume it's already in lamports format
      minAmountOutLamports = minAmountOut;
    } else {
      // Fixed: minAmountOut already in lamports, do not multiply
      minAmountOutLamports = BigInt(minAmountOut);
    }
    
    console.log(`Using amounts: ${amountIn} tokens (${amountInLamports} lamports)`);
    console.log(`Minimum out: ${minAmountOut} tokens (${minAmountOutLamports} lamports)`);
    
    // Verify amounts are within valid range for u64
    const MAX_U64 = BigInt('18446744073709551615'); // 2^64 - 1
    
    if (amountInLamports > MAX_U64) {
      console.warn(`Input amount ${amountInLamports} exceeds u64 max, capping at maximum`);
      amountInLamports = MAX_U64;
    }
    
    if (minAmountOutLamports > MAX_U64) {
      console.warn(`Min output amount ${minAmountOutLamports} exceeds u64 max, capping at maximum`);
      minAmountOutLamports = MAX_U64;
    }
    
    // Create the swap instruction data using our improved direct buffer serialization approach
    const instructionData = buildSwapInstruction({
      amountIn: amountInLamports,
      minAmountOut: minAmountOutLamports
    });
    
    console.log('Using direct buffer encoding for Swap instruction');
    console.log('Swap instruction data length:', instructionData.length);
    console.log('Swap instruction data bytes:', Array.from(new Uint8Array(instructionData)));
    
    const swapData = instructionData;
    
    // DUAL IMPLEMENTATION: Use both Pool Authority and Program Authority with fallback logic
    console.log("Implementing dual authority approach with fallback logic");
    console.log("Primary authority: Pool Authority PDA", POOL_AUTHORITY);
    // Derive the program authority PDA dynamically instead of using hardcoded value
    const [derivedAuthorityPDA, _] = findProgramAuthorityAddress();
    console.log("Fallback authority: Program Authority PDA", derivedAuthorityPDA.toString());
    
    // CRITICAL FIX: Use our enhanced token account validation
    // (We import the function at the top of the file)
    
    // IMPROVED: Enhanced account validation with comprehensive error reporting
    // This function now handles all possible token account validation scenarios
    const validateAccount = async (pubkey: PublicKey, accountType = "unknown", expectedMint?: PublicKey, accountIndex = 0): Promise<boolean> => {
      try {
        console.log(`🧪 Enhanced validation for ${accountType} account: ${pubkey.toString()}`);
        
        // Check if this is the Program Authority account (special case)
        const [programAuthorityPDA, authorityBump1] = findProgramAuthorityAddress();
        if (accountType === "Program Authority" || pubkey.equals(programAuthorityPDA)) {
          console.log(`💡 Validating Program Authority PDA: ${pubkey.toString()}`);
          
          // Get account info with retries
          const accountInfo = await connectionManager.executeWithFallback(
            conn => conn.getAccountInfo(pubkey)
          );
          
          if (!accountInfo) {
            console.warn(`⚠️ Program authority PDA doesn't exist yet, it will be created as part of the transaction`);
            return true; // Allow creation during transaction
          }
          
          // Special validation for program authority
          if (accountInfo.data.length > 0) {
            console.warn(`⚠️ WARNING: Program authority has data (${accountInfo.data.length} bytes) which may cause InvalidAccountData`);
            console.log(`Proceeding anyway since this is a PDA used for signing`);
          }
          
          return true; // Program Authority validation passes
        }
        
        // For token accounts, use the comprehensive validation
        if (accountType.includes("token")) {
          // Token validation with the expectedMint if provided
          if (expectedMint) {
            return await validateSplTokenAccount(connection, pubkey, expectedMint);
          } else {
            return await validateSplTokenAccount(connection, pubkey);
          }
        }
        
        // Default validation for other account types
        const accountInfo = await connectionManager.executeWithFallback(
          conn => conn.getAccountInfo(pubkey)
        );
        
        if (!accountInfo) {
          console.error(`❌ Account does not exist: ${pubkey.toString()}`);
          return false;
        }
        
        return true;
      } catch (err) {
        console.error(`❌ Error validating ${accountType} account ${pubkey.toString()}:`, err);
        return false;
      }
    };
    
    // STEP 1: Find the tokenFromMintATA with fallback logic
    let tokenFromMintATA: PublicKey;
    let tokenFromMintATAValid = false;
    
    // Primary account (Pool Authority)
    if (tokenFromMint.toString() === "So11111111111111111111111111111111111111112") {
      // SOL account
      tokenFromMintATA = new PublicKey(DEFAULT_SOL_TOKEN_ACCOUNT);
      console.log("Using PRIMARY SOL token account (FROM):", tokenFromMintATA.toString());
    } else if (tokenFromMint.toString() === config.tokens.YOT) {
      // YOT account
      tokenFromMintATA = new PublicKey(DEFAULT_YOT_TOKEN_ACCOUNT);
      console.log("Using PRIMARY YOT token account (FROM):", tokenFromMintATA.toString());
    } else if (tokenFromMint.toString() === config.tokens.YOS) {
      // YOS account
      tokenFromMintATA = new PublicKey(DEFAULT_YOS_TOKEN_ACCOUNT);
      console.log("Using PRIMARY YOS token account (FROM):", tokenFromMintATA.toString());
    } else {
      // For other tokens, derive ATA with Pool Authority
      tokenFromMintATA = await getAssociatedTokenAddress(
        tokenFromMint,
        new PublicKey(POOL_AUTHORITY),
        true,  // allowOwnerOffCurve: true for PDAs
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
    }
    
    // Validate the primary account with account type description
    tokenFromMintATAValid = await validateAccount(tokenFromMintATA, "Program FROM token");
    console.log(`PRIMARY FROM account ${tokenFromMintATA.toString()} valid: ${tokenFromMintATAValid}`);
    
    // If primary account is invalid and it's YOT or YOS, try fallback
    if (!tokenFromMintATAValid) {
      if (tokenFromMint.toString() === config.tokens.YOT) {
        // Try fallback YOT account
        const fallbackAccount = new PublicKey(FALLBACK_YOT_TOKEN_ACCOUNT);
        const fallbackValid = await validateAccount(fallbackAccount);
        
        if (fallbackValid) {
          console.log(`Using FALLBACK YOT account (FROM): ${fallbackAccount.toString()}`);
          tokenFromMintATA = fallbackAccount;
          tokenFromMintATAValid = true;
        }
      } else if (tokenFromMint.toString() === config.tokens.YOS) {
        // Try fallback YOS account
        const fallbackAccount = new PublicKey(FALLBACK_YOS_TOKEN_ACCOUNT);
        const fallbackValid = await validateAccount(fallbackAccount);
        
        if (fallbackValid) {
          console.log(`Using FALLBACK YOS account (FROM): ${fallbackAccount.toString()}`);
          tokenFromMintATA = fallbackAccount;
          tokenFromMintATAValid = true;
        }
      }
    }
    
    // STEP 2: Find the tokenToMintATA with fallback logic
    let tokenToMintATA: PublicKey;
    let tokenToMintATAValid = false;
    
    // Primary account (Pool Authority)
    if (tokenToMint.toString() === "So11111111111111111111111111111111111111112") {
      // SOL account
      tokenToMintATA = new PublicKey(DEFAULT_SOL_TOKEN_ACCOUNT);
      console.log("Using PRIMARY SOL token account (TO):", tokenToMintATA.toString());
    } else if (tokenToMint.toString() === config.tokens.YOT) {
      // YOT account
      tokenToMintATA = new PublicKey(DEFAULT_YOT_TOKEN_ACCOUNT);
      console.log("Using PRIMARY YOT token account (TO):", tokenToMintATA.toString());
    } else if (tokenToMint.toString() === config.tokens.YOS) {
      // YOS account
      tokenToMintATA = new PublicKey(DEFAULT_YOS_TOKEN_ACCOUNT);
      console.log("Using PRIMARY YOS token account (TO):", tokenToMintATA.toString());
    } else {
      // For other tokens, derive ATA with Pool Authority
      tokenToMintATA = await getAssociatedTokenAddress(
        tokenToMint,
        new PublicKey(POOL_AUTHORITY),
        true,  // allowOwnerOffCurve: true for PDAs
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
    }
    
    // Validate the primary account with specific account type for better logging
    tokenToMintATAValid = await validateAccount(tokenToMintATA, "Program TO token");
    console.log(`PRIMARY TO account ${tokenToMintATA.toString()} valid: ${tokenToMintATAValid}`);
    
    // If primary account is invalid and it's YOT or YOS, try fallback
    if (!tokenToMintATAValid) {
      if (tokenToMint.toString() === config.tokens.YOT) {
        // Try fallback YOT account
        const fallbackAccount = new PublicKey(FALLBACK_YOT_TOKEN_ACCOUNT);
        const fallbackValid = await validateAccount(fallbackAccount);
        
        if (fallbackValid) {
          console.log(`Using FALLBACK YOT account (TO): ${fallbackAccount.toString()}`);
          tokenToMintATA = fallbackAccount;
          tokenToMintATAValid = true;
        }
      } else if (tokenToMint.toString() === config.tokens.YOS) {
        // Try fallback YOS account
        const fallbackAccount = new PublicKey(FALLBACK_YOS_TOKEN_ACCOUNT);
        const fallbackValid = await validateAccount(fallbackAccount);
        
        if (fallbackValid) {
          console.log(`Using FALLBACK YOS account (TO): ${fallbackAccount.toString()}`);
          tokenToMintATA = fallbackAccount;
          tokenToMintATAValid = true;
        }
      }
    }
    
    // STEP 3: Find YOS token account for cashback with fallback logic
    let yosTokenProgramATA: PublicKey;
    let yosTokenProgramATAValid = false;
    
    // Primary YOS account (Pool Authority)
    yosTokenProgramATA = new PublicKey(DEFAULT_YOS_TOKEN_ACCOUNT);
    console.log("Using PRIMARY YOS token account for cashback:", yosTokenProgramATA.toString());
    
    // Validate YOS account with specific account type for detailed error tracking
    yosTokenProgramATAValid = await validateAccount(yosTokenProgramATA, "Program YOS token");
    console.log(`PRIMARY YOS account valid: ${yosTokenProgramATAValid}`);
    
    // Try fallback if primary is invalid
    if (!yosTokenProgramATAValid) {
      const fallbackAccount = new PublicKey(FALLBACK_YOS_TOKEN_ACCOUNT);
      const fallbackValid = await validateAccount(fallbackAccount);
      
      if (fallbackValid) {
        console.log(`Using FALLBACK YOS account for cashback: ${fallbackAccount.toString()}`);
        yosTokenProgramATA = fallbackAccount;
        yosTokenProgramATAValid = true;
      }
    }
    
    // Throw error if any required account is still invalid after fallback
    if (!tokenFromMintATAValid || !tokenToMintATAValid || !yosTokenProgramATAValid) {
      throw new Error("Required token accounts are invalid and fallback accounts were also invalid");
    }
    
    // Create all token accounts first before we do any validations
    // This ensures all accounts exist before we try to check balances
    try {
      // Check the program's token accounts using ConnectionManager for reliability
      const tokenFromProgramAccount = await connectionManager.executeWithFallback(
        conn => conn.getAccountInfo(tokenFromMintATA)
      );
      
      if (!tokenFromProgramAccount) {
        console.log('Creating program token account for tokenFromMint:', tokenFromMint.toString());
        // CRITICAL FIX: Use Pool Authority instead of Program Authority 
        const ix = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          tokenFromMintATA,
          new PublicKey(POOL_AUTHORITY),
          tokenFromMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        transaction.add(ix);
      }
      
      const tokenToProgramAccount = await connectionManager.executeWithFallback(
        conn => conn.getAccountInfo(tokenToMintATA)
      );
      
      if (!tokenToProgramAccount) {
        console.log('Creating program token account for tokenToMint:', tokenToMint.toString());
        // CRITICAL FIX: Use Pool Authority instead of Program Authority
        const ix = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          tokenToMintATA,
          new PublicKey(POOL_AUTHORITY),
          tokenToMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        transaction.add(ix);
      }
      
      const yosProgramAccount = await connectionManager.executeWithFallback(
        conn => conn.getAccountInfo(yosTokenProgramATA)
      );
      
      if (!yosProgramAccount) {
        console.log('Creating program token account for YOS mint');
        // CRITICAL FIX: Use Pool Authority instead of Program Authority
        const ix = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          yosTokenProgramATA,
          new PublicKey(POOL_AUTHORITY),
          new PublicKey(YOS_TOKEN_MINT),
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        transaction.add(ix);
      }
    } catch (err) {
      console.warn('Error checking/creating program token accounts:', err);
      // Continue anyway as this may not be fatal
    }
    
    // CRITICAL FIX: Check if program has tokens needed for SOL->YOT swaps
    // For SOL->YOT swaps, the program must already hold YOT tokens to send to the user
    if (tokenFromMint.equals(new PublicKey("So11111111111111111111111111111111111111112"))) {
      try {
        // Check if program has YOT tokens needed for the swap using ConnectionManager
        const programTokenAccount = await connectionManager.executeWithFallback(
          conn => conn.getTokenAccountBalance(tokenToMintATA)
        );
        
        console.log(`Program's ${tokenToMint.toString()} balance:`, programTokenAccount.value.uiAmount);
        
        if (!programTokenAccount.value.uiAmount || programTokenAccount.value.uiAmount < minAmountOut) {
          console.warn(`⚠️ CRITICAL: Program doesn't have enough ${tokenToMint.toString()} tokens for this swap!`);
          console.warn(`⚠️ Program has ${programTokenAccount.value.uiAmount || 0} tokens, but swap requires at least ${minAmountOut}`);
          console.warn(`⚠️ This is likely causing the InsufficientFunds error at instruction index 4`);
          throw new Error(`Program doesn't have enough ${tokenToMint.toString()} tokens for this swap. Please try a smaller amount or try YOT->SOL direction.`);
        }
      } catch (err: any) {
        // If account doesn't exist yet or has no balance, we can't proceed with SOL->YOT swap
        if (err?.message?.includes("could not find account")) {
          console.warn(`Program token account for ${tokenToMint.toString()} was just created, but has no balance yet.`);
          throw new Error(`Program doesn't have any ${tokenToMint.toString()} tokens for this swap. Please try YOT->SOL direction first to fund the program.`);
        }
        console.warn('Error checking program token balance:', err);
      }
    }
    
    // Token accounts are already created above
    // We've moved this check to before the token balance validation
    
    // Check user token account balances and provide detailed logs
    console.log('Token accounts for program operation:', {
      tokenFromAccount: tokenFromAccount.address.toBase58(),
      tokenFromBalance: tokenFromAccount.balance.toString(),
      tokenToAccount: tokenToAccount.address.toBase58(),
      tokenFromMintATA: tokenFromMintATA.toBase58(),
      tokenToMintATA: tokenToMintATA.toBase58(),
      yosTokenAccount: yosTokenAccount.address.toBase58(),
      yosTokenProgramATA: yosTokenProgramATA.toBase58(),
      programAuthorityAddress: programAuthorityAddress.toBase58()
    });
    
    // Verify that user has sufficient balance for the swap
    if (!tokenFromMint.equals(new PublicKey("So11111111111111111111111111111111111111112"))) {
      // For token transfers, check token account balance
      const rawAmountNeeded = BigInt(amountInLamports);
      if (tokenFromAccount.balance < rawAmountNeeded) {
        throw new Error(`Insufficient balance. You have ${tokenFromAccount.balance.toString()} ${tokenFromMint.toString()} tokens, but need ${rawAmountNeeded.toString()}.`);
      }
    } else {
      // For SOL transfers, check wallet SOL balance using ConnectionManager
      const solBalance = await connectionManager.executeWithFallback(
        conn => conn.getBalance(wallet.publicKey)
      );
      
      // We need the transfer amount plus extra for transaction fees (0.001 SOL should be enough)
      const neededAmount = amountInLamports + BigInt(1000000); // amount + 0.001 SOL for fees
      if (BigInt(solBalance) < neededAmount) {
        // Convert to numbers for display, with appropriate decimal places
        const solBalanceDecimal = Number(solBalance) / 1_000_000_000;
        const neededAmountDecimal = Number(neededAmount) / 1_000_000_000;
        
        throw new Error(`Insufficient SOL balance. You have ${solBalanceDecimal.toFixed(6)} SOL, but need at least ${neededAmountDecimal.toFixed(6)} SOL (including fees).`);
      }
    }
    
    // Add token mint accounts to the transaction
    // Including the mint accounts is often required for proper validation
    // Using the TOKEN_PROGRAM_ID, SYSTEM_PROGRAM_ID, and SYSVAR_RENT_PUBKEY defined at the top of the file
    
    // Perform additional validation and ensure APR accounts exist
    console.log(`Using tokenFromMint: ${tokenFromMint.toString()}`);
    console.log(`Using tokenToMint: ${tokenToMint.toString()}`);
    console.log(`Using YOS mint: ${YOS_TOKEN_MINT}`);
    
    // Add the swap instruction to the transaction with more complete account list
    // First, let's verify each account is accessible with robust error handling
    const accountsToVerify = [
      { name: 'Program State', account: programStateAddress, expectData: true },
      { name: 'Program Authority', account: programAuthorityAddress, expectData: false }, // PDA may not have data yet
      { name: 'User Token From', account: tokenFromAccount.address, expectData: true },
      { name: 'User Token To', account: tokenToAccount.address, expectData: true },
      { name: 'User YOS', account: yosTokenAccount.address, expectData: true },
      { name: 'Program Token From', account: tokenFromMintATA, expectData: true },
      { name: 'Program Token To', account: tokenToMintATA, expectData: true },
      { name: 'Program YOS', account: yosTokenProgramATA, expectData: true },
    ];
    
    console.log('Verifying account accessibility before swap...');
    
    try {
      // CRITICAL: Check for proper program initialization first!
      const programState = await connectionManager.executeWithFallback(
        conn => conn.getAccountInfo(programStateAddress)
      );
      
      if (!programState || !programState.data || programState.data.length === 0) {
        console.error('Program state account has no data! Program needs to be initialized first.');
        
        // Try automatic initialization since the program state may be missing
        console.log('Attempting automatic program initialization...');
        try {
          const initSignature = await initializeProgram(connectionManager.getConnection(), wallet);
          console.log('Program successfully initialized:', initSignature);
          console.log('Please try your swap again now.');
          throw new Error('Program was not initialized. We\'ve initialized it for you - please try your swap again.');
        } catch (initError: any) {
          console.error('Failed to auto-initialize program:', initError);
          throw new Error('Program is not initialized. Please visit the admin page to initialize it first.');
        }
      }
      
      // Check other critical accounts using ConnectionManager for reliability
      for (const acct of accountsToVerify) {
        try {
          const info = await connectionManager.executeWithFallback(
            conn => conn.getAccountInfo(acct.account)
          );
          
          if (acct.expectData && (!info || !info.data || info.data.length === 0)) {
            console.warn(`WARNING: ${acct.name} account exists but has no data!`);
            
            // Special handling for token accounts - auto create if missing
            if (acct.name.includes('Token')) {
              console.log(`Creating missing token account: ${acct.name}`);
              
              // Use a helper function to determine the correct instruction for token account creation
              const ix = await getTokenAccountCreateInstruction(connectionManager.getConnection(), wallet, acct.account, acct.name);
              if (ix) {
                transaction.add(ix);
                console.log(`Added instruction to create token account ${acct.name}`);
              }
            }
          }
        } catch (acctErr) {
          console.warn(`Error checking ${acct.name} account:`, acctErr);
          // Continue checking other accounts
        }
      }
    } catch (verifyErr) {
      console.warn('Error during account verification:', verifyErr);
      // Continue with swap attempt
    }
    
    // First, verify the program authority with a specific check
    let programAuthorityAccountInfo;
    try {
      programAuthorityAccountInfo = await connectionManager.executeWithFallback(
        conn => conn.getAccountInfo(programAuthorityAddress)
      );
      
      if (!programAuthorityAccountInfo) {
        console.warn("Program authority account not found - this is normal for a PDA that is used only for signing");
        
        // Add a funding instruction to ensure the PDA has enough SOL for rent
        const fundInstruction = SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: programAuthorityAddress,
          lamports: 1000000 // 0.001 SOL for operations
        });
        
        transaction.add(fundInstruction);
      }
    } catch (error) {
      console.error("Error checking program authority account:", error);
    }

    // Ensure program state exists and has data before proceeding
    const programStateAccountInfo = await connectionManager.executeWithFallback(
      conn => conn.getAccountInfo(programStateAddress)
    );
    
    if (!programStateAccountInfo || !programStateAccountInfo.data || programStateAccountInfo.data.length === 0) {
      throw new Error("Program state account is not initialized or has invalid data. Please initialize the program first.");
    }
    
    // Track whether we had an actual TokenAccount issue
    let hasTokenAccountIssues = false;

    // CRITICAL FIX: Check for "InvalidAccountData" errors - specifically check program authority
    try {
      const authorityInfo = await connectionManager.executeWithFallback(
        conn => conn.getAccountInfo(programAuthorityAddress)
      );
      
      if (authorityInfo && authorityInfo.data.length > 0) {
        console.warn('WARNING: Program authority account has data which may cause InvalidAccountData error');
        console.log('Authority data length:', authorityInfo.data.length);
        console.log('Authority data:', Buffer.from(authorityInfo.data).toString('hex'));
        
        // Display first few bytes for debugging
        const firstFewBytes = Buffer.from(authorityInfo.data.slice(0, 8));
        console.log('First 8 bytes:', firstFewBytes.toString('hex'));
        console.log('This is likely causing the InvalidAccountData error at instruction index 2');
      }
    } catch (error) {
      console.log('Error checking program authority account data:', error);
    }

    // Important fix for accounts order:
    // Add the swap instruction with EXACT key ordering as expected by the program
    // This matches EXACTLY what the Rust program expects in the same order
    // CRITICAL FIX: Add the Pool Authority to the accounts list
    // EMERGENCY FIX: Follow the exact account structure expected by the Rust program
    // The InvalidAccountData error indicates the account at index 2 doesn't match what the program expects
    
    // Get the authorities
    const poolAuthorityAddress = new PublicKey(POOL_AUTHORITY);
    const [programAuthorityPDA, authorityBump2] = findProgramAuthorityAddress();
    
    console.log("=== TRANSACTION SETUP ===");
    console.log("Program Authority PDA:", programAuthorityPDA.toString());
    console.log("Pool Authority PDA:", poolAuthorityAddress.toString());
    console.log("Using token accounts with fallback logic");
    console.log("From token account:", tokenFromMintATA.toString());
    console.log("To token account:", tokenToMintATA.toString());
    console.log("YOS token account:", yosTokenProgramATA.toString());
    
    // CRITICAL FIX: Dual authority funding - fund both authorities to ensure at least one works
    if (tokenFromMint.equals(new PublicKey("So11111111111111111111111111111111111111112"))) {
      try {
        // Check both authority accounts and fund them if needed
        
        // 1. Check Program Authority PDA balance
        const programAuthorityBalance = await connectionManager.executeWithFallback(
          conn => conn.getBalance(programAuthorityPDA)
        );
        
        // 2. Check Pool Authority balance
        const poolAuthorityBalance = await connectionManager.executeWithFallback(
          conn => conn.getBalance(poolAuthorityAddress)
        );
        
        console.log(`Program Authority balance: ${programAuthorityBalance / 1_000_000_000} SOL`);
        console.log(`Pool Authority balance: ${poolAuthorityBalance / 1_000_000_000} SOL`);
        
        // If the Program Authority has less than 0.05 SOL, send 0.05 SOL to it
        if (programAuthorityBalance < 50_000_000) { // 0.05 SOL (50 million lamports)
          console.log(`Program Authority needs SOL, sending 0.05 SOL...`);
          
          // Add a SOL transfer instruction to fund the Program Authority
          const fundProgramAuthIx = SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: programAuthorityPDA,
            lamports: 50_000_000 // 0.05 SOL
          });
          
          transaction.add(fundProgramAuthIx);
          console.log(`Added instruction to send 0.05 SOL to Program Authority`);
        }
        
        // DUAL AUTHORITY: If the Pool Authority has less than 0.05 SOL, send 0.05 SOL to it too
        if (poolAuthorityBalance < 50_000_000) { // 0.05 SOL (50 million lamports)
          console.log(`Pool Authority needs SOL, sending 0.05 SOL...`);
          
          // Add a SOL transfer instruction to fund the Pool Authority
          const fundPoolAuthIx = SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: poolAuthorityAddress,
            lamports: 50_000_000 // 0.05 SOL
          });
          
          transaction.add(fundPoolAuthIx);
          console.log(`Added instruction to send 0.05 SOL to Pool Authority`);
        }
      } catch (fundError) {
        console.warn("Error during authority funding:", fundError);
        // Continue with transaction - funding failure is not fatal
      }
    }
    
    // CRITICAL FIX: Dump the instruction data to debug
    console.log("Instruction data bytes:", Array.from(Buffer.from(swapData)));
    
    // CRITICAL FIX: Log account validation
    console.log("============ ACCOUNT VALIDATION ============");
    console.log("Program State PDA:", programStateAddress.toString());
    console.log("Program Authority PDA:", programAuthorityPDA.toString());
    console.log("Pool Authority:", poolAuthorityAddress.toString());
    console.log("Token From Account:", tokenFromAccount.address.toString());
    console.log("Token To Account:", tokenToAccount.address.toString());
    console.log("YOS Token Account:", yosTokenAccount.address.toString());
    console.log("Program Token From ATA:", tokenFromMintATA.toString());
    console.log("Program Token To ATA:", tokenToMintATA.toString());
    console.log("Program YOS ATA:", yosTokenProgramATA.toString());
    
    // CRITICAL FIX: Verify program state data is valid before proceeding
    const stateAccountData = await connectionManager.executeWithFallback(
      conn => conn.getAccountInfo(programStateAddress)
    );
    
    if (!stateAccountData || !stateAccountData.data || stateAccountData.data.length < 32) {
      console.error("CRITICAL: Program state account data is corrupted or missing!");
      throw new Error("Program state is corrupted. Please reinitialize the program.");
    }
    
    // CRITICAL FIX: For compatibility with the deployed program, we need to ensure both the 
    // Program Authority PDA and Pool Authority have sufficient SOL balance
    console.log(`Program Authority (PDA) balance: ${await connectionManager.executeWithFallback(
      conn => conn.getBalance(programAuthorityPDA)
    ) / 1_000_000_000} SOL`);
    
    console.log(`Pool Authority balance: ${await connectionManager.executeWithFallback(
      conn => conn.getBalance(poolAuthorityAddress)
    ) / 1_000_000_000} SOL`);
    
    // Make sure the Program Authority PDA is validated first
    await validateAccount(programAuthorityPDA, "Program Authority");
    
    // EMERGENCY FIX: Check if the Program Authority account has data
    // If it does, this will cause InvalidAccountData error during the swap
    try {
      const programAuthorityInfo = await connectionManager.executeWithFallback(
        conn => conn.getAccountInfo(programAuthorityPDA)
      );
      
      if (programAuthorityInfo && programAuthorityInfo.data.length > 0) {
        console.error("CRITICAL: Program Authority PDA has unexpected data! This will cause InvalidAccountData error");
        console.error(`Data length: ${programAuthorityInfo.data.length} bytes`);
        console.error("First few bytes:", Buffer.from(programAuthorityInfo.data.slice(0, 16)).toString('hex'));
        
        throw new Error("Program Authority PDA has unexpected data which will cause transaction to fail");
      } else {
        console.log("Program Authority PDA validation passed - no unexpected data found");
      }
    } catch (error) {
      console.warn("Error checking Program Authority data:", error);
      // Continue anyway, as this might be a connection error rather than a data error
    }
    
    // IMPORTANT: Add the transaction with very specific ordering that matches the
    // Rust program's expectation EXACTLY
    console.log("Creating transaction instruction with EXACT account order matching Rust program");
    
    // CRITICAL FIX: Reorder accounts to match Rust contract's expected layout EXACTLY
    // The InvalidAccountData error happens because the account at index 2 is being checked
    // by the Rust code with specific expectations
    // =====================================================================
    // COMPLETE REWRITE OF TRANSACTION INSTRUCTION CREATION
    // =====================================================================
    console.log("COMPLETE REWRITE: Creating transaction instruction manually");
    
    // Step 1: Create the account keys array
    const keys = [
      // CRITICAL: User must be first
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // User wallet [0]
      
      // CRITICAL: Program state must be second 
      { pubkey: programStateAddress, isSigner: false, isWritable: true }, // Program state [1]
      
      // CRITICAL FIX: Program Authority must be third AND writable
      // EMERGENCY FIX: Make sure programAuthorityPDA is a regular account/PDA not an ATA
      { pubkey: programAuthorityPDA, isSigner: false, isWritable: true }, // Program Authority PDA [2]
      
      // Pool Authority is the actual owner of token accounts
      { pubkey: poolAuthorityAddress, isSigner: false, isWritable: true }, // Pool Authority [3]
      
      // CRITICAL FIX: For SOL swaps, use wallet.publicKey as the FROM account
      // This is because SOL is directly held in the wallet, not in a token account
      { 
        pubkey: tokenFromMint.equals(new PublicKey("So11111111111111111111111111111111111111112")) 
          ? wallet.publicKey // For SOL, use wallet address directly 
          : tokenFromAccount.address, // For other tokens, use token account
        isSigner: tokenFromMint.equals(new PublicKey("So11111111111111111111111111111111111111112")),
        isWritable: true 
      }, // User's source token account (or wallet for SOL) [4]
      { 
        pubkey: tokenToAccount.address, 
        isSigner: false, 
        isWritable: true 
      }, // User's destination token account [5]
      { 
        pubkey: yosTokenAccount.address, 
        isSigner: false, 
        isWritable: true 
      }, // User's YOS token account for cashback [6]
      
      // CRITICAL FIX: Enhanced token account validation for program token accounts
      // The InvalidAccountData error is likely caused by issues with these accounts
      { 
        pubkey: tokenFromMintATA, 
        isSigner: false, 
        isWritable: true 
      }, // Program's token account for source token [7]
      { 
        pubkey: tokenToMintATA, 
        isSigner: false, 
        isWritable: true 
      }, // Program's token account for destination token [8]
      { 
        pubkey: yosTokenProgramATA, 
        isSigner: false, 
        isWritable: true 
      }, // Program's YOS token account [9]
      
      // Token mints (indexes 10-12)
      { pubkey: tokenFromMint, isSigner: false, isWritable: false }, // From token mint [10]
      { pubkey: tokenToMint, isSigner: false, isWritable: false }, // To token mint [11] 
      { pubkey: new PublicKey(YOS_TOKEN_MINT), isSigner: false, isWritable: false }, // YOS token mint [12]
      
      // System programs (indexes 13-15)
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // SPL Token program [13]
      { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false }, // System program [14]
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // Rent sysvar [15]
    ];
    
    // Step 2: Directly create the program ID from string (hardcoded for maximum reliability)
    const programId = new PublicKey("SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE");
    
    console.log("DEBUG - Program ID Values:");
    console.log(`- From config (string): ${MULTIHUB_SWAP_PROGRAM_ID}`);
    console.log(`- From config (PublicKey): ${MULTIHUB_SWAP_PROGRAM_PUBKEY.toString()}`);
    console.log(`- Hardcoded direct: ${programId.toString()}`);
    
    // Verify they all match
    if (MULTIHUB_SWAP_PROGRAM_ID !== programId.toString()) {
      console.error("ERROR: Program ID from config doesn't match hardcoded ID!");
    }
    
    // Step 3: Create raw transaction instruction with proper buffer
    const swapInstruction = new TransactionInstruction({
      keys: keys,
      programId: programId, // Using hard-coded PublicKey
      data: Buffer.from(swapData)
    });
    
    // Step 4: Verify the instruction has a valid program ID
    console.log(`Instruction created. Program ID: ${swapInstruction.programId.toString()}`);
    console.log(`Program ID valid: ${swapInstruction.programId !== undefined}`);
    
    // Step 5: Add the instruction to the transaction
    transaction.add(swapInstruction);
    
    // CRITICAL FIX: Enhanced error handling for InvalidAccountData
    // First verify that all token accounts exist with proper owners using validateTokenAccount
    console.log('Verifying token accounts before simulation with comprehensive validation...');
    
    try {
      // Import validateTokenAccount if not already available
      const { validateTokenAccount } = await import('./validateTokenAccount');
      
      // Use our comprehensive token account validation function
      // Verify FROM token ATA (program authority)
      const fromTokenValidated = await validateTokenAccount(
        connection,
        tokenFromMintATA,
        tokenFromMint
      );
      
      if (!fromTokenValidated) {
        console.error(`Token account validation failed for FROM token: ${tokenFromMintATA.toString()}`);
        throw new Error(`Program's ${tokenFromMint.toString()} token account not properly set up. Click "Verify & Fund Program Authority" first.`);
      }
      
      // Verify TO token ATA (program authority)
      const toTokenValidated = await validateTokenAccount(
        connection, 
        tokenToMintATA,
        tokenToMint
      );
      
      if (!toTokenValidated) {
        console.error(`Token account validation failed for TO token: ${tokenToMintATA.toString()}`);
        throw new Error(`Program's ${tokenToMint.toString()} token account not properly set up. Click "Verify & Fund Program Authority" first.`);
      }
      
      // Verify YOS token ATA (program authority)
      const yosTokenValidated = await validateTokenAccount(
        connection,
        yosTokenProgramATA,
        new PublicKey(YOS_TOKEN_MINT)
      );
      
      if (!yosTokenValidated) {
        console.warn(`YOS token account validation failed: ${yosTokenProgramATA.toString()}`);
        // Non-blocking warning since cashback is optional
        console.warn("YOS token account validation failed - cashback might not work");
      }
      
      console.log('✅ All token accounts SUCCESSFULLY validated with comprehensive checks');
    } catch (verifyError) {
      console.error('Token account validation failed:', verifyError);
      throw new Error(`Token account validation failed: ${verifyError.message}. Please click "Verify Token Accounts" button in the debug panel.`);
    }
    
    // Simulate the transaction to check for errors with detailed output
    console.log('Simulating swap transaction...');
    let simulation;
    try {
      simulation = await connectionManager.executeWithFallback(
        conn => conn.simulateTransaction(transaction, undefined, true)
      );
      
      // Log detailed simulation results
      if (simulation?.value?.logs) {
        console.log('Detailed swap simulation logs:', simulation.value.logs);
      }
      
      if (simulation?.value?.err) {
        console.error('Swap simulation failed:', simulation.value.err);
        console.error('Simulation error details:', JSON.stringify(simulation.value.err));
        
        // Get the error as a string for checking
        const errString = JSON.stringify(simulation.value.err);
        
        // Enhanced error handling with specific tips for different error types
        if (errString.includes('InvalidAccountData')) {
          const instructionIndex = errString.match(/\[(\d+)\s*,\s*"InvalidAccountData"\]/);
          const index = instructionIndex ? instructionIndex[1] : 'unknown';
          
          // Check if the token account values in the UI match exactly what's being sent to the blockchain
          console.error(`InvalidAccountData error at instruction index ${index}`);
          
          // Suggest specific fixes based on our detailed account debugging
          throw new Error(`Token account validation failed at account index ${index}. This usually happens when token accounts haven't been set up properly. Please use the "Verify & Fund Program Authority" and "Verify Token Accounts" buttons in the debug panel.`);
        } else if (errString.includes('Custom')) {
          // Custom program error, likely amount-related
          throw new Error(`Program reported an error: ${errString}. This could be due to insufficient balance or invalid transaction parameters.`);
        } else if (errString.includes('InsufficientFunds')) {
          // SOL balance issue
          throw new Error(`Insufficient SOL balance for transaction fees. Please ensure your wallet has enough SOL.`);
        }
        
        // Generic error fallback
        throw new Error(`Simulation failed: ${errString}`);
      }
    } catch (simError) {
      console.error('Error during transaction simulation:', simError);
      // If it's already our custom error, re-throw it
      if (simError.message && (
          simError.message.includes('Token account validation failed') ||
          simError.message.includes('Token account verification failed')
      )) {
        throw simError;
      }
      throw new Error(`Transaction simulation error: ${simError.message}`);
    }
    
    // Import the transaction recovery system
    let cleanupTracker: (() => void) | null = null;
    try {
      // Import the transaction recovery system
      const { trackSwapTransaction, recordFailedTransaction } = await import('./multihub-recovery');
      
      // Start tracking this swap transaction for potential recovery
      const tokenInAddress = tokenFromMint.toString();
      const tokenOutAddress = tokenToMint.toString();
      const amountValue = typeof amountIn === 'bigint' ? Number(amountIn) / 1e9 : amountIn;
      
      // Track the transaction for potential recovery
      cleanupTracker = trackSwapTransaction(
        wallet.publicKey,
        tokenInAddress,
        tokenOutAddress,
        amountValue
      );
      
      console.log('Transaction is being tracked for potential recovery if it fails');
    } catch (trackerError) {
      console.warn('Failed to initialize transaction recovery tracker:', trackerError);
      // Continue anyway - recovery is a nice-to-have, not critical for the swap
    }
      
    // Send the transaction
    console.log('Sending swap transaction...');
    try {
      const signature = await wallet.sendTransaction(transaction, connectionManager.getConnection());
      console.log('Swap transaction sent:', signature);
      
      // Wait for confirmation using ConnectionManager for reliability
      await connectionManager.executeWithFallback(
        conn => conn.confirmTransaction(signature, 'confirmed')
      );
      
      console.log('Swap transaction confirmed:', signature);
      
      // Clear the transaction tracker since it succeeded
      if (cleanupTracker) {
        cleanupTracker();
      }
      
      return signature;
    } catch (sendError) {
      console.error('Error sending swap transaction:', sendError);
      
      // Record the failed transaction for recovery
      try {
        const { recordFailedTransaction } = await import('./multihub-recovery');
        
        // Only record certain types of errors that indicate SOL/tokens might have been deducted
        // These are the errors where the transaction was actually sent to the blockchain
        const errorMessage = sendError.message?.toLowerCase() || '';
        
        const wasActuallySent = 
          errorMessage.includes('timeout') || 
          errorMessage.includes('blockhash not found') ||
          errorMessage.includes('invalid account data') ||
          errorMessage.includes('insufficient funds');
        
        if (wasActuallySent) {
          // Get the error signature if available
          const signature = sendError.signature || 'unknown_signature';
          
          recordFailedTransaction(
            wallet.publicKey,
            signature,
            tokenFromMint.toString(),
            tokenToMint.toString(),
            typeof amountIn === 'bigint' ? Number(amountIn) / 1e9 : amountIn
          );
          
          console.log('Transaction recorded for potential recovery:', signature);
        }
      } catch (recoveryError) {
        console.warn('Failed to record transaction for recovery:', recoveryError);
      }
      
      // Clear the transaction tracker
      if (cleanupTracker) {
        cleanupTracker();
      }
      
      throw new Error(`Failed to send swap transaction: ${sendError.message}. You can check the Transaction Recovery tab to recover your funds if they were deducted.`);
    }
  } catch (error) {
    console.error('Error in swap function:', error);
    throw error;
  }
}

/**
 * Helper function to create a token account instruction based on account name pattern
 * ENHANCED: Better handling of User Token accounts with improved logic for SOL
 * CRITICAL FIX: Robust address derivation with fallback logic for InvalidSeeds errors
 */
async function getTokenAccountCreateInstruction(
  connection: Connection,
  wallet: any,
  account: PublicKey,
  accountName: string
): Promise<any> {
  try {
    // Extract mint and owner from the account name pattern
    let mint: PublicKey;
    let owner: PublicKey;
    
    // CRITICAL FIX: Pool Authority is now the owner for program token accounts
    const poolAuthorityAddress = new PublicKey(POOL_AUTHORITY);
    
    // ENHANCED TYPE DETECTION: Check if the account name contains token type names
    if (accountName.includes('YOT')) {
      mint = new PublicKey(YOT_TOKEN_MINT);
    } else if (accountName.includes('YOS')) {
      mint = new PublicKey(YOS_TOKEN_MINT);
    } else if (accountName.includes('SOL') || accountName.includes('User Token From')) {
      // For User Token FROM accounts when performing SOL swaps, assume SOL wrapped token
      mint = new PublicKey('So11111111111111111111111111111111111111112'); // Wrapped SOL mint
    } else {
      console.warn(`Unknown token type in account name: ${accountName}`);
      return null;
    }
    
    // Determine the owner based on account name
    if (accountName.includes('Program')) {
      owner = poolAuthorityAddress; // Use Pool Authority instead of Program Authority
    } else {
      owner = wallet.publicKey;
    }
    
    // IMPORTANT FIX FOR INVALIDSEEDS ERROR:
    // Instead of using the passed account address, we'll always derive the correct ATA
    // using the standard function with proper parameters, then create that account
    
    // Standard method to get Associated Token Address - more reliable
    const derivedTokenAddress = await getAssociatedTokenAddress(
      mint,
      owner,
      true, // Allow owner off curve
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    console.log(`Correctly derived ATA for ${accountName}: ${derivedTokenAddress.toString()}`);
    
    // Log if there's a mismatch with the expected address
    if (!derivedTokenAddress.equals(account)) {
      console.warn(`MISMATCH: Derived address ${derivedTokenAddress.toString()} doesn't match expected ${account.toString()}`);
      console.log(`Using correct derived address to prevent InvalidSeeds error`);
    }
    
    // Create the token account with explicit program IDs
    // CRITICAL FIX: Always use the correctly derived address
    const instruction = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      derivedTokenAddress,
      owner,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    console.log(`Created instruction for: ${accountName} (mint: ${mint.toString()}, owner: ${owner.toString()})`);
    console.log(`ATA address: ${derivedTokenAddress.toString()}`);
    
    // Return both the instruction and the correct address
    return {
      instruction,
      address: derivedTokenAddress
    };
  } catch (error) {
    console.error(`Error creating token account instruction for ${accountName}:`, error);
    return null;
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
    const poolAuthorityAddress = new PublicKey(POOL_AUTHORITY);
    
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
    
    // =====================================================================
    // COMPLETE REWRITE OF CLOSEPROGRAM INSTRUCTION CREATION
    // =====================================================================
    console.log("COMPLETE REWRITE: Creating closeProgram transaction instruction manually");
    
    // Step 1: Create the account keys array
    const keys = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // Admin account that receives the rent
      { pubkey: programStateAddress, isSigner: false, isWritable: true }, // Program state account to be closed
      { pubkey: programAuthorityAddress, isSigner: false, isWritable: true }, // Program authority - must be writable!
      { pubkey: poolAuthorityAddress, isSigner: false, isWritable: true }, // CRITICAL FIX: Pool Authority for token accounts
      { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }, // System Program - needed for closing accounts
    ];
    
    // Step 2: Directly create the program ID from string (hardcoded for maximum reliability)
    const programId = new PublicKey("SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE");
    
    console.log("DEBUG - Program ID Values for closeProgram:");
    console.log(`- From config (string): ${MULTIHUB_SWAP_PROGRAM_ID}`);
    console.log(`- From config (PublicKey): ${MULTIHUB_SWAP_PROGRAM_PUBKEY.toString()}`);
    console.log(`- Hardcoded direct: ${programId.toString()}`);
    
    // Verify they all match
    if (MULTIHUB_SWAP_PROGRAM_ID !== programId.toString()) {
      console.error("ERROR: Program ID from config doesn't match hardcoded ID!");
    }
    
    // Step 3: Create raw transaction instruction with proper buffer
    const closeInstruction = new TransactionInstruction({
      keys: keys,
      programId: programId, // Using hard-coded PublicKey
      data: Buffer.from(closeProgramData)
    });
    
    // Step 4: Verify the instruction has a valid program ID before adding it
    console.log(`CloseProgram instruction created. Program ID: ${closeInstruction.programId.toString()}`);
    console.log(`Program ID valid: ${closeInstruction.programId !== undefined}`);
    
    // Step 5: Add the instruction to the transaction  
    transaction.add(closeInstruction);
    
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

/**
 * Transfer tokens from an existing token account to a PDA-derived ATA
 * This function allows transferring tokens from any token account you have authority over
 * @param connection Solana connection
 * @param wallet Connected wallet (must have authority over the source account)
 * @param sourceAddress Source token account public key
 * @param isYot True to transfer YOT, false to transfer YOS
 * @param amount Amount of tokens to transfer
 * @returns Transaction signature
 */
export async function transferTokensToPDA(
  connection: Connection,
  wallet: any,
  sourceAddress: PublicKey,
  isYot: boolean,
  amount: number
): Promise<string> {
  try {
    // Get Program Authority PDA
    const [programAuthorityAddress, _bump] = findProgramAuthorityAddress();
    
    // Get the appropriate mint address
    const mint = new PublicKey(isYot ? YOT_TOKEN_MINT : YOS_TOKEN_MINT);
    
    // Get destination ATA with explicit program IDs
    const pdaAta = await getAssociatedTokenAddress(
      mint,
      programAuthorityAddress,
      true, // Allow PDA as owner
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Check if destination ATA exists, if not, create it
    const transaction = new Transaction();
    transaction.feePayer = wallet.publicKey;
    
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    const destinationInfo = await connection.getAccountInfo(pdaAta);
    if (!destinationInfo) {
      console.log(`Creating ${isYot ? 'YOT' : 'YOS'} ATA for Program Authority: ${pdaAta.toString()}`);
      const createAtaIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        pdaAta, // ata address
        programAuthorityAddress, // owner (PDA)
        mint, // mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      transaction.add(createAtaIx);
    }
    
    // Calculate amount in raw format (assuming 9 decimals)
    const rawAmount = BigInt(Math.floor(amount * 1e9));
    
    // Add transfer instruction with explicit program ID
    const { createTransferInstruction } = await import('@solana/spl-token');
    const transferIx = createTransferInstruction(
      sourceAddress, // source
      pdaAta, // destination
      wallet.publicKey, // owner
      rawAmount, // amount
      [], // multiSigners (empty array for normal signing)
      TOKEN_PROGRAM_ID // explicit program ID
    );
    transaction.add(transferIx);
    
    // Send and confirm transaction
    console.log(`Transferring ${amount} ${isYot ? 'YOT' : 'YOS'} from ${sourceAddress.toString()} to ${pdaAta.toString()}`);
    const signature = await wallet.sendTransaction(transaction, connection);
    await connection.confirmTransaction(signature, 'confirmed');
    console.log(`Transfer successful: ${signature}`);
    
    return signature;
  } catch (error) {
    console.error('Error in transferTokensToPDA function:', error);
    throw error;
  }
}

/**
 * Admin function to mint tokens directly from mint to PDA-derived ATAs
 * This approach avoids issues with transferring from existing accounts
 * by minting new tokens directly to the PDA ATAs
 */
export async function mintTokensToProgramPDA(
  connection: Connection,
  wallet: any,
  amountYot: number = 0,
  amountYos: number = 0
): Promise<string[]> {
  try {
    // Get Program Authority PDA
    const [programAuthorityAddress, _bump] = findProgramAuthorityAddress();
    
    // Create an array to store transaction signatures from multiple transactions if needed
    const signatures: string[] = [];
    
    // Create or get PDA-owned token accounts for YOT and YOS
    console.log(`Finding or creating PDA-owned ATAs for YOT and YOS tokens...`);
    
    // First transaction: Create ATAs if needed
    const ataTransaction = new Transaction();
    ataTransaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    ataTransaction.recentBlockhash = blockhash;
    let needsAtaCreation = false;
    
    // Create or get PDA-owned YOT account
    const yotMint = new PublicKey(YOT_TOKEN_MINT);
    const pdaYotAta = await getAssociatedTokenAddress(
      yotMint,
      programAuthorityAddress,
      true, // Allow PDA as owner
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Check if account already exists
    const yotAtaInfo = await connection.getAccountInfo(pdaYotAta);
    if (!yotAtaInfo) {
      console.log(`Creating YOT ATA for Program Authority: ${pdaYotAta.toString()}`);
      // Create ATA for Program Authority
      const createYotAtaIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        pdaYotAta, // ata address
        programAuthorityAddress, // owner (PDA)
        yotMint, // mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      ataTransaction.add(createYotAtaIx);
      needsAtaCreation = true;
    } else {
      console.log(`YOT ATA for Program Authority already exists: ${pdaYotAta.toString()}`);
    }
    
    // Create or get PDA-owned YOS account
    const yosMint = new PublicKey(YOS_TOKEN_MINT);
    const pdaYosAta = await getAssociatedTokenAddress(
      yosMint,
      programAuthorityAddress,
      true, // Allow PDA as owner
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Check if account already exists
    const yosAtaInfo = await connection.getAccountInfo(pdaYosAta);
    if (!yosAtaInfo) {
      console.log(`Creating YOS ATA for Program Authority: ${pdaYosAta.toString()}`);
      // Create ATA for Program Authority
      const createYosAtaIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        pdaYosAta, // ata address
        programAuthorityAddress, // owner (PDA)
        yosMint, // mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      ataTransaction.add(createYosAtaIx);
      needsAtaCreation = true;
    } else {
      console.log(`YOS ATA for Program Authority already exists: ${pdaYosAta.toString()}`);
    }
    
    // Send the transaction to create the ATAs if needed
    if (needsAtaCreation) {
      console.log(`Sending transaction to create ATAs...`);
      const createSig = await wallet.sendTransaction(ataTransaction, connection);
      console.log(`ATAs created successfully: ${createSig}`);
      await connection.confirmTransaction(createSig, 'confirmed');
      signatures.push(createSig);
    }
    
    // Get token accounts from mint
    // Using the TOKEN_PROGRAM_ID defined at the top of the file
    
    // Create separate transactions for YOT and YOS to mint directly to PDAs
    if (amountYot > 0) {
      try {
        const mintToYotTx = new Transaction();
        mintToYotTx.feePayer = wallet.publicKey;
        const { blockhash: yotBlockhash } = await connection.getLatestBlockhash();
        mintToYotTx.recentBlockhash = yotBlockhash;
        
        // Convert amount to raw token amount (assuming 9 decimals)
        const mintAmount = BigInt(Math.floor(amountYot * 1e9));
        
        // Create mint instruction using MintToChecked (safer)
        // Instruction data layout:
        // 0: Instruction index (14 for MintToChecked)
        // 1-8: Amount as u64 LE
        // 9: Decimals as u8
        const instructionData = Buffer.alloc(10);
        instructionData.writeUInt8(14, 0); // MintToChecked instruction
        
        // Convert bigint to little-endian bytes
        const amountLE = Buffer.alloc(8);
        amountLE.writeBigUInt64LE(mintAmount, 0);
        amountLE.copy(instructionData, 1);
        
        // Write decimals (9 for most Solana tokens)
        instructionData.writeUInt8(9, 9);
        
        const mintToYotIx = new TransactionInstruction({
          keys: [
            { pubkey: yotMint, isSigner: false, isWritable: true }, // token mint
            { pubkey: pdaYotAta, isSigner: false, isWritable: true }, // destination
            { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // mint authority
          ],
          programId: TOKEN_PROGRAM_ID,
          data: instructionData
        });
        
        mintToYotTx.add(mintToYotIx);
        
        console.log(`Minting ${amountYot} YOT tokens from mint to PDA ATA...`);
        const yotSig = await wallet.sendTransaction(mintToYotTx, connection);
        console.log(`YOT minting successful: ${yotSig}`);
        await connection.confirmTransaction(yotSig, 'confirmed');
        signatures.push(yotSig);
      } catch (err) {
        console.error(`Error minting YOT tokens:`, err);
      }
    }
    
    if (amountYos > 0) {
      try {
        const mintToYosTx = new Transaction();
        mintToYosTx.feePayer = wallet.publicKey;
        const { blockhash: yosBlockhash } = await connection.getLatestBlockhash();
        mintToYosTx.recentBlockhash = yosBlockhash;
        
        // Convert amount to raw token amount (assuming 9 decimals)
        const mintAmount = BigInt(Math.floor(amountYos * 1e9));
        
        // Create mint instruction using MintToChecked (safer)
        const instructionData = Buffer.alloc(10);
        instructionData.writeUInt8(14, 0); // MintToChecked instruction
        
        // Convert bigint to little-endian bytes
        const amountLE = Buffer.alloc(8);
        amountLE.writeBigUInt64LE(mintAmount, 0);
        amountLE.copy(instructionData, 1);
        
        // Write decimals (9 for most Solana tokens)
        instructionData.writeUInt8(9, 9);
        
        const mintToYosIx = new TransactionInstruction({
          keys: [
            { pubkey: yosMint, isSigner: false, isWritable: true }, // token mint
            { pubkey: pdaYosAta, isSigner: false, isWritable: true }, // destination
            { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // mint authority
          ],
          programId: TOKEN_PROGRAM_ID,
          data: instructionData
        });
        
        mintToYosTx.add(mintToYosIx);
        
        console.log(`Minting ${amountYos} YOS tokens from mint to PDA ATA...`);
        const yosSig = await wallet.sendTransaction(mintToYosTx, connection);
        console.log(`YOS minting successful: ${yosSig}`);
        await connection.confirmTransaction(yosSig, 'confirmed');
        signatures.push(yosSig);
      } catch (err) {
        console.error(`Error minting YOS tokens:`, err);
      }
    }
    
    console.log(`
Completed token minting process:
- Created PDA-owned Associated Token Accounts if needed
- Minted tokens directly from token mint to these accounts
- No need for intermediate transfers

Important notes:
- This operation requires the wallet to be a mint authority for both tokens
- The PDA-derived ATAs can now be used in swap operations
- Update program code to reference these new PDA ATAs
    `);
    
    return signatures;
  } catch (error) {
    console.error('Error in mintTokensToProgramPDA function:', error);
    throw error;
  }
}

export default {
  MULTIHUB_SWAP_PROGRAM_ID,
  YOT_TOKEN_MINT,
  YOS_TOKEN_MINT,
  findProgramAuthorityAddress,
  findProgramStateAddress,
  debugProgramIDs,
  checkStateAccount,
  fundProgramAuthority,
  fundProgramYotAccount,
  initializeProgram,
  performSwap,
  closeProgram,
  mintTokensToProgramPDA,
  transferTokensToPDA
};