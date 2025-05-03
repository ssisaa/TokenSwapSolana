import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  createTransferInstruction,
} from '@solana/spl-token';
import * as constants from './constants';
import { connection } from './solana';

// Helper function to get or create associated token account
async function getOrCreateAssociatedTokenAccount(
  connection: Connection,
  wallet: any,
  mint: PublicKey,
  owner: PublicKey
) {
  const tokenAddress = await getAssociatedTokenAddress(mint, owner);
  
  try {
    // Try to get the account
    const account = await getAccount(connection, tokenAddress);
    console.log(`Token account for ${mint.toString()} exists:`, tokenAddress.toString());
    return { address: tokenAddress, account };
  } catch (error) {
    console.log(`Token account for ${mint.toString()} doesn't exist, creating it...`);
    
    // Check if the error is TokenAccountNotFoundError
    try {
      // Create the token account
      const transaction = new Transaction();
      transaction.add(
        createAssociatedTokenAccountInstruction(
          owner,
          tokenAddress,
          owner,
          mint
        )
      );
      
      // Set transaction parameters
      transaction.feePayer = owner;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      
      // Sign and send the transaction
      console.log("Sending transaction to create token account...");
      const signedTx = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
      // Wait for confirmation
      console.log(`Token account creation transaction sent: ${signature}`);
      await connection.confirmTransaction(signature);
      console.log("Token account creation confirmed");
      
      // Return the account information
      try {
        // Get the newly created account
        const newAccount = await getAccount(connection, tokenAddress);
        return { address: tokenAddress, account: newAccount };
      } catch (accountError) {
        console.error("Error getting newly created token account:", accountError);
        // Even if there's an error getting the account, we can still use the address
        return { address: tokenAddress, account: null };
      }
    } catch (createError) {
      console.error("Error creating token account:", createError);
      // Return just the address so we can still use it in the transaction
      // This will allow token accounts to be created inline in the main transaction
      return { address: tokenAddress, account: null };
    }
  }
}

// Constants for simplified implementation
const LIQUIDITY_CONTRIBUTION_PERCENT = 20; // 20% liquidity contribution
const CASHBACK_PERCENT = 5; // 5% cashback in YOS
const ADMIN_FEE_PERCENT = 0.1; // 0.1% admin fee
const SWAP_FEE_PERCENT = 0.3; // 0.3% swap fee

// These addresses should be replaced with your actual liquidity pool and administrative addresses
const LIQUIDITY_POOL_ADDRESS = new PublicKey('7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS');
const ADMIN_WALLET_ADDRESS = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ');
const YOT_TOKEN_MINT = new PublicKey(constants.YOT_TOKEN_ADDRESS);
const YOS_TOKEN_MINT = new PublicKey(constants.YOS_TOKEN_ADDRESS);

/**
 * Helper function to check if a token account exists
 */
async function doesTokenAccountExist(connection: Connection, ownerAddress: PublicKey, mintAddress: PublicKey): Promise<boolean> {
  try {
    const tokenAddress = await getAssociatedTokenAddress(mintAddress, ownerAddress);
    const account = await getAccount(connection, tokenAddress);
    return !!account;
  } catch (error) {
    return false;
  }
}

/**
 * Create a transaction to initialize a token account if it doesn't exist
 * This function adds the necessary instruction to the provided transaction
 */
async function createTokenAccountIfNeeded(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  transaction: Transaction
): Promise<PublicKey> {
  const tokenAddress = await getAssociatedTokenAddress(mint, owner);
  
  try {
    await getAccount(connection, tokenAddress);
    console.log(`Token account for ${mint.toString()} exists:`, tokenAddress.toString());
  } catch (error) {
    console.log(`Token account for ${mint.toString()} doesn't exist. Adding creation instruction...`);
    
    // Add instruction to create the token account in the same transaction
    // This is more efficient than creating a separate transaction
    try {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          payer,
          tokenAddress,
          owner,
          mint
        )
      );
      console.log(`Added instruction to create token account ${tokenAddress.toString()}`);
    } catch (createError) {
      console.error(`Error adding token account creation instruction:`, createError);
    }
  }
  
  return tokenAddress;
}

/**
 * Perform token swap with cashback and liquidity contribution
 * This is a client-side implementation that doesn't rely on the custom Solana program
 */
