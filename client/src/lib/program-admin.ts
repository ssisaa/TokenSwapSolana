import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { MULTI_HUB_SWAP_PROGRAM_ID, SOLANA_CLUSTER, YOT_MINT, YOS_MINT } from "./constants";
import { connection } from "./solana";

/**
 * Find program authority PDA address
 * @returns [authority, bump]
 */
export function findProgramAuthorityAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Find program state PDA address
 * @returns [state, bump]
 */
export function findProgramStateAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
}

/**
 * Get token balance for an account
 * @param tokenAccount The token account address
 * @returns Balance as a number with decimals
 */
export async function getTokenBalance(tokenAccount: PublicKey): Promise<number> {
  try {
    const accountInfo = await connection.getAccountInfo(tokenAccount);

    if (!accountInfo) {
      console.log(`Token account ${tokenAccount.toString()} does not exist`);
      return 0;
    }

    // Parse token account data to get balance
    // Token account data layout: 
    // - 32 bytes: mint
    // - 32 bytes: owner
    // - 8 bytes: amount
    // - remaining: other data
    const data = accountInfo.data;
    const balance = data.slice(64, 72); // 8 bytes for amount
    
    // Convert to number (handle BigInt for large balances)
    // Manually iterate through buffer to avoid downlevelIteration flag issues
    let hexString = '0x';
    for (let i = balance.length - 1; i >= 0; i--) {
      hexString += balance[i].toString(16).padStart(2, '0');
    }
    const amount = Number(BigInt(hexString));
    
    // For simplicity, assuming 9 decimals for YOT/YOS
    const DECIMALS = 9;
    return amount / Math.pow(10, DECIMALS);
  } catch (error) {
    console.error("Error getting token balance:", error);
    // Return 0 as a fallback if there's a connection issue
    return 0;
  }
}

/**
 * Fund program token account with specified amount
 * @param wallet Connected wallet
 * @param mintAddress Token mint address
 * @param amount Amount to transfer (in tokens, not raw amount)
 * @returns Transaction signature
 */
export async function fundProgramTokenAccount(
  wallet: any,
  mintAddress: PublicKey,
  amount: number,
): Promise<string> {
  // Maximum retry attempts for network-related errors
  const MAX_RETRIES = 3;
  let retries = 0;
  let lastError: any = null;

  while (retries < MAX_RETRIES) {
    try {
      if (retries > 0) {
        console.log(`Retrying fund operation (attempt ${retries+1}/${MAX_RETRIES})...`);
        // Exponential backoff: 500ms, 1000ms, 2000ms, etc.
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retries - 1)));
      }
      
      if (!wallet.publicKey) {
        throw new Error("Wallet not connected");
      }

      // Find program authority
      const [programAuthority] = findProgramAuthorityAddress();
      console.log("Program authority:", programAuthority.toString());

      // Convert amount to raw amount (assuming 9 decimals for YOT/YOS)
      const DECIMALS = 9;
      const rawAmount = BigInt(Math.floor(amount * Math.pow(10, DECIMALS)));
      console.log(`Funding ${amount} tokens (${rawAmount} raw amount)`);
      
      // Source: Admin's associated token account
      const sourceTokenAccount = await getAssociatedTokenAddress(
        mintAddress,
        wallet.publicKey,
        false // allowOwnerOffCurve = false for normal wallets
      );
      
      // Destination: Program authority's associated token account
      const destinationTokenAccount = await getAssociatedTokenAddress(
        mintAddress,
        programAuthority,
        true // allowOwnerOffCurve = true for PDAs
      );
      
      console.log("Source:", sourceTokenAccount.toString());
      console.log("Destination:", destinationTokenAccount.toString());

      // Verify accounts with retry
      let accountInfo = null;
      try {
        accountInfo = await connection.getAccountInfo(destinationTokenAccount);
      } catch (accountError) {
        console.warn("Error checking token account, will retry:", accountError);
        // Continue execution to create account if needed
      }
      
      if (!accountInfo) {
        console.warn(`Program token account doesn't exist or couldn't be verified. Will try to create it.`);
        
        try {
          // Attempt to create the token account if it doesn't exist
          const createAtaIx = createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            destinationTokenAccount,
            programAuthority,
            mintAddress
          );
          
          // Create and send the account creation transaction
          const createAtaTx = new Transaction().add(createAtaIx);
          createAtaTx.feePayer = wallet.publicKey;
          createAtaTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
          
          const signedCreate = await wallet.signTransaction(createAtaTx);
          const createSig = await connection.sendRawTransaction(signedCreate.serialize());
          await connection.confirmTransaction(createSig);
          
          console.log("Created destination token account:", createSig);
        } catch (createError: any) {
          // If account already exists, we can continue
          if (createError.message && createError.message.includes("already in use")) {
            console.log("Token account already exists, continuing with transfer");
          } else {
            throw createError;
          }
        }
      }

      // Create transfer instruction
      const transferIx = createTransferInstruction(
        sourceTokenAccount,
        destinationTokenAccount,
        wallet.publicKey,
        rawAmount
      );

      // Build and send transaction
      const transaction = new Transaction().add(transferIx);
      
      // Set recent blockhash and fee payer
      transaction.feePayer = wallet.publicKey;
      // Use higher priority fee to improve chances of confirmation
      transaction.recentBlockhash = (
        await connection.getLatestBlockhash('confirmed')
      ).blockhash;

      // Sign and send transaction
      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });
      
      // Confirm transaction with longer timeout
      await connection.confirmTransaction({
        signature,
        blockhash: transaction.recentBlockhash,
        lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
      }, 'confirmed');
      
      console.log("Transfer successful:", signature);
      return signature;
    } catch (error) {
      console.error(`Error funding program token account (attempt ${retries+1}/${MAX_RETRIES}):`, error);
      
      // Analyze error to see if it's retriable
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNetworkError = errorMessage.includes("failed to fetch") || 
                            errorMessage.includes("timed out") ||
                            errorMessage.includes("network error") ||
                            errorMessage.includes("connecting to network");
      
      if (isNetworkError && retries < MAX_RETRIES - 1) {
        // It's a network error and we haven't exhausted retries
        lastError = error;
        retries++;
        continue;
      }
      
      // Either it's not a network error or we've exhausted retries
      throw error;
    }
  }
  
  // This should not be reached due to the throw in the catch block
  // but TypeScript requires it
  throw lastError;
}