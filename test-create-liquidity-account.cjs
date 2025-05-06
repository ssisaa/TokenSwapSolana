/**
 * Script to create a liquidity contribution account separately
 * This helps solve the "account already borrowed" error by creating the
 * liquidity contribution account in a separate transaction
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY, ComputeBudgetProgram, TransactionInstruction } = require('@solana/web3.js');
const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } = require('@solana/spl-token');
const fs = require('fs');

// Connect to Solana
const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';
const connection = new Connection(DEVNET_ENDPOINT, 'confirmed');

// Program and Token Constants (Must match what's in on-chain program)
const MULTI_HUB_SWAP_PROGRAM_ID = 'Js9TqdpLBsF7M64ra2mYNyfbPTWwTvBUNR85wsEoSKP';
const YOT_TOKEN_ADDRESS = '9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw';
const YOS_TOKEN_ADDRESS = '2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop';
const POOL_SOL_ACCOUNT = 'Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH';
const POOL_AUTHORITY = 'CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9';

// Load wallet from keypair file
function loadWalletFromFile() {
  // Use existing keypair for consistency in testing
  const keypairData = JSON.parse(fs.readFileSync('./program-keypair.json', 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// PDA Derivation Functions
function getProgramStatePda() {
  const [programState] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return programState;
}

function getProgramAuthorityPda() {
  const [programAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return programAuthority;
}

function getLiquidityContributionPda(userPublicKey) {
  const [liquidityContribution] = PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userPublicKey.toBuffer()],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  return liquidityContribution;
}

// Ensure token account exists
async function ensureTokenAccount(mint, owner) {
  try {
    // Get the associated token address
    const tokenAddress = await getAssociatedTokenAddress(
      new PublicKey(mint),
      owner
    );
    
    // Check if account exists
    try {
      const accountInfo = await connection.getAccountInfo(tokenAddress);
      if (accountInfo) {
        console.log(`Token account for ${mint} already exists`);
        return { address: tokenAddress, created: false };
      }
    } catch (error) {
      // Account doesn't exist or error occurred
    }
    
    // Create the account
    console.log(`Creating token account for ${mint}...`);
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        owner,
        tokenAddress,
        owner,
        new PublicKey(mint)
      )
    );
    
    transaction.feePayer = owner;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send the transaction
    const wallet = loadWalletFromFile();
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction(signature);
    
    console.log(`Created token account: ${signature}`);
    return { address: tokenAddress, created: true, signature };
  } catch (error) {
    console.error('Error ensuring token account:', error);
    throw error;
  }
}

// The main function to create a liquidity contribution account
async function createLiquidityContributionAccount() {
  try {
    console.log('==============================================');
    console.log('CREATING LIQUIDITY CONTRIBUTION ACCOUNT');
    console.log('==============================================');
    
    // Load the wallet
    const wallet = loadWalletFromFile();
    console.log(`Using wallet: ${wallet.publicKey.toString()}`);
    
    // Get all the necessary PDAs and accounts
    const programStateAddress = getProgramStatePda();
    const programAuthority = getProgramAuthorityPda();
    const liquidityContributionAddress = getLiquidityContributionPda(wallet.publicKey);
    
    console.log('Account Details:');
    console.log(`- Program State: ${programStateAddress.toString()}`);
    console.log(`- Program Authority: ${programAuthority.toString()}`);
    console.log(`- Liquidity Contribution: ${liquidityContributionAddress.toString()}`);
    
    // Check if account already exists
    const accountInfo = await connection.getAccountInfo(liquidityContributionAddress);
    if (accountInfo) {
      console.log('\nLiquidity contribution account already exists!');
      console.log(`Account Size: ${accountInfo.data.length} bytes`);
      console.log(`Owner: ${accountInfo.owner.toString()}`);
      return;
    }
    
    // Create YOT token account if needed
    console.log('\nEnsuring token accounts exist...');
    const { address: yotAccount } = await ensureTokenAccount(YOT_TOKEN_ADDRESS, wallet.publicKey);
    const { address: yosAccount } = await ensureTokenAccount(YOS_TOKEN_ADDRESS, wallet.publicKey);
    
    console.log(`YOT Account: ${yotAccount.toString()}`);
    console.log(`YOS Account: ${yosAccount.toString()}`);
    
    // Get the pool token accounts
    const yotPoolAccount = await getAssociatedTokenAddress(
      new PublicKey(YOT_TOKEN_ADDRESS),
      new PublicKey(POOL_AUTHORITY)
    );
    
    const yosPoolAccount = await getAssociatedTokenAddress(
      new PublicKey(YOS_TOKEN_ADDRESS),
      new PublicKey(POOL_AUTHORITY)
    );
    
    console.log('\nCreating liquidity contribution account transaction...');
    
    // Create instruction data for CreateLiquidityAccount (index 7)
    const data = Buffer.alloc(1);
    data.writeUint8(7, 0);
    
    // IMPORTANT: Use program authority as central liquidity wallet
    const centralLiquidityWallet = programAuthority;
    
    // Account list must match EXACTLY what the program expects
    const accountMetas = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAddress, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: liquidityContributionAddress, isSigner: false, isWritable: true },
      { pubkey: new PublicKey(POOL_SOL_ACCOUNT), isSigner: false, isWritable: false },
      { pubkey: yotPoolAccount, isSigner: false, isWritable: false },
      { pubkey: centralLiquidityWallet, isSigner: false, isWritable: false },
      { pubkey: yosPoolAccount, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(YOT_TOKEN_ADDRESS), isSigner: false, isWritable: false },
      { pubkey: yotAccount, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(YOS_TOKEN_ADDRESS), isSigner: false, isWritable: false },
      { pubkey: yosAccount, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    const instruction = new TransactionInstruction({
      programId: new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID),
      keys: accountMetas,
      data,
    });
    
    // Create transaction with compute budget
    const transaction = new Transaction();
    
    // Add compute budget instructions for more compute units
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000
    });
    
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000
    });
    
    transaction.add(computeUnits);
    transaction.add(priorityFee);
    transaction.add(instruction);
    
    // Set transaction properties
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send transaction
    transaction.sign(wallet);
    console.log('Sending transaction...');
    
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true
    });
    
    console.log(`Transaction sent: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation with timeout
    try {
      console.log('Waiting for confirmation...');
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('Transaction confirmed!');
      
      // Verify the account was created
      const newAccountInfo = await connection.getAccountInfo(liquidityContributionAddress);
      if (newAccountInfo) {
        console.log('\nSuccess! Liquidity contribution account created!');
        console.log(`Account Size: ${newAccountInfo.data.length} bytes`);
        console.log(`Owner: ${newAccountInfo.owner.toString()}`);
      } else {
        console.log('\nWarning: Transaction confirmed but account not found. It may still be processing.');
      }
    } catch (error) {
      console.warn(`Confirmation error: ${error.message}`);
      console.log('The transaction may still succeed. Check the explorer link above.');
    }
  } catch (error) {
    console.error('Error creating liquidity contribution account:', error);
  }
}

// Run the script
createLiquidityContributionAccount();