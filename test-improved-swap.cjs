/**
 * Improved Swap Test for Multi-Hub Swap Contract
 * 
 * This test script creates a transaction with proper initialization sequence
 * to avoid the "Cannot read properties of undefined (reading 'numRequiredSignatures')" error.
 * 
 * To run this test:
 * 1. Make sure you have a Phantom or Solflare wallet with SOL balance
 * 2. Connect to Solana devnet in your wallet
 * 3. Run: node test-improved-swap.cjs
 */

// Import required libraries
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, ComputeBudgetProgram, sendAndConfirmTransaction, SYSVAR_RENT_PUBKEY } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = require('@solana/spl-token');
const fs = require('fs');

// Load app config
const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
const solanaConfig = appConfig.solana;

// Constants - Use values from app config
const MULTI_HUB_SWAP_PROGRAM_ID = solanaConfig.programId;
const YOT_TOKEN_ADDRESS = solanaConfig.tokens.yot;
const YOS_TOKEN_ADDRESS = solanaConfig.tokens.yos;
const POOL_AUTHORITY = solanaConfig.pool.authority;
const POOL_SOL_ACCOUNT = solanaConfig.pool.solAccount;

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
 * Find program state account - uses the same seed derivation as the Rust program
 */
function findProgramStateAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Find liquidity contribution account for a user's wallet
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
 * Encode a 64-bit unsigned integer in little-endian format
 */
function encodeU64(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value), 0);
  return buffer;
}

/**
 * Main test function for buyAndDistribute
 */
