/**
 * Test script for the integrated on-chain SOL to YOT swap functionality
 * This uses the smart contract-based approach with the new instruction (#7)
 */

const { 
  Connection, 
  PublicKey, 
  Keypair, 
  LAMPORTS_PER_SOL 
} = require('@solana/web3.js');
const { 
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID
} = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');
const config = require('./app.config.json').solana;

// Constants from config
const YOT_TOKEN_ADDRESS = config.tokens.yot.address;
const YOS_TOKEN_ADDRESS = config.tokens.yos.address;
const MULTI_HUB_SWAP_PROGRAM_ID = config.multiHubSwap.programId;
const POOL_SOL_ACCOUNT = config.pool.solAccount;
const POOL_AUTHORITY = config.pool.authority;

// Setup connection
const connection = new Connection(config.rpcUrl, config.commitment);

// Load wallet from the test keypair
function loadWalletFromFile() {
  try {
    // Look for keypair in home directory for convenience
    const homeDir = require('os').homedir();
    const keypairPath = path.join(homeDir, '.config', 'solana', 'id.json');
    
    if (fs.existsSync(keypairPath)) {
      const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
      return Keypair.fromSecretKey(new Uint8Array(keypairData));
    } else {
      // Fallback to local keypair file if present
      const keypairData = JSON.parse(fs.readFileSync('.keypair-test.json', 'utf-8'));
      return Keypair.fromSecretKey(new Uint8Array(keypairData));
    }
  } catch (error) {
    console.error('Error loading wallet from keypair:', error);
    throw new Error('Failed to load wallet keypair. Please ensure .keypair-test.json exists');
  }
}

// Helper functions
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

