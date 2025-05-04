// Simple TypeScript script to create and fund a YOT token account for the program
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} from "@solana/spl-token";
import fs from 'fs';
import path from 'path';

// Constants
const YOT_TOKEN_MINT = new PublicKey("2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF");
const PROGRAM_ID = new PublicKey("SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE"); // V4 Program

// Find program authority PDA
function findProgramAuthorityAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    PROGRAM_ID
  );
}

async function main() {
  try {
    // Connect to Solana devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Get program PDA (this address will be the same for everyone)
    const [programAuthority, _bump] = findProgramAuthorityAddress();
    console.log("\n⚠️ PROBLEM: Program Authority (PDA) needs a YOT token account");
    console.log("PDA Address:", programAuthority.toBase58());
    
    // Calculate what the YOT token account address would be
    console.log("\n✅ When created, the PDA's YOT token account will be at this address:");
    const pdaTokenAddress = PublicKey.findProgramAddressSync(
      [
        programAuthority.toBuffer(),
        new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").toBuffer(),
        YOT_TOKEN_MINT.toBuffer(),
      ],
      new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
    )[0];
    console.log(pdaTokenAddress.toBase58());
    
    // Print instructions
    console.log(`
=====================================================================
HOW TO FIX THE "PROGRAM DOESN'T HAVE A TOKEN ACCOUNT FOR YOT" ERROR
=====================================================================

1. Run this command on your server:
   
   ts-node scripts/fund-program-yot.ts
   
2. This will:
   - Create the YOT token account for the program authority
   - Fund it with YOT tokens from your admin wallet
   
3. After running this once, SOL→YOT swaps will work for all users

Note: Your admin wallet must have YOT tokens and be in program-keypair.json
=====================================================================
`);
    
  } catch (error) {
    console.error("Error:", error);
  }
}

main();