async function testSwap() {
  try {
    // Load wallet
    const wallet = loadWalletFromFile();
    console.log('Using wallet:', wallet.publicKey.toString());
    
    // Get wallet SOL balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`Wallet SOL balance: ${balance / 1_000_000_000} SOL`);
    
    // Check if wallet has enough SOL to perform the swap
    if (balance < 0.1 * 1_000_000_000) {
      console.log('Not enough SOL in wallet for test. Requesting SOL from devnet faucet...');
      
      // Create a transaction to airdrop SOL from devnet faucet
      try {
        // Request 1 SOL from devnet faucet (maximum allowed per request)
        const airdropSignature = await connection.requestAirdrop(
          wallet.publicKey,
          1 * 1_000_000_000
        );
        
        // Wait for airdrop to be confirmed
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
          signature: airdropSignature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
        
        // Check new balance
        const newBalance = await connection.getBalance(wallet.publicKey);
        console.log(`SOL airdrop successful! New balance: ${newBalance / 1_000_000_000} SOL`);
        
        // If still not enough SOL, exit
        if (newBalance < 0.1 * 1_000_000_000) {
          console.error('Still not enough SOL after airdrop. Please fund the wallet manually.');
          return;
        }
      } catch (error) {
        console.error('Failed to airdrop SOL:', error);
        console.error('Please fund the wallet manually with at least 0.1 SOL to run the test.');
        return;
      }
    }
    
    // Get YOT token account
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const userYotAccount = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
    const userYosAccount = await getAssociatedTokenAddress(yosMint, wallet.publicKey);
    
    // Check if user token accounts exist
    const yotAccountInfo = await connection.getAccountInfo(userYotAccount);
    const yosAccountInfo = await connection.getAccountInfo(userYosAccount);
    
    // Create token accounts if needed
    if (!yotAccountInfo || !yosAccountInfo) {
      console.log('Creating token accounts...');
      
      let createAccountTx = new Transaction();
      let createAccountTxNeeded = false;
      
      if (!yotAccountInfo) {
        console.log('Creating YOT token account...');
        createAccountTx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            userYotAccount,
            wallet.publicKey,
            yotMint
          )
        );
        createAccountTxNeeded = true;
      }
      
      if (!yosAccountInfo) {
        console.log('Creating YOS token account...');
        createAccountTx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            userYosAccount,
            wallet.publicKey,
            yosMint
          )
        );
        createAccountTxNeeded = true;
      }
      
      if (createAccountTxNeeded) {
        // Get recent blockhash and sign transaction
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        createAccountTx.recentBlockhash = blockhash;
        createAccountTx.lastValidBlockHeight = lastValidBlockHeight;
        createAccountTx.feePayer = wallet.publicKey;
        
        // Sign and send transaction
        createAccountTx.sign(wallet);
        const signature = await connection.sendRawTransaction(createAccountTx.serialize());
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
        console.log('Token accounts created:', signature);
      }
    }
    
    // Get pool token accounts
    const poolAuthority = new PublicKey(POOL_AUTHORITY);
    const poolYotAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
    
    // Get PDAs
    const [programStateAccount] = findProgramStateAddress();
    const [liquidityContributionAccount] = findLiquidityContributionAddress(wallet.publicKey);
    
    // Log all accounts for verification
    console.log('\nAccounts for swap:');
    console.log('- User wallet:', wallet.publicKey.toString());
    console.log('- User YOT account:', userYotAccount.toString());
    console.log('- User YOS account:', userYosAccount.toString());
    console.log('- Pool YOT account:', poolYotAccount.toString());
    console.log('- Liquidity contribution account:', liquidityContributionAccount.toString());
    console.log('- Program state account:', programStateAccount.toString());
    
    // Create swap instruction data - Use buy_and_distribute (buyAndDistributeInstruction)
    const amount = 0.01; // SOL amount to swap
    const rawAmount = Math.floor(amount * 1_000_000_000); // Convert to lamports
    
    // Create instruction data with discriminator byte of 4 for BUY_AND_DISTRIBUTE
    const instructionData = Buffer.concat([
      Buffer.from([4]), // BUY_AND_DISTRIBUTE discriminator
      encodeU64(rawAmount) // Amount as 8-byte little-endian u64
    ]);
    
    console.log('\nInstruction data:');
    console.log('- Discriminator: 4 (BUY_AND_DISTRIBUTE)');
    console.log('- Amount: 0.01 SOL');
    console.log('- Raw amount: ', rawAmount);
    console.log('- Full buffer hex:', instructionData.toString('hex'));
    
    // Create the instruction with the exact account order expected by the Rust program
    const instruction = {
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: poolYotAccount, isSigner: false, isWritable: true },  // vault_yot
        { pubkey: userYotAccount, isSigner: false, isWritable: true },  // user_yot
        { pubkey: poolYotAccount, isSigner: false, isWritable: true },  // liquidity_yot (same as vault_yot)
        { pubkey: yosMint, isSigner: false, isWritable: true },         // yos_mint
        { pubkey: userYosAccount, isSigner: false, isWritable: true },  // user_yos
        { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true }, // liquidity_contribution
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // rent_sysvar
        { pubkey: programStateAccount, isSigner: false, isWritable: true } // program_state
      ],
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
      data: instructionData
    };
    
    // CRITICAL: Create transaction and setup in the proper order to avoid the numRequiredSignatures error
    console.log('\nCreating transaction with improved handling...');
    const transaction = await createAndSignTransaction(wallet, instruction, connection);
    
    // Sign transaction
    console.log('Signing transaction...');
    transaction.sign(wallet);
    
    // Send transaction with skipPreflight to avoid simulation errors
    console.log('Sending transaction with skipPreflight=true...');
    const txSignature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });
    
    console.log('Transaction sent, waiting for confirmation...');
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature: txSignature,
      blockhash: transaction.recentBlockhash,
      lastValidBlockHeight: transaction.lastValidBlockHeight
    }, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('Transaction failed:', confirmation.value.err);
    } else {
      console.log('Transaction confirmed! 🎉');
      console.log('Signature:', txSignature);
      console.log('View transaction: https://explorer.solana.com/tx/' + txSignature + '?cluster=devnet');
    }
  } catch (error) {
    console.error('Error in test swap:', error);
  }
}

// Run the test
testSwap();