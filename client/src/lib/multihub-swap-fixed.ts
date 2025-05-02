/**
 * Fixed MultiHub Swap Implementation
 * This file contains improved transaction handling for Solana to fix the simulation errors and expired blockhash issues.
 */
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  Commitment,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
} from '@solana/spl-token';
import { ENDPOINT, MULTI_HUB_SWAP_PROGRAM_ID } from './constants';

// Token mint addresses
const YOS_TOKEN_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');
const MULTIHUB_SWAP_PROGRAM_ID = MULTI_HUB_SWAP_PROGRAM_ID;

/**
 * Improved, fixed implementation of MultiHub swap functionality to address common transaction issues
 */
export async function executeFixedMultiHubSwap(
  wallet: any,
  fromToken: any,
  toToken: any,
  amount: number,
  minAmountOut: number
): Promise<any> {
  const connection = new Connection(ENDPOINT, 'confirmed');
  console.log("Starting fixed multihub swap implementation");

  try {
    if (!wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    const fromMint = new PublicKey(fromToken.address || fromToken.mint || fromToken.toString());
    const toMint = new PublicKey(toToken.address || toToken.mint || toToken.toString());
    
    console.log(`From token mint: ${fromMint.toString()}`);
    console.log(`To token mint: ${toMint.toString()}`);
    console.log(`Amount: ${amount}, Min Amount Out: ${minAmountOut}`);

    // Get token accounts
    const fromTokenAccount = await getAssociatedTokenAddress(
      fromMint,
      wallet.publicKey
    );
    
    const toTokenAccount = await getAssociatedTokenAddress(
      toMint,
      wallet.publicKey
    );
    
    console.log(`From token account: ${fromTokenAccount.toString()}`);
    console.log(`To token account: ${toTokenAccount.toString()}`);

    // Try to find the program state account
    const [programStateAddress] = await PublicKey.findProgramAddress(
      [Buffer.from("state")],
      new PublicKey(MULTIHUB_SWAP_PROGRAM_ID)
    );
    console.log("Program state address:", programStateAddress.toString());
    
    // Try to find the pool account
    const [poolAddress] = await PublicKey.findProgramAddress(
      [Buffer.from("pool")],
      new PublicKey(MULTIHUB_SWAP_PROGRAM_ID)
    );
    console.log("Pool address:", poolAddress.toString());
    
    // YOS token account for cashback
    const yosTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(YOS_TOKEN_MINT),
      wallet.publicKey
    );
    console.log("YOS token account:", yosTokenAccount.toString());

    // Create the transaction object
    const transaction = new Transaction();
    
    // Check if the user has the token accounts and create them if needed
    try {
      await getAccount(connection, fromTokenAccount);
      console.log("From token account exists");
    } catch (error) {
      console.log("Creating from token account");
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          fromTokenAccount,
          wallet.publicKey,
          fromMint
        )
      );
    }
    
    try {
      await getAccount(connection, toTokenAccount);
      console.log("To token account exists");
    } catch (error) {
      console.log("Creating to token account");
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          toTokenAccount,
          wallet.publicKey,
          toMint
        )
      );
    }
    
    try {
      await getAccount(connection, yosTokenAccount);
      console.log("YOS token account exists");
    } catch (error) {
      console.log("Creating YOS token account for cashback");
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          yosTokenAccount,
          wallet.publicKey,
          new PublicKey(YOS_TOKEN_MINT)
        )
      );
    }

    // Create instruction data for swap with proper serialization
    const instructionType = 1; // SwapToken instruction type
    const data = Buffer.alloc(17); // 1 byte for instruction + 8 bytes each for amount_in and min_amount_out
    
    // Write instruction type
    data.writeUInt8(instructionType, 0);
    
    // Write amount in and min amount out (as fixed-point numbers with 9 decimals)
    const amountInRaw = BigInt(Math.floor(amount * 1_000_000_000));
    const minAmountOutRaw = BigInt(Math.floor(minAmountOut * 1_000_000_000));
    
    // Create a data view to write the BigInts
    const view = new DataView(new ArrayBuffer(16));
    view.setBigUint64(0, amountInRaw, true); // Write amount_in (little endian)
    view.setBigUint64(8, minAmountOutRaw, true); // Write min_amount_out (little endian)
    
    // Copy values to our instruction data buffer
    Buffer.from(view.buffer).copy(data, 1);
    
    console.log(`Converting ${amount} to raw value: ${amountInRaw}`);
    console.log(`Converting ${minAmountOut} to raw value: ${minAmountOutRaw}`);
    
    // Add the swap instruction with all necessary accounts
    const swapInstruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: fromTokenAccount, isSigner: false, isWritable: true },
        { pubkey: toTokenAccount, isSigner: false, isWritable: true },
        { pubkey: fromMint, isSigner: false, isWritable: false },
        { pubkey: toMint, isSigner: false, isWritable: false },
        { pubkey: programStateAddress, isSigner: false, isWritable: true },
        { pubkey: poolAddress, isSigner: false, isWritable: true },
        { pubkey: yosTokenAccount, isSigner: false, isWritable: true },
        { pubkey: new PublicKey(YOS_TOKEN_MINT), isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: MULTIHUB_SWAP_PROGRAM_ID,
      data: data
    });
    
    transaction.add(swapInstruction);
    
    // Get a finalized blockhash with lastValidBlockHeight for better transaction validity
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash({
      commitment: 'finalized'
    });
    
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = wallet.publicKey;
    
    console.log(`Using blockhash ${blockhash} with lastValidBlockHeight ${lastValidBlockHeight}`);
    
    // Sign and send transaction
    try {
      const signature = await wallet.sendTransaction(transaction, connection, {
        skipPreflight: false, // Enable preflight checks to catch errors before submitting
        preflightCommitment: 'processed', // Use "processed" instead of "confirmed" to avoid staleness
        maxRetries: 3, // Retry a few times in case of network issues
      });
      
      console.log(`Transaction sent with signature: ${signature}`);
      
      // Confirm the transaction to make sure it was included and didn't fail
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        console.error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
        throw new Error(`Transaction confirmed but failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
      }
      
      console.log(`Transaction confirmed successfully!`);
      return {
        success: true,
        signature,
        fromAmount: amount,
        fromToken: fromToken.symbol,
        toAmount: minAmountOut,
        toToken: toToken.symbol
      };
    } catch (error: any) {
      console.error("Transaction failed:", error);
      
      // Handle specific errors
      const errorMessage = error.message || "Unknown error";
      
      if (errorMessage.includes("Simulation failed")) {
        console.error("Transaction simulation failed");
        
        if (errorMessage.includes("insufficient funds")) {
          throw new Error("Insufficient funds to complete the transaction");
        } else if (errorMessage.includes("account not found")) {
          throw new Error("One of the required accounts was not found");
        } else if (errorMessage.includes("invalid program id")) {
          throw new Error("The swap program ID is invalid or not deployed");
        } else {
          // Extract detailed error from simulation failure
          const match = errorMessage.match(/Error: (.+)$/m);
          const detailedError = match ? match[1] : "Unknown simulation error";
          throw new Error(`Simulation failed: ${detailedError}`);
        }
      } else if (errorMessage.includes("blockhash")) {
        throw new Error("Transaction blockhash expired. Please try again.");
      } else if (errorMessage.includes("rejected")) {
        throw new Error("Transaction was rejected by the wallet");
      } else {
        throw error; // Re-throw the original error
      }
    }
  } catch (error: any) {
    console.error("Error in fixed multihub swap:", error);
    throw error;
  }
}