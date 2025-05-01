import { Connection, PublicKey, Transaction, Keypair, clusterApiUrl } from '@solana/web3.js';
import { 
  createAssociatedTokenAccountInstruction, 
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { TEST_TOKENS } from './test-token-transfer';
import { ENDPOINT } from './constants';

// Token decimals (most are 9 decimals like SOL)
const TOKEN_DECIMALS = {
  MTA: 9,
  SAMX: 9,
  XAR: 9,
  XMP: 9,
  RAMX: 9,
  TRAXX: 9,
};

// Default transfer amount
const DEFAULT_TRANSFER_AMOUNT = 1000;

/**
 * Transfer test tokens directly to specified wallet addresses for immediate testing
 * 
 * @param adminSecretKey Admin wallet secret key (as base64 string or Uint8Array)
 * @param recipientAddress Recipient wallet address
 * @returns Transaction details
 */
export async function directTransferTestTokens(
  adminSecretKey: string | Uint8Array,
  recipientAddress: string
): Promise<{
  success: boolean;
  signatures: string[];
  errors: string[];
}> {
  const connection = new Connection(ENDPOINT);
  const signatures: string[] = [];
  const errors: string[] = [];
  
  // Create admin keypair from secret
  let adminKeypair: Keypair;
  if (typeof adminSecretKey === 'string') {
    const secretKeyArray = Uint8Array.from(Buffer.from(adminSecretKey, 'base64'));
    adminKeypair = Keypair.fromSecretKey(secretKeyArray);
  } else {
    adminKeypair = Keypair.fromSecretKey(adminSecretKey);
  }
  
  const recipientPublicKey = new PublicKey(recipientAddress);
  
  // Process each token
  for (const [tokenSymbol, tokenMintAddress] of Object.entries(TEST_TOKENS)) {
    try {
      console.log(`Transferring ${DEFAULT_TRANSFER_AMOUNT} ${tokenSymbol} to ${recipientAddress}...`);
      
      // Get token mint
      const tokenMint = new PublicKey(tokenMintAddress);
      
      // Calculate raw amount with decimals
      const decimals = TOKEN_DECIMALS[tokenSymbol as keyof typeof TOKEN_DECIMALS];
      const rawAmount = Math.floor(DEFAULT_TRANSFER_AMOUNT * Math.pow(10, decimals));
      
      // Get sender's token account
      const senderTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        adminKeypair.publicKey
      );
      
      // Get recipient's token account
      const recipientTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        recipientPublicKey
      );
      
      // Check if recipient's token account exists, if not, create it
      let transaction = new Transaction();
      try {
        await connection.getAccountInfo(recipientTokenAccount);
        console.log(`Recipient's ${tokenSymbol} token account exists.`);
      } catch (error) {
        console.log(`Creating ${tokenSymbol} token account for recipient...`);
        // Add instruction to create associated token account
        transaction.add(
          createAssociatedTokenAccountInstruction(
            adminKeypair.publicKey, // payer
            recipientTokenAccount, // associated token account address
            recipientPublicKey, // owner
            tokenMint // mint
          )
        );
      }
      
      // Add token transfer instruction
      transaction.add(
        createTransferInstruction(
          senderTokenAccount, // source
          recipientTokenAccount, // destination
          adminKeypair.publicKey, // owner
          BigInt(rawAmount) // amount
        )
      );
      
      // Send transaction
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = adminKeypair.publicKey;
      
      // Sign the transaction with admin keypair
      transaction.sign(adminKeypair);
      
      // Send the signed transaction
      const signature = await connection.sendRawTransaction(transaction.serialize());
      
      // Wait for confirmation
      await connection.confirmTransaction(signature);
      
      console.log(`Successfully transferred ${DEFAULT_TRANSFER_AMOUNT} ${tokenSymbol} to ${recipientAddress}. Signature: ${signature}`);
      signatures.push(signature);
    } catch (error: any) {
      console.error(`Error transferring ${tokenSymbol} to ${recipientAddress}:`, error);
      errors.push(`${tokenSymbol}: ${error.message || 'Unknown error'}`);
    }
  }
  
  return {
    success: errors.length === 0,
    signatures,
    errors
  };
}

/**
 * Execute a direct token transfer using server-side admin credentials
 * This function is meant to be called from a server API endpoint
 */
export async function executeDirectTokenTransfer(recipientAddress: string): Promise<any> {
  // In a real implementation, you would retrieve the admin's secret key from a secure environment variable
  // or other secure storage mechanism. This is just a placeholder.
  const adminSecretKey = process.env.ADMIN_SECRET_KEY;
  
  if (!adminSecretKey) {
    throw new Error('Admin secret key not found in environment variables');
  }
  
  return await directTransferTestTokens(adminSecretKey, recipientAddress);
}