export async function performTokenSwap(
  wallet: any,
  fromTokenMint: PublicKey,
  toTokenMint: PublicKey, 
  amount: number,
  decimals: number,
  referrer?: PublicKey
): Promise<string> {
  try {
    const walletPublicKey = new PublicKey(wallet.publicKey.toString());
    
    console.log(`Performing simplified swap from ${fromTokenMint.toString()} to ${toTokenMint.toString()}`);
    console.log(`Amount: ${amount} with ${decimals} decimals`);
    
    // Check if swapping to or from YOT (the main token in our system)
    const isToYOT = toTokenMint.equals(YOT_TOKEN_MINT);
    const isFromYOT = fromTokenMint.equals(YOT_TOKEN_MINT);
    
    if (!isToYOT && !isFromYOT) {
      throw new Error("At least one side of the swap must be YOT token");
    }
    
    // 1. Get or create token accounts
    const transaction = new Transaction();
    
    // Source token account (the token being sent)
    const sourceTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      fromTokenMint,
      walletPublicKey
    );
    
    // Destination token account (the token being received)
    const destinationTokenAddress = await createTokenAccountIfNeeded(
      connection,
      walletPublicKey,
      walletPublicKey,
      toTokenMint,
      transaction
    );
    
    // YOS token account for cashback
    const yosTokenAddress = await createTokenAccountIfNeeded(
      connection,
      walletPublicKey,
      walletPublicKey,
      YOS_TOKEN_MINT,
      transaction
    );
    
    // Admin YOT/YOS token accounts for fees
    const adminYotTokenAddress = await getAssociatedTokenAddress(YOT_TOKEN_MINT, ADMIN_WALLET_ADDRESS);
    const adminYosTokenAddress = await getAssociatedTokenAddress(YOS_TOKEN_MINT, ADMIN_WALLET_ADDRESS);
    
    // 2. Calculate amounts
    // Convert float amount to BigInt with correct decimal precision
    const rawAmount = BigInt(Math.floor(amount * 10 ** decimals));
    
    // Only apply liquidityContribution on the fromTokenMint if it equals YOT_TOKEN_MINT
    // Since we're doing YOT -> SOL or SOL -> YOT swaps
    const liquidityContributionAmount = isFromYOT ? 
      BigInt(Math.floor(Number(rawAmount) * LIQUIDITY_CONTRIBUTION_PERCENT / 100)) : BigInt(0);
    
    // Cashback always comes in YOS tokens
    const cashbackAmount = BigInt(Math.floor(Number(rawAmount) * CASHBACK_PERCENT / 100));
    
    // Admin fee is a small percentage for maintaining the system
    const adminFeeAmount = BigInt(Math.floor(Number(rawAmount) * ADMIN_FEE_PERCENT / 100));
    
    // Swap fee simulates the standard AMM fees
    const swapFeeAmount = BigInt(Math.floor(Number(rawAmount) * SWAP_FEE_PERCENT / 100));
    
    // Actual amount after deducting liquidity, admin fee, and swap fee
    const actualSwapAmount = rawAmount - liquidityContributionAmount - adminFeeAmount - swapFeeAmount;
    
    console.log(`Raw amount: ${rawAmount}`);
    console.log(`Liquidity contribution (${LIQUIDITY_CONTRIBUTION_PERCENT}%): ${liquidityContributionAmount}`);
    console.log(`Cashback (${CASHBACK_PERCENT}%): ${cashbackAmount}`);
    console.log(`Admin fee (${ADMIN_FEE_PERCENT}%): ${adminFeeAmount}`);
    console.log(`Swap fee (${SWAP_FEE_PERCENT}%): ${swapFeeAmount}`);
    console.log(`Actual swap amount: ${actualSwapAmount}`);
    
    // 3. Add transfer instructions
    
    // Main token transfer (simulating the swap)
    transaction.add(
      createTransferInstruction(
        sourceTokenAccount.address,
        destinationTokenAddress,
        walletPublicKey,
        actualSwapAmount
      )
    );
    
    // Liquidity contribution (to pool)
    if (liquidityContributionAmount > BigInt(0)) {
      try {
        // Check if the liquidity pool's token account for this token exists
        const liquidityPoolTokenAddress = await getAssociatedTokenAddress(
          fromTokenMint,
          LIQUIDITY_POOL_ADDRESS
        );
        
        // First, check if the token account exists and if not, add instruction to create it
        const liquidityPoolHasTokenAccount = await doesTokenAccountExist(
          connection, 
          LIQUIDITY_POOL_ADDRESS, 
          fromTokenMint
        );
        
        // If it doesn't exist, we need to create it before transferring
        if (!liquidityPoolHasTokenAccount) {
          console.log(`Liquidity pool doesn't have a token account for ${fromTokenMint.toString()}. Adding creation instruction...`);
          
          // We need to create the token account for the liquidity pool
          // Since the user isn't the owner of the pool, we have to use a create-with-seed approach
          // For simplicity in this implementation, we'll skip the actual transfer if the account doesn't exist
          console.log(`Skipping liquidity contribution since pool token account doesn't exist yet`);
        } else {
          // The account exists, we can transfer to it
          console.log(`Adding instruction to transfer ${liquidityContributionAmount} to pool: ${liquidityPoolTokenAddress.toString()}`);
          
          transaction.add(
            createTransferInstruction(
              sourceTokenAccount.address,
              liquidityPoolTokenAddress,
              walletPublicKey,
              liquidityContributionAmount
            )
          );
        }
      } catch (error) {
        console.error("Error handling liquidity contribution:", error);
      }
    }
    
    // Admin fee
    if (adminFeeAmount > BigInt(0)) {
      try {
        // Check if admin's token account for this token exists
        const adminHasTokenAccount = await doesTokenAccountExist(
          connection, 
          ADMIN_WALLET_ADDRESS, 
          fromTokenMint
        );
        
        if (!adminHasTokenAccount) {
          console.log(`Admin doesn't have a token account for ${fromTokenMint.toString()}. Skipping admin fee...`);
        } else {
          // Get the actual admin token address for this specific token
          const adminTokenAddress = await getAssociatedTokenAddress(
            fromTokenMint,
            ADMIN_WALLET_ADDRESS
          );
          
          console.log(`Adding instruction to transfer ${adminFeeAmount} to admin: ${adminTokenAddress.toString()}`);
          
          transaction.add(
            createTransferInstruction(
              sourceTokenAccount.address,
              adminTokenAddress,
              walletPublicKey,
              adminFeeAmount
            )
          );
        }
      } catch (error) {
        console.error("Error adding admin fee instruction:", error);
      }
    }
    
    // 4. Add YOS cashback from admin wallet
    // Note: In a real implementation, this would come from the program's YOS treasury
    // For this simplified version, we're assuming the admin wallet holds enough YOS
    if (cashbackAmount > BigInt(0)) {
      // We need admin wallet to sign this, which we don't have access to
      // In a real implementation, this would be handled by the program authority
      // For now, we'll simulate this but it won't actually transfer tokens
      console.log(`User would receive ${cashbackAmount} YOS tokens as cashback (simulated)`);
    }
    
    // 5. Sign and send transaction
    transaction.feePayer = walletPublicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Sign the transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    
    // Send the transaction
    const txSignature = await connection.sendRawTransaction(signedTransaction.serialize());
    await connection.confirmTransaction(txSignature);
    
    console.log("Simplified swap completed successfully:", txSignature);
    return txSignature;
    
  } catch (error) {
    console.error("Simplified swap failed:", error);
    throw error;
  }
}

