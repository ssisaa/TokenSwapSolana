// Test script for ensuring liquidity contribution account is properly structured
// This script will:
// 1. Create a standard account and assign it to the program
// 2. Try to initialize the account with the expected data structure

const { Keypair, Connection, PublicKey, Transaction, SystemProgram, 
  TransactionInstruction, LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY, 
  ComputeBudgetProgram } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// Load configuration from app.config.json
const appConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.config.json'), 'utf8'));
const solanaConfig = appConfig.solana;

// Constants from config
const SOLANA_RPC_URL = solanaConfig.rpcUrl || 'https://api.devnet.solana.com';
const MULTI_HUB_SWAP_PROGRAM_ID = new PublicKey(solanaConfig.multiHubSwap.programId);
const POOL_SOL_ACCOUNT = new PublicKey(solanaConfig.pool.solAccount);
const POOL_AUTHORITY = new PublicKey(solanaConfig.pool.authority);
const YOT_TOKEN_ADDRESS = new PublicKey(solanaConfig.tokens.yot.address);
const YOS_TOKEN_ADDRESS = new PublicKey(solanaConfig.tokens.yos.address);

// Create connection
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Load wallet from file
function loadWalletFromFile() {
  try {
    const keypairData = JSON.parse(fs.readFileSync('.keypair-test.json', 'utf8'));
    const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
    console.log(`Using wallet: ${wallet.publicKey.toString()}`);
    return wallet;
  } catch (error) {
    console.error('Error loading wallet keypair:', error);
    process.exit(1);
  }
}

// Find program state PDA
function findProgramStateAddress(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    programId
  );
}

// Find program authority PDA
function findProgramAuthority(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    programId
  );
}

// Find liquidity contribution address (PDA) for a user
function findLiquidityContributionAddress(userWallet, programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.toBuffer()],
    programId
  );
}

// Create a standard account and assign it to the program
async function createStandardAccount(wallet, size = 128) {
  console.log('Creating standard account and assigning to program');
  
  // Generate a new keypair for the account
  const newAccount = Keypair.generate();
  console.log(`Generated account: ${newAccount.publicKey.toString()}`);
  
  // Calculate lamports needed for rent exemption
  const lamports = await connection.getMinimumBalanceForRentExemption(size);
  
  // Create transaction with transfer, allocate, and assign instructions
  const transaction = new Transaction();
  
  // Add compute budget to ensure enough compute units
  const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400000
  });
  transaction.add(computeUnits);
  
  // Transfer SOL to the new account
  const transferIx = SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: newAccount.publicKey,
    lamports
  });
  
  // Allocate space in the account
  const allocateIx = SystemProgram.allocate({
    accountPubkey: newAccount.publicKey,
    space: size
  });
  
  // Assign the account to the program
  const assignIx = SystemProgram.assign({
    accountPubkey: newAccount.publicKey,
    programId: MULTI_HUB_SWAP_PROGRAM_ID
  });
  
  transaction.add(transferIx);
  transaction.add(allocateIx);
  transaction.add(assignIx);
  
  // Set transaction properties
  transaction.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  // Sign the transaction with both the wallet and the new account
  transaction.sign(wallet, newAccount);
  
  // Send the transaction
  console.log('Sending account creation transaction...');
  const signature = await connection.sendRawTransaction(
    transaction.serialize()
  );
  
  console.log(`Account creation transaction sent: ${signature}`);
  console.log('Waiting for confirmation...');
  
  await connection.confirmTransaction(signature);
  console.log('Account creation confirmed!');
  
  // Verify account was created and assigned correctly
  const accountInfo = await connection.getAccountInfo(newAccount.publicKey);
  if (!accountInfo) {
    throw new Error('Account was not created');
  }
  
  if (!accountInfo.owner.equals(MULTI_HUB_SWAP_PROGRAM_ID)) {
    throw new Error(`Account not assigned to program. Owner: ${accountInfo.owner.toString()}`);
  }
  
  console.log(`Account created and assigned to program: ${newAccount.publicKey.toString()}`);
  return newAccount;
}

