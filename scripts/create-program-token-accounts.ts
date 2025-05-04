import {
  Connection,
  PublicKey,
  Keypair,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import fs from 'fs';
import path from 'path';

// Constants
const YOT_TOKEN_MINT = new PublicKey("2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF");
const YOS_TOKEN_MINT = new PublicKey("GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n");
const PROGRAM_ID = new PublicKey("Cohae9agySEgC9gyJL1QHCJWw4q58R7Wshr3rpPJHU7L");

// Load admin keypair
function loadKeypair(filePath: string): Keypair {
  try {
    const keypairData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
  } catch (error) {
    console.error('Error loading keypair:', error);
    throw error;
  }
}

// Find program authority PDA
function findProgramAuthorityAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    PROGRAM_ID
  );
}

async function main() {
  try {
    // Establish connection to Solana devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Load admin wallet keypair for transaction fees
    console.log("Loading admin keypair...");
    const adminKeypair = loadKeypair(path.join(process.cwd(), 'program-keypair.json'));
    
    // Get program PDA that needs the token accounts
    const [programAuthority, _bump] = findProgramAuthorityAddress();
    console.log("Program Authority (PDA):", programAuthority.toBase58());
    
    console.log("Creating token accounts for the program PDA...");
    
    // Create or verify YOT token account for the PDA
    console.log("Creating YOT token account...");
    const yotAta = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair,
      YOT_TOKEN_MINT,
      programAuthority,
      true // Allow the owner to be a PDA
    );
    console.log("✅ YOT Token Account:", yotAta.address.toBase58());
    
    // Create or verify YOS token account for the PDA
    console.log("Creating YOS token account...");
    const yosAta = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair,
      YOS_TOKEN_MINT,
      programAuthority,
      true // Allow the owner to be a PDA
    );
    console.log("✅ YOS Token Account:", yosAta.address.toBase58());
    
    console.log("Token accounts created successfully!");
    
    // Verify balances
    const yotTokenAccount = await connection.getTokenAccountBalance(yotAta.address);
    console.log("YOT balance:", yotTokenAccount.value.uiAmount);
    
    const yosTokenAccount = await connection.getTokenAccountBalance(yosAta.address);
    console.log("YOS balance:", yosTokenAccount.value.uiAmount);
    
    console.log("IMPORTANT: The program PDA now has the required token accounts, but they need to have tokens to function properly.");
    console.log("To enable SOL->YOT swaps, please transfer some YOT tokens to this address:", yotAta.address.toBase58());
    
  } catch (error) {
    console.error("Error creating token accounts:", error);
  }
}

main().catch(console.error);