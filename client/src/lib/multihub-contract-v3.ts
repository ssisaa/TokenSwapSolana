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
} from '@solana/spl-token';
import { config } from './config';
import { connectionManager } from './connection-manager';

// Program ID for the multihub swap V3/V4 contract from central config
export const MULTIHUB_SWAP_PROGRAM_ID = config.programs.multiHub.v4;

// Define hardcoded token account addresses as fallbacks
const DEFAULT_SOL_TOKEN_ACCOUNT = "7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS";
const DEFAULT_YOT_TOKEN_ACCOUNT = "BtHDQ6QwAffeeGftkNQK8X22n7HfnX4dud5vVsPZdqzE";
const DEFAULT_YOS_TOKEN_ACCOUNT = "5eQTdriuNrWaVdbLiyKDPwakYjM9na6ctYbxauPxaqWz";
const POOL_AUTHORITY = "7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK";

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
    new PublicKey(MULTIHUB_SWAP_PROGRAM_ID)
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
    const programId = new PublicKey(MULTIHUB_SWAP_PROGRAM_ID);
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
    // 4. system program - needed for creating accounts
    // 5. rent sysvar - needed for calculating lamports
    console.log(`Adding initialization instruction with accounts:`);
    console.log(`1. Payer: ${wallet.publicKey.toString()}`);
    console.log(`2. Program State (PDA): ${programStateAddress.toString()}`);
    console.log(`3. Program Authority (PDA): ${programAuthorityAddress.toString()}`);
    console.log(`4. System Program: 11111111111111111111111111111111`);
    console.log(`5. Rent Sysvar: SysvarRent111111111111111111111111111111111`);
    
    // Create a proper TransactionInstruction with all necessary accounts
    const initializeProgramInstruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // payer_account
        { pubkey: programStateAddress, isSigner: false, isWritable: true }, // program_state_account (will be created by program)
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: true }, // program_authority_account 
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }, // system_program_account
        { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }, // rent_sysvar_account
      ],
      programId: new PublicKey(MULTIHUB_SWAP_PROGRAM_ID), // Using program ID from config
      data: instructionData
    });
    
    // Add the instruction to the transaction
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

async function ensureTokenAccount(
  connection: Connection,
  wallet: any,
  mint: PublicKey,
  transaction: Transaction
): Promise<TokenAccountInfo> {
  try {
    // Handle SOL separately since it's not a token account
    if (mint.toString() === 'So11111111111111111111111111111111111111112' || 
        mint.toString() === SystemProgram.programId.toString()) {
      
      const solBalance = await connection.getBalance(wallet.publicKey);
      console.log(`SOL balance: ${solBalance / 1_000_000_000} SOL`);
      return { 
        address: wallet.publicKey, 
        balance: BigInt(solBalance) 
      };
    }
    
    // For other tokens, use getOrCreateAssociatedTokenAccount for maximum compatibility
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet, // Payer for account creation
      mint,
      wallet.publicKey // Owner of the token account
    );
    
    console.log(`Token account for ${mint.toString()}: ${tokenAccount.address.toString()}`);
    console.log(`Balance: ${tokenAccount.amount.toString()} (Owner: ${tokenAccount.owner.toString()})`);
    
    return {
      address: tokenAccount.address,
      balance: tokenAccount.amount
    };
  } catch (err: any) {
    console.error(`Error ensuring token account for mint ${mint.toString()}:`, err);
    
    // Fallback to the old method if getOrCreateAssociatedTokenAccount fails
    console.log('Falling back to basic account creation...');
    
    // Get the associated token address for the wallet
    const tokenAddress = await getAssociatedTokenAddress(
      mint,
      wallet.publicKey
    );
    
    // Check if the account exists
    const accountInfo = await connection.getAccountInfo(tokenAddress);
    
    // If account doesn't exist, create it
    if (!accountInfo) {
      console.log('Creating token account for mint:', mint.toString());
      const createAtaIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        tokenAddress,
        wallet.publicKey,
        mint
      );
      transaction.add(createAtaIx);
    }
    
    try {
      // Get token balance if possible
      const accountInfo = await getAccount(connection, tokenAddress);
      return {
        address: tokenAddress,
        balance: accountInfo.amount
      };
    } catch (balanceErr: any) {
      // Return zero balance if we can't get it yet
      console.warn('Unable to get account balance, assuming zero:', balanceErr?.message || 'Unknown error');
      return {
        address: tokenAddress,
        balance: BigInt(0)
      };
    }
  }
}