// Try to initialize the account with the program's expected data structure
async function initializeLiquidityAccount(wallet, account, pdaAddress) {
  console.log(`\nAttempting to initialize account ${account.publicKey.toString()} as liquidity contribution account`);
  console.log(`PDA address for reference: ${pdaAddress.toString()}`);
  
  // Get PDAs for the transaction
  const [programStateAddress] = findProgramStateAddress(MULTI_HUB_SWAP_PROGRAM_ID);
  const [programAuthority] = findProgramAuthority(MULTI_HUB_SWAP_PROGRAM_ID);
  
  // We'll try with minimal SOL amount to just trigger initialization
  const minimalAmount = 0.001 * LAMPORTS_PER_SOL;
  
  // Instruction data: [9 (INITIALIZE_LIQUIDITY_ACCOUNT), amountIn (8 bytes), minAmountOut (8 bytes)]
  // Using 9 as a hypothetical instruction type that might initialize the account structure
  const data = Buffer.alloc(17);
  data.writeUint8(9, 0); // Hypothetical instruction #9
  data.writeBigUInt64LE(BigInt(minimalAmount), 1);
  data.writeBigUInt64LE(BigInt(0), 9);
  
  // Try with minimal accounts list that would be necessary for initialization
  const accounts = [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: programStateAddress, isSigner: false, isWritable: false },
    { pubkey: programAuthority, isSigner: false, isWritable: false },
    { pubkey: account.publicKey, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
  
  const initializeIx = new TransactionInstruction({
    programId: MULTI_HUB_SWAP_PROGRAM_ID,
    keys: accounts,
    data
  });
  
  // Create transaction
  const transaction = new Transaction();
  
  // Add compute budget
  const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400000
  });
  
  transaction.add(computeUnits);
  transaction.add(initializeIx);
  
  // Set transaction properties
  transaction.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  // Try to send transaction
  try {
    console.log('Sending initialization transaction...');
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(
      transaction.serialize()
    );
    
    console.log(`Initialization transaction sent: ${signature}`);
    console.log('Waiting for confirmation...');
    
    const confirmResult = await connection.confirmTransaction(signature);
    
    if (confirmResult.value.err) {
      console.error('❌ Initialization failed:', confirmResult.value.err);
      return false;
    }
    
    console.log('✅ Initialization transaction confirmed!');
    return true;
  } catch (error) {
    console.error('Error during initialization:', error);
    
    // Log detailed error information
    if (error.logs) {
      console.log('Error logs:');
      error.logs.forEach(log => console.log(log));
    }
    
    return false;
  }
}

