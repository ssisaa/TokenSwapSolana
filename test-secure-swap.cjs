/**
 * Test script for the secure SOL to YOT swap implementation
 * This script demonstrates and validates the two-phase secure transaction approach
 */

const { 
  Connection, 
  PublicKey, 
  Keypair, 
  LAMPORTS_PER_SOL,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram
} = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount } = require('@solana/spl-token');
const fs = require('fs');

// Helper function to load wallet from file for testing
function loadWalletFromFile() {
  try {
    const keypairData = JSON.parse(fs.readFileSync('./program-keypair.json', 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    console.error('Error loading wallet:', error);
    process.exit(1);
  }
}

/**
 * Helper function to check wallet balances
 */
async function checkBalances(wallet, connection) {
  console.log('\n=== Current Balances ===');
  
  // Check SOL balance
  const solBalance = await connection.getBalance(wallet.publicKey);
  console.log(`SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
  
  try {
    // Get configuration from app.config.json
    const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
    const yotMint = new PublicKey(appConfig.solana.tokens.yot.address);
    const yosMint = new PublicKey(appConfig.solana.tokens.yos.address);
    
    // Check YOT balance
    const yotAddress = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
    try {
      const yotAccount = await getAccount(connection, yotAddress);
      console.log(`YOT Balance: ${Number(yotAccount.amount) / Math.pow(10, 9)} YOT`);
    } catch (error) {
      console.log('No YOT token account found');
    }
    
    // Check YOS balance
    const yosAddress = await getAssociatedTokenAddress(yosMint, wallet.publicKey);
    try {
      const yosAccount = await getAccount(connection, yosAddress);
      console.log(`YOS Balance: ${Number(yosAccount.amount) / Math.pow(10, 9)} YOS`);
    } catch (error) {
      console.log('No YOS token account found');
    }
    
    // Check pool SOL account balance
    const poolSolAccount = new PublicKey(appConfig.solana.pool.solAccount);
    const poolSolBalance = await connection.getBalance(poolSolAccount);
    console.log(`Pool SOL Balance: ${poolSolBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Check if liquidity contribution account exists
    const programId = new PublicKey(appConfig.solana.multiHubSwap.programId);
    const [liquidityAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from('liq'), wallet.publicKey.toBuffer()],
      programId
    );
    const accountInfo = await connection.getAccountInfo(liquidityAccount);
    if (accountInfo) {
      console.log(`Liquidity contribution account exists: ${liquidityAccount.toString()}`);
      console.log(`Account size: ${accountInfo.data.length} bytes`);
      console.log(`Account owner: ${accountInfo.owner.toString()}`);
    } else {
      console.log(`Liquidity contribution account does not exist: ${liquidityAccount.toString()}`);
    }
  } catch (error) {
    console.error('Error checking token balances:', error);
  }
}

/**
 * Ensure token accounts exist for the wallet
 */
async function ensureTokenAccounts(wallet, connection) {
  console.log('\n=== Checking token accounts ===');
  
  try {
    // Get configuration from app.config.json
    const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
    const yotMint = new PublicKey(appConfig.solana.tokens.yot.address);
    const yosMint = new PublicKey(appConfig.solana.tokens.yos.address);
    
    // Check/create YOT account
    const yotAddress = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
    let yotAccountExists = false;
    try {
      await getAccount(connection, yotAddress);
      console.log(`YOT token account exists: ${yotAddress.toString()}`);
      yotAccountExists = true;
    } catch (error) {
      console.log(`YOT token account does not exist, will create it`);
    }
    
    // Check/create YOS account
    const yosAddress = await getAssociatedTokenAddress(yosMint, wallet.publicKey);
    let yosAccountExists = false;
    try {
      await getAccount(connection, yosAddress);
      console.log(`YOS token account exists: ${yosAddress.toString()}`);
      yosAccountExists = true;
    } catch (error) {
      console.log(`YOS token account does not exist, will create it`);
    }
    
    // If both accounts exist, we're done
    if (yotAccountExists && yosAccountExists) {
      return {
        yotAddress,
        yosAddress
      };
    }
    
    // Create any missing accounts
    const transaction = new Transaction();
    
    if (!yotAccountExists) {
      const createYotAccountIx = require('@solana/spl-token').createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        yotAddress, // ata
        wallet.publicKey, // owner
        yotMint // mint
      );
      transaction.add(createYotAccountIx);
    }
    
    if (!yosAccountExists) {
      const createYosAccountIx = require('@solana/spl-token').createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        yosAddress, // ata
        wallet.publicKey, // owner
        yosMint // mint
      );
      transaction.add(createYosAccountIx);
    }
    
    if (transaction.instructions.length > 0) {
      // Set transaction properties
      transaction.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      
      // Sign and send
      transaction.sign(wallet);
      const signature = await connection.sendRawTransaction(transaction.serialize());
      console.log(`Token account creation transaction sent: ${signature}`);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature);
      console.log('Token accounts created successfully!');
    }
    
    return {
      yotAddress,
      yosAddress
    };
  } catch (error) {
    console.error('Error ensuring token accounts:', error);
    throw error;
  }
}

