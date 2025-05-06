/**
 * Test script for the improved twoStepSwap approach
 * This tests the approach of sending a minimal transaction first to create the
 * liquidity contribution account, then sending a second transaction for the actual swap
 */

const { 
  Connection, 
  PublicKey, 
  Keypair, 
  LAMPORTS_PER_SOL, 
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
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
 * Find program state account - uses the same seed derivation as the Rust program
 */
function findProgramStateAddress() {
  const programId = new PublicKey('SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE');
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    programId
  );
}

/**
 * Find liquidity contribution account for a user's wallet
 */
function findLiquidityContributionAddress(userWallet) {
  const programId = new PublicKey('SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE');
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.toBuffer()],
    programId
  );
}

/**
 * Find program authority account
 */
function findProgramAuthority() {
  const programId = new PublicKey('SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE');
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    programId
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
    
    // Check if liquidity contribution account exists
    const [liquidityAccount] = findLiquidityContributionAddress(wallet.publicKey);
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
 * Create SOL to YOT swap transaction
 */
async function createSwapTransaction(
  wallet,
  connection,
  solAmount,
  userYotAccount,
  userYosAccount,
  liquidityContributionAccount
) {
  // Get configuration from app.config.json
  const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
  const programId = new PublicKey(appConfig.solana.multiHubSwap.programId);
  const solPoolAccount = new PublicKey(appConfig.solana.pool.solAccount);
  const yotMint = new PublicKey(appConfig.solana.tokens.yot.address);
  const poolAuthority = new PublicKey(appConfig.solana.pool.authority);
  
  // Convert SOL to lamports
  const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  
  // Get PDAs
  const [programStateAddress] = findProgramStateAddress();
  const [programAuthority] = findProgramAuthority();
  
  // Get YOT pool token account
  const yotPoolAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
  
  // Instruction data: [7 (SOL-YOT Swap), amountIn (8 bytes), minAmountOut (8 bytes)]
  const data = Buffer.alloc(17);
  data.writeUint8(7, 0); // SOL-YOT Swap instruction (index 7)
  data.writeBigUInt64LE(BigInt(amountInLamports), 1);
  data.writeBigUInt64LE(BigInt(0), 9); // Min amount out (0 for testing)
  
  // Required accounts for the SOL to YOT swap
  const accounts = [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: programStateAddress, isSigner: false, isWritable: false },
    { pubkey: programAuthority, isSigner: false, isWritable: false },
    { pubkey: solPoolAccount, isSigner: false, isWritable: true },
    { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
    { pubkey: userYotAccount, isSigner: false, isWritable: true },
    { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true },
    { pubkey: new PublicKey(appConfig.solana.tokens.yos.address), isSigner: false, isWritable: true },
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
  
  // Add compute budget instructions
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
}

/**
 * Two-step swap implementation
 */
async function twoStepSwap(wallet, connection, solAmount) {
  console.log(`\n=== Starting Two-Step SOL to YOT swap (${solAmount} SOL) ===`);
  
  try {
    // Ensure token accounts exist
    const { yotAddress, yosAddress } = await ensureTokenAccounts(wallet, connection);
    
    // Get liquidity contribution account
    const [liquidityContributionAccount] = findLiquidityContributionAddress(wallet.publicKey);
    console.log(`Liquidity contribution account address: ${liquidityContributionAccount.toString()}`);
    
    // Check if liquidity contribution account exists
    const accountInfo = await connection.getAccountInfo(liquidityContributionAccount);
    
    if (accountInfo) {
      console.log('Liquidity contribution account already exists!');
      console.log(`Account size: ${accountInfo.data.length} bytes`);
      console.log(`Account owner: ${accountInfo.owner.toString()}`);
      
      // Account exists, do a normal swap
      const transaction = await createSwapTransaction(
        wallet,
        connection,
        solAmount,
        yotAddress,
        yosAddress,
        liquidityContributionAccount
      );
      
      console.log('Sending swap transaction...');
      transaction.sign(wallet);
      const signature = await connection.sendRawTransaction(transaction.serialize());
      console.log(`Transaction sent: ${signature}`);
      
      const result = await connection.confirmTransaction(signature);
      if (result.value.err) {
        console.error('Transaction failed:', result.value.err);
        return {
          success: false,
          signature,
          error: result.value.err
        };
      }
      
      console.log('Transaction succeeded!');
      return {
        success: true,
        signature
      };
    }
    
    // Account doesn't exist, use the two-step approach
    console.log('Liquidity contribution account does not exist, using two-step approach');
    
    // Step 1: Send a minimal amount (0.000001 SOL) to create the account
    const microAmount = 0.000001;
    console.log(`\n--- STEP 1: Creating account with minimal swap (${microAmount} SOL) ---`);
    
    const stepOneTransaction = await createSwapTransaction(
      wallet,
      connection,
      microAmount,
      yotAddress,
      yosAddress,
      liquidityContributionAccount
    );
    
    console.log('Sending step 1 transaction...');
    stepOneTransaction.sign(wallet);
    const stepOneSignature = await connection.sendRawTransaction(stepOneTransaction.serialize(), {
      skipPreflight: true // Skip preflight to force through even with expected simulation errors
    });
    console.log(`Step 1 transaction sent: ${stepOneSignature}`);
    
    try {
      await connection.confirmTransaction(stepOneSignature);
      console.log('Step 1 transaction succeeded unexpectedly!');
    } catch (error) {
      console.log('Step 1 transaction failed as expected:', error.message);
    }
    
    // Wait a moment to ensure any changes propagate
    console.log('Waiting 2 seconds before checking account and proceeding...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if account was created
    const accountAfterStepOne = await connection.getAccountInfo(liquidityContributionAccount);
    if (accountAfterStepOne) {
      console.log('Liquidity contribution account was successfully created in step 1!');
      console.log(`Account size: ${accountAfterStepOne.data.length} bytes`);
      console.log(`Account owner: ${accountAfterStepOne.owner.toString()}`);
    } else {
      console.log('Account was not created in step 1, proceeding anyway...');
    }
    
    // Step 2: Send the actual amount
    console.log(`\n--- STEP 2: Performing actual swap (${solAmount} SOL) ---`);
    
    const stepTwoTransaction = await createSwapTransaction(
      wallet,
      connection,
      solAmount,
      yotAddress,
      yosAddress,
      liquidityContributionAccount
    );
    
    console.log('Sending step 2 transaction...');
    stepTwoTransaction.sign(wallet);
    const stepTwoSignature = await connection.sendRawTransaction(stepTwoTransaction.serialize());
    console.log(`Step 2 transaction sent: ${stepTwoSignature}`);
    
    // Wait for confirmation
    const stepTwoResult = await connection.confirmTransaction(stepTwoSignature);
    
    if (stepTwoResult.value.err) {
      console.error('Step 2 transaction failed:', stepTwoResult.value.err);
      
      // If step 2 failed and account doesn't exist, try with higher amount
      if (!accountAfterStepOne) {
        console.log('Account still does not exist, trying again with higher amount...');
        
        // Try with 0.01 SOL - higher than micro but less than full amount
        const smallAmount = 0.01;
        const retryTransaction = await createSwapTransaction(
          wallet,
          connection,
          smallAmount,
          yotAddress,
          yosAddress,
          liquidityContributionAccount
        );
        
        console.log(`Sending retry transaction with ${smallAmount} SOL...`);
        retryTransaction.sign(wallet);
        const retrySignature = await connection.sendRawTransaction(retryTransaction.serialize());
        console.log(`Retry transaction sent: ${retrySignature}`);
        
        const retryResult = await connection.confirmTransaction(retrySignature);
        if (retryResult.value.err) {
          console.error('Retry transaction failed:', retryResult.value.err);
          return {
            success: false,
            signatures: [stepOneSignature, stepTwoSignature, retrySignature],
            error: retryResult.value.err
          };
        }
        
        console.log('Retry transaction succeeded!');
        return {
          success: true,
          signatures: [stepOneSignature, stepTwoSignature, retrySignature]
        };
      }
      
      return {
        success: false,
        signatures: [stepOneSignature, stepTwoSignature],
        error: stepTwoResult.value.err
      };
    }
    
    console.log('Step 2 transaction succeeded!');
    return {
      success: true,
      signatures: [stepOneSignature, stepTwoSignature]
    };
  } catch (error) {
    console.error('Error in two-step swap:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Main test function for twoStepSwap
 */
async function testSwap() {
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
  
  // Execute two-step swap
  const result = await twoStepSwap(wallet, connection, solAmount);
  
  // Show result
  console.log('\n=== Swap Result ===');
  console.log(`Success: ${result.success}`);
  
  if (result.signature) {
    console.log(`Signature: ${result.signature}`);
  }
  if (result.signatures) {
    console.log(`Signatures: ${result.signatures.join(', ')}`);
  }
  if (result.error) {
    console.log(`Error: ${result.error}`);
  }
  
  // Check final balances
  await checkBalances(wallet, connection);
}

// Run the test
testSwap().catch(err => {
  console.error('Test failed:', err);
});