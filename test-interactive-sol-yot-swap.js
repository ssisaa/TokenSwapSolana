const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount, TokenAccountNotFoundError } = require('@solana/spl-token');
const fs = require('fs');
const readline = require('readline');

// Load app config
const appConfig = JSON.parse(fs.readFileSync('./app.config.json', 'utf8'));
const { solana: solanaConfig } = appConfig;

// Constants
const YOT_TOKEN_ADDRESS = solanaConfig.tokens.yot;
const ENDPOINT = solanaConfig.endpoints.devnet;
const POOL_AUTHORITY = solanaConfig.pool.authority;
const POOL_SOL_ACCOUNT = solanaConfig.pool.solAccount;
const YOT_TOKEN_ACCOUNT = solanaConfig.pool.yotAccount;
const PROGRAM_ID = solanaConfig.multiHubSwap.programId;

// Create connection to devnet
const connection = new Connection(ENDPOINT, 'confirmed');

// Interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Load wallet from file for testing
function loadWalletFromFile() {
  try {
    // Path to your keypair file (this should be a testing wallet with some SOL)
    const keypairFile = '.keypair-test.json'; // Create this file or replace with your file path
    
    if (!fs.existsSync(keypairFile)) {
      console.log('Keypair file not found. You need to create a test wallet first.');
      console.log('Run: solana-keygen new --outfile .keypair-test.json');
      process.exit(1);
    }
    
    const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(keypairFile, 'utf8')));
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error('Error loading wallet:', error);
    process.exit(1);
  }
}

async function checkBalances(wallet) {
  try {
    // Check SOL balance
    const solBalance = await connection.getBalance(wallet.publicKey);
    console.log(`SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Check YOT balance
    try {
      const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
      const tokenAddress = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
      
      try {
        const tokenAccount = await connection.getTokenAccountBalance(tokenAddress);
        console.log(`YOT Balance: ${tokenAccount.value.uiAmount} YOT`);
        return { sol: solBalance / LAMPORTS_PER_SOL, yot: tokenAccount.value.uiAmount };
      } catch (err) {
        console.log('YOT token account does not exist yet.');
        return { sol: solBalance / LAMPORTS_PER_SOL, yot: 0 };
      }
    } catch (err) {
      console.error('Error checking YOT balance:', err);
      return { sol: solBalance / LAMPORTS_PER_SOL, yot: 0 };
    }
  } catch (err) {
    console.error('Error checking balances:', err);
    return { sol: 0, yot: 0 };
  }
}

// Check if the token account exists, if not, create it
async function createTokenAccountIfNeeded(wallet) {
  const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
  const yotTokenAddress = await getAssociatedTokenAddress(yotMint, wallet.publicKey);
  
  try {
    await getAccount(connection, yotTokenAddress);
    console.log('YOT token account already exists');
    return yotTokenAddress;
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      console.log('Creating YOT token account...');
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey, // payer
          yotTokenAddress, // associated token address
          wallet.publicKey, // owner
          yotMint // mint
        )
      );
      
      const signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);
      console.log('Token account created:', signature);
      return yotTokenAddress;
    }
    throw error;
  }
}

// Test pool balances
async function checkPoolBalances() {
  try {
    // Get pool's SOL balance
    const poolSolAccount = new PublicKey(POOL_SOL_ACCOUNT);
    const solBalance = await connection.getBalance(poolSolAccount);
    console.log(`Pool SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Get pool's YOT balance
    try {
      const yotPoolAccount = new PublicKey(YOT_TOKEN_ACCOUNT);
      
      try {
        const tokenAccount = await connection.getTokenAccountBalance(yotPoolAccount);
        console.log(`Pool YOT Balance: ${tokenAccount.value.uiAmount} YOT`);
        return { sol: solBalance / LAMPORTS_PER_SOL, yot: tokenAccount.value.uiAmount };
      } catch (err) {
        console.log('Pool YOT token account not found or empty.');
        return { sol: solBalance / LAMPORTS_PER_SOL, yot: 0 };
      }
    } catch (err) {
      console.error('Error checking pool YOT balance:', err);
      return { sol: solBalance / LAMPORTS_PER_SOL, yot: 0 };
    }
  } catch (err) {
    console.error('Error checking pool balances:', err);
    return { sol: 0, yot: 0 };
  }
}

// Calculate SOL to YOT swap rate based on pool balances
async function calculateSwapRate() {
  const poolBalances = await checkPoolBalances();
  if (poolBalances.sol === 0 || poolBalances.yot === 0) {
    console.error('Cannot calculate swap rate: Pool has zero balance');
    return 0;
  }
  
  const rate = poolBalances.yot / poolBalances.sol;
  console.log(`Current exchange rate: 1 SOL = ${rate} YOT`);
  return rate;
}

// Execute SOL to YOT swap (Step 1: Send SOL to pool)
async function solToYotSwap(wallet, solAmount) {
  console.log(`Swapping ${solAmount} SOL to YOT...`);
  try {
    // First, create YOT token account if it doesn't exist
    await createTokenAccountIfNeeded(wallet);
    
    // Get pool SOL account
    const poolSolAccount = new PublicKey(POOL_SOL_ACCOUNT);
    
    // Calculate SOL amount in lamports
    const lamports = solAmount * LAMPORTS_PER_SOL;
    
    // Create transaction to send SOL to pool
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: poolSolAccount,
        lamports
      })
    );
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);
    console.log('SOL sent to pool successfully!');
    console.log('Transaction signature:', signature);
    console.log('View on explorer:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    console.log('\nNOTE: In a real smart contract implementation, the next step would be to send');
    console.log('YOT tokens back to the user, but that requires program authorization.');
    console.log('This test only demonstrates the first part of the swap (sending SOL to pool).');
    
    return signature;
  } catch (error) {
    console.error('Error executing swap:', error);
    throw error;
  }
}

