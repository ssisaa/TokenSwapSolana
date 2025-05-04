import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as fs from 'fs';
import { 
  buildCloseProgramInstruction,
  MULTIHUB_SWAP_PROGRAM_ID,
} from "../client/src/lib/multihub-contract-v3";

/**
 * This script demonstrates closing the MultihubSwap program using direct buffer serialization
 * CAUTION: This will close the program and reclaim rent - only for admin use!
 */
async function main() {
  console.log("Starting MultihubSwap V3 program close test...");
  console.log("WARNING: This will close the program and reclaim rent!");

  try {
    // Create a connection to Solana devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    console.log("Connected to Solana devnet");

    // Load the admin wallet from a keypair file
    let adminKeypair: Keypair;
    
    try {
      // Try to load from file - admin keypair is required
      const keypairData = JSON.parse(fs.readFileSync('./admin-keypair.json', 'utf-8'));
      adminKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
      console.log("Loaded admin keypair from file");
    } catch (err) {
      console.error("Failed to load admin keypair. Cannot continue.");
      console.error("This operation requires the admin keypair used to initialize the program.");
      return;
    }

    // Check admin account balance
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`Admin account balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    // Program addresses
    const programId = new PublicKey(MULTIHUB_SWAP_PROGRAM_ID);
    console.log("Program ID:", programId.toString());

    // Find PDAs
    const [programState] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")], 
      programId
    );
    console.log("Program State PDA:", programState.toString());

    const [programAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority")], 
      programId
    );
    console.log("Program Authority PDA:", programAuthority.toString());

    // Create transaction
    const transaction = new Transaction();
    
    // Set fee payer immediately
    transaction.feePayer = adminKeypair.publicKey;
    
    // Add a recent blockhash immediately
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    // Create the close program instruction data using direct serialization
    const closeInstructionData = buildCloseProgramInstruction();
    console.log("Close instruction data length:", closeInstructionData.length);
    console.log("Close instruction data bytes:", Array.from(new Uint8Array(closeInstructionData)));

    // System Program ID
    const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');

    // Create the close program instruction
    const closeIx = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true }, // Admin account that receives the rent
        { pubkey: programState, isSigner: false, isWritable: true }, // Program state account to be closed
        { pubkey: programAuthority, isSigner: false, isWritable: false }, // Program authority - may be needed
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false }, // System Program - needed for closing accounts
      ],
      data: closeInstructionData
    });

    // Add close instruction to transaction
    transaction.add(closeIx);

    // Simulate the transaction first
    console.log("Simulating close program transaction...");
    const simulation = await connection.simulateTransaction(transaction, [adminKeypair]);
    
    if (simulation.value.err) {
      console.error("Simulation failed:", simulation.value.err);
      console.log("Simulation logs:", simulation.value.logs);
      throw new Error("Transaction simulation failed");
    }
    
    console.log("Simulation successful");
    console.log("Simulation logs:", simulation.value.logs);

    // Confirm with the user before proceeding
    console.log("Are you sure you want to close the program? This will reclaim all rent!");
    console.log("To continue, remove this console.log and the return statement below.");
    return; // Remove this line to actually execute the close

    // Send and confirm transaction
    console.log("Sending close program transaction...");
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [adminKeypair]
    );
    
    console.log("✅ Close program transaction successful!");
    console.log("Transaction signature:", signature);
    console.log("Program closed successfully");
    
  } catch (error) {
    console.error("Error:", error);
  }
}

main();