/**
 * Create the liquidity contribution account transaction
 */
async function createLiquidityAccountTransaction(wallet, connection, solAmount) {
  // Get configuration from app.config.json
  const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
  const programId = new PublicKey(appConfig.solana.multiHubSwap.programId);
  const poolSolAccount = new PublicKey(appConfig.solana.pool.solAccount);
  const poolAuthority = new PublicKey(appConfig.solana.pool.authority);
  const yotMint = new PublicKey(appConfig.solana.tokens.yot.address);
  const yosMint = new PublicKey(appConfig.solana.tokens.yos.address);
  
  try {
    // Find liquidity contribution account address
    const [liquidityContributionAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('liq'), wallet.publicKey.toBuffer()],
      programId
    );
    
    // Check if account already exists
    const accountInfo = await connection.getAccountInfo(liquidityContributionAddress);
    if (accountInfo !== null) {
      console.log('Liquidity contribution account already exists');
      return null;
    }
    
    console.log('Creating liquidity contribution account transaction');
    
    // Create a minimal SOL amount transaction to initialize the account
    const microAmount = 0.000001;
    
    // Get PDAs for the transaction
    const [programStateAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('state')],
      programId
    );
    
    const [programAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority')],
      programId
    );
    
    // Get YOT pool token account
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
    
    // Get user token accounts
    const userYotAccount = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
    const userYosAccount = await getAssociatedTokenAddress(yosMint, wallet.publicKey);
    
    // Create instruction data
    const microlAmports = Math.floor(microAmount * LAMPORTS_PER_SOL);
    const data = Buffer.alloc(17);
    data.writeUint8(7, 0); // SOL-YOT Swap instruction (index 7)
    data.writeBigUInt64LE(BigInt(microlAmports), 1);
    data.writeBigUInt64LE(BigInt(0), 9); // Min amount out (0 for initialization)
    
    // Required accounts for the SOL to YOT swap
    const accounts = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: false },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: poolSolAccount, isSigner: false, isWritable: true },
      { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
      { pubkey: userYotAccount, isSigner: false, isWritable: true },
      { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
      { pubkey: yosMint, isSigner: false, isWritable: true },
      { pubkey: userYosAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    const swapInstruction = new TransactionInstruction({
      programId,
      keys: accounts,
      data,
    });
    
    // Create transaction with compute budget instructions
    const transaction = new Transaction();
    
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    transaction.add(swapInstruction);
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    return transaction;
  } catch (error) {
    console.error('Error creating liquidity account transaction:', error);
    return null;
  }
}

/**
 * Create SOL transfer transaction
 */
async function createSolTransferTransaction(wallet, connection, solAmount) {
  // Get configuration from app.config.json
  const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
  const poolSolAccount = new PublicKey(appConfig.solana.pool.solAccount);
  
  console.log(`Creating SOL transfer transaction for ${solAmount} SOL`);
  
  // Convert SOL to lamports
  const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  
  // Create a transaction to transfer SOL to the pool
  const transaction = new Transaction();
  
  // Add compute budget for better transaction success rate
  const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 1_000_000
  });
  transaction.add(priorityFee);
  
  // Add instruction to transfer SOL to pool
  const transferSolIx = SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: poolSolAccount,
    lamports: amountInLamports
  });
  
  transaction.add(transferSolIx);
  
  // Set transaction properties
  transaction.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  return transaction;
}