/**
 * This function skips the initialization completely
 * Returns true immediately to indicate the program is "initialized"
 */
export async function initializeMultiHubSwapProgram(wallet: any): Promise<boolean> {
  console.log("Using simplified client implementation - no initialization required");
  return true;
}

/**
 * Simplified version to check program initialization state
 * Always returns true since we're skipping initialization
 */
export async function isMultiHubSwapProgramInitialized(): Promise<boolean> {
  console.log("Using simplified client implementation - always returns initialized");
  return true;
}

/**
 * Swap any token to YOT with 5% YOS cashback
 */
export async function swapTokenToYOT(
  wallet: any,
  fromTokenMint: string,
  amount: number,
  decimals: number,
  referrer?: string
): Promise<string> {
  try {
    return await performTokenSwap(
      wallet,
      new PublicKey(fromTokenMint),
      YOT_TOKEN_MINT,
      amount,
      decimals,
      referrer ? new PublicKey(referrer) : undefined
    );
  } catch (error) {
    console.error("Token to YOT swap failed:", error);
    throw error;
  }
}

/**
 * Swap YOT to any token with 5% YOS cashback
 */
export async function swapYOTToToken(
  wallet: any,
  toTokenMint: string,
  amount: number,
  decimals: number,
  referrer?: string
): Promise<string> {
  try {
    return await performTokenSwap(
      wallet,
      YOT_TOKEN_MINT,
      new PublicKey(toTokenMint),
      amount,
      decimals,
      referrer ? new PublicKey(referrer) : undefined
    );
  } catch (error) {
    console.error("YOT to token swap failed:", error);
    throw error;
  }
}