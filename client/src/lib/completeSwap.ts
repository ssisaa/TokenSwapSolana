import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import { 
  ENDPOINT, 
  POOL_AUTHORITY, 
  YOT_TOKEN_ADDRESS,
  YOT_TOKEN_ACCOUNT 
} from './constants';

// Create a connection to the Solana cluster
export const connection = new Connection(ENDPOINT, 'confirmed');

// IMPORTANT: Do not try to initialize the pool authority keypair anymore
// The pool authority is a PDA (program derived address) owned by the program
// We can't forge signatures for it client-side
export const poolAuthorityPublicKey = new PublicKey(POOL_AUTHORITY);

// Function to complete a swap by sending YOT tokens from the pool to the user
export async function completeSwapWithYotTransfer(
  userPublicKey: PublicKey,
  yotAmount: number
) {
  try {
    console.log(`Completing swap by sending ${yotAmount} YOT tokens to ${userPublicKey.toString()}`);
    
    // Get the YOT token mint
    const yotTokenMint = new PublicKey(YOT_TOKEN_ADDRESS);
    
    // Get the associated token account for the user's YOT
    const userYotAccount = await getAssociatedTokenAddress(
      yotTokenMint,
      userPublicKey
    );
    
    // Check if the user has a YOT token account, if not create one
    try {
      await getAccount(connection, userYotAccount);
      console.log(`User already has YOT token account: ${userYotAccount.toString()}`);
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        // User doesn't have a YOT token account yet, create one
        console.log(`Creating YOT token account for user: ${userYotAccount.toString()}`);
        
        // Get latest blockhash for the token account creation transaction
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        
        // Create transaction to initialize the token account
        const createAccountTx = new Transaction({
          feePayer: userPublicKey,
          blockhash,
          lastValidBlockHeight
        });
        
        // Add instruction to create the account
        createAccountTx.add(
          createAssociatedTokenAccountInstruction(
            userPublicKey, // payer
            userYotAccount, // associated token account
            userPublicKey, // owner
            yotTokenMint // mint
          )
        );
        
        // Return the transaction for the user to sign with their wallet
        // We can't complete the transfer yet, as we need to inform the user to sign this first
        return {
          needsTokenAccount: true,
          transaction: createAccountTx,
          userTokenAccount: userYotAccount.toString()
        };
      } else {
        // Other error
        throw error;
      }
    }
    
    // CRITICAL ISSUE: We can't transfer tokens from pool directly client-side
    // The pool authority is a PDA owned by the program, and we can't forge signatures for it
    
    // We need to return this information and have the frontend display a message
    // explaining that SOL was sent to the pool, but we can't get YOT tokens back client-side
    // The admin would need to distribute tokens or we need to use the program
    
    console.error("Critical limitation: Client-side token transfers from pool not possible");
    console.error("Only the program can transfer tokens from the pool");
    
    return {
      error: true, 
      message: "SOL was sent to the pool, but YOT tokens cannot be transferred back client-side. Please use the smart contract directly or contact the admin for token distribution."
    };
  } catch (error) {
    console.error('Error completing swap with YOT transfer:', error);
    throw error;
  }
}