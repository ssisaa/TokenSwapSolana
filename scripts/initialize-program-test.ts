import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as fs from 'fs';
import { 
  buildInitializeInstruction,
  buildSwapInstruction,
  buildCloseProgramInstruction,
  MULTIHUB_SWAP_PROGRAM_ID,
  YOT_TOKEN_MINT,
  YOS_TOKEN_MINT
} from "../client/src/lib/multihub-contract-v3";

/**
 * This script tests the initialization of the multihub swap program
 * using our direct buffer serialization approach
 */
async function main() {
  console.log("Starting MultihubSwap V3 program initialization test...");

  try {
    // Create a connection to Solana devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    console.log("Connected to Solana devnet");

    // Load the admin wallet from a keypair file or generate one for testing
    let adminKeypair: Keypair;
    
    try {
      // Try to load from file (for reproducible tests)
      const keypairData = JSON.parse(fs.readFileSync('./admin-keypair.json', 'utf-8'));
      adminKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
      console.log("Loaded admin keypair from file");
    } catch (err) {
      // If file doesn't exist, generate a new keypair
      console.log("No admin keypair file found, generating new keypair");
      adminKeypair = Keypair.generate();
      
      // Save keypair for future use
      fs.writeFileSync(
        './admin-keypair.json', 
        JSON.stringify(Array.from(adminKeypair.secretKey)), 
        'utf-8'
      );
      console.log("Generated and saved new admin keypair");
    }

    // Check admin account balance
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`Admin account balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    // Request airdrop if balance is too low
    if (balance < 1 * LAMPORTS_PER_SOL) {
      console.log("Requesting airdrop of 2 SOL...");
      const airdropSig = await connection.requestAirdrop(
        adminKeypair.publicKey, 
        2 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(airdropSig);
      console.log("Airdrop successful");
      
      // Check new balance
      const newBalance = await connection.getBalance(adminKeypair.publicKey);
      console.log(`New admin account balance: ${newBalance / LAMPORTS_PER_SOL} SOL`);
    }

    // Find program addresses
    const programId = new PublicKey(MULTIHUB_SWAP_PROGRAM_ID);
    const [programState] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")], 
      programId
    );
    const [programAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority")], 
      programId
    );

    console.log("Program ID:", programId.toString());
    console.log("Program State PDA:", programState.toString());
    console.log("Program Authority PDA:", programAuthority.toString());
    console.log("YOT Mint:", YOT_TOKEN_MINT);
    console.log("YOS Mint:", YOS_TOKEN_MINT);

    // Create initialize instruction with our buffer serialization
    console.log("Creating initialize instruction...");
    const instructionData = buildInitializeInstruction({
      admin: adminKeypair.publicKey,
      yotMint: new PublicKey(YOT_TOKEN_MINT),
      yosMint: new PublicKey(YOS_TOKEN_MINT),
      rates: {
        lp: BigInt(2000),       // 20% LP contribution
        fee: BigInt(10),        // 0.1% admin fee
        cashback: BigInt(300),  // 3% YOS cashback
        swap: BigInt(30),       // 0.3% swap fee
        referral: BigInt(50)    // 0.5% referral fee
      }
    });

    // Create the transaction instruction
    const initIx = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: programState, isSigner: false, isWritable: true },
        { pubkey: programAuthority, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
      ],
      data: instructionData
    });

    // Add to transaction
    const tx = new Transaction().add(initIx);
    
    // Simulate before sending
    console.log("Simulating transaction...");
    const simulation = await connection.simulateTransaction(tx, [adminKeypair]);
    
    if (simulation.value.err) {
      console.error("Simulation failed:", simulation.value.err);
      console.log("Simulation logs:", simulation.value.logs);
      throw new Error("Transaction simulation failed");
    }
    
    console.log("Simulation successful");
    console.log("Simulation logs:", simulation.value.logs);

    // Send and confirm transaction
    console.log("Sending transaction...");
    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [adminKeypair]
    );
    
    console.log("✅ Transaction successful!");
    console.log("Transaction signature:", signature);
    console.log("Program initialized successfully");
    
  } catch (error) {
    console.error("Error:", error);
  }
}

main();