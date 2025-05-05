/**
 * Front-end Swap Test for Multi-Hub Swap Contract
 * 
 * This test script uses the improved transaction handling from the web app
 * to test a SOL to YOT swap.
 * 
 * To run this test:
 * 1. Make sure you have a Phantom or Solflare wallet with SOL balance
 * 2. Connect to Solana devnet in your wallet
 * 3. Run: node test-frontend-swap.cjs
 */

// Import from app config
import fs from 'fs';
const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
const solanaConfig = appConfig.solana;

// Import required libraries
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, ComputeBudgetProgram, sendAndConfirmTransaction, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';

// Constants from the configuration
const MULTI_HUB_SWAP_PROGRAM_ID = solanaConfig.programId;
const YOT_TOKEN_ADDRESS = solanaConfig.tokens.yot;
const YOS_TOKEN_ADDRESS = solanaConfig.tokens.yos;

// Define token addresses
const SOL_TOKEN_ADDRESS = 'SOL';

// Connect to Solana network - using devnet for testing
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Load wallet from file (for testing only - normally use a wallet adapter from the frontend)
function loadWalletFromFile() {
  try {
    // If program-keypair.json exists, use it (useful for testing with deployed program's keypair)
    if (fs.existsSync('./program-keypair.json')) {
      const keypairData = JSON.parse(fs.readFileSync('./program-keypair.json', 'utf8'));
      return Keypair.fromSecretKey(Uint8Array.from(keypairData));
    } 
    // Otherwise create a new keypair (for testing only)
    else {
      console.log('No keypair file found. Creating new keypair for testing.');
      const newKeypair = Keypair.generate();
      fs.writeFileSync('./test-keypair.json', JSON.stringify(Array.from(newKeypair.secretKey)));
      return newKeypair;
    }
  } catch (error) {
    console.error('Error loading wallet:', error);
    return Keypair.generate(); // Create a new keypair as fallback
  }
}

/**
 * Find program state address
 */
function findProgramStateAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Find liquidity contribution account for a user's wallet
 * Uses the same seed as the Rust program: "liq" + user_pubkey
 */
function findLiquidityContributionAddress(userWallet) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("liq"), userWallet.toBuffer()],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Creates a transaction with proper initialization to avoid numRequiredSignatures error
 */
async function createAndSignTransaction(wallet, instruction, connection) {
  // STEP 1: Get a valid blockhash first
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  
  // STEP 2: Create a completely fresh Transaction object
  const transaction = new Transaction();
  
  // STEP 3: Set blockhash and fee payer FIRST (before adding instructions)
  // This is CRITICAL to avoid the numRequiredSignatures error
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = wallet.publicKey;
  
  // STEP 4: Add compute budget instructions for complex operations
  const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 1000000 // High value for complex transactions
  });
  
  const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 1_000_000 // Higher priority fee
  });
  
  // STEP 5: Add all instructions in the correct order
  transaction.add(computeUnits);
  transaction.add(priorityFee);
  transaction.add(instruction);
  
  console.log("Transaction created with:", {
    blockhash: transaction.recentBlockhash?.substring(0, 8) + "...",
    feePayer: transaction.feePayer?.toString().substring(0, 8) + "...",
    numInstructions: transaction.instructions.length
  });
  
  return transaction;
}

/**
 * BUY_AND_DISTRIBUTE implementation - based on the web app
 */
