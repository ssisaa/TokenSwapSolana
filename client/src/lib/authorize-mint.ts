/**
 * Utility functions to set up token mint authorities
 * This is necessary for program-controlled tokens like YOS
 */

import { 
  Connection, PublicKey, Transaction 
} from '@solana/web3.js';
import { SOLANA_RPC_URL, YOS_TOKEN_ADDRESS, MULTI_HUB_SWAP_PROGRAM_ID } from './config';
import { 
  TOKEN_PROGRAM_ID, createSetAuthorityInstruction, AuthorityType
} from '@solana/spl-token';
import { sendTransaction } from './transaction-helper';

/**
 * Set the YOS mint authority to the program authority PDA
 * This only needs to be run once by the admin
 * @param wallet The wallet from which to send the transaction
 */
export async function setProgramAsMintAuthority(wallet: any) {
  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const adminPublicKey = wallet.publicKey;
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const programId = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    
    // Derive the program authority PDA
    const [programAuthority, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority")],
      programId
    );
    
    console.log("Admin wallet:", adminPublicKey.toString());
    console.log("YOS mint:", yosMint.toString());
    console.log("Program authority PDA:", programAuthority.toString());
    console.log("Authority bump seed:", bump);
    
    // Get mint info to check the current authority directly
    const mintInfo = await connection.getAccountInfo(yosMint);
    if (!mintInfo) {
      throw new Error("YOS mint account not found");
    }
    
    // Parse mint info to extract current authority
    const mintAuthorityOption = mintInfo.data[0];
    let currentAuthority = "No authority set";
    
    if (mintAuthorityOption !== 0) {
      const mintAuthorityBytes = mintInfo.data.slice(4, 36);
      const mintAuthority = new PublicKey(mintAuthorityBytes);
      currentAuthority = mintAuthority.toString();
    }
    
    console.log("Current mint authority:", currentAuthority);
    console.log("Admin wallet:", adminPublicKey.toString());
    
    if (currentAuthority !== adminPublicKey.toString()) {
      console.warn("WARNING: Current mint authority does not match your wallet address!");
      console.warn("This transaction may fail if you are not the current mint authority.");
    }
    
    // Create set authority instruction
    const instruction = createSetAuthorityInstruction(
      yosMint,             // Token mint account
      adminPublicKey,      // Current authority (admin)
      AuthorityType.MintTokens, // Authority type
      programAuthority,    // New authority (program PDA)
      [],                  // Multisig signers (empty for single signer)
      TOKEN_PROGRAM_ID     // Token program ID
    );
    
    // Create transaction
    const transaction = new Transaction().add(instruction);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = adminPublicKey;
    
    console.log("Transaction prepared with:");
    console.log("- Blockhash:", blockhash);
    console.log("- Fee payer:", adminPublicKey.toString());
    console.log("- Using universal transaction helper for cross-wallet compatibility");
    
    // Use the universal transaction helper to handle different wallet types
    const signature = await sendTransaction(wallet, transaction, connection);
    
    console.log("✅ Successfully set program authority PDA as mint authority for YOS token");
    console.log("Transaction signature:", signature);
    
    return { success: true, signature };
  } catch (error: any) {
    console.error("Failed to set program as mint authority:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if the program authority PDA is already the mint authority for YOS
 */
export async function checkYosMintAuthority(): Promise<{
  isCorrect: boolean,
  currentAuthority: string,
  expectedAuthority: string,
  authorityBump: number
}> {
  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const programId = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    
    // Derive the program authority PDA
    const [programAuthority, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority")],
      programId
    );
    
    console.log("Checking mint authority...");
    console.log("YOS mint:", yosMint.toString());
    console.log("Expected authority (PDA):", programAuthority.toString());
    console.log("Authority bump seed:", bump);
    
    // Get mint info
    const mintInfo = await connection.getAccountInfo(yosMint);
    if (!mintInfo) {
      throw new Error("YOS mint account not found");
    }
    
    // Parse mint info - the mint authority is at bytes 4-35
    const mintAuthorityOption = mintInfo.data[0]; // First byte indicates if authority is present
    
    if (mintAuthorityOption === 0) {
      // No mint authority set
      return {
        isCorrect: false,
        currentAuthority: "No authority set",
        expectedAuthority: programAuthority.toString(),
        authorityBump: bump
      };
    }
    
    // Extract mint authority (bytes 4-35)
    const mintAuthorityBytes = mintInfo.data.slice(4, 36);
    const mintAuthority = new PublicKey(mintAuthorityBytes);
    
    const isCorrect = mintAuthority.equals(programAuthority);
    
    console.log("Current mint authority:", mintAuthority.toString());
    console.log("Expected program authority:", programAuthority.toString());
    console.log("Are they equal?", isCorrect);
    
    return {
      isCorrect,
      currentAuthority: mintAuthority.toString(),
      expectedAuthority: programAuthority.toString(),
      authorityBump: bump
    };
  } catch (error: any) {
    console.error("Error checking YOS mint authority:", error);
    throw error;
  }
}