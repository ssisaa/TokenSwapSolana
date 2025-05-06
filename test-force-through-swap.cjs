/**
 * Test script for the force-through swap implementation
 * This tests our new approach to the "account already borrowed" error in SOL-YOT swaps
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

// Helper functions to find PDA addresses
function findProgramStateAddress(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    programId
  );
}

function findProgramAuthority(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    programId
  );
}

function findLiquidityContributionAddress(userWallet, programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.toBuffer()],
    programId
  );
}

// Helper function to check wallet balances
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
    const programId = new PublicKey(appConfig.solana.multiHubSwap.programId);
    const [liquidityAccount] = findLiquidityContributionAddress(wallet.publicKey, programId);
    const accountInfo = await connection.getAccountInfo(liquidityAccount);
    if (accountInfo) {
      console.log(`Liquidity contribution account exists: ${liquidityAccount.toString()}`);
      console.log(`Account size: ${accountInfo.data.length} bytes`);
    } else {
      console.log(`Liquidity contribution account does not exist: ${liquidityAccount.toString()}`);
    }
  } catch (error) {
    console.error('Error checking token balances:', error);
  }
}

// Helper function to check pool balances
async function checkPoolBalances(connection) {
  console.log('\n=== Pool Balances ===');
  
  try {
    // Get configuration from app.config.json
    const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
    const solPoolAccount = new PublicKey(appConfig.solana.pool.solAccount);
    const poolAuthority = new PublicKey(appConfig.solana.pool.authority);
    const yotMint = new PublicKey(appConfig.solana.tokens.yot.address);
    
    // Check SOL pool balance
    const solBalance = await connection.getBalance(solPoolAccount);
    console.log(`SOL Pool Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Get YOT pool account
    const yotPoolAccount = await getAssociatedTokenAddress(yotMint, poolAuthority);
    
    // Check YOT pool balance
    try {
      const yotAccount = await getAccount(connection, yotPoolAccount);
      console.log(`YOT Pool Balance: ${Number(yotAccount.amount) / Math.pow(10, 9)} YOT`);
    } catch (error) {
      console.error('Error getting YOT pool balance:', error);
    }
  } catch (error) {
    console.error('Error checking pool balances:', error);
  }
}

// Helper function to ensure token account exists
async function ensureTokenAccount(wallet, connection, mint) {
  try {
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mint,
      wallet.publicKey
    );
    
    try {
      // Check if account exists
      await getAccount(connection, associatedTokenAddress);
      console.log(`Token account exists: ${associatedTokenAddress.toString()}`);
      return {
        exists: true,
        address: associatedTokenAddress
      };
    } catch (error) {
      // Need to create token account
      console.log(`Creating token account for mint ${mint.toString()}`);
      
      // Create associated token account instruction
      const createATAIx = require('@solana/spl-token').createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        associatedTokenAddress, // ata
        wallet.publicKey, // owner
        mint // mint
      );
      
      // Create and send transaction
      const transaction = new Transaction();
      transaction.add(createATAIx);
      
      // Set transaction properties
      transaction.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      
      // Sign and send transaction
      transaction.sign(wallet);
      const signature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction(signature);
      
      console.log(`Token account created: ${associatedTokenAddress.toString()}`);
      return {
        exists: false,
        address: associatedTokenAddress,
        signature
      };
    }
  } catch (error) {
    console.error('Error ensuring token account:', error);
    throw error;
  }
}

// Create SOL to YOT swap transaction
// If forceZeroSol is true, it will create a transaction with 0 SOL amount
async function createSwapTransaction(
  wallet,
  connection,
  solAmount,
  programId,
  solPoolAccount,
  userYotAccount,
  userYosAccount,
  liquidityContributionAccount,
  forceZeroSol = false
) {
  // Convert SOL to lamports (use 0 if forced)
  const amountInLamports = forceZeroSol ? 0 : Math.floor(solAmount * LAMPORTS_PER_SOL);
  
  // Get PDAs
  const [programStateAddress] = findProgramStateAddress(programId);
  const [programAuthority] = findProgramAuthority(programId);
  
  // Get YOT pool token account
  const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
  const yotMint = new PublicKey(appConfig.solana.tokens.yot.address);
  const poolAuthority = new PublicKey(appConfig.solana.pool.authority);
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

// Perform a SOL to YOT swap with force-through approach
async function forceThroughSwap(wallet, connection, solAmount) {
  console.log(`\n=== Starting SOL to YOT swap (${solAmount} SOL) with force-through approach ===\n`);
  
  try {
    // Load config from app.config.json
    const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
    const programId = new PublicKey(appConfig.solana.multiHubSwap.programId);
    const solPoolAccount = new PublicKey(appConfig.solana.pool.solAccount);
    const yotMint = new PublicKey(appConfig.solana.tokens.yot.address);
    const yosMint = new PublicKey(appConfig.solana.tokens.yos.address);
    
    // Ensure token accounts exist
    console.log('Ensuring YOT and YOS token accounts exist...');
    const yotAccountResult = await ensureTokenAccount(wallet, connection, yotMint);
    const yosAccountResult = await ensureTokenAccount(wallet, connection, yosMint);
    
    // Get the liquidity contribution account
    const [liquidityContributionAccount] = findLiquidityContributionAddress(wallet.publicKey, programId);
    console.log(`Liquidity contribution account address: ${liquidityContributionAccount.toString()}`);
    
    // Check if the account exists
    const accountInfo = await connection.getAccountInfo(liquidityContributionAccount);
    console.log(`Liquidity contribution account exists: ${!!accountInfo}`);
    
    // If account already exists, we can just do a normal swap
    if (accountInfo) {
      console.log('\n--- PHASE 1: Regular Swap with Existing Account ---');
      const transaction = await createSwapTransaction(
        wallet,
        connection,
        solAmount,
        programId,
        solPoolAccount,
        yotAccountResult.address,
        yosAccountResult.address,
        liquidityContributionAccount
      );
      
      transaction.sign(wallet);
      console.log('Sending swap transaction...');
      const signature = await connection.sendRawTransaction(transaction.serialize());
      console.log(`Transaction sent with signature: ${signature}`);
      
      // Wait for confirmation
      console.log('Waiting for confirmation...');
      const result = await connection.confirmTransaction(signature);
      
      if (result.value.err) {
        console.error('Transaction failed:', result.value.err);
        return {
          success: false,
          signature,
          error: 'Swap failed'
        };
      }
      
      console.log('✅ Swap succeeded!');
      return {
        success: true,
        signature
      };
    }
    
    // Account doesn't exist, use the force-through approach
    console.log('\n--- PHASE 1: Initial Transaction (To Create Account) ---');
    
    // Create the first transaction that will transfer SOL and create the account
    const initialTransaction = await createSwapTransaction(
      wallet,
      connection,
      solAmount,
      programId,
      solPoolAccount,
      yotAccountResult.address,
      yosAccountResult.address,
      liquidityContributionAccount
    );
    
    initialTransaction.sign(wallet);
    console.log('Sending initial transaction (expect it to fail but create account)...');
    
    try {
      // Skip preflight to force transaction through even if it fails
      const initialSignature = await connection.sendRawTransaction(initialTransaction.serialize(), {
        skipPreflight: true
      });
      console.log(`Initial transaction sent with signature: ${initialSignature}`);
      
      try {
        // Wait for confirmation, but it will probably fail
        console.log('Waiting for confirmation...');
        const initialResult = await connection.confirmTransaction(initialSignature);
        
        if (initialResult.value.err) {
          console.log('Initial transaction failed as expected:', initialResult.value.err);
          console.log('This is normal - we expect it to fail with "account already borrowed" error');
        } else {
          console.log('✅ Initial transaction succeeded unexpectedly!');
          return {
            success: true,
            signature: initialSignature
          };
        }
      } catch (error) {
        console.log('Confirmation error (expected):', error.message);
      }
    } catch (error) {
      console.error('Error sending initial transaction:', error);
      return {
        success: false,
        error: 'Failed to send initial transaction'
      };
    }
    
    // Wait a moment for the account creation to propagate
    console.log('\nWaiting 2 seconds before checking account and proceeding...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if the liquidity contribution account was created
    const newAccountInfo = await connection.getAccountInfo(liquidityContributionAccount);
    if (!newAccountInfo) {
      console.log('❌ Liquidity account still does not exist after initial transaction');
      return {
        success: false,
        error: 'Account creation failed'
      };
    }
    
    console.log('✅ Liquidity contribution account created successfully!');
    console.log(`Account size: ${newAccountInfo.data.length} bytes`);
    
    // Now send the second transaction with 0 SOL to complete the operation
    console.log('\n--- PHASE 2: Completion Transaction (0 SOL) ---');
    const completionTransaction = await createSwapTransaction(
      wallet,
      connection,
      solAmount, // Same amount for consistency in logs
      programId,
      solPoolAccount,
      yotAccountResult.address,
      yosAccountResult.address,
      liquidityContributionAccount,
      true // Force 0 SOL amount
    );
    
    completionTransaction.sign(wallet);
    console.log('Sending completion transaction with 0 SOL amount...');
    const completionSignature = await connection.sendRawTransaction(completionTransaction.serialize());
    console.log(`Completion transaction sent with signature: ${completionSignature}`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    const completionResult = await connection.confirmTransaction(completionSignature);
    
    if (completionResult.value.err) {
      console.error('Completion transaction failed:', completionResult.value.err);
      return {
        success: false,
        signature: completionSignature,
        error: 'Completion transaction failed'
      };
    }
    
    console.log('✅ Force-through swap succeeded!');
    return {
      success: true,
      signature: completionSignature
    };
  } catch (error) {
    console.error('Error in force-through swap:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Main test function
async function main() {
  // Load config from app.config.json
  const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
  const connection = new Connection(appConfig.solana.rpcUrl, 'confirmed');
  
  // Load wallet
  const wallet = loadWalletFromFile();
  console.log(`Using wallet: ${wallet.publicKey.toString()}`);
  
  // Check initial balances
  await checkBalances(wallet, connection);
  await checkPoolBalances(connection);
  
  // Amount to swap (0.1 SOL)
  const solAmount = 0.05; // A small amount for testing
  
  // Delete existing liquidity contribution account if it exists (for testing)
  try {
    const programId = new PublicKey(appConfig.solana.multiHubSwap.programId);
    const [liquidityAccount] = findLiquidityContributionAddress(wallet.publicKey, programId);
    const accountInfo = await connection.getAccountInfo(liquidityAccount);
    
    if (accountInfo) {
      console.log(`\n=== Existing liquidity contribution account found ===\n`);
      console.log('This test assumes the account does not exist yet.');
      console.log('Please run the test with a wallet that does not have this account.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error checking liquidity account:', error);
  }
  
  // Perform the force-through swap
  const result = await forceThroughSwap(wallet, connection, solAmount);
  
  if (result.success) {
    console.log(`\n✅ Swap succeeded with signature: ${result.signature}`);
  } else {
    console.error(`\n❌ Swap failed: ${result.error}`);
  }
  
  // Check final balances
  await checkBalances(wallet, connection);
  await checkPoolBalances(connection);
}

// Run the test
main().catch(err => {
  console.error('Test failed:', err);
});