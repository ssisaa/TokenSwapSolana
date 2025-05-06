/**
 * Debug test script for the SOL to YOT swap
 * This script sends a transaction and captures the full logs to understand
 * exactly what's happening during the "account already borrowed" error
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
      console.log(`Account owner: ${accountInfo.owner.toString()}`);
    } else {
      console.log(`Liquidity contribution account does not exist: ${liquidityAccount.toString()}`);
    }
  } catch (error) {
    console.error('Error checking token balances:', error);
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

// Create the liquidity contribution account manually
async function createLiquidityContributionAccount(
  wallet,
  connection,
  programId,
  programAuthority,
  liquidityContributionAddress
) {
  console.log(`\n=== Creating liquidity contribution account: ${liquidityContributionAddress.toString()} ===`);
  
  const space = 128; // Space for liquidity contribution account
  const lamports = await connection.getMinimumBalanceForRentExemption(space);
  
  console.log(`Required lamports for rent exemption: ${lamports}`);
  console.log(`Account space: ${space} bytes`);
  
  // Create SystemProgram instruction to allocate space and transfer lamports
  // The important thing is to set the program ID as the owner
  const createAccountIx = SystemProgram.createAccountWithSeed({
    fromPubkey: wallet.publicKey,
    basePubkey: wallet.publicKey,
    seed: 'liquidity_contrib', // Seed for deterministic derivation
    newAccountPubkey: liquidityContributionAddress,
    lamports,
    space,
    programId: programId // This sets the program as the owner
  });
  
  // Create transaction
  const transaction = new Transaction();
  transaction.add(createAccountIx);
  
  // Set transaction properties
  transaction.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  try {
    transaction.sign(wallet);
    console.log('Sending create account transaction...');
    const signature = await connection.sendRawTransaction(transaction.serialize());
    console.log(`Transaction sent: ${signature}`);
    console.log('Waiting for confirmation...');
    const confirmation = await connection.confirmTransaction(signature);
    
    if (confirmation.value.err) {
      console.error('Transaction failed:', confirmation.value.err);
      return {
        success: false,
        error: confirmation.value.err
      };
    }
    
    console.log('Account creation transaction confirmed!');
    
    // Check if the account was created
    const accountInfo = await connection.getAccountInfo(liquidityContributionAddress);
    if (accountInfo) {
      console.log('✅ Account created successfully!');
      console.log(`Account data length: ${accountInfo.data.length}`);
      console.log(`Account owner: ${accountInfo.owner.toString()}`);
      return {
        success: true,
        signature
      };
    } else {
      console.error('❌ Account not found after creation transaction');
      return {
        success: false,
        error: 'Account not found'
      };
    }
  } catch (error) {
    console.error('Error creating account:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Test function to observe what happens in the transaction
async function debugTransactionFlow(wallet, connection, solAmount) {
  console.log(`\n=== Debugging SOL to YOT swap transaction flow for ${solAmount} SOL ===\n`);
  
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
    
    // Get the liquidity contribution account address
    const [liquidityContributionAccount] = findLiquidityContributionAddress(wallet.publicKey, programId);
    console.log(`Liquidity contribution account address: ${liquidityContributionAccount.toString()}`);
    
    // Get program state and authority
    const [programStateAddress] = findProgramStateAddress(programId);
    const [programAuthority] = findProgramAuthority(programId);
    console.log(`Program state address: ${programStateAddress.toString()}`);
    console.log(`Program authority address: ${programAuthority.toString()}`);
    
    // Check if the account already exists
    const accountInfo = await connection.getAccountInfo(liquidityContributionAccount);
    if (accountInfo) {
      console.log('Liquidity contribution account already exists!');
      console.log(`Account data length: ${accountInfo.data.length}`);
      console.log(`Account owner: ${accountInfo.owner.toString()}`);
    } else {
      console.log('Liquidity contribution account does not exist yet');
      
      // Try to create the account manually
      const createResult = await createLiquidityContributionAccount(
        wallet,
        connection,
        programId,
        programAuthority,
        liquidityContributionAccount
      );
      
      if (!createResult.success) {
        console.error('Failed to create account manually. Error:', createResult.error);
        console.log('Proceeding with normal transaction to see what happens...');
      }
    }
    
    // Create and send the swap transaction
    console.log('\n=== Sending swap transaction ===');
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
    
    // Simulate the transaction first to debug
    console.log('Simulating transaction...');
    const simulation = await connection.simulateTransaction(transaction);
    
    if (simulation.value.err) {
      console.log('Simulation failed with error:', simulation.value.err);
      console.log('Logs from simulation:');
      simulation.value.logs.forEach((log, i) => console.log(`${i}: ${log}`));
    } else {
      console.log('Simulation succeeded!');
      console.log('Logs from simulation:');
      simulation.value.logs.forEach((log, i) => console.log(`${i}: ${log}`));
    }
    
    // Now send the actual transaction
    console.log('\n=== Sending actual transaction ===');
    transaction.sign(wallet);
    
    let signature;
    try {
      signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: true // Skip preflight to force it through even if simulation fails
      });
      console.log(`Transaction sent with signature: ${signature}`);
      console.log(`Explorer URL: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    } catch (error) {
      console.error('Error sending transaction:', error);
      return;
    }
    
    try {
      console.log('Waiting for confirmation...');
      const confirmation = await connection.confirmTransaction(signature);
      
      if (confirmation.value.err) {
        console.log('Transaction failed with error:', confirmation.value.err);
      } else {
        console.log('Transaction succeeded!');
      }
    } catch (error) {
      console.error('Error confirming transaction:', error);
    }
    
    // Get transaction details with logs
    console.log('\n=== Getting detailed transaction logs ===');
    const txDetails = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });
    
    if (txDetails) {
      console.log('Transaction details retrieved!');
      if (txDetails.meta && txDetails.meta.logMessages) {
        console.log('Logs from on-chain execution:');
        txDetails.meta.logMessages.forEach((log, i) => console.log(`${i}: ${log}`));
      } else {
        console.log('No logs available in transaction details');
      }
    } else {
      console.log('Could not retrieve transaction details');
    }
    
    // Check if the account was created after the transaction
    console.log('\n=== Checking for liquidity contribution account after transaction ===');
    const accountInfoAfter = await connection.getAccountInfo(liquidityContributionAccount);
    if (accountInfoAfter) {
      console.log('Liquidity contribution account exists after transaction!');
      console.log(`Account data length: ${accountInfoAfter.data.length}`);
      console.log(`Account owner: ${accountInfoAfter.owner.toString()}`);
    } else {
      console.log('Liquidity contribution account still does not exist after transaction');
    }
  } catch (error) {
    console.error('Error in debug transaction flow:', error);
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
  
  // Amount to swap (0.1 SOL)
  const solAmount = 0.05; // A small amount for testing
  
  // Run the debug transaction flow
  await debugTransactionFlow(wallet, connection, solAmount);
  
  // Check final balances
  await checkBalances(wallet, connection);
}

// Run the test
main().catch(err => {
  console.error('Test failed:', err);
});