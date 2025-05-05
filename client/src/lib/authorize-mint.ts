/**
 * Utility functions to set up token mint authorities
 * This is necessary for program-controlled tokens like YOS
 */

import { 
  Connection, PublicKey, Transaction 
} from '@solana/web3.js';
import { SOLANA_RPC_URL, YOS_TOKEN_ADDRESS, MULTI_HUB_SWAP_PROGRAM_ID } from './config';
import { 
  TOKEN_PROGRAM_ID, createSetAuthorityInstruction, AuthorityType,
  getMint
} from '@solana/spl-token';
import { sendTransaction } from './transaction-helper';

/**
 * Set the YOS mint authority to the program authority PDA
 * This only needs to be run once by the admin
 * @param wallet The wallet from which to send the transaction
 * @param overrideAuthority Optional override for the current mint authority if it's different from the wallet
 */
export async function setProgramAsMintAuthority(wallet: any, overrideAuthority?: string) {
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
    
    // Get mint info using SPL Token library
    const mintInfo = await getMint(connection, yosMint);
    
    // Get current authority
    let currentAuthority = "No authority set";
    if (mintInfo.mintAuthority) {
      currentAuthority = mintInfo.mintAuthority.toString();
    }
    
    console.log("Current mint authority:", currentAuthority);
    console.log("Admin wallet:", adminPublicKey.toString());
    
    if (currentAuthority !== adminPublicKey.toString()) {
      console.warn("WARNING: Current mint authority does not match your wallet address!");
      console.warn("This transaction may fail if you are not the current mint authority.");
      console.warn("Current authority: " + currentAuthority);
      console.warn("Your wallet: " + adminPublicKey.toString());
    }
    
    // If an override authority is provided, use it instead of the admin's public key
    let currentAuthorityKey: PublicKey;
    
    if (overrideAuthority) {
      try {
        currentAuthorityKey = new PublicKey(overrideAuthority);
        console.log("Using override authority:", currentAuthorityKey.toString());
      } catch (err) {
        console.error("Invalid override authority provided:", err);
        currentAuthorityKey = adminPublicKey;
      }
    } else {
      // Use the admin's public key by default
      currentAuthorityKey = adminPublicKey;
    }
    
    console.log("Setting mint authority using authority:", currentAuthorityKey.toString());
    
    // Create set authority instruction with the appropriate authority
    const instruction = createSetAuthorityInstruction(
      yosMint,                // Token mint account
      currentAuthorityKey,    // Current authority (admin or override)
      AuthorityType.MintTokens, // Authority type
      programAuthority,       // New authority (program PDA)
      [],                     // Multisig signers (empty for single signer)
      TOKEN_PROGRAM_ID        // Token program ID
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
    
    // Improve error reporting by adding more detailed logs
    console.log("Sending transaction with the following parameters:");
    console.log("- Current authority:", currentAuthorityKey.toString());
    console.log("- Target mint:", yosMint.toString());
    console.log("- New authority:", programAuthority.toString());
    
    // Use the universal transaction helper to handle different wallet types
    try {
      const signature = await sendTransaction(wallet, transaction, connection);
      
      console.log("✅ Successfully set program authority PDA as mint authority for YOS token");
      console.log("Transaction signature:", signature);
      
      return { success: true, signature };
    } catch (sendError: any) {
      console.error("Transaction failed during sending:", sendError);
      // Try to get more detailed error information
      let errorMsg = sendError.message || "Unknown error";
      if (sendError.logs) {
        console.error("Transaction logs:", sendError.logs);
        errorMsg += "\nLogs: " + sendError.logs.join('\n');
      }
      
      return { 
        success: false, 
        error: errorMsg,
        details: {
          currentAuthority: currentAuthorityKey.toString(),
          targetMint: yosMint.toString(),
          newAuthority: programAuthority.toString()
        }
      };
    }
  } catch (error: any) {
    console.error("Failed to set program as mint authority:", error);
    
    // Add more detailed error information if available
    let details = undefined;
    
    // Try to extract PublicKey values from the current scope
    try {
      details = {
        currentAuthority: currentAuthorityKey?.toString() || "unknown",
        targetMint: yosMint?.toString() || "unknown",
        newAuthority: programAuthority?.toString() || "unknown"
      };
    } catch (detailsError) {
      console.error("Could not extract detailed error information:", detailsError);
    }
    
    return { 
      success: false, 
      error: error.message,
      details
    };
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
    
    // Get mint info using SPL Token library
    const mintInfo = await getMint(connection, yosMint);
    
    console.log("Full mint info:", mintInfo);
    
    // Check if mint authority exists
    if (!mintInfo.mintAuthority) {
      return {
        isCorrect: false,
        currentAuthority: "No authority set",
        expectedAuthority: programAuthority.toString(),
        authorityBump: bump
      };
    }
    
    const mintAuthority = mintInfo.mintAuthority;
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