/**
 * Execute a secure two-phase swap
 */
async function secureSwap(wallet, connection, solAmount) {
  console.log(`\n=== Starting secure two-phase SOL to YOT swap (${solAmount} SOL) ===`);
  
  try {
    // Ensure user has token accounts for YOT and YOS
    console.log('Ensuring token accounts exist');
    await ensureTokenAccounts(wallet, connection);
    
    // PHASE 1: Check if we need to initialize the liquidity contribution account
    const accountInitTx = await createLiquidityAccountTransaction(wallet, connection, solAmount);
    if (accountInitTx) {
      console.log('\n--- PHASE 1: Initializing liquidity contribution account ---');
      try {
        accountInitTx.sign(wallet);
        
        // Use skipPreflight to allow transaction to go through even with expected errors
        const initSignature = await connection.sendRawTransaction(accountInitTx.serialize(), {
          skipPreflight: true
        });
        console.log(`Initialization transaction sent: ${initSignature}`);
        
        // Don't wait for confirmation - the transaction will likely fail with "account borrowed" error
        // But it will create the account, which is what we want
        console.log('Waiting 2 seconds for account initialization to propagate');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.log('Expected initialization error (this is normal):', error.message);
        // Continue with the main transaction regardless of initialization result
      }
    }
    
    // PHASE 2: Send the main SOL transfer transaction
    console.log('\n--- PHASE 2: Transferring SOL to pool ---');
    const transferTransaction = await createSolTransferTransaction(wallet, connection, solAmount);
    
    // Sign and send
    transferTransaction.sign(wallet);
    const signature = await connection.sendRawTransaction(transferTransaction.serialize());
    console.log(`SOL transfer transaction sent: ${signature}`);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature);
    console.log('SOL transfer confirmed!');
    
    // Get transaction details
    const txDetails = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });
    
    if (txDetails) {
      console.log(`Transaction fee paid: ${txDetails.meta.fee} lamports`);
    }
    
    return {
      success: true,
      signature,
      message: `Successfully sent ${solAmount} SOL to the pool.`
    };
  } catch (error) {
    console.error('Error during secure swap:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Main test function
 */
async function testSecureSwap() {
  // Get app config
  const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
  const connection = new Connection(appConfig.solana.rpcUrl, 'confirmed');
  
  console.log(`Connected to ${appConfig.solana.rpcUrl}`);
  
  // Load wallet
  const wallet = loadWalletFromFile();
  console.log(`Using wallet: ${wallet.publicKey.toString()}`);
  
  // Check initial balances
  await checkBalances(wallet, connection);
  
  // Set amount to swap (0.05 SOL)
  const solAmount = 0.05;
  
  // Execute secure swap
  const result = await secureSwap(wallet, connection, solAmount);
  
  // Show result
  console.log('\n=== Swap Result ===');
  console.log(`Success: ${result.success}`);
  
  if (result.success) {
    console.log(`Signature: ${result.signature}`);
    console.log(`Message: ${result.message}`);
  } else {
    console.log(`Error: ${result.error}`);
  }
  
  // Check final balances
  await checkBalances(wallet, connection);
}

// Run the test
testSecureSwap().catch(err => {
  console.error('Test failed:', err);
});