/**
 * Test script for the manual SOL to YOT swap implementation
 * This demonstrates our workaround solution for the "account already borrowed" error
 */

const { 
  Connection, 
  PublicKey, 
  Keypair, 
  LAMPORTS_PER_SOL, 
  SystemProgram,
  Transaction,
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
    
    // Check pool YOT balance
    const poolAuthority = new PublicKey(appConfig.solana.pool.authority);
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
    try {
      const yotPoolAccountInfo = await getAccount(connection, yotPoolAccount);
      console.log(`Pool YOT Balance: ${Number(yotPoolAccountInfo.amount) / Math.pow(10, 9)} YOT`);
    } catch (error) {
      console.log('Error getting pool YOT balance:', error);
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
 * Calculate YOT output amount based on SOL input
 */
async function calculateYotOutput(connection, solAmount) {
  // Get configuration from app.config.json
  const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
  const poolSolAccount = new PublicKey(appConfig.solana.pool.solAccount);
  const poolAuthority = new PublicKey(appConfig.solana.pool.authority);
  const yotMint = new PublicKey(appConfig.solana.tokens.yot.address);
  
  // Get the current SOL and YOT balances in the pool
  const solPoolBalance = await connection.getBalance(poolSolAccount);
  const solPoolBalanceNormalized = solPoolBalance / LAMPORTS_PER_SOL;
  
  const yotPoolAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
  const yotAccountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
  const yotPoolBalance = Number(yotAccountInfo.value.uiAmount || 0);
  
  console.log(`Pool balances: SOL=${solPoolBalanceNormalized}, YOT=${yotPoolBalance}`);
  
  // Calculate the SOL:YOT exchange rate
  const exchangeRate = yotPoolBalance / solPoolBalanceNormalized;
  console.log(`Current exchange rate: 1 SOL = ${exchangeRate} YOT`);
  
  // Calculate the total YOT output based on the exchange rate
  const totalOutput = solAmount * exchangeRate;
  
  // Calculate the distribution based on configured rates
  const lpContributionRate = appConfig.solana.multiHubSwap.rates.lpContributionRate / 10000;
  const yosCashbackRate = appConfig.solana.multiHubSwap.rates.yosCashbackRate / 10000;
  const userRate = 1 - lpContributionRate - yosCashbackRate;
  
  const userOutput = totalOutput * userRate;
  const liquidityOutput = totalOutput * lpContributionRate;
  const yosCashback = totalOutput * yosCashbackRate;
  
  console.log(`Distribution: User=${userOutput}, Liquidity=${liquidityOutput}, YOS=${yosCashback}`);
  
  return {
    totalOutput,
    userOutput,
    liquidityOutput,
    yosCashback,
    exchangeRate
  };
}

/**
 * Create and send SOL transfer transaction
 */
async function transferSolToPool(wallet, connection, solAmount) {
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
  
  // Sign and send transaction
  transaction.sign(wallet);
  const signature = await connection.sendRawTransaction(transaction.serialize());
  
  console.log(`SOL transfer transaction sent: ${signature}`);
  
  // Wait for confirmation
  await connection.confirmTransaction(signature);
  console.log('SOL transfer confirmed!');
  
  return signature;
}

/**
 * Manual SOL to YOT swap implementation
 */
async function manualSolToYotSwap(wallet, connection, solAmount) {
  console.log(`\n=== Starting manual SOL to YOT swap for ${solAmount} SOL ===`);
  
  try {
    // Ensure user has token accounts for YOT and YOS
    console.log('Ensuring token accounts exist');
    await ensureTokenAccounts(wallet, connection);
    
    // Calculate the expected YOT output based on current state
    const { userOutput, liquidityOutput, yosCashback, exchangeRate } = await calculateYotOutput(connection, solAmount);
    
    // Transfer SOL to the pool
    console.log(`\n--- Transferring ${solAmount} SOL to pool ---`);
    const signature = await transferSolToPool(wallet, connection, solAmount);
    
    // Return success with calculation details
    return {
      success: true,
      signature,
      totalOutput: userOutput + liquidityOutput + yosCashback,
      exchangeRate,
      distributionDetails: {
        userReceived: userOutput,
        liquidityContribution: liquidityOutput,
        yosCashback: yosCashback
      }
    };
  } catch (error) {
    console.error('Error during swap:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Main test function
 */
async function testManualSwap() {
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
  
  // Execute manual SOL to YOT swap
  const result = await manualSolToYotSwap(wallet, connection, solAmount);
  
  // Show result
  console.log('\n=== Swap Result ===');
  console.log(`Success: ${result.success}`);
  
  if (result.success) {
    console.log(`Signature: ${result.signature}`);
    console.log(`Exchange Rate: 1 SOL = ${result.exchangeRate} YOT`);
    console.log(`Total Output: ${result.totalOutput} YOT`);
    console.log(`User Portion: ${result.distributionDetails.userReceived} YOT`);
    console.log(`Liquidity Portion: ${result.distributionDetails.liquidityContribution} YOT`);
    console.log(`YOS Cashback: ${result.distributionDetails.yosCashback} YOT`);
  } else {
    console.log(`Error: ${result.error}`);
  }
  
  // Check final balances
  await checkBalances(wallet, connection);
}

// Run the test
testManualSwap().catch(err => {
  console.error('Test failed:', err);
});