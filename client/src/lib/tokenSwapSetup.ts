import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram
} from '@solana/web3.js';
import {
  AccountLayout,
  createMint,
  createAccount,
  getMint,
  getAccount,
  mintTo,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TokenAccountNotFoundError,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { ENDPOINT, POOL_AUTHORITY } from './constants';

// For testing purposes, we'll use a locally generated keypair for devnet transactions
// In production, this would be maintained securely
export let poolAuthorityKeypair: Keypair | null = null;

// Create a connection to the Solana cluster
export const connection = new Connection(ENDPOINT, 'confirmed');

// This function will initialize a test token-swap pool for development
export async function initializeDevSwapPool() {
  // Check if we already have a pool authority keypair
  if (!poolAuthorityKeypair) {
    // For test purposes, we'll create a new keypair
    // In production, this would be a securely stored keypair
    poolAuthorityKeypair = Keypair.generate();
    console.log('Generated new pool authority keypair for testing');
    console.log('Public key:', poolAuthorityKeypair.publicKey.toString());
  }

  // Fund the pool authority with SOL (needed for creating accounts)
  // This step requires the user's connected wallet to send a small amount of SOL
  // We'll implement this in a separate function that user can trigger
  
  console.log('Token swap test pool initialized successfully');
  return poolAuthorityKeypair.publicKey;
}

// Function to fund the pool authority (for testing only)
export async function fundPoolAuthority(
  userWallet: any, // Wallet adapter
  amount: number = 0.1 // Small amount of SOL for account creation fees
) {
  if (!poolAuthorityKeypair) {
    await initializeDevSwapPool();
  }

  if (!userWallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  // Create transaction to send SOL to the pool authority
  const transaction = new Transaction({
    feePayer: userWallet.publicKey,
    blockhash,
    lastValidBlockHeight
  });

  // Add instruction to transfer SOL
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: userWallet.publicKey,
      toPubkey: poolAuthorityKeypair!.publicKey,
      lamports: amount * 1000000000 // convert to lamports
    })
  );

  // Send transaction
  const signature = await userWallet.sendTransaction(transaction, connection);
  console.log('Funded pool authority with SOL, signature:', signature);

  return signature;
}

// Function to create a testing token account with the pool authority
export async function createPoolTokenAccounts(
  tokenMintAddress: string
) {
  if (!poolAuthorityKeypair) {
    throw new Error('Pool authority not initialized');
  }

  const tokenMint = new PublicKey(tokenMintAddress);
  
  // Get associated token account for pool authority
  const tokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    poolAuthorityKeypair.publicKey
  );

  // Check if account already exists
  try {
    await getAccount(connection, tokenAccount);
    console.log('Pool token account already exists:', tokenAccount.toString());
    return tokenAccount;
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      // Create the token account
      const transaction = new Transaction();
      
      transaction.add(
        createAssociatedTokenAccountInstruction(
          poolAuthorityKeypair.publicKey, // payer
          tokenAccount, // associated token account
          poolAuthorityKeypair.publicKey, // owner
          tokenMint // mint
        )
      );

      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction, 
        [poolAuthorityKeypair]
      );

      console.log('Created pool token account:', tokenAccount.toString());
      console.log('Signature:', signature);
      
      return tokenAccount;
    }
    throw error;
  }
}

// Function to execute a token swap with the pool authority signing
// This mimics what a token-swap program would do but for testing purposes
export async function executeSwapWithAuth(
  userWallet: any, // User's wallet for sending tokens TO pool
  fromTokenAddress: string, // Token being sent TO pool
  toTokenAddress: string, // Token being received FROM pool
  fromAmount: number, // Amount of tokens being sent
  toAmount: number, // Amount of tokens to receive
  isSOL: boolean = false // Whether the fromToken is SOL
) {
  if (!poolAuthorityKeypair) {
    throw new Error('Pool authority not initialized');
  }

  if (!userWallet.publicKey) {
    throw new Error('Wallet not connected');
  }
  
  // Will be implemented in the next update
  // This function will handle both sides of the swap:
  // 1. User sends tokens to pool
  // 2. Pool sends tokens back to user
  
  return {
    signature: 'simulated_signature',
    fromAmount,
    toAmount,
    fromToken: isSOL ? 'SOL' : fromTokenAddress,
    toToken: isSOL ? toTokenAddress : 'SOL',
    fee: fromAmount * 0.003
  };
}