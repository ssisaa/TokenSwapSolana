// Simple script to create a YOT token account for the V4 program
// Requires app.config.json for program IDs and token addresses

const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount, createTransferInstruction } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// STEP 1: Load configuration
const appConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.config.json'), 'utf8'));

// Set up constants from config
const YOT_TOKEN_MINT = new PublicKey(appConfig.tokens.YOT);
const PROGRAM_ID = new PublicKey(appConfig.programs.multiHub.v4); // V4
const ADMIN_PUBLIC_KEY = new PublicKey("AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ");

// STEP 2: Find the program authority PDA (same for any script)
function findProgramAuthorityAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    PROGRAM_ID
  );
}

// STEP 3: Create a YOT token account for the program PDA and fund it
async function fixProgramYotAccount() {
  try {
    // Connect to Solana devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Get admin wallet (this would be manually provided in real script)
    // This is just a placeholder - you'll use your own wallet for this
    const adminKeypair = Keypair.generate(); 
    console.log("Admin public key:", adminKeypair.publicKey.toBase58());
    
    // Get program PDA
    const [programAuthority, _bump] = findProgramAuthorityAddress();
    console.log("Program Authority (PDA):", programAuthority.toBase58());
    
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
    
    console.log("✅ Success! Now the PDA has a YOT token account.");
    console.log("To fund it with YOT tokens, you need the admin wallet private key.");
    
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the main function
fixProgramYotAccount();

// IMPORTANT: In a real system, you'd need:
// 1. The admin's actual keypair to create the account
// 2. YOT tokens in the admin wallet to fund the program

console.log(`
=====================================================================
HOW TO FIX THE PROGRAM'S YOT ACCOUNT FOR SOL→YOT SWAPS
=====================================================================

1. You need the admin wallet private key in program-keypair.json
2. Run this command in your server:
   
   ts-node scripts/fund-program-yot.ts
   
3. This will create a YOT token account for the program and fund it
4. SOL→YOT swaps will now work for all users

The program needs this YOT account to send tokens to users during swaps.
=====================================================================
`);