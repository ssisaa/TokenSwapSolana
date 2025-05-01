import { 
  Keypair, 
  Connection, 
  PublicKey, 
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram
} from '@solana/web3.js';
import {
  createInitializeMintInstruction,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createMint,
  getMint,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createMintToInstruction
} from '@solana/spl-token';
import { TEST_TOKENS } from '@/lib/test-token-transfer';
import { ENDPOINT } from './constants';

// Token creation parameters
const TOKEN_DECIMALS = 9;
const INITIAL_SUPPLY = 1_000_000_000; // 1 billion tokens

/**
 * Creates test tokens on the Solana devnet
 * @param wallet The wallet to use for token creation (must be the admin wallet)
 * @returns Array of created token mint addresses
 */
export async function createTestTokens(wallet: any): Promise<string[]> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }
  
  console.log('Creating test tokens on Solana devnet...');
  
  const connection = new Connection(ENDPOINT);
  const createdTokens: string[] = [];
  
  // Create each test token
  for (const [symbol, address] of Object.entries(TEST_TOKENS)) {
    try {
      console.log(`Creating ${symbol} token...`);
      
      // Check if token mint already exists
      try {
        const mintInfo = await getMint(connection, new PublicKey(address));
        console.log(`${symbol} token already exists with address: ${address}`);
        createdTokens.push(address);
        continue;
      } catch (error) {
        console.log(`${symbol} token does not exist yet. Creating...`);
      }
      
      // Generate a new keypair for the token mint using the address as seed
      const mintKeypair = Keypair.generate();
      
      // Get rent for token mint
      const rentExemptMint = await getMinimumBalanceForRentExemptMint(connection);
      
      // Create transaction to create token mint
      const transaction = new Transaction().add(
        // Create mint account with admin as mint authority
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports: rentExemptMint,
          programId: TOKEN_PROGRAM_ID
        }),
        // Initialize mint
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          TOKEN_DECIMALS,
          wallet.publicKey,
          wallet.publicKey,
          TOKEN_PROGRAM_ID
        )
      );
      
      // Get associated token account for admin wallet
      const associatedTokenAccount = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        wallet.publicKey
      );
      
      // Add instruction to create associated token account
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          associatedTokenAccount,
          wallet.publicKey,
          mintKeypair.publicKey
        )
      );
      
      // Add instruction to mint initial supply to admin
      transaction.add(
        createMintToInstruction(
          mintKeypair.publicKey,
          associatedTokenAccount,
          wallet.publicKey,
          INITIAL_SUPPLY * (10 ** TOKEN_DECIMALS)
        )
      );
      
      // Send and confirm transaction
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = wallet.publicKey;
      
      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(signature);
      
      console.log(`Successfully created ${symbol} token with mint address: ${mintKeypair.publicKey.toString()}`);
      createdTokens.push(mintKeypair.publicKey.toString());
    } catch (error) {
      console.error(`Error creating ${symbol} token:`, error);
    }
  }
  
  return createdTokens;
}

/**
 * Check if test tokens exist on the blockchain
 * @returns Object with token existence status
 */
export async function checkTestTokensExist(): Promise<Record<string, boolean>> {
  const connection = new Connection(ENDPOINT);
  const tokenStatus: Record<string, boolean> = {};
  
  for (const [symbol, address] of Object.entries(TEST_TOKENS)) {
    try {
      await getMint(connection, new PublicKey(address));
      tokenStatus[symbol] = true;
    } catch (error) {
      tokenStatus[symbol] = false;
    }
  }
  
  return tokenStatus;
}
