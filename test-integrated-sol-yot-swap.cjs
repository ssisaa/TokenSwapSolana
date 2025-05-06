/**
 * Test script for on-chain SOL to YOT swap with automatic liquidity contribution account creation
 * This script tests the updated approach where we let the swap instruction handle account creation
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

// Create SOL to YOT swap instruction
function createSolToYotSwapInstruction(
  userWallet,
  amountInLamports,
  minAmountOutTokens,
  programId,
  programStateAddress,
  programAuthority,
  solPoolAccount,
  yotPoolAccount,
  userYotAccount,
  liquidityContributionAccount,
  yosMint,
  userYosAccount
) {
  // Instruction data: [7 (SOL-YOT Swap), amountIn (8 bytes), minAmountOut (8 bytes)]
  const data = Buffer.alloc(17);
  data.writeUint8(7, 0); // SOL-YOT Swap instruction (index 7)
  data.writeBigUInt64LE(BigInt(amountInLamports), 1);
  data.writeBigUInt64LE(BigInt(minAmountOutTokens), 9);
  
  // Required accounts for the SOL to YOT swap
  const accounts = [
    { pubkey: userWallet, isSigner: true, isWritable: true },
    { pubkey: programStateAddress, isSigner: false, isWritable: false },
    { pubkey: programAuthority, isSigner: false, isWritable: false },
    { pubkey: solPoolAccount, isSigner: false, isWritable: true },
    { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
    { pubkey: userYotAccount, isSigner: false, isWritable: true },
    { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true },
    { pubkey: yosMint, isSigner: false, isWritable: true },
    { pubkey: userYosAccount, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId,
    keys: accounts,
    data,
  });
}

// Helper function to ensure token account exists
async function ensureTokenAccount(wallet, connection, mint) {
  try {
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mint,
      wallet.publicKey
    );
    
    // Check if account exists
    try {
      await getAccount(connection, associatedTokenAddress);
      console.log(`Token account exists: ${associatedTokenAddress.toString()}`);
      return {
        exists: true,
        address: associatedTokenAddress
      };
    } catch (error) {
      // Need to create token account
      console.log(`Token account doesn't exist for mint ${mint.toString()}, creating...`);
      
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

// Main function to test SOL to YOT swap
async function solToYotSwap(wallet, solAmount) {
  try {
    // Get configuration from app.config.json
    const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
    const connection = new Connection(appConfig.solana.rpcUrl, 'confirmed');
    const programId = new PublicKey(appConfig.solana.multiHubSwap.programId);
    const solPoolAccount = new PublicKey(appConfig.solana.pool.solAccount);
    const poolAuthority = new PublicKey(appConfig.solana.pool.authority);
    const yotMint = new PublicKey(appConfig.solana.tokens.yot.address);
    const yosMint = new PublicKey(appConfig.solana.tokens.yos.address);
    
    console.log(`\n=== Starting SOL to YOT swap (${solAmount} SOL) ===\n`);
    console.log('Using the updated approach with program-handled account creation');
    
    // Convert SOL to lamports
    const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    
    // Get PDAs
    const [programStateAddress] = findProgramStateAddress(programId);
    const [programAuthority] = findProgramAuthority(programId);
    const [liquidityContributionAccount] = findLiquidityContributionAddress(wallet.publicKey, programId);
    
    console.log(`Program ID: ${programId.toString()}`);
    console.log(`Program State: ${programStateAddress.toString()}`);
    console.log(`Program Authority: ${programAuthority.toString()}`);
    console.log(`Liquidity Contribution Account: ${liquidityContributionAccount.toString()}`);
    
    // Check if liquidity contribution account exists
    const liquidityAccountInfo = await connection.getAccountInfo(liquidityContributionAccount);
    console.log(`Liquidity contribution account exists: ${!!liquidityAccountInfo}`);
    
    // Ensure YOT token account exists
    const yotAccountResult = await ensureTokenAccount(wallet, connection, yotMint);
    const userYotAccount = yotAccountResult.address;
    
    // Ensure YOS token account exists
    const yosAccountResult = await ensureTokenAccount(wallet, connection, yosMint);
    const userYosAccount = yosAccountResult.address;
    
    // Get the pool's YOT token account
    const yotPoolAccount = await getAssociatedTokenAddress(
      yotMint,
      poolAuthority
    );
    console.log(`YOT Pool Account: ${yotPoolAccount.toString()}`);
    
    // Create swap instruction
    const swapInstruction = createSolToYotSwapInstruction(
      wallet.publicKey,
      amountInLamports,
      0, // Min amount out (0 for testing, in production use a proper slippage)
      programId,
      programStateAddress,
      programAuthority,
      solPoolAccount,
      yotPoolAccount,
      userYotAccount,
      liquidityContributionAccount,
      yosMint,
      userYosAccount
    );
    
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
    console.log('Signing and sending transaction...');
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    console.log(`Transaction sent: ${signature}`);
    console.log('Waiting for confirmation...');
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature);
    
    if (confirmation.value.err) {
      console.error('Transaction failed:', confirmation.value.err);
      return {
        success: false,
        signature,
        error: JSON.stringify(confirmation.value.err)
      };
    }
    
    console.log('Transaction confirmed successfully!');
    return {
      success: true,
      signature
    };
  } catch (error) {
    console.error('Error in SOL to YOT swap:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Main test function
async function main() {
  // Load configuration
  const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
  const connection = new Connection(appConfig.solana.rpcUrl, 'confirmed');
  
  // Load wallet
  const wallet = loadWalletFromFile();
  console.log(`Using wallet: ${wallet.publicKey.toString()}`);
  
  // Check initial balances
  await checkBalances(wallet, connection);
  await checkPoolBalances(connection);
  
  // Amount to swap (0.1 SOL)
  const solAmount = 0.1;
  
  // Perform swap
  const result = await solToYotSwap(wallet, solAmount);
  
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