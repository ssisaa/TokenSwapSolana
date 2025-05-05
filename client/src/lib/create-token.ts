import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  sendAndConfirmTransaction, 
  SystemProgram 
} from '@solana/web3.js';

import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  createSetAuthorityInstruction,
  AuthorityType,
  getMint
} from '@solana/spl-token';

import { getConfig } from './config';

/**
 * Creates a new token with specified parameters using the connected wallet
 * @param wallet The connected wallet (admin)
 * @param tokenName The name of the token
 * @param tokenSymbol The token symbol
 * @param tokenDecimals The number of decimals for the token
 * @param initialSupply The initial supply to mint
 * @returns Object with token addresses and transaction details
 */
export async function createNewToken(
  wallet: any,
  tokenName: string,
  tokenSymbol: string,
  tokenDecimals: number,
  initialSupply: number,
): Promise<{
  mintAddress: string;
  tokenAccount: string;
  signature: string;
}> {
  if (!wallet?.publicKey) {
    throw new Error('Wallet not connected');
  }

  try {
    const connection = new Connection(getConfig().rpcEndpoint, 'confirmed');
    
    // Create a new keypair for the token mint
    const mintKeypair = Keypair.generate();
    const mintAddress = mintKeypair.publicKey;
    
    console.log(`Creating new token mint: ${mintAddress.toBase58()}`);
    
    // Calculate the lamports needed for the mint account
    const lamports = await connection.getMinimumBalanceForRentExemption(82);
    
    // Create a transaction to create the mint
    const transaction = new Transaction();
    
    // Add instruction to create the mint account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintAddress,
        space: 82, // Size needed for a mint account
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
    );
    
    // Add instruction to initialize the mint
    transaction.add(
      createInitializeMintInstruction(
        mintAddress,
        tokenDecimals,
        wallet.publicKey,
        wallet.publicKey,
        TOKEN_PROGRAM_ID,
      ),
    );
    
    // Create an associated token account for the wallet
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mintAddress,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    
    console.log(`Creating associated token account: ${associatedTokenAddress.toBase58()}`);
    
    // Add instruction to create the associated token account
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        associatedTokenAddress,
        wallet.publicKey,
        mintAddress,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
    
    // Calculate the raw token amount with decimals
    const rawAmount = initialSupply * (10 ** tokenDecimals);
    
    // Add instruction to mint tokens to the token account
    transaction.add(
      createMintToInstruction(
        mintAddress,
        associatedTokenAddress,
        wallet.publicKey,
        BigInt(rawAmount),
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
    
    // Derive the program authority PDA
    const programId = new PublicKey(getConfig().programId);
    const [programAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority')],
      programId
    );
    
    console.log(`Program authority PDA: ${programAuthority.toBase58()}`);
    
    // Add instruction to set the program authority as the mint authority
    transaction.add(
      createSetAuthorityInstruction(
        mintAddress,
        wallet.publicKey,
        AuthorityType.MintTokens,
        programAuthority,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
    
    // Send and confirm the transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = blockhash;
    
    // Sign the transaction with both the wallet and the mint keypair
    const signedTransaction = await wallet.signTransaction(transaction);
    signedTransaction.sign(mintKeypair);
    
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log(`New token created with signature: ${signature}`);
    console.log(`Token Mint Address: ${mintAddress.toBase58()}`);
    console.log(`Token Account: ${associatedTokenAddress.toBase58()}`);
    
    return {
      mintAddress: mintAddress.toBase58(),
      tokenAccount: associatedTokenAddress.toBase58(),
      signature,
    };
  } catch (error) {
    console.error('Error creating new token:', error);
    throw new Error(`Failed to create token: ${error.message}`);
  }
}

/**
 * Verifies a token's mint authority is set correctly to the program authority
 * @param mintAddress The token mint address to check
 * @returns Boolean indicating if authority is set correctly and current authority info
 */
export async function verifyTokenMintAuthority(mintAddress: string): Promise<{
  isCorrect: boolean;
  currentAuthority: string | null;
  programAuthority: string;
}> {
  try {
    const connection = new Connection(getConfig().rpcEndpoint, 'confirmed');
    const mintPublicKey = new PublicKey(mintAddress);
    const programId = new PublicKey(getConfig().programId);
    
    // Derive the program authority PDA
    const [programAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority')],
      programId
    );
    
    // Get the mint info
    const mintInfo = await getMint(connection, mintPublicKey);
    
    // Check if the mint authority is set to the program authority
    const currentAuthority = mintInfo.mintAuthority ? 
      mintInfo.mintAuthority.toBase58() : null;
    
    const isCorrect = currentAuthority === programAuthority.toBase58();
    
    return {
      isCorrect,
      currentAuthority,
      programAuthority: programAuthority.toBase58(),
    };
  } catch (error) {
    console.error('Error verifying token mint authority:', error);
    return {
      isCorrect: false,
      currentAuthority: null,
      programAuthority: 'Error',
    };
  }
}