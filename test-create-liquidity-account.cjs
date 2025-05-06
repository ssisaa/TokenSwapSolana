// Test script for the create-account-first approach
// This script will attempt to:
// 1. Create the liquidity contribution account first with instruction #8
// 2. Then perform a SOL to YOT swap using instruction #7

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

// Find liquidity contribution account for a user
function findLiquidityContributionAddress(userWallet, programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.toBuffer()],
    programId
  );
}

// Encode a u64 number for program instruction
function encodeU64(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value), 0);
  return buffer;
}

// Ensure token account exists
async function ensureTokenAccount(wallet, mint) {
  try {
    const tokenAddress = await getAssociatedTokenAddress(
      mint,
      wallet.publicKey
    );
    
    try {
      // Check if the account exists
      await connection.getTokenAccountBalance(tokenAddress);
      console.log(`Token account exists: ${tokenAddress.toString()}`);
      return tokenAddress;
    } catch (error) {
      // Account doesn't exist, create it
      console.log(`Creating token account for mint ${mint.toString()}`);
      
      const ataInstruction = require('@solana/spl-token').createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        tokenAddress, // associatedToken
        wallet.publicKey, // owner
        mint // mint
      );
      
      const transaction = new Transaction().add(ataInstruction);
      transaction.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      
      const signature = await connection.sendTransaction(
        transaction,
        [wallet]
      );
      
      await connection.confirmTransaction(signature);
      console.log(`Token account created: ${tokenAddress.toString()}`);
      return tokenAddress;
    }
  } catch (error) {
    console.error('Error ensuring token account:', error);
    throw error;
  }
}

// Create transaction for instruction #8: CREATE_LIQUIDITY_ACCOUNT
async function createAccountTransaction(wallet, liquidityContributionAccount) {
  console.log('Creating account creation transaction');
  
  const [programStateAddress] = findProgramStateAddress(MULTI_HUB_SWAP_PROGRAM_ID);
  const [programAuthority] = findProgramAuthority(MULTI_HUB_SWAP_PROGRAM_ID);
  
  // Instruction data: [8 (CREATE_LIQUIDITY_ACCOUNT), 0, 0]
  const data = Buffer.alloc(17);
  data.writeUint8(8, 0); // Instruction #8 - CREATE_LIQUIDITY_ACCOUNT
  data.writeBigUInt64LE(BigInt(0), 1); // No SOL transfer needed
  data.writeBigUInt64LE(BigInt(0), 9); // No min amount needed
  
  // Accounts needed for account creation
  const accounts = [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: programStateAddress, isSigner: false, isWritable: false },
    { pubkey: programAuthority, isSigner: false, isWritable: false },
    { pubkey: POOL_SOL_ACCOUNT, isSigner: false, isWritable: true },
    { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
  
  const createIx = new TransactionInstruction({
    programId: MULTI_HUB_SWAP_PROGRAM_ID,
    keys: accounts,
    data
  });
  
  // Create transaction with compute budget
  const transaction = new Transaction();
  
  const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400000
  });
  
  transaction.add(computeUnits);
  transaction.add(createIx);
  
  // Set transaction properties
  transaction.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  return transaction;
}