async function buyAndDistribute(wallet, amountIn) {
  try {
    console.log(`Starting buyAndDistribute with ${amountIn} SOL`);
    
    const userPublicKey = wallet.publicKey;
    const program = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);

    // Find user's token accounts
    const userYotAccount = await getAssociatedTokenAddress(yotMint, userPublicKey);
    const userYosAccount = await getAssociatedTokenAddress(yosMint, userPublicKey);

    // Check if user YOS account exists and create it if not
    const userYosAccountInfo = await connection.getAccountInfo(userYosAccount);
    if (!userYosAccountInfo) {
      console.log("Creating YOS token account for user...");
      const createTx = new Transaction();
      createTx.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,  // payer
          userYosAccount, // ata address
          userPublicKey,  // owner (user)
          yosMint         // mint
        )
      );
      
      // Set recent blockhash and fee payer
      createTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      createTx.feePayer = userPublicKey;
      
      // Sign and send transaction
      createTx.sign(wallet);
      const signature = await connection.sendRawTransaction(createTx.serialize());
      await connection.confirmTransaction(signature);
      console.log("YOS token account created:", signature);
    }
    
    // Find program controlled accounts
    const [liquidityContributionPda] = findLiquidityContributionAddress(userPublicKey);
    const [programStateAccount] = findProgramStateAddress();
    
    // Get Pool Authority token accounts
    const poolAuthority = new PublicKey(solanaConfig.pool.authority);
    const poolYotAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
    
    // Check if accounts exist
    const poolYotAccountInfo = await connection.getAccountInfo(poolYotAccount);
    if (!poolYotAccountInfo) {
      throw new Error("Pool YOT account doesn't exist! Ask admin to create it first.");
    }
    
    // Convert amount to raw token amount (lamports)
    const rawAmount = Math.floor(amountIn * 1_000_000_000);

    // Create instruction data buffer - 1 byte discriminator + 8 bytes amount
    const instructionData = Buffer.alloc(9);
    instructionData.writeUInt8(4, 0); // BUY_AND_DISTRIBUTE = 4
    instructionData.writeBigUInt64LE(BigInt(rawAmount), 1);
    
    console.log("Instruction data:", {
      discriminator: instructionData[0],
      rawAmount: rawAmount,
      fullDataHex: instructionData.toString('hex')
    });
    
    // Create the instruction with the exact account order expected by the Rust program
    const instruction = {
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: poolYotAccount, isSigner: false, isWritable: true },  // vault_yot
        { pubkey: userYotAccount, isSigner: false, isWritable: true },  // user_yot
        { pubkey: poolYotAccount, isSigner: false, isWritable: true },  // liquidity_yot (same as vault_yot)
        { pubkey: yosMint, isSigner: false, isWritable: true },         // yos_mint
        { pubkey: userYosAccount, isSigner: false, isWritable: true },  // user_yos
        { pubkey: liquidityContributionPda, isSigner: false, isWritable: true }, // liquidity_contribution
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // rent_sysvar
        { pubkey: programStateAccount, isSigner: false, isWritable: true } // program_state
      ],
      programId: program,
      data: instructionData
    };

    console.log("Creating transaction with fixed handling for numRequiredSignatures error");
    const transaction = await createAndSignTransaction(wallet, instruction, connection);
    
    // Sign the transaction
    transaction.sign(wallet);
    
    // Skip simulation and send with skipPreflight
    console.log("Sending transaction with skipPreflight=true...");
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });
    
    console.log("Transaction sent! Waiting for confirmation...");
    
    // Use proper confirmation strategy with blockhash reference
    const confirmationStrategy = {
      signature,
      blockhash: transaction.recentBlockhash,
      lastValidBlockHeight: transaction.lastValidBlockHeight
    };
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(confirmationStrategy, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('Transaction failed:', confirmation.value.err);
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }
    
    console.log("✅ Buy and distribute transaction confirmed:", signature);
    console.log('View transaction: https://explorer.solana.com/tx/' + signature + '?cluster=devnet');
    
    return signature;
  } catch (error) {
    console.error("Error in buyAndDistribute:", error);
    throw error;
  }
}

/**
 * Main test function
 */
async function testFrontendSwap() {
  try {
    // Load wallet
    const wallet = loadWalletFromFile();
    console.log('Testing with wallet:', wallet.publicKey.toString());
    
    // Get SOL balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`Wallet SOL balance: ${balance / 1_000_000_000} SOL`);
    
    if (balance < 0.1 * 1_000_000_000) {
      console.error('Not enough SOL for testing. Need at least 0.1 SOL');
      return;
    }
    
    // Test the buyAndDistribute function
    const swapAmount = 0.01; // Swap 0.01 SOL
    console.log(`\nSwapping ${swapAmount} SOL for YOT tokens...`);
    
    const signature = await buyAndDistribute(wallet, swapAmount);
    console.log('\nSwap completed successfully! 🎉');
    console.log('Transaction signature:', signature);
    console.log('View on explorer: https://explorer.solana.com/tx/' + signature + '?cluster=devnet');
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testFrontendSwap();