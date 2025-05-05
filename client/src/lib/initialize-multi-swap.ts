/**
 * Multi-Hub Swap Program Initialization
 * 
 * This file contains functions to initialize the Multi-Hub Swap program
 * It is meant to be used only for initial setup and not regular operations
 */

import { Keypair, Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, TransactionInstruction, Transaction } from '@solana/web3.js';
import { ENDPOINT, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS } from './constants';
import { ADMIN_KEYPAIR } from './multi-swap-admin';
import { MULTI_HUB_SWAP_PROGRAM_ID } from './config';

// Connect to Solana network
const connection = new Connection(ENDPOINT, 'confirmed');

/**
 * Find program state PDA address
 */
function findProgramStateAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Find program authority PDA address
 */
function findProgramAuthorityAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Initialize Multi-Hub Swap Program with default parameters 
 * This should only be called once to initialize the program state
 */
export async function initializeMultiHubSwapProgram(
  lpContributionRate: number = 20,   // % (20% = 2000 basis points)
  adminFeeRate: number = 0.1,        // % (0.1% = 10 basis points)
  yosCashbackRate: number = 5,       // % (5% = 500 basis points)
  swapFeeRate: number = 0.3,         // % (0.3% = 30 basis points)
  referralRate: number = 0.5         // % (0.5% = 50 basis points)
): Promise<string> {
  try {
    const adminKeypair = ADMIN_KEYPAIR;
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const admin = adminKeypair.publicKey;
    
    // Convert percentages to basis points (1% = 100 basis points)
    const lpContributionBps = Math.round(lpContributionRate * 100);
    const adminFeeBps = Math.round(adminFeeRate * 100);
    const yosCashbackBps = Math.round(yosCashbackRate * 100);
    const swapFeeBps = Math.round(swapFeeRate * 100);
    const referralBps = Math.round(referralRate * 100);
    
    // Find program state and authority PDAs
    const [programStateAddress, _programStateBump] = findProgramStateAddress();
    const [programAuthorityAddress, _programAuthorityBump] = findProgramAuthorityAddress();
    
    console.log("Program state address:", programStateAddress.toString());
    console.log("Program authority address:", programAuthorityAddress.toString());
    
    // Create initialize instruction data
    // First byte is the instruction discriminator (0 for Initialize)
    const data = Buffer.alloc(1 + 32*3 + 8*5); // 1 byte + 3 pubkeys + 5 u64s
    data.writeUInt8(0, 0); // Initialize instruction
    
    // Write admin pubkey
    admin.toBuffer().copy(data, 1);
    
    // Write YOT mint pubkey
    yotMint.toBuffer().copy(data, 33);
    
    // Write YOS mint pubkey
    yosMint.toBuffer().copy(data, 65);
    
    // Write rates as u64 values
    data.writeBigUInt64LE(BigInt(lpContributionBps), 97);
    data.writeBigUInt64LE(BigInt(adminFeeBps), 105);
    data.writeBigUInt64LE(BigInt(yosCashbackBps), 113);
    data.writeBigUInt64LE(BigInt(swapFeeBps), 121);
    data.writeBigUInt64LE(BigInt(referralBps), 129);
    
    // Create instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: true },
        { pubkey: programAuthorityAddress, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
      ],
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
      data
    });
    
    // Create transaction
    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = adminKeypair.publicKey;
    
    // Sign with admin keypair
    transaction.sign(adminKeypair);
    
    // Send and confirm
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log("Multi-Hub Swap Program initialized successfully:", signature);
    
    return signature;
  } catch (error) {
    console.error("Error initializing Multi-Hub Swap Program:", error);
    throw error;
  }
}

/**
 * Check if the program is already initialized
 * @returns true if program state exists, false otherwise
 */
export async function isProgramInitialized(): Promise<boolean> {
  try {
    const [programStateAddress] = findProgramStateAddress();
    const accountInfo = await connection.getAccountInfo(programStateAddress);
    
    // If account info exists and has data, the program is initialized
    return !!accountInfo && !!accountInfo.data && accountInfo.data.length > 0;
  } catch (error) {
    console.error("Error checking program initialization:", error);
    return false;
  }
}

/**
 * Run program initialization if needed
 * This can be called safely as it will only initialize if not already done
 */
export async function ensureProgramInitialized(): Promise<void> {
  const initialized = await isProgramInitialized();
  
  if (!initialized) {
    console.log("Multi-Hub Swap Program is not initialized. Initializing now...");
    await initializeMultiHubSwapProgram();
    console.log("Program initialization complete.");
  } else {
    console.log("Multi-Hub Swap Program is already initialized.");
  }
}