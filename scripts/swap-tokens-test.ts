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
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { 
  buildSwapInstruction,
  MULTIHUB_SWAP_PROGRAM_ID,
  YOT_TOKEN_MINT,
  YOS_TOKEN_MINT,
  LP_CONTRIBUTION_RATE,
  ADMIN_FEE_RATE,
  YOS_CASHBACK_RATE,
  SWAP_FEE_RATE,
  REFERRAL_RATE
} from "../client/src/lib/multihub-contract-v3";

/**
 * This script tests token swapping using our direct buffer serialization approach
 * It demonstrates a YOT → other token swap operation
 */
async function main() {
  console.log("Starting MultihubSwap V3 token swap test...");

  try {
    // Create a connection to Solana devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    console.log("Connected to Solana devnet");

    // Load the user wallet from a keypair file or generate one for testing
    let userKeypair: Keypair;
    
    try {
      // Try to load from file (for reproducible tests)
      const keypairData = JSON.parse(fs.readFileSync('./user-keypair.json', 'utf-8'));
      userKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
      console.log("Loaded user keypair from file");
    } catch (err) {
      // If file doesn't exist, generate a new keypair
      console.log("No user keypair file found, generating new keypair");
      userKeypair = Keypair.generate();
      
      // Save keypair for future use
      fs.writeFileSync(
        './user-keypair.json', 
        JSON.stringify(Array.from(userKeypair.secretKey)), 
        'utf-8'
      );
      console.log("Generated and saved new user keypair");
    }

    // Check user account balance
    const balance = await connection.getBalance(userKeypair.publicKey);
    console.log(`User account balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    // Request airdrop if balance is too low
    if (balance < 0.05 * LAMPORTS_PER_SOL) {
      console.log("Requesting airdrop of 1 SOL...");
      const airdropSig = await connection.requestAirdrop(
        userKeypair.publicKey, 
        1 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(airdropSig);
      console.log("Airdrop successful");
      
      // Check new balance
      const newBalance = await connection.getBalance(userKeypair.publicKey);
      console.log(`New user account balance: ${newBalance / LAMPORTS_PER_SOL} SOL`);
    }

    // Define token mints for the swap
    const fromTokenMint = new PublicKey(YOT_TOKEN_MINT);  // Swap from YOT
    const toTokenMint = new PublicKey("9T7uw5dqaEmEC4McqyefzYsZauvtSP3z3iMrZsrMW8n");  // Swap to USDC (devnet)
    const yosMint = new PublicKey(YOS_TOKEN_MINT);  // For cashback

    console.log("From token (YOT):", fromTokenMint.toString());
    console.log("To token (USDC):", toTokenMint.toString());
    console.log("YOS token (cashback):", yosMint.toString());

    // Find program addresses
    const programId = new PublicKey(MULTIHUB_SWAP_PROGRAM_ID);
    console.log("Program ID:", programId.toString());

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
    transaction.feePayer = userKeypair.publicKey;
    
    // Add a recent blockhash immediately
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    // Ensure token accounts exist
    // Get the user's token accounts
    const fromTokenAccount = await getAssociatedTokenAddress(
      fromTokenMint,
      userKeypair.publicKey
    );
    console.log("User's YOT account:", fromTokenAccount.toString());
    
    // Check if account exists
    const fromTokenAccountInfo = await connection.getAccountInfo(fromTokenAccount);
    if (!fromTokenAccountInfo) {
      console.log("Creating YOT token account for user");
      const createFromTokenIx = createAssociatedTokenAccountInstruction(
        userKeypair.publicKey,
        fromTokenAccount,
        userKeypair.publicKey,
        fromTokenMint
      );
      transaction.add(createFromTokenIx);
    }

    // To token account (where user receives swapped tokens)
    const toTokenAccount = await getAssociatedTokenAddress(
      toTokenMint,
      userKeypair.publicKey
    );
    console.log("User's USDC account:", toTokenAccount.toString());
    
    // Check if account exists
    const toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);
    if (!toTokenAccountInfo) {
      console.log("Creating USDC token account for user");
      const createToTokenIx = createAssociatedTokenAccountInstruction(
        userKeypair.publicKey,
        toTokenAccount,
        userKeypair.publicKey,
        toTokenMint
      );
      transaction.add(createToTokenIx);
    }

    // YOS token account (for cashback rewards)
    const yosTokenAccount = await getAssociatedTokenAddress(
      yosMint,
      userKeypair.publicKey
    );
    console.log("User's YOS account:", yosTokenAccount.toString());
    
    // Check if account exists
    const yosTokenAccountInfo = await connection.getAccountInfo(yosTokenAccount);
    if (!yosTokenAccountInfo) {
      console.log("Creating YOS token account for user");
      const createYosTokenIx = createAssociatedTokenAccountInstruction(
        userKeypair.publicKey,
        yosTokenAccount,
        userKeypair.publicKey,
        yosMint
      );
      transaction.add(createYosTokenIx);
    }

    // Program token accounts (held by the program authority)
    const fromTokenProgramAccount = await getAssociatedTokenAddress(
      fromTokenMint,
      programAuthority,
      true // allowOwnerOffCurve: true for PDAs
    );
    console.log("Program's YOT account:", fromTokenProgramAccount.toString());
    
    const toTokenProgramAccount = await getAssociatedTokenAddress(
      toTokenMint,
      programAuthority,
      true // allowOwnerOffCurve: true for PDAs
    );
    console.log("Program's USDC account:", toTokenProgramAccount.toString());
    
    const yosTokenProgramAccount = await getAssociatedTokenAddress(
      yosMint,
      programAuthority,
      true // allowOwnerOffCurve: true for PDAs
    );
    console.log("Program's YOS account:", yosTokenProgramAccount.toString());

    // Create program token accounts if they don't exist
    // NOTE: For a real application, these should be pre-created by the admin
    // or handled inside the program, but for testing we'll check here
    
    // From token program account
    const fromTokenProgramAccountInfo = await connection.getAccountInfo(fromTokenProgramAccount);
    if (!fromTokenProgramAccountInfo) {
      console.log("Creating YOT token account for program authority");
      const createFromTokenProgramIx = createAssociatedTokenAccountInstruction(
        userKeypair.publicKey,
        fromTokenProgramAccount,
        programAuthority,
        fromTokenMint
      );
      transaction.add(createFromTokenProgramIx);
    }
    
    // To token program account
    const toTokenProgramAccountInfo = await connection.getAccountInfo(toTokenProgramAccount);
    if (!toTokenProgramAccountInfo) {
      console.log("Creating USDC token account for program authority");
      const createToTokenProgramIx = createAssociatedTokenAccountInstruction(
        userKeypair.publicKey,
        toTokenProgramAccount,
        programAuthority,
        toTokenMint
      );
      transaction.add(createToTokenProgramIx);
    }
    
    // YOS token program account
    const yosTokenProgramAccountInfo = await connection.getAccountInfo(yosTokenProgramAccount);
    if (!yosTokenProgramAccountInfo) {
      console.log("Creating YOS token account for program authority");
      const createYosTokenProgramIx = createAssociatedTokenAccountInstruction(
        userKeypair.publicKey,
        yosTokenProgramAccount,
        programAuthority,
        yosMint
      );
      transaction.add(createYosTokenProgramIx);
    }

    // Define the swap parameters
    const amountIn = 100;  // Swap 100 YOT
    const minAmountOut = 50;  // Accept at least 50 USDC
    const DECIMALS = 9;  // Most tokens use 9 decimals on Solana

    // Convert to lamports (raw token units)
    const amountInLamports = Math.floor(amountIn * (10 ** DECIMALS));
    const minAmountOutLamports = Math.floor(minAmountOut * (10 ** DECIMALS));
    
    console.log(`Swapping ${amountIn} YOT for at least ${minAmountOut} USDC`);
    console.log(`Raw values: ${amountInLamports} lamports in, ${minAmountOutLamports} min lamports out`);

    // Create the swap instruction data using our buffer serialization
    const swapInstructionData = buildSwapInstruction({
      amountIn: BigInt(amountInLamports),
      minAmountOut: BigInt(minAmountOutLamports)
    });

    // Token Program ID
    const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
    const SYSVAR_RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');

    // Create the swap instruction
    const swapIx = new TransactionInstruction({
      programId,
      keys: [
        // User accounts
        { pubkey: userKeypair.publicKey, isSigner: true, isWritable: true }, 
        { pubkey: programState, isSigner: false, isWritable: true },
        { pubkey: programAuthority, isSigner: false, isWritable: false },
        
        // User token accounts
        { pubkey: fromTokenAccount, isSigner: false, isWritable: true },
        { pubkey: toTokenAccount, isSigner: false, isWritable: true },
        { pubkey: yosTokenAccount, isSigner: false, isWritable: true },
        
        // Program token accounts
        { pubkey: fromTokenProgramAccount, isSigner: false, isWritable: true },
        { pubkey: toTokenProgramAccount, isSigner: false, isWritable: true },
        { pubkey: yosTokenProgramAccount, isSigner: false, isWritable: true },
        
        // Token mints
        { pubkey: fromTokenMint, isSigner: false, isWritable: false },
        { pubkey: toTokenMint, isSigner: false, isWritable: false },
        { pubkey: yosMint, isSigner: false, isWritable: false },
        
        // System programs
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: swapInstructionData
    });

    // Add swap instruction to transaction
    transaction.add(swapIx);

    // Simulate the transaction first
    console.log("Simulating swap transaction...");
    const simulation = await connection.simulateTransaction(transaction, [userKeypair]);
    
    if (simulation.value.err) {
      console.error("Simulation failed:", simulation.value.err);
      console.log("Simulation logs:", simulation.value.logs);
      console.log("Swap parameters used:");
      console.log("- LP contribution rate:", LP_CONTRIBUTION_RATE);
      console.log("- Admin fee rate:", ADMIN_FEE_RATE);
      console.log("- YOS cashback rate:", YOS_CASHBACK_RATE);
      console.log("- Swap fee rate:", SWAP_FEE_RATE);
      console.log("- Referral rate:", REFERRAL_RATE);
      throw new Error("Transaction simulation failed");
    }
    
    console.log("Simulation successful");
    console.log("Simulation logs:", simulation.value.logs);

    // Send and confirm transaction
    console.log("Sending swap transaction...");
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [userKeypair]
    );
    
    console.log("✅ Swap transaction successful!");
    console.log("Transaction signature:", signature);
    
    // Check token balances after swap
    // NOTE: In a real application, you would fetch token balances from the blockchain
    console.log("Swap completed successfully");
    
  } catch (error) {
    console.error("Error:", error);
  }
}

main();