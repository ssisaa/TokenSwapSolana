import { Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { 
  createAssociatedTokenAccountInstruction, 
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { ENDPOINT } from './constants';

// Test token addresses
export const TEST_TOKENS = {
  MTA: 'MTAwhynnxuZPWeRaKdZNgCiLgv8qTzhMV7SE6cuvjLf',
  SAMX: 'SAMXtxdXUeRHkeFp3JbCJcDtVPM18tqcEFmhsJtUYU7',
  XAR: 'XARMztsUvnKamdA2TgSEEib7H7zCUwF3jgChMGHXXSp',
  XMP: 'XMPuiiydZfyYNSXY894NucMmFZyEwuK7i1uHLmDyDN1',
  RAMX: 'RAMXriMbBGpXU8FMj2Y7WEcTXNfWGhkmkYdgZZ26i5F',
  TRAXX: 'TRAXXapnMX3NYpuYpXuRJjpH7Vop8YZtxRrPEAVTJhY',
};

// Decimals for the test tokens (most are 9 decimals like SOL)
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
 * Transfer test tokens to specified wallet addresses
 * @param wallet The connected wallet with admin permissions
 * @param recipients Array of recipient wallet addresses
 * @param tokenSymbols Array of token symbols to transfer
 * @param amount Amount of each token to transfer (default: 1000)
 * @returns Transaction signatures
 */
export async function transferTestTokens(
  wallet: any,
  recipients: string[],
  tokenSymbols: (keyof typeof TEST_TOKENS)[],
  amount: number = DEFAULT_TRANSFER_AMOUNT
): Promise<string[]> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }
  
  const connection = new Connection(ENDPOINT);
  const signatures: string[] = [];
  
  // Process each recipient
  for (const recipientAddress of recipients) {
    const recipientPublicKey = new PublicKey(recipientAddress);
    
    // Process each token for the current recipient
    for (const tokenSymbol of tokenSymbols) {
      try {
        console.log(`Transferring ${amount} ${tokenSymbol} to ${recipientAddress}...`);
        
        // Get token mint
        const tokenMint = new PublicKey(TEST_TOKENS[tokenSymbol]);
        
        // Calculate raw amount with decimals
        const decimals = TOKEN_DECIMALS[tokenSymbol];
        const rawAmount = Math.floor(amount * Math.pow(10, decimals));
        
        // Get sender's token account
        const senderTokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          wallet.publicKey
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
              wallet.publicKey, // payer
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
            wallet.publicKey, // owner
            BigInt(rawAmount) // amount
          )
        );
        
        // Send transaction
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transaction.feePayer = wallet.publicKey;
        
        // Sign and send the transaction
        const signedTransaction = await wallet.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());
        
        // Wait for confirmation
        await connection.confirmTransaction(signature);
        
        console.log(`Successfully transferred ${amount} ${tokenSymbol} to ${recipientAddress}. Signature: ${signature}`);
        signatures.push(signature);
      } catch (error) {
        console.error(`Error transferring ${tokenSymbol} to ${recipientAddress}:`, error);
      }
    }
  }
  
  return signatures;
}

/**
 * Check token balances for a wallet
 * @param walletAddress The wallet address to check balances for
 * @param tokenSymbols Array of token symbols to check
 * @returns Object with token balances
 */
export async function checkTokenBalances(
  walletAddress: string,
  tokenSymbols: (keyof typeof TEST_TOKENS)[]
): Promise<Record<string, number>> {
  const connection = new Connection(ENDPOINT);
  const balances: Record<string, number> = {};
  
  try {
    for (const tokenSymbol of tokenSymbols) {
      const tokenMint = new PublicKey(TEST_TOKENS[tokenSymbol]);
      const tokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        new PublicKey(walletAddress)
      );
      
      try {
        const balance = await connection.getTokenAccountBalance(tokenAccount);
        balances[tokenSymbol] = Number(balance.value.uiAmount);
      } catch (error) {
        console.log(`No ${tokenSymbol} token account found for ${walletAddress}.`);
        balances[tokenSymbol] = 0;
      }
    }
  } catch (error) {
    console.error('Error checking token balances:', error);
  }
  
  return balances;
}