/**
 * Full test for the complete two-step SOL to YOT swap
 * This script tests the new approach handling liquidity contribution accounts correctly
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

// Helper function to create liquidity contribution account setup transaction
async function createLiquidityAccountTransaction(
  wallet,
  connection,
  programId
) {
  // Get the liquidity contribution account PDA
  const [liquidityAccount, bump] = findLiquidityContributionAddress(wallet.publicKey, programId);
  console.log(`Liquidity contribution account: ${liquidityAccount.toString()} (bump: ${bump})`);

  // Check if the account exists
  const accountInfo = await connection.getAccountInfo(liquidityAccount);
  
  if (accountInfo !== null) {
    console.log('✅ Liquidity contribution account already exists');
    return {
      exists: true,
      accountAddress: liquidityAccount
    };
  }

  console.log('Creating liquidity contribution account transaction...');

  // Create a transaction with compute budget
  const transaction = new Transaction();
  
  // Add compute budget instruction
  const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400000
  });
  
  transaction.add(computeUnits);
  
  // Get PDAs needed for the instruction
  const [programStateAddress] = findProgramStateAddress(programId);
  const [programAuthority] = findProgramAuthority(programId);
  
  // Create instruction data for CREATE_LIQUIDITY_ACCOUNT_ONLY
  const data = Buffer.alloc(17);
  data.writeUint8(8, 0); // Instruction #8 - CREATE_LIQUIDITY_ACCOUNT_ONLY
  data.writeBigUInt64LE(BigInt(0), 1); // No SOL amount
  data.writeBigUInt64LE(BigInt(0), 9); // No min amount out
  
  // Create the instruction with minimal account set
  const solPoolAccount = new PublicKey(appConfig.solana.pool.solAccount);
  
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: false },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: solPoolAccount, isSigner: false, isWritable: true },
      { pubkey: liquidityAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data
  });
  
  transaction.add(instruction);
  
  // Set transaction properties
  transaction.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  return {
    exists: false,
    accountAddress: liquidityAccount,
    transaction
  };
}

// Main test function
async function testCompleteSwap() {
  // Load config from app.config.json
  const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
  
  // Set up connection to Solana devnet
  const connection = new Connection(appConfig.solana.rpcUrl, 'confirmed');
  
  // Load test wallet
  const wallet = loadWalletFromFile();
  console.log(`Using wallet: ${wallet.publicKey.toString()}`);
  
  // Check wallet SOL balance
  const solBalance = await connection.getBalance(wallet.publicKey);
  console.log(`Wallet SOL balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
  
  // Get essential addresses
  const programId = new PublicKey(appConfig.solana.multiHubSwap.programId);
  const yotMint = new PublicKey(appConfig.solana.tokens.yot.address);
  const yosMint = new PublicKey(appConfig.solana.tokens.yos.address);
  const poolAuthority = new PublicKey(appConfig.solana.pool.authority);
  
  // STEP 1: Ensure YOT and YOS token accounts exist
  console.log('\n=== STEP 1: Ensure token accounts exist ===\n');
  
  // Ensure YOT token account
  const yotTokenAddress = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
  let yotAccountExists = false;
  
  try {
    await getAccount(connection, yotTokenAddress);
    console.log(`YOT token account exists: ${yotTokenAddress.toString()}`);
    yotAccountExists = true;
  } catch (error) {
    console.log(`Creating YOT token account: ${yotTokenAddress.toString()}`);
    
    // Create transaction
    const transaction = new Transaction();
    
    // Create associated token account instruction
    const createATAIx = require('@solana/spl-token').createAssociatedTokenAccountInstruction(
      wallet.publicKey, // payer
      yotTokenAddress, // ata
      wallet.publicKey, // owner
      yotMint // mint
    );
    
    transaction.add(createATAIx);
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction(signature);
    
    console.log(`YOT token account created with signature: ${signature}`);
    yotAccountExists = true;
  }
  
  // Ensure YOS token account
  const yosTokenAddress = await getAssociatedTokenAddress(yosMint, wallet.publicKey);
  let yosAccountExists = false;
  
  try {
    await getAccount(connection, yosTokenAddress);
    console.log(`YOS token account exists: ${yosTokenAddress.toString()}`);
    yosAccountExists = true;
  } catch (error) {
    console.log(`Creating YOS token account: ${yosTokenAddress.toString()}`);
    
    // Create transaction
    const transaction = new Transaction();
    
    // Create associated token account instruction
    const createATAIx = require('@solana/spl-token').createAssociatedTokenAccountInstruction(
      wallet.publicKey, // payer
      yosTokenAddress, // ata
      wallet.publicKey, // owner
      yosMint // mint
    );
    
    transaction.add(createATAIx);
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction(signature);
    
    console.log(`YOS token account created with signature: ${signature}`);
    yosAccountExists = true;
  }
  
  // Check that token accounts were created successfully
  if (!yotAccountExists || !yosAccountExists) {
    console.error('Failed to create token accounts');
    return;
  }
  
  // STEP 2: Create liquidity contribution account separately if needed
  console.log('\n=== STEP 2: Create liquidity contribution account ===\n');
  
  const liquidityAccountResult = await createLiquidityAccountTransaction(
    wallet,
    connection,
    programId
  );
  
  // If account doesn't exist, send the creation transaction
  if (!liquidityAccountResult.exists && liquidityAccountResult.transaction) {
    try {
      // Sign and send transaction
      console.log('Signing transaction...');
      liquidityAccountResult.transaction.sign(wallet);
      
      console.log('Sending transaction to create liquidity contribution account...');
      const signature = await connection.sendRawTransaction(liquidityAccountResult.transaction.serialize());
      
      console.log(`Transaction sent with signature: ${signature}`);
      console.log('Waiting for confirmation...');
      
      const confirmation = await connection.confirmTransaction(signature);
      
      if (confirmation.value.err) {
        console.error('Transaction failed:', confirmation.value.err);
        // Continue anyway, the account might already exist
      } else {
        console.log('✅ Liquidity contribution account created successfully!');
      }
      
      // Sleep briefly to ensure account propagation
      console.log('Waiting for account to be fully propagated...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Error creating liquidity contribution account:', error);
      // Continue anyway, we'll check if the account exists before the swap
    }
  }
  
  // Verify that the account was created or already exists
  const accountInfo = await connection.getAccountInfo(liquidityAccountResult.accountAddress);
  
  if (accountInfo) {
    console.log(`✅ Liquidity contribution account verified: ${liquidityAccountResult.accountAddress.toString()}`);
    console.log(`Account data length: ${accountInfo.data.length} bytes`);
    console.log(`Account owner: ${accountInfo.owner.toString()}`);
  } else {
    console.log(`❌ Liquidity contribution account was not created: ${liquidityAccountResult.accountAddress.toString()}`);
    // Proceed anyway to test the swap's account creation logic
  }
  
  // STEP 3: Perform the swap with a proper amount and slippage
  console.log('\n=== STEP 3: Perform SOL to YOT swap ===\n');
  
  // Get the pool YOT token account
  const yotPoolAccount = await getAssociatedTokenAddress(
    yotMint,
    poolAuthority
  );
  
  // Amount to swap (in SOL)
  const solAmount = 0.05; // Swap 0.05 SOL (small amount for testing)
  console.log(`Swapping ${solAmount} SOL to YOT tokens`);
  
  // Convert SOL to lamports
  const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  
  // Set slippage to 1%
  const slippagePercent = 1.0;
  
  // For testing purposes, set min amount out to 0
  const minAmountOut = 0;
  
  // Get PDAs for the swap instruction
  const [programStateAddress] = findProgramStateAddress(programId);
  const [programAuthority] = findProgramAuthority(programId);
  
  // Create SOL to YOT swap instruction
  const solPoolAccount = new PublicKey(appConfig.solana.pool.solAccount);
  
  // Instruction data: [7 (SOL-YOT Swap), amountIn (8 bytes), minAmountOut (8 bytes)]
  const data = Buffer.alloc(17);
  data.writeUint8(7, 0); // SOL-YOT Swap instruction (index 7)
  data.writeBigUInt64LE(BigInt(amountInLamports), 1);
  data.writeBigUInt64LE(BigInt(minAmountOut), 9);
  
  // Required accounts for the SOL to YOT swap
  const accounts = [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: programStateAddress, isSigner: false, isWritable: false },
    { pubkey: programAuthority, isSigner: false, isWritable: false },
    { pubkey: solPoolAccount, isSigner: false, isWritable: true },
    { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
    { pubkey: yotTokenAddress, isSigner: false, isWritable: true },
    { pubkey: liquidityAccountResult.accountAddress, isSigner: false, isWritable: true },
    { pubkey: yosMint, isSigner: false, isWritable: true },
    { pubkey: yosTokenAddress, isSigner: false, isWritable: true },
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
  
  // Sign and send transaction
  console.log('Signing transaction...');
  transaction.sign(wallet);
  
  console.log('Sending swap transaction...');
  const signature = await connection.sendRawTransaction(transaction.serialize());
  console.log(`Transaction sent: ${signature}`);
  
  console.log('Waiting for confirmation...');
  try {
    const confirmation = await connection.confirmTransaction(signature);
    
    if (confirmation.value.err) {
      console.error('Swap transaction failed:', confirmation.value.err);
      
      try {
        // Get more details about the error
        const txInfo = await connection.getTransaction(signature, { commitment: 'confirmed' });
        console.log('Transaction logs:', txInfo?.meta?.logMessages);
      } catch (infoError) {
        console.error('Error getting transaction info:', infoError);
      }
    } else {
      console.log('✅ Swap transaction confirmed successfully!');
      
      // Check final balances
      const finalSolBalance = await connection.getBalance(wallet.publicKey);
      console.log(`\nNew SOL balance: ${finalSolBalance / LAMPORTS_PER_SOL} SOL`);
      
      try {
        const yotAccount = await getAccount(connection, yotTokenAddress);
        console.log(`New YOT balance: ${Number(yotAccount.amount) / Math.pow(10, 9)} YOT`);
      } catch (error) {
        console.error('Error getting YOT balance:', error);
      }
      
      try {
        const yosAccount = await getAccount(connection, yosTokenAddress);
        console.log(`New YOS balance: ${Number(yosAccount.amount) / Math.pow(10, 9)} YOS`);
      } catch (error) {
        console.error('Error getting YOS balance:', error);
      }
    }
  } catch (error) {
    console.error('Error confirming transaction:', error);
    
    // Try to get more information about what happened
    try {
      const simResult = await connection.simulateTransaction(transaction);
      console.log('Simulation logs:', simResult.value.logs);
    } catch (simError) {
      console.error('Error simulating transaction:', simError);
    }
  }
}

// Load config globally
const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));

// Run the test
testCompleteSwap().catch(err => {
  console.error('Test failed:', err);
});