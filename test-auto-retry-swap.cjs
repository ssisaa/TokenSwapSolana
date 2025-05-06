/**
 * Test script for the auto-retry swap implementation
 * This tests our approach to the "account already borrowed" error in SOL-YOT swaps
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
async function createSwapTransaction(
  wallet,
  connection,
  solAmount,
  programId,
  solPoolAccount,
  userYotAccount,
  userYosAccount,
  liquidityContributionAccount
) {
  // Convert SOL to lamports
  const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  
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

// Create an empty liquidity contribution account
async function createLiquidityContributionAccount(
  wallet,
  connection,
  programId,
  liquidityAccountAddress
) {
  console.log('Creating empty liquidity contribution account...');
  
  try {
    // Find program state and authority
    const [programStateAddress] = findProgramStateAddress(programId);
    const [programAuthority] = findProgramAuthority(programId);
    
    // Create a transaction with create account instruction
    const transaction = new Transaction();
    
    // Add compute budget instructions for safety
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000
    });
    
    transaction.add(computeUnits);
    
    // We'll use a special instruction #9 (if it exists) that only creates the account
    const data = Buffer.alloc(1);
    data.writeUint8(9, 0); // Instruction #9 - CREATE_ACCOUNT_ONLY
    
    const accounts = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: false },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: liquidityAccountAddress, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    const createAccountIx = new TransactionInstruction({
      programId,
      keys: accounts,
      data
    });
    
    transaction.add(createAccountIx);
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    transaction.sign(wallet);
    console.log('Sending account creation transaction...');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true // Skip preflight to send it even if it might fail
    });
    
    console.log(`Account creation transaction sent: ${signature}`);
    
    try {
      await connection.confirmTransaction(signature);
      console.log('Account creation transaction confirmed!');
    } catch (error) {
      console.log('Account creation confirmation error (may still be created):', error.message);
    }
    
    // Wait a moment to ensure propagation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return signature;
  } catch (error) {
    console.error('Error creating liquidity contribution account:', error);
    throw error;
  }
}

// Perform a SOL to YOT swap with two-phase approach
async function autoRetrySwap(wallet, connection, solAmount) {
  console.log(`\n=== Starting SOL to YOT swap (${solAmount} SOL) with two-phase approach ===\n`);
  
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
    
    let accountCreated = false;
    
    // STEP 1: If account doesn't exist, try to create it first
    if (!accountInfo) {
      try {
        console.log('\n--- PHASE 1: Creating Liquidity Contribution Account ---');
        await createLiquidityContributionAccount(
          wallet,
          connection,
          programId,
          liquidityContributionAccount
        );
        
        accountCreated = true;
        
        // Check if the account was created
        const newAccountInfo = await connection.getAccountInfo(liquidityContributionAccount);
        if (newAccountInfo) {
          console.log('✅ Liquidity contribution account created successfully!');
          console.log(`Account size: ${newAccountInfo.data.length} bytes`);
        } else {
          console.log('❌ Account not found after creation attempt, proceeding anyway');
        }
        
        // Wait a moment before proceeding to swap
        console.log('Waiting 2 seconds before proceeding to swap...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('Error during account creation (continuing anyway):', error);
      }
    }
    
    // STEP 2: Now proceed with the actual swap
    console.log('\n--- PHASE 2: Performing SOL to YOT Swap ---');
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
    
    // Sign and send transaction
    transaction.sign(wallet);
    console.log('Sending swap transaction...');
    
    let swapSignature;
    try {
      swapSignature = await connection.sendRawTransaction(transaction.serialize());
      console.log(`Swap transaction sent with signature: ${swapSignature}`);
      
      // Wait for confirmation
      console.log('Waiting for confirmation...');
      const result = await connection.confirmTransaction(swapSignature);
      
      if (result.value.err) {
        const errStr = JSON.stringify(result.value.err);
        console.error(`Swap transaction failed: ${errStr}`);
        
        // If we hit the "account already borrowed" error after creating the account
        // we should retry one more time
        if (errStr.includes('already borrowed') && accountCreated) {
          console.log('\n--- PHASE 3: Retry after account creation ---');
          console.log('Waiting 2 seconds before final retry...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Create a new transaction with fresh blockhash
          const retryTransaction = await createSwapTransaction(
            wallet,
            connection,
            solAmount,
            programId,
            solPoolAccount,
            yotAccountResult.address,
            yosAccountResult.address,
            liquidityContributionAccount
          );
          
          retryTransaction.sign(wallet);
          console.log('Sending final retry transaction...');
          const retrySignature = await connection.sendRawTransaction(retryTransaction.serialize());
          console.log(`Retry transaction sent with signature: ${retrySignature}`);
          
          // Wait for confirmation
          console.log('Waiting for confirmation...');
          const retryResult = await connection.confirmTransaction(retrySignature);
          
          if (retryResult.value.err) {
            console.error(`Retry also failed: ${JSON.stringify(retryResult.value.err)}`);
            return {
              success: false,
              signature: retrySignature,
              error: 'Final retry also failed',
              accountCreated
            };
          }
          
          console.log('✅ Retry succeeded!');
          return {
            success: true,
            signature: retrySignature,
            accountCreated
          };
        }
        
        return {
          success: false,
          signature: swapSignature,
          error: `Transaction error: ${errStr}`,
          accountCreated
        };
      }
      
      console.log('✅ Swap transaction succeeded!');
      return {
        success: true,
        signature: swapSignature,
        accountCreated
      };
    } catch (error) {
      console.error('Error sending swap transaction:', error);
      return {
        success: false,
        error: `Transaction error: ${error.message}`,
        accountCreated
      };
    }
  } catch (error) {
    console.error('Error in two-phase swap:', error);
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
  
  // First, try to delete the liquidity contribution account to test retry
  // This is just for testing purposes so we can see the retry in action
  try {
    const programId = new PublicKey(appConfig.solana.multiHubSwap.programId);
    const [liquidityAccount] = findLiquidityContributionAddress(wallet.publicKey, programId);
    const accountInfo = await connection.getAccountInfo(liquidityAccount);
    
    if (accountInfo) {
      console.log(`\n=== Deleting existing liquidity contribution account for testing ===\n`);
      // We can't actually delete it, but we'll inform what would happen
      console.log('Note: In a real scenario, we would need the program to delete this account');
      console.log('Since we can\'t delete a PDA from the client, we\'ll proceed with the test.');
      console.log('If this is a fresh account, the first attempt may succeed directly.');
    }
  } catch (error) {
    console.error('Error checking liquidity account:', error);
  }
  
  // Perform the auto-retry swap
  const result = await autoRetrySwap(wallet, connection, solAmount);
  
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