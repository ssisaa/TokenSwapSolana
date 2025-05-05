/**
 * Utility functions to set up token mint authorities
 * This is necessary for program-controlled tokens like YOS
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';
import { SOLANA_RPC_URL, YOS_TOKEN_ADDRESS, MULTI_HUB_SWAP_PROGRAM_ID } from './config';
import { ADMIN_KEYPAIR } from './multi-swap-admin';
import { TOKEN_PROGRAM_ID, createSetAuthorityInstruction, AuthorityType } from '@solana/spl-token';

/**
 * Set the YOS mint authority to the program authority PDA
 * This only needs to be run once by the admin
 */
export async function setProgramAsMintAuthority() {
  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const adminKeypair = ADMIN_KEYPAIR;
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const programId = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    
    // Derive the program authority PDA
    const [programAuthority, _bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority")],
      programId
    );
    
    console.log("Admin wallet:", adminKeypair.publicKey.toString());
    console.log("YOS mint:", yosMint.toString());
    console.log("Program authority PDA:", programAuthority.toString());
    
    // Create set authority instruction
    const instruction = createSetAuthorityInstruction(
      yosMint,                  // Token mint account
      adminKeypair.publicKey,   // Current authority (admin)
      AuthorityType.MintTokens, // Authority type
      programAuthority,         // New authority (program PDA)
      [],                       // Signers (empty for instructions)
      TOKEN_PROGRAM_ID          // Token program ID
    );
    
    // Create and sign transaction
    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = adminKeypair.publicKey;
    
    transaction.sign(adminKeypair);
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection, 
      transaction, 
      [adminKeypair]
    );
    
    console.log("✅ Successfully set program authority PDA as mint authority for YOS token");
    return { success: true };
  } catch (error) {
    console.error("Failed to set program as mint authority:", error);
    return { success: false, error };
  }
}

/**
 * Check if the program authority PDA is already the mint authority for YOS
 */
export async function checkYosMintAuthority(): Promise<{
  isCorrect: boolean,
  currentAuthority: string,
  expectedAuthority: string
}> {
  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const programId = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    
    // Derive the program authority PDA
    const [programAuthority, _bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority")],
      programId
    );
    
    // Get mint info
    const mintInfo = await connection.getAccountInfo(yosMint);
    if (!mintInfo) {
      throw new Error("YOS mint account not found");
    }
    
    // Parse mint info - the mint authority is at bytes 4-35
    const mintAuthorityBytes = mintInfo.data.slice(4, 36);
    const mintAuthority = new PublicKey(mintAuthorityBytes);
    
    const isCorrect = mintAuthority.equals(programAuthority);
    
    return {
      isCorrect,
      currentAuthority: mintAuthority.toString(),
      expectedAuthority: programAuthority.toString()
    };
  } catch (error) {
    console.error("Error checking YOS mint authority:", error);
    throw error;
  }
}