/**
 * Perform a token swap using the multihub swap V3 program
 * This improved version uses ConnectionManager for reliable network operations
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
    // CRITICAL FIX: Use the correct token accounts from hardcoded values
    let tokenFromMintATA;
    if (tokenFromMint.toString() === "So11111111111111111111111111111111111111112") {
      // Use SOL token account from hardcoded value
      tokenFromMintATA = new PublicKey(DEFAULT_SOL_TOKEN_ACCOUNT);
      console.log("Using SOL token account (FROM):", tokenFromMintATA.toString());
    } else if (tokenFromMint.toString() === config.tokens.YOT) {
      // Use YOT token account from hardcoded value
      tokenFromMintATA = new PublicKey(DEFAULT_YOT_TOKEN_ACCOUNT);
      console.log("Using YOT token account (FROM):", tokenFromMintATA.toString());
    } else if (tokenFromMint.toString() === config.tokens.YOS) {
      // Use YOS token account from hardcoded value
      tokenFromMintATA = new PublicKey(DEFAULT_YOS_TOKEN_ACCOUNT);
      console.log("Using YOS token account (FROM):", tokenFromMintATA.toString());
    } else {
      tokenFromMintATA = await getAssociatedTokenAddress(
        tokenFromMint,
        programAuthorityAddress,
        true  // allowOwnerOffCurve: true for PDAs
      );
    }
    
    // CRITICAL FIX: Use the correct token accounts from hardcoded values
    let tokenToMintATA;
    if (tokenToMint.toString() === "So11111111111111111111111111111111111111112") {
      // Use SOL token account from hardcoded value
      tokenToMintATA = new PublicKey(DEFAULT_SOL_TOKEN_ACCOUNT);
      console.log("Using SOL token account (TO):", tokenToMintATA.toString());
    } else if (tokenToMint.toString() === config.tokens.YOT) {
      // Use YOT token account from hardcoded value
      tokenToMintATA = new PublicKey(DEFAULT_YOT_TOKEN_ACCOUNT);
      console.log("Using YOT token account (TO):", tokenToMintATA.toString());
    } else if (tokenToMint.toString() === config.tokens.YOS) {
      // Use YOS token account from hardcoded value
      tokenToMintATA = new PublicKey(DEFAULT_YOS_TOKEN_ACCOUNT);
      console.log("Using YOS token account (TO):", tokenToMintATA.toString());
    } else {
      tokenToMintATA = await getAssociatedTokenAddress(
        tokenToMint, 
        programAuthorityAddress,
        true // allowOwnerOffCurve: true for PDAs
      );
    }
    
    const yosTokenProgramATA = await getAssociatedTokenAddress(
      new PublicKey(YOS_TOKEN_MINT),
      programAuthorityAddress,
      true // allowOwnerOffCurve: true for PDAs
    );
    
    // Create all token accounts first before we do any validations
    // This ensures all accounts exist before we try to check balances
    try {
      // Check the program's token accounts using ConnectionManager for reliability
      const tokenFromProgramAccount = await connectionManager.executeWithFallback(
        conn => conn.getAccountInfo(tokenFromMintATA)
      );
      
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
      
      const tokenToProgramAccount = await connectionManager.executeWithFallback(
        conn => conn.getAccountInfo(tokenToMintATA)
      );
      
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
      
      const yosProgramAccount = await connectionManager.executeWithFallback(
        conn => conn.getAccountInfo(yosTokenProgramATA)
      );
      
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
      const neededAmount = amountInLamports + 1000000; // amount + 0.001 SOL for fees
      if (solBalance < neededAmount) {
        throw new Error(`Insufficient SOL balance. You have ${solBalance / 1_000_000_000} SOL, but need at least ${neededAmount / 1_000_000_000} SOL (including fees).`);
      }
    }
    
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
    transaction.add(new TransactionInstruction({
      keys: [
        // User accounts (indexes 0-2)
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // User wallet [0]
        { pubkey: programStateAddress, isSigner: false, isWritable: true }, // Program state for updating [1]
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: true }, // Program authority for signing PDAs [2]
        
        // User token accounts (indexes 3-5)
        { pubkey: tokenFromAccount.address, isSigner: false, isWritable: true }, // User's source token account [3]
        { pubkey: tokenToAccount.address, isSigner: false, isWritable: true }, // User's destination token account [4]
        { pubkey: yosTokenAccount.address, isSigner: false, isWritable: true }, // User's YOS token account for cashback [5]
        
        // Program token accounts (indexes 6-8)
        { pubkey: tokenFromMintATA, isSigner: false, isWritable: true }, // Program's token account for source token [6]
        { pubkey: tokenToMintATA, isSigner: false, isWritable: true }, // Program's token account for destination token [7]
        { pubkey: yosTokenProgramATA, isSigner: false, isWritable: true }, // Program's YOS token account [8]
        
        // Token mints (indexes 9-11)
        { pubkey: tokenFromMint, isSigner: false, isWritable: false }, // From token mint [9]
        { pubkey: tokenToMint, isSigner: false, isWritable: false }, // To token mint [10]
        { pubkey: new PublicKey(YOS_TOKEN_MINT), isSigner: false, isWritable: false }, // YOS token mint [11]
        
        // System programs (indexes 12-14)
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // SPL Token program [12]
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false }, // System program [13]
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // Rent sysvar [14]
      ],
      programId: new PublicKey(MULTIHUB_SWAP_PROGRAM_ID), // Using program ID from config
      data: Buffer.from(swapData)
    }));
    
    // Simulate the transaction to check for errors with detailed output
    console.log('Simulating swap transaction...');
    const simulation = await connectionManager.executeWithFallback(
      conn => conn.simulateTransaction(transaction, undefined, true)
    );
    
    // Log detailed simulation results
    console.log('Detailed swap simulation logs:', simulation.value.logs);
    
    if (simulation.value.err) {
      console.error('Swap simulation failed:', simulation.value.err);
      console.error('Simulation error details:', JSON.stringify(simulation.value.err));
      throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }
    
    // Send the transaction
    console.log('Sending swap transaction...');
    const signature = await wallet.sendTransaction(transaction, connectionManager.getConnection());
    console.log('Swap transaction sent:', signature);
    
    // Wait for confirmation using ConnectionManager for reliability
    await connectionManager.executeWithFallback(
      conn => conn.confirmTransaction(signature, 'confirmed')
    );
    
    console.log('Swap transaction confirmed:', signature);
    return signature;
  } catch (error) {
    console.error('Error in swap function:', error);
    throw error;
  }
}

/**
 * Helper function to create a token account instruction based on account name pattern
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
    
    // Program authority is always the owner for program token accounts
    const [programAuthorityAddress] = findProgramAuthorityAddress();
    
    if (accountName.includes('YOT')) {
      mint = new PublicKey(YOT_TOKEN_MINT);
    } else if (accountName.includes('YOS')) {
      mint = new PublicKey(YOS_TOKEN_MINT);
    } else if (accountName.includes('SOL')) {
      mint = new PublicKey('So11111111111111111111111111111111111111112');
    } else {
      console.warn(`Unknown token type in account name: ${accountName}`);
      return null;
    }
    
    // Determine the owner based on account name
    if (accountName.includes('Program')) {
      owner = programAuthorityAddress;
    } else {
      owner = wallet.publicKey;
    }
    
    // Create the token account
    const instruction = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      account,
      owner,
      mint
    );
    
    console.log(`Created instruction for: ${accountName} (mint: ${mint.toString()}, owner: ${owner.toString()})`);
    return instruction;
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
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // Admin account that receives the rent
        { pubkey: programStateAddress, isSigner: false, isWritable: true }, // Program state account to be closed
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: true }, // Program authority - must be writable!
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }, // System Program - needed for closing accounts
      ],
      programId: new PublicKey(MULTIHUB_SWAP_PROGRAM_ID), // Using program ID from config
      data: Buffer.from(closeProgramData)
    }));
    
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
  debugProgramIDs,
  checkStateAccount,
  fundProgramAuthority,
  fundProgramYotAccount,
  initializeProgram,
  performSwap,
  closeProgram
};