// Try creating a minimal contribution with a SOL to YOT swap
async function tryCreateContribution(wallet, account) {
  console.log(`\nAttempting minimal SOL to YOT swap to initialize account ${account.publicKey.toString()}`);
  
  // Get necessary token accounts
  const userYotAccount = await getAssociatedTokenAddress(
    YOT_TOKEN_ADDRESS,
    wallet.publicKey
  );
  
  const userYosAccount = await getAssociatedTokenAddress(
    YOS_TOKEN_ADDRESS,
    wallet.publicKey
  );
  
  // Get PDAs for the transaction
  const [programStateAddress] = findProgramStateAddress(MULTI_HUB_SWAP_PROGRAM_ID);
  const [programAuthority] = findProgramAuthority(MULTI_HUB_SWAP_PROGRAM_ID);
  
  // Get YOT pool token account
  const yotPoolAccount = await getAssociatedTokenAddress(
    YOT_TOKEN_ADDRESS,
    POOL_AUTHORITY
  );
  
  // Use minimal amount
  const solAmount = 0.001; // SOL
  const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  
  // Instruction data: [7 (SOL-YOT Swap), amountIn (8 bytes), minAmountOut (8 bytes)]
  const data = Buffer.alloc(17);
  data.writeUint8(7, 0); // SOL-YOT Swap instruction (index 7)
  data.writeBigUInt64LE(BigInt(amountInLamports), 1);
  data.writeBigUInt64LE(BigInt(0), 9);
  
  // Required accounts for the SOL to YOT swap
  const accounts = [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: programStateAddress, isSigner: false, isWritable: false },
    { pubkey: programAuthority, isSigner: false, isWritable: false },
    { pubkey: POOL_SOL_ACCOUNT, isSigner: false, isWritable: true },
    { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
    { pubkey: userYotAccount, isSigner: false, isWritable: true },
    { pubkey: account.publicKey, isSigner: false, isWritable: true },
    { pubkey: YOS_TOKEN_ADDRESS, isSigner: false, isWritable: true },
    { pubkey: userYosAccount, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  const swapInstruction = new TransactionInstruction({
    programId: MULTI_HUB_SWAP_PROGRAM_ID,
    keys: accounts,
    data,
  });
  
  // Create transaction with compute budget instructions
  const transaction = new Transaction();
  
  // Add compute budget
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
  
  // Try to send transaction
  try {
    console.log('Sending minimal swap transaction...');
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(
      transaction.serialize()
    );
    
    console.log(`Swap transaction sent: ${signature}`);
    console.log('Waiting for confirmation...');
    
    const confirmResult = await connection.confirmTransaction(signature);
    
    if (confirmResult.value.err) {
      console.error('❌ Swap failed:', confirmResult.value.err);
      return false;
    }
    
    console.log('✅ Swap transaction confirmed!');
    return true;
  } catch (error) {
    console.error('Error during swap:', error);
    
    // Log detailed error information
    if (error.logs) {
      console.log('Error logs:');
      error.logs.forEach(log => console.log(log));
    }
    
    return false;
  }
}

// Print balances
async function printBalances(wallet) {
  // Get SOL balance
  const solBalance = await connection.getBalance(wallet.publicKey);
  
  // Get YOT balance
  let yotBalance = 0;
  try {
    const yotTokenAccount = await getAssociatedTokenAddress(
      YOT_TOKEN_ADDRESS,
      wallet.publicKey
    );
    const accountInfo = await connection.getTokenAccountBalance(yotTokenAccount);
    yotBalance = Number(accountInfo.value.uiAmount);
  } catch (error) {
    // Account doesn't exist or other error
  }
  
  // Get YOS balance
  let yosBalance = 0;
  try {
    const yosTokenAccount = await getAssociatedTokenAddress(
      YOS_TOKEN_ADDRESS,
      wallet.publicKey
    );
    const accountInfo = await connection.getTokenAccountBalance(yosTokenAccount);
    yosBalance = Number(accountInfo.value.uiAmount);
  } catch (error) {
    // Account doesn't exist or other error
  }
  
  console.log('\n=== Current Balances ===');
  console.log(`SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
  console.log(`YOT Balance: ${yotBalance} YOT`);
  console.log(`YOS Balance: ${yosBalance} YOS`);
}

// Main test function
async function main() {
  // Load wallet
  const wallet = loadWalletFromFile();
  
  // Print initial balances
  await printBalances(wallet);
  
  // Get the expected PDA address for reference
  const [liquidityContributionPda] = findLiquidityContributionAddress(
    wallet.publicKey,
    MULTI_HUB_SWAP_PROGRAM_ID
  );
  console.log(`Expected PDA for liquidity contribution: ${liquidityContributionPda.toString()}`);
  
  // Check if PDA already exists
  const pdaInfo = await connection.getAccountInfo(liquidityContributionPda);
  if (pdaInfo) {
    console.log(`PDA already exists with size ${pdaInfo.data.length} bytes`);
    console.log(`PDA owner: ${pdaInfo.owner.toString()}`);
    console.log('Using existing PDA account');
    
    // TODO: Implement full-swap operation with the existing PDA account
    console.log('Skipping further tests, as account already exists');
    return;
  }
  
  console.log('\n=== Starting liquidity contribution account test ===');
  
  // Create a standard account
  console.log('\n--- PHASE 1: Create Standard Account ---');
  const standardAccount = await createStandardAccount(wallet);
  
  // Try to initialize the account as a liquidity contribution account
  console.log('\n--- PHASE 2: Try to Initialize the Account ---');
  const initSuccess = await initializeLiquidityAccount(wallet, standardAccount, liquidityContributionPda);
  
  if (!initSuccess) {
    console.log('Initialization through dedicated instruction failed, trying minimal contribution...');
    
    // If initialization instruction failed, try to create a minimal contribution
    const swapSuccess = await tryCreateContribution(wallet, standardAccount);
    
    if (!swapSuccess) {
      console.log('❌ Both initialization methods failed');
    }
  }
  
  // Get the account info to see if it has been properly initialized
  console.log('\n--- PHASE 3: Check Account State ---');
  const accountInfo = await connection.getAccountInfo(standardAccount.publicKey);
  if (!accountInfo) {
    console.error('Account no longer exists!');
  } else {
    console.log(`Account data size: ${accountInfo.data.length} bytes`);
    console.log(`Account owner: ${accountInfo.owner.toString()}`);
    console.log(`Account data (first 32 bytes): ${Buffer.from(accountInfo.data.slice(0, 32)).toString('hex')}`);
  }
  
  // Print final balances
  await printBalances(wallet);
}

// Run the test
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });