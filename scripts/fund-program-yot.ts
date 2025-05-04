import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import fs from 'fs';
import path from 'path';

// Constants
const YOT_TOKEN_MINT = new PublicKey("2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF");
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
    console.log("Admin public key:", adminKeypair.publicKey.toBase58());
    
    // Get program PDA that needs the token accounts
    const [programAuthority, _bump] = findProgramAuthorityAddress();
    console.log("Program Authority (PDA):", programAuthority.toBase58());
    
    // Create or get the YOT token account for the admin
    console.log("Getting admin's YOT token account...");
    const adminYotAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair,
      YOT_TOKEN_MINT,
      adminKeypair.publicKey
    );
    console.log("Admin YOT Token Account:", adminYotAccount.address.toBase58());
    console.log("Admin YOT Balance:", adminYotAccount.amount.toString());
    
    // Create or get YOT token account for the PDA
    console.log("Creating YOT token account for the program PDA...");
    const pdaYotAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair,
      YOT_TOKEN_MINT,
      programAuthority,
      true // Allow the owner to be a PDA
    );
    console.log("✅ PDA YOT Token Account:", pdaYotAccount.address.toBase58());
    
    // Check PDA's current YOT balance
    const pdaYotBalance = await connection.getTokenAccountBalance(pdaYotAccount.address);
    console.log("PDA's current YOT balance:", pdaYotBalance.value.uiAmount);
    
    // If PDA already has tokens, ask for confirmation before sending more
    if (pdaYotBalance.value.uiAmount && pdaYotBalance.value.uiAmount > 0) {
      console.log("⚠️ The program PDA already has YOT tokens. If you want to add more, modify the amount below.");
    }
    
    // Define the amount of YOT to transfer (100,000 YOT tokens)
    const amountToTransfer = 100000 * Math.pow(10, 9); // Assuming 9 decimals for YOT
    
    // Create transaction to transfer YOT from admin to PDA
    const transaction = new Transaction();
    
    // Add a recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = adminKeypair.publicKey;
    
    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        adminYotAccount.address,
        pdaYotAccount.address,
        adminKeypair.publicKey,
        BigInt(amountToTransfer)
      )
    );
    
    console.log(`Sending ${amountToTransfer / Math.pow(10, 9)} YOT tokens from admin to program PDA...`);
    
    // Sign and send transaction
    const signature = await connection.sendTransaction(transaction, [adminKeypair]);
    console.log("Transaction signature:", signature);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature);
    
    // Verify the new balance
    const newPdaYotBalance = await connection.getTokenAccountBalance(pdaYotAccount.address);
    console.log("✅ New PDA YOT balance:", newPdaYotBalance.value.uiAmount);
    
    console.log("✅ Success! The program now has YOT tokens and can facilitate SOL→YOT swaps.");
    
  } catch (error) {
    console.error("Error funding program:", error);
  }
}

main().catch(console.error);