// Prompt user for SOL amount to swap
function promptForSwap() {
  rl.question('\nEnter amount of SOL to swap (e.g., 0.1) or type "exit" to quit: ', async (answer) => {
    if (answer.toLowerCase() === 'exit') {
      rl.close();
      return;
    }
    
    const amount = parseFloat(answer);
    if (isNaN(amount) || amount <= 0) {
      console.log('Please enter a valid positive number.');
      promptForSwap();
      return;
    }
    
    try {
      // Load test wallet
      const wallet = loadWalletFromFile();
      
      // Check balances before swap
      console.log('\nBalances before swap:');
      const balancesBefore = await checkBalances(wallet);
      
      // Calculate swap rate
      const rate = await calculateSwapRate();
      console.log(`Expected YOT to receive: ~${amount * rate} YOT`);
      
      // Confirm swap
      rl.question(`\nConfirm swap of ${amount} SOL? (yes/no): `, async (confirmation) => {
        if (confirmation.toLowerCase() === 'yes') {
          try {
            // Execute swap
            await solToYotSwap(wallet, amount);
            
            // Check balances after swap
            console.log('\nBalances after swap:');
            const balancesAfter = await checkBalances(wallet);
            
            // Show difference
            console.log('\nBalance changes:');
            console.log(`SOL: ${balancesBefore.sol - balancesAfter.sol} SOL (sent to pool)`);
            console.log(`YOT: ${balancesAfter.yot - balancesBefore.yot} YOT (should have received from pool)`);
            
            // Check pool balances after swap
            console.log('\nPool balances after swap:');
            await checkPoolBalances();
            
            promptForSwap();
          } catch (error) {
            console.error('Swap failed:', error);
            promptForSwap();
          }
        } else {
          console.log('Swap cancelled.');
          promptForSwap();
        }
      });
    } catch (error) {
      console.error('Error:', error);
      promptForSwap();
    }
  });
}

// Run the main test
async function main() {
  console.log('SOL-YOT Swap Interactive Test');
  console.log('============================');
  console.log('Pool Authority:', POOL_AUTHORITY);
  console.log('Pool SOL Account:', POOL_SOL_ACCOUNT);
  console.log('Pool YOT Account:', YOT_TOKEN_ACCOUNT);
  console.log('YOT Token Address:', YOT_TOKEN_ADDRESS);
  console.log('Program ID:', PROGRAM_ID);
  console.log('============================');
  
  try {
    // Load test wallet
    const wallet = loadWalletFromFile();
    console.log('Test Wallet:', wallet.publicKey.toString());
    
    // Check wallet balances
    console.log('\nWallet Balances:');
    await checkBalances(wallet);
    
    // Check pool balances
    console.log('\nPool Balances:');
    await checkPoolBalances();
    
    // Calculate current exchange rate
    await calculateSwapRate();
    
    // Start interactive prompt
    promptForSwap();
  } catch (error) {
    console.error('Test setup failed:', error);
    rl.close();
  }
}

// Run the test
main();