// Function to check balances
async function checkBalances(wallet) {
  try {
    console.log('=== Checking Balances ===');
    
    // Check SOL balance
    const solBalance = await connection.getBalance(wallet.publicKey);
    console.log(`SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Check YOT balance
    try {
      const yotTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(YOT_TOKEN_ADDRESS),
        wallet.publicKey
      );
      
      try {
        const yotBalance = await connection.getTokenAccountBalance(yotTokenAccount);
        console.log(`YOT Balance: ${yotBalance.value.uiAmount} YOT`);
      } catch (error) {
        console.log('YOT token account does not exist yet');
      }
    } catch (error) {
      console.error('Error checking YOT balance:', error);
    }
    
    // Check YOS balance
    try {
      const yosTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(YOS_TOKEN_ADDRESS),
        wallet.publicKey
      );
      
      try {
        const yosBalance = await connection.getTokenAccountBalance(yosTokenAccount);
        console.log(`YOS Balance: ${yosBalance.value.uiAmount} YOS`);
      } catch (error) {
        console.log('YOS token account does not exist yet');
      }
    } catch (error) {
      console.error('Error checking YOS balance:', error);
    }
    
    console.log('=========================');
  } catch (error) {
    console.error('Error checking balances:', error);
  }
}

// Function to check pool balances
async function checkPoolBalances() {
  try {
    console.log('=== Checking Pool Balances ===');
    
    // Get SOL balance from pool SOL account
    const solPoolAccount = new PublicKey(POOL_SOL_ACCOUNT);
    const solBalance = await connection.getBalance(solPoolAccount);
    console.log(`Pool SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Get YOT balance from pool YOT account
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const poolAuthority = new PublicKey(POOL_AUTHORITY);
    const yotPoolAccount = await getAssociatedTokenAddress(
      yotMint,
      poolAuthority
    );
    
    try {
      const yotBalance = await connection.getTokenAccountBalance(yotPoolAccount);
      console.log(`Pool YOT Balance: ${yotBalance.value.uiAmount} YOT`);
    } catch (error) {
      console.error('Error checking pool YOT balance:', error);
    }
    
    // Calculate exchange rate
    const solBalanceNum = solBalance / LAMPORTS_PER_SOL;
    const yotBalanceValue = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotBalanceNum = yotBalanceValue.value.uiAmount;
    
    if (solBalanceNum > 0 && yotBalanceNum > 0) {
      const solToYotRate = yotBalanceNum / solBalanceNum;
      console.log(`Exchange Rate: 1 SOL = ${solToYotRate} YOT`);
    } else {
      console.log('Cannot calculate exchange rate: one or both balances are zero');
    }
    
    console.log('=============================');
  } catch (error) {
    console.error('Error checking pool balances:', error);
  }
}

// On-chain SOL to YOT swap implementation with instruction #7
async function solToYotSwap(wallet, solAmount) {
  try {
    console.log(`Starting on-chain SOL-YOT swap for ${solAmount} SOL...`);
    
    if (!wallet || !wallet.publicKey) {
      throw new Error('No wallet provided');
    }
    
    // Convert SOL to lamports
    const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    
    // Get program ID and other key accounts
    const programId = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    console.log('Using MULTI_HUB_SWAP_PROGRAM_ID:', MULTI_HUB_SWAP_PROGRAM_ID);
    console.log('Program ID:', programId.toString());
    
    const solPoolAccount = new PublicKey(POOL_SOL_ACCOUNT);
    const poolAuthority = new PublicKey(POOL_AUTHORITY);
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    
    // Get the pool's YOT token account (ATA owned by pool authority)
    const yotPoolAccount = await getAssociatedTokenAddress(
      yotMint,
      poolAuthority
    );
    
    // Ensure user has token accounts
    const userYotAccount = await getAssociatedTokenAddress(
      yotMint,
      wallet.publicKey
    );
    
    const userYosAccount = await getAssociatedTokenAddress(
      yosMint,
      wallet.publicKey
    );
    
    // Check if token accounts exist, create them if needed
    try {
      await connection.getTokenAccountBalance(userYotAccount);
      console.log('User YOT token account exists');
    } catch (error) {
      console.log('Creating YOT token account...');
      const createAtaIx = require('@solana/spl-token').createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userYotAccount,
        wallet.publicKey,
        yotMint
      );
      
      // Create and send transaction
      const createAtaTx = new (require('@solana/web3.js').Transaction)();
      createAtaTx.add(createAtaIx);
      
      const ataSig = await connection.sendTransaction(createAtaTx, [wallet]);
      console.log('Created YOT token account:', ataSig);
      await connection.confirmTransaction(ataSig);
    }
    
    try {
      await connection.getTokenAccountBalance(userYosAccount);
      console.log('User YOS token account exists');
    } catch (error) {
      console.log('Creating YOS token account...');
      const createYosAtaIx = require('@solana/spl-token').createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userYosAccount,
        wallet.publicKey,
        yosMint
      );
      
      // Create and send transaction
      const createYosAtaTx = new (require('@solana/web3.js').Transaction)();
      createYosAtaTx.add(createYosAtaIx);
      
      const yosAtaSig = await connection.sendTransaction(createYosAtaTx, [wallet]);
      console.log('Created YOS token account:', yosAtaSig);
      await connection.confirmTransaction(yosAtaSig);
    }
    
    // Get program-derived addresses
    const [programStateAddress] = findProgramStateAddress(programId);
    const [programAuthority] = findProgramAuthority(programId);
    const [liquidityContributionAccount] = findLiquidityContributionAddress(
      wallet.publicKey,
      programId
    );
    
    // Log PDA addresses
    console.log('Generated PDAs from seeds:');
    console.log('Program State Address:', programStateAddress.toString());
    console.log('Program Authority:', programAuthority.toString());
    console.log('Liquidity Contribution Account:', liquidityContributionAccount.toString());
    
    // Compare with config values
    console.log('Config Values:');
    console.log('Config Program State:', config.multiHubSwap.programState);
    console.log('Config Program Authority:', config.multiHubSwap.programAuthority);
    
    // Calculate exchange rate for expected output
    const poolYotBalance = await connection.getTokenAccountBalance(yotPoolAccount);
    const poolYotAmount = Number(poolYotBalance.value.uiAmount);
    
    const poolSolBalance = await connection.getBalance(solPoolAccount);
    const poolSolAmount = poolSolBalance / LAMPORTS_PER_SOL;
    
    // Calculate expected YOT output (simple AMM formula)
    const expectedOutput = (solAmount * poolYotAmount) / (poolSolAmount + solAmount);
    console.log(`Expected YOT output: ${expectedOutput}`);
    
    // Apply 1% slippage tolerance
    const minAmountOut = Math.floor(
      expectedOutput * 0.99 * Math.pow(10, 9) // Convert to token units with 9 decimals
    );
    
    console.log(`Min YOT output with slippage: ${minAmountOut / Math.pow(10, 9)}`);
    
    // Create the swap instruction
    // Instruction data: [7 (SOL-to-YOT Swap), amountIn (8 bytes), minAmountOut (8 bytes)]
    // We are trying with instruction index 7 which matches the Rust code for sol-to-yot swap
    const data = Buffer.alloc(17);
    data.writeUint8(7, 0); // SOL-to-YOT Swap instruction (index 7)
    data.writeBigUInt64LE(BigInt(amountInLamports), 1);
    data.writeBigUInt64LE(BigInt(minAmountOut), 9);
    
    // Required accounts for the SOL to YOT swap
    // This uses the SOL-to-YOT swap specific account order from process_sol_to_yot_swap
    // Adjust isWritable flags based on the program's expectations
    const accounts = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },                            // user wallet
      { pubkey: programStateAddress, isSigner: false, isWritable: true },                        // program state (writable)
      { pubkey: programAuthority, isSigner: false, isWritable: false },                          // program authority (PDA)
      { pubkey: solPoolAccount, isSigner: false, isWritable: true },                             // SOL pool account
      { pubkey: yotPoolAccount, isSigner: false, isWritable: true },                             // YOT pool account
      { pubkey: userYotAccount, isSigner: false, isWritable: true },                             // user's YOT token account
      { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true },               // user's liquidity contribution account
      { pubkey: yosMint, isSigner: false, isWritable: true },                                    // YOS mint
      { pubkey: userYosAccount, isSigner: false, isWritable: true },                             // user's YOS token account
      { pubkey: require('@solana/web3.js').SystemProgram.programId, isSigner: false, isWritable: false }, // system program
      { pubkey: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), isSigner: false, isWritable: false }, // token program
      { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }, // rent sysvar
    ];
    
    // Log all account public keys for debugging
    console.log('Transaction accounts:');
    accounts.forEach((account, index) => {
      console.log(`Account ${index}: ${account.pubkey.toString()}`);
    });
    
    const swapInstruction = new (require('@solana/web3.js').TransactionInstruction)({
      programId,
      keys: accounts,
      data,
    });
    
    // Create transaction
    const transaction = new (require('@solana/web3.js').Transaction)();
    
    // Add compute budget instructions
    const ComputeBudgetProgram = require('@solana/web3.js').ComputeBudgetProgram;
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 1000000 // High value for complex operations
      })
    );
    
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1_000_000 // Higher priority fee
      })
    );
    
    transaction.add(swapInstruction);
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Sign and send transaction
    console.log('Sending transaction...');
    const signature = await connection.sendTransaction(
      transaction,
      [wallet]
    );
    
    console.log('Transaction sent with signature:', signature);
    console.log(`Explorer URL: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    const confirmation = await connection.confirmTransaction(signature);
    
    if (confirmation.value.err) {
      console.error('Transaction failed:', confirmation.value.err);
      console.log('Getting detailed logs...');
      
      try {
        // Get full transaction details
        const tx = await connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        });
        
        if (tx?.meta?.logMessages) {
          console.log('Transaction logs:');
          tx.meta.logMessages.forEach((log, i) => {
            console.log(`${i}: ${log}`);
          });
        }
      } catch (error) {
        console.error('Error fetching transaction details:', error);
      }
      
      throw new Error('Transaction failed');
    }
    
    console.log('Transaction confirmed successfully!');
    return signature;
  } catch (error) {
    console.error('Error in SOL to YOT swap:', error);
    throw error;
  }
}

async function main() {
  try {
    const wallet = loadWalletFromFile();
    console.log(`Using wallet: ${wallet.publicKey.toString()}`);
    
    // Check initial balances
    await checkBalances(wallet);
    await checkPoolBalances();
    
    // Amount of SOL to swap
    const solAmount = 0.03; // Swap 0.03 SOL
    
    // Perform the swap
    try {
      const signature = await solToYotSwap(wallet, solAmount);
      console.log('✅ Swap completed successfully!');
    } catch (error) {
      console.error('❌ Swap failed:', error);
    }
    
    // Check balances after swap
    console.log('\nBalances after swap:');
    await checkBalances(wallet);
    await checkPoolBalances();
    
  } catch (error) {
    console.error('Error in main:', error);
  }
}

// Run the main function
main().then(() => {
  console.log('Test script completed');
}).catch(err => {
  console.error('Fatal error:', err);
});