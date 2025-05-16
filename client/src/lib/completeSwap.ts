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

// Initialize the pool authority keypair from provided bytes
// This keypair will be used to sign token transfers from the pool
const poolAuthorityBytes = new Uint8Array([111,52,81,80,79,3,254,27,91,239,88,92,71,122,14,66,205,5,186,38,68,44,147,132,45,148,217,134,174,102,204,231,100,114,238,175,149,109,187,18,127,240,66,141,63,222,206,220,19,210,93,22,197,87,147,116,47,170,206,252,224,97,171,186]);
export const poolAuthorityKeypair = Keypair.fromSecretKey(poolAuthorityBytes);

// Verify the keypair matches the expected public key
const expectedPoolAuthority = new PublicKey(POOL_AUTHORITY);
if (!poolAuthorityKeypair.publicKey.equals(expectedPoolAuthority)) {
  console.error('Pool authority keypair does not match expected public key!');
}

// Function to complete a swap by sending YOT tokens from the pool to the user
export async function completeSwapWithYotTransfer(
  userPublicKey: PublicKey,
  yotAmount: number
) {
  try {
    console.log(`Completing swap by sending ${yotAmount} YOT tokens to ${userPublicKey.toString()}`);
    
    // Get the YOT token mint
    const yotTokenMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const poolYotAccount = new PublicKey(YOT_TOKEN_ACCOUNT);
    
    // Get the associated token account for the user's YOT
    const userYotAccount = await getAssociatedTokenAddress(
      yotTokenMint,
      userPublicKey
    );
    
    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    // Create transaction
    const transaction = new Transaction({
      feePayer: poolAuthorityKeypair.publicKey,
      blockhash,
      lastValidBlockHeight
    });
    
    // Check if the user has a YOT token account, if not create one
    let needsTokenAccount = false;
    try {
      await getAccount(connection, userYotAccount);
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        // User doesn't have a YOT token account yet, add instruction to create one
        needsTokenAccount = true;
        transaction.add(
          createAssociatedTokenAccountInstruction(
            poolAuthorityKeypair.publicKey, // payer
            userYotAccount, // associated token account
            userPublicKey, // owner
            yotTokenMint // mint
          )
        );
      } else {
        throw error;
      }
    }
    
    // Get mint info to convert amount to the right number of tokens
    const mintInfo = await getMint(connection, yotTokenMint);
    const yotTokenAmount = BigInt(Math.floor(yotAmount * Math.pow(10, mintInfo.decimals)));
    
    // Add instruction to transfer YOT tokens from pool to user
    transaction.add(
      createTransferInstruction(
        poolYotAccount, // source
        userYotAccount, // destination
        poolAuthorityKeypair.publicKey, // owner (pool authority)
        yotTokenAmount // amount
      )
    );
    
    // Sign and send the transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [poolAuthorityKeypair] // signers
    );
    
    console.log(`YOT tokens sent to user. Transaction signature: ${signature}`);
    
    return {
      signature,
      amount: yotAmount,
      userTokenAccount: userYotAccount.toString()
    };
  } catch (error) {
    console.error('Error completing swap with YOT transfer:', error);
    throw error;
  }
}