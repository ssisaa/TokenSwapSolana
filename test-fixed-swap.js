import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';

// Utility function to load wallet from file
function loadWalletFromFile() {
  try {
    const keypairData = JSON.parse(fs.readFileSync('./program-keypair.json', 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    console.error('Error loading wallet:', error);
    throw error;
  }
}

// Find program state account - uses the same seed derivation as the Rust program
function findProgramStateAddress(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    programId
  );
}

// Find liquidity contribution account for a user's wallet
function findLiquidityContributionAddress(userWallet, programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.publicKey.toBuffer()],
    programId
  );
}

// Find program authority
function findProgramAuthority(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    programId
  );
}

// Encode a 64-bit unsigned integer in little-endian format
function encodeU64(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

/**
 * Main test function for buyAndDistribute
 */
async function testSwap() {
  // Setup connection to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load test wallet
  const wallet = loadWalletFromFile();
  console.log('Using wallet address:', wallet.publicKey.toString());
  
  // Program ID (use your actual program ID)
  const programId = new PublicKey('SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE');
  
  // Find program state and authority
  const [programStateAddress, _bump1] = findProgramStateAddress(programId);
  const [programAuthority, _bump2] = findProgramAuthority(programId);
  
  console.log('Program State:', programStateAddress.toString());
  console.log('Program Authority:', programAuthority.toString());
  
  // Token mints
  const yotMint = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
  const yosMint = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');
  
  // Get token accounts
  const userYotAccount = new PublicKey('BtHDQ6QwAffeeGftkNQK8X22n7HfnX3dud5vVsPZdqzE');
  const userYosAccount = new PublicKey('BLz2mfhb9qoPAtKuFNVfrj9uTEyChHKKbZsniS1eRaUB');
  const vaultYotAccount = new PublicKey('7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS');
  const liquidityYotAccount = vaultYotAccount; // Often the same in test setup
  
  // Find liquidity contribution account for user
  const [liquidityContributionAccount, _] = findLiquidityContributionAddress(wallet, programId);
  console.log('Liquidity Contribution Account:', liquidityContributionAccount.toString());
  
  // Check balance before swap
  try {
    const accountInfo = await connection.getTokenAccountBalance(userYotAccount);
    console.log('Pre-swap YOT balance:', accountInfo.value.uiAmount);
  } catch (error) {
    console.error('Failed to get token balance:', error);
  }
  
  // Create and send transaction using the buyAndDistribute instruction
  try {
    console.log('Preparing swap transaction...');
    
    // Amount to swap (in raw units)
    const amount = 1_000_000; // 0.001 tokens with 6 decimals
    
    // Create instruction data
    // 4 = buy_and_distribute instruction code
    const instructionData = Buffer.concat([
      Buffer.from([4]), // Instruction code for buy_and_distribute
      encodeU64(amount)
    ]);
    
    console.log('Instruction data created');
    
    // Build transaction
    const transaction = new Transaction().add({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: vaultYotAccount, isSigner: false, isWritable: true },
        { pubkey: userYotAccount, isSigner: false, isWritable: true },
        { pubkey: liquidityYotAccount, isSigner: false, isWritable: true },
        { pubkey: yosMint, isSigner: false, isWritable: true },
        { pubkey: userYosAccount, isSigner: false, isWritable: true },
        { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // System program
        { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // Rent sysvar
        { pubkey: programStateAddress, isSigner: false, isWritable: false },
        { pubkey: programAuthority, isSigner: false, isWritable: false },
      ],
      programId,
      data: instructionData
    });
    
    console.log('Transaction built, sending...');
    
    // Sign and send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: 'confirmed' }
    );
    
    console.log('🎉 Transaction successful!');
    console.log('Signature:', signature);
    console.log('View transaction: https://explorer.solana.com/tx/' + signature + '?cluster=devnet');
    
    // Check balance after swap
    try {
      const accountInfo = await connection.getTokenAccountBalance(userYotAccount);
      console.log('Post-swap YOT balance:', accountInfo.value.uiAmount);
    } catch (error) {
      console.error('Failed to get token balance:', error);
    }
    
  } catch (error) {
    console.error('Error in swap transaction:', error);
    if (error.logs) {
      console.error('Transaction logs:');
      error.logs.forEach((log, i) => console.error(`${i}: ${log}`));
    }
  }
}

// Run the test
testSwap().then(() => {
  console.log('Test completed');
}).catch(err => {
  console.error('Test failed:', err);
});

// Add exports for ES modules
export { testSwap };