// Create SOL to YOT swap transaction (instruction #7)
async function createSwapTransaction(wallet, solAmount, userYotAccount, userYosAccount, liquidityContributionAccount) {
  console.log(`Creating swap transaction for ${solAmount} SOL`);
  
  // Convert SOL to lamports
  const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  
  // Allow 0 min output during testing
  const minAmountOut = 0;
  
  // Get PDAs for the transaction
  const [programStateAddress] = findProgramStateAddress(MULTI_HUB_SWAP_PROGRAM_ID);
  const [programAuthority] = findProgramAuthority(MULTI_HUB_SWAP_PROGRAM_ID);
  
  // Get YOT pool token account
  const yotPoolAccount = await getAssociatedTokenAddress(
    YOT_TOKEN_ADDRESS,
    POOL_AUTHORITY
  );
  
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
    { pubkey: POOL_SOL_ACCOUNT, isSigner: false, isWritable: true },
    { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
    { pubkey: userYotAccount, isSigner: false, isWritable: true },
    { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true },
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
  
  return transaction;
}

// Print balances
async function printBalances(wallet, liquidityContributionAccount) {
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
  
  // Check if liquidity contribution account exists
  const accountInfo = await connection.getAccountInfo(liquidityContributionAccount);
  if (accountInfo) {
    console.log(`Liquidity contribution account exists: ${liquidityContributionAccount.toString()}`);
    console.log(`Account data size: ${accountInfo.data.length} bytes`);
  } else {
    console.log(`Liquidity contribution account does not exist: ${liquidityContributionAccount.toString()}`);
  }
}

// Get pool balances
async function getPoolBalances() {
  // Get SOL balance from pool SOL account
  const solBalance = await connection.getBalance(POOL_SOL_ACCOUNT);
  const solBalanceNormalized = solBalance / LAMPORTS_PER_SOL;
  
  // Get YOT balance from pool YOT account
  const yotPoolAccount = await getAssociatedTokenAddress(
    YOT_TOKEN_ADDRESS,
    POOL_AUTHORITY
  );
  
  let yotBalance = 0;
  try {
    const accountInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    yotBalance = Number(accountInfo.value.uiAmount);
  } catch (error) {
    console.error('Error getting YOT pool balance:', error);
  }
  
  console.log('\n=== Pool Balances ===');
  console.log(`SOL Pool Balance: ${solBalanceNormalized} SOL`);
  console.log(`YOT Pool Balance: ${yotBalance} YOT`);
}

// Main test function
async function main() {
  // Load wallet
  const wallet = loadWalletFromFile();
  
  // Get liquidity contribution account address
  const [liquidityContributionAccount] = findLiquidityContributionAddress(
    wallet.publicKey,
    MULTI_HUB_SWAP_PROGRAM_ID
  );
  
  // Print initial balances
  await printBalances(wallet, liquidityContributionAccount);
  await getPoolBalances();
  
  // Amount to swap
  const solAmount = 0.05; // SOL
  
  console.log(`\n=== Starting SOL to YOT swap (${solAmount} SOL) with create-account-first approach ===\n`);
  
  // Ensure token accounts exist
  console.log('Ensuring YOT and YOS token accounts exist...');
  const userYotAccount = await ensureTokenAccount(wallet, YOT_TOKEN_ADDRESS);
  const userYosAccount = await ensureTokenAccount(wallet, YOS_TOKEN_ADDRESS);
  
  // Check if liquidity contribution account already exists
  const accountInfo = await connection.getAccountInfo(liquidityContributionAccount);
  const accountExists = accountInfo !== null;
  console.log(`Liquidity contribution account address: ${liquidityContributionAccount.toString()}`);
  console.log(`Liquidity contribution account exists: ${accountExists}`);
  
  // If account doesn't exist, create it first
  if (!accountExists) {
    console.log('\n--- PHASE 1: Create Liquidity Contribution Account ---');
    console.log('Creating liquidity contribution account first...');
    
    try {
      const createAccountTx = await createAccountTransaction(
        wallet,
        liquidityContributionAccount
      );
      
      console.log('Sending account creation transaction...');
      const createSignature = await connection.sendTransaction(
        createAccountTx,
        [wallet]
      );
      
      console.log(`Account creation transaction sent: ${createSignature}`);
      console.log('Waiting for confirmation...');
      
      const confirmation = await connection.confirmTransaction(createSignature);
      
      if (confirmation.value.err) {
        console.error('Account creation failed:', confirmation.value.err);
        console.log('Aborting swap process');
        await printBalances(wallet, liquidityContributionAccount);
        return;
      }
      
      console.log('Account creation transaction confirmed!');
      console.log('Waiting 2 seconds before checking account...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if account was actually created
      const newAccountInfo = await connection.getAccountInfo(liquidityContributionAccount);
      if (!newAccountInfo) {
        console.error('❌ Liquidity account still does not exist after creation transaction');
        console.log('Aborting swap process');
        await printBalances(wallet, liquidityContributionAccount);
        return;
      }
      
      console.log(`✅ Account created successfully! Size: ${newAccountInfo.data.length} bytes`);
    } catch (error) {
      console.error('Error during account creation:', error);
      console.log('Aborting swap process');
      await printBalances(wallet, liquidityContributionAccount);
      return;
    }
  } else {
    console.log('Liquidity contribution account already exists, skipping creation step');
  }
  
  // Now perform the swap
  console.log('\n--- PHASE 2: Perform SOL to YOT Swap ---');
  console.log(`Creating swap transaction for ${solAmount} SOL...`);
  
  try {
    const swapTransaction = await createSwapTransaction(
      wallet,
      solAmount,
      userYotAccount,
      userYosAccount,
      liquidityContributionAccount
    );
    
    console.log('Sending swap transaction...');
    const swapSignature = await connection.sendTransaction(
      swapTransaction,
      [wallet]
    );
    
    console.log(`Swap transaction sent: ${swapSignature}`);
    console.log('Waiting for confirmation...');
    
    const swapConfirmation = await connection.confirmTransaction(swapSignature);
    
    if (swapConfirmation.value.err) {
      console.error('❌ Swap failed:', swapConfirmation.value.err);
    } else {
      console.log(`✅ Swap succeeded! Transaction: ${swapSignature}`);
    }
  } catch (error) {
    console.error('Error during swap:', error);
  }
  
  // Print final balances
  await printBalances(wallet, liquidityContributionAccount);
  await getPoolBalances();
}

// Run the test
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });