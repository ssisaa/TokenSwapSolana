/**
 * Improved Swap Test for Multi-Hub Swap Contract
 * 
 * This test script creates a transaction with proper initialization sequence
 * to avoid the "Cannot read properties of undefined (reading 'numRequiredSignatures')" error.
 * 
 * To run this test:
 * 1. Make sure you have a Phantom or Solflare wallet with SOL balance
 * 2. Connect to Solana devnet in your wallet
 * 3. Run: node test-improved-swap.js
 */

// Import required libraries
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = require('@solana/spl-token');
const { bs58 } = require('bs58');
const fs = require('fs');

// Constants - Update these with your actual values from app.config.json
const MULTI_HUB_SWAP_PROGRAM_ID = 'SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE';
const YOT_TOKEN_ADDRESS = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
const YOS_TOKEN_ADDRESS = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';
const POOL_AUTHORITY = '7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK';
const POOL_SOL_ACCOUNT = '7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS';

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
      console.error('Not enough SOL in wallet for test. Need at least 0.1 SOL.');
      return;
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
      console.log('Creating token accounts...');
      // Get recent blockhash and sign transaction
      createAccountTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      createAccountTx.feePayer = wallet.publicKey;
      
      // Sign and send transaction
      const signedTx = await wallet.signTransaction(createAccountTx);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature);
      console.log('Token accounts created:', signature);
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
    
    // Create transaction instruction
    const instruction = {
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: poolYotAccount, isSigner: false, isWritable: true },
        { pubkey: userYotAccount, isSigner: false, isWritable: true },
        { pubkey: poolYotAccount, isSigner: false, isWritable: true },
        { pubkey: yosMint, isSigner: false, isWritable: true },
        { pubkey: userYosAccount, isSigner: false, isWritable: true },
        { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // Rent Sysvar (legacy)
        { pubkey: programStateAccount, isSigner: false, isWritable: true }
      ],
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
      data: instructionData
    };
    
    // CRITICAL: Create transaction and setup in the proper order to avoid the numRequiredSignatures error
    console.log('\nCreating transaction...');
    
    // 1. Get a valid blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    
    // 2. Create a new Transaction
    const transaction = new Transaction();
    
    // 3. Set blockhash and fee payer FIRST (before adding instructions)
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = wallet.publicKey;
    
    // 4. Add instruction
    transaction.add(instruction);
    
    // 5. Sign transaction
    console.log('Signing transaction...');
    const signedTransaction = await wallet.sign(transaction);
    
    // 6. Send transaction with skipPreflight to avoid simulation errors
    console.log('Sending transaction with skipPreflight=true...');
    const txSignature = await connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight: true,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });
    
    console.log('Transaction sent, waiting for confirmation...');
    
    // 7. Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature: txSignature,
      blockhash,
      lastValidBlockHeight
    });
    
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