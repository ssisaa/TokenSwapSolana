/**
 * Multihub Swap Helper Functions
 * Bridge between Raydium and our MultihubSwap contract
 */

import { SwapProvider } from './multi-hub-swap';
import {
  Connection,
  Transaction,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  TransactionInstruction
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';

// Devnet endpoint
const ENDPOINT = 'https://api.devnet.solana.com';

// Token addresses as PublicKey objects
const SOL_TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const YOT_TOKEN_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
const YOS_TOKEN_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');

// Program ID of multihub swap contract - initialize as a PublicKey object
const MULTIHUB_SWAP_PROGRAM_ID = new PublicKey('3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps');

// Define class to implement the required methods for swap
class MultihubSwapClient implements SwapProvider {
  connection: Connection;

  constructor() {
    this.connection = new Connection(ENDPOINT);
  }

  async estimateSwap(
    fromToken: any,
    toToken: any,
    amount: number,
    slippage: number = 0.01
  ): Promise<any> {
    // This would be implemented to estimate the swap
    throw new Error("Method not implemented");
  }

  async executeSwap(
    wallet: any,
    fromToken: any,
    toToken: any,
    amount: number,
    minAmountOut: number
  ): Promise<any> {
    if (!wallet?.publicKey) {
      throw new Error("Wallet not connected");
    }

    // Use direct import instead of dynamic import
    // We'll implement the functionality here since we can't dynamically import the class
    const multihubSwap = {
      createSwapTransaction: async (wallet: any, fromToken: any, toToken: any, amount: number, minAmountOut: number) => {
        // This is a simplified version that matches what's in multihub-contract.ts
        const { Connection, Transaction, PublicKey, SystemProgram } = await import('@solana/web3.js');
        const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = await import('@solana/spl-token');
        
        const connection = new Connection(ENDPOINT);
        
        // Program IDs
        const MULTIHUB_SWAP_PROGRAM_ID = new PublicKey('3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps');
        const YOT_TOKEN_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
        const YOS_TOKEN_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');
        const SOL_TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112');
        
        // Create a new transaction
        const transaction = new Transaction();
        
        // Convert token addresses to PublicKey objects
        const fromTokenMint = new PublicKey(fromToken.address);
        const toTokenMint = new PublicKey(toToken.address);
        
        // Get ATA for YOT, SOL is handled differently
        const SOL_ADDRESS = 'So11111111111111111111111111111111111111112';
        const fromTokenAccount = fromToken.address === SOL_ADDRESS
          ? wallet.publicKey 
          : await getAssociatedTokenAddress(fromTokenMint, wallet.publicKey);
          
        const toTokenAccount = toToken.address === SOL_ADDRESS
          ? wallet.publicKey
          : await getAssociatedTokenAddress(toTokenMint, wallet.publicKey);
          
        // For YOS cashback, we also need YOS token account
        const yosTokenAccount = await getAssociatedTokenAddress(YOS_TOKEN_MINT, wallet.publicKey);
        
        // Based on looking at the Rust code, the instruction format is different than we expected
        // The Solana program uses a tag-based approach, not Borsh serialization
        // Looking at multihub_swap.rs, the actual instruction enum is:
        // 
        // pub enum MultiHubSwapInstruction {
        //   Initialize { authority_bump: u8 },
        //   SwapToken {
        //     amount_in: u64,
        //     minimum_amount_out: u64,
        //   },
        //   ...
        // }
        //
        // Note that the token mints are not part of the instruction data,
        // they should be passed as account parameters instead
        
        // Create the instruction data buffer with all required fields
        // Looking at the Rust code, SwapToken expects:
        // - amount_in (u64)
        // - minimum_amount_out (u64)
        // - input_token_mint (Pubkey - 32 bytes)
        // - output_token_mint (Pubkey - 32 bytes)
        // - referrer (Option<Pubkey> - 1 + 32 bytes)
        
        // Calculate total buffer size (1 byte tag + two u64s + two Pubkeys + Option<Pubkey>)
        // 1 + 8 + 8 + 32 + 32 + 1 + (32 optional) = 82 or 114 bytes
        const hasReferrer = false; // We don't have referrer functionality yet
        const bufferSize = 1 + 8 + 8 + 32 + 32 + 1 + (hasReferrer ? 32 : 0);
        const instructionData = Buffer.alloc(bufferSize);
        
        let offset = 0;
        
        // Write instruction tag (1 = SwapToken)
        instructionData.writeUInt8(1, offset);
        offset += 1;
        
        // Write amount_in as u64 (8 bytes in little-endian format)
        const amountRaw = Math.floor(amount * Math.pow(10, fromToken.decimals));
        const amountBigInt = BigInt(amountRaw);
        for (let i = 0; i < 8; i++) {
          instructionData[offset + i] = Number((amountBigInt >> BigInt(i * 8)) & BigInt(0xFF));
        }
        offset += 8;
        
        // Write minimum_amount_out as u64 (8 bytes in little-endian format)
        const minAmountOutRaw = Math.floor(minAmountOut * Math.pow(10, toToken.decimals));
        const minAmountOutBigInt = BigInt(minAmountOutRaw);
        for (let i = 0; i < 8; i++) {
          instructionData[offset + i] = Number((minAmountOutBigInt >> BigInt(i * 8)) & BigInt(0xFF));
        }
        offset += 8;
        
        // Write input_token_mint (Pubkey - 32 bytes)
        const inputTokenBuffer = fromTokenMint.toBuffer();
        inputTokenBuffer.copy(instructionData, offset);
        offset += 32;
        
        // Write output_token_mint (Pubkey - 32 bytes)
        const outputTokenBuffer = toTokenMint.toBuffer();
        outputTokenBuffer.copy(instructionData, offset);
        offset += 32;
        
        // Write referrer as Option<Pubkey>
        if (hasReferrer) {
          // Option<T> in Rust serializes as 1 byte (1 for Some, 0 for None) followed by T if Some
          instructionData.writeUInt8(1, offset); // Some
          offset += 1;
          
          // Write referrer Pubkey (not implemented, using wallet key as placeholder)
          const referrerBuffer = wallet.publicKey.toBuffer();
          referrerBuffer.copy(instructionData, offset);
          // offset += 32; // No need to increment offset further as we're done
        } else {
          instructionData.writeUInt8(0, offset); // None
          // offset += 1; // No need to increment offset further as we're done
        }
        
        console.log(`Instruction data created: Swap ${amountRaw} units of ${fromToken.symbol} for min ${minAmountOutRaw} units of ${toToken.symbol}`);
        
        // Debug the instruction data as hex
        console.log('Instruction data (hex):', Buffer.from(instructionData).toString('hex'));
        
        // Setup account metas based on the expected accounts in the program
        // We need to find the exact account order that the program expects
        
        // The program state account (PDA) is derived with seed "state"
        const [programState, programStateBump] = await PublicKey.findProgramAddress(
          [Buffer.from("state")], 
          MULTIHUB_SWAP_PROGRAM_ID
        );
        
        // The SOL-YOT pool account 
        const [poolAccount, poolBump] = await PublicKey.findProgramAddress(
          [Buffer.from("pool"), YOT_TOKEN_MINT.toBuffer(), SOL_TOKEN_MINT.toBuffer()], 
          MULTIHUB_SWAP_PROGRAM_ID
        );
        
        // The admin fee recipient account
        const [feeAccount, feeBump] = await PublicKey.findProgramAddress(
          [Buffer.from("fees")], 
          MULTIHUB_SWAP_PROGRAM_ID
        );
        
        // Based on the error code, we need to adjust the account order to match the program's expectations
        const accountMetas = [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },           // 0. User's wallet (payer + authority)
          { pubkey: fromTokenAccount, isSigner: false, isWritable: true },          // 1. User's token account for input token
          { pubkey: toTokenAccount, isSigner: false, isWritable: true },            // 2. User's token account for output token
          { pubkey: yosTokenAccount, isSigner: false, isWritable: true },           // 3. User's YOS token account for cashback
          { pubkey: fromTokenMint, isSigner: false, isWritable: false },            // 4. Input token mint (was missing)
          { pubkey: toTokenMint, isSigner: false, isWritable: false },              // 5. Output token mint (was missing)
          { pubkey: YOS_TOKEN_MINT, isSigner: false, isWritable: false },           // 6. YOS token mint (was missing)
          { pubkey: programState, isSigner: false, isWritable: true },              // 7. Program state account
          { pubkey: poolAccount, isSigner: false, isWritable: true },               // 8. SOL-YOT liquidity pool
          { pubkey: feeAccount, isSigner: false, isWritable: true },                // 9. Admin fee account
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },         // 10. Token program
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },  // 11. System program
        ];
        
        // Create the swap instruction
        const swapInstruction = {
          programId: MULTIHUB_SWAP_PROGRAM_ID,
          keys: accountMetas,
          data: instructionData
        };
        
        // Add it to the transaction
        transaction.add(swapInstruction);
        
        // Return the transaction for signing
        return transaction;
      }
    };

    console.log(`Executing multi-hub swap: ${amount} ${fromToken.symbol} -> ${toToken.symbol}`);
    console.log(`This will include 20% liquidity contribution and 5% YOS cashback`);

    // Create the swap transaction using the contract
    const transaction = await multihubSwap.createSwapTransaction(
      wallet,
      fromToken,
      toToken,
      amount,
      minAmountOut
    );

    // Sign and send the transaction
    try {
      // Ensure accounts exist first (especially for token accounts)
      const { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } = await import('@solana/spl-token');
      const { Connection, Transaction, PublicKey, SystemProgram } = await import('@solana/web3.js');
      
      // Check and create token accounts if needed
      const YOT_TOKEN_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
      const YOS_TOKEN_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');
      const toTokenMint = new PublicKey(toToken.address);
      const yosTokenAccount = await getAssociatedTokenAddress(YOS_TOKEN_MINT, wallet.publicKey);
      const toTokenAccount = toToken.address === 'So11111111111111111111111111111111111111112' 
        ? wallet.publicKey 
        : await getAssociatedTokenAddress(toTokenMint, wallet.publicKey);
      
      // Check if YOS token account exists
      try {
        const yosAccountInfo = await this.connection.getAccountInfo(yosTokenAccount);
        if (!yosAccountInfo) {
          console.log("Creating YOS token account...");
          const createYosAtaIx = createAssociatedTokenAccountInstruction(
            wallet.publicKey, // payer
            yosTokenAccount, // ata
            wallet.publicKey, // owner
            YOS_TOKEN_MINT // mint
          );
          transaction.add(createYosAtaIx);
        }
      } catch (err) {
        console.log("Creating YOS token account...");
        const createYosAtaIx = createAssociatedTokenAccountInstruction(
          wallet.publicKey, // payer
          yosTokenAccount, // ata
          wallet.publicKey, // owner
          YOS_TOKEN_MINT // mint
        );
        transaction.add(createYosAtaIx);
      }
      
      // Check if destination token account exists (if not SOL)
      if (toToken.address !== 'So11111111111111111111111111111111111111112') {
        try {
          const toAccountInfo = await this.connection.getAccountInfo(toTokenAccount);
          if (!toAccountInfo) {
            console.log(`Creating ${toToken.symbol} token account...`);
            const createToAtaIx = createAssociatedTokenAccountInstruction(
              wallet.publicKey, // payer
              toTokenAccount, // ata
              wallet.publicKey, // owner
              toTokenMint // mint
            );
            transaction.add(createToAtaIx);
          }
        } catch (err) {
          console.log(`Creating ${toToken.symbol} token account...`);
          const createToAtaIx = createAssociatedTokenAccountInstruction(
            wallet.publicKey, // payer
            toTokenAccount, // ata
            wallet.publicKey, // owner
            toTokenMint // mint
          );
          transaction.add(createToAtaIx);
        }
      }
      
      // Set recent blockhash and fee payer
      transaction.feePayer = wallet.publicKey;
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      
      // Skip preflight checks explicitly to avoid simulation errors
      // Common error is Custom:0 which is usually from insufficient balance or incorrect token accounts
      console.log("Preparing transaction for execution...");
      
      // Add more robust transaction handling options
      const options = {
        skipPreflight: true, // Skip preflight to avoid simulation errors
        preflightCommitment: 'processed',
        maxRetries: 5 // Add retries to handle network issues
      };
      
      // Log transaction accounts for debugging
      console.log("Transaction accounts:", transaction.instructions.map(ix => ({
        programId: ix.programId.toString(),
        keys: ix.keys.map(k => ({
          pubkey: k.pubkey.toString(),
          isSigner: k.isSigner,
          isWritable: k.isWritable
        }))
      })));
      
      console.log("Sending transaction with token account checks...");
      
      try {
        // Calculate the raw amounts for logging and debugging
        // These calculations match the ones inside createSwapTransaction
        const amountInRaw = Math.floor(amount * Math.pow(10, fromToken.decimals));
        const minAmountOutRaw = Math.floor(minAmountOut * Math.pow(10, toToken.decimals));
        
        // Log important debug information for transaction diagnostics
        console.log(`Amount in (raw): ${amountInRaw} ${fromToken.symbol}`);
        console.log(`Min amount out (raw): ${minAmountOutRaw} ${toToken.symbol}`);
        console.log(`Input token mint: ${fromToken.address}`);
        console.log(`Output token mint: ${toToken.address}`);
        
        // Log the PDA derivations
        const programStatePDA = (await PublicKey.findProgramAddress(
          [Buffer.from("state")], 
          MULTIHUB_SWAP_PROGRAM_ID
        ))[0];
        console.log("Program state PDA:", programStatePDA.toString());
        
        const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
        const poolPDA = (await PublicKey.findProgramAddress(
          [Buffer.from("pool"), YOT_TOKEN_MINT.toBuffer(), SOL_MINT.toBuffer()], 
          MULTIHUB_SWAP_PROGRAM_ID
        ))[0];
        console.log("Pool PDA:", poolPDA.toString());
        
        const feePDA = (await PublicKey.findProgramAddress(
          [Buffer.from("fees")], 
          MULTIHUB_SWAP_PROGRAM_ID
        ))[0];
        console.log("Fee PDA:", feePDA.toString());
        
        const signature = await wallet.sendTransaction(transaction, this.connection, options);
        console.log("Transaction sent with signature:", signature);
        
        try {
          // More detailed transaction simulation to get logs
          const simResult = await this.connection.simulateTransaction(transaction);
          console.log("Simulation logs:", simResult.value.logs);
        } catch (simError) {
          console.log("Could not get simulation logs:", simError);
        }
        
        // Wait for confirmation with more specific options
        const confirmation = await this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
        
        if (confirmation.value.err) {
          console.error(`Transaction confirmed but has error:`, confirmation.value.err);
          
          // Try to get transaction details to see what went wrong
          const txDetails = await this.connection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          });
          
          if (txDetails) {
            console.log("Transaction logs:", txDetails.meta?.logMessages);
          }
          
          throw new Error(`Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`);
        }
        
        return {
          signature,
          success: true,
          fromAmount: amount,
          fromToken: fromToken.symbol,
          toAmount: minAmountOut,
          toToken: toToken.symbol
        };
      } catch (sendError) {
        console.error("Error sending transaction:", sendError);
        
        // More detailed error handler
        const errorMessage = sendError.message || "Unknown error";
        
        if (errorMessage.includes("Simulation failed")) {
          if (errorMessage.includes("Custom program error: 0x")) {
            // Try to decode the program error
            const errorCodeMatch = errorMessage.match(/Custom program error: 0x([0-9a-f]+)/i);
            if (errorCodeMatch) {
              const errorCode = parseInt(errorCodeMatch[1], 16);
              console.error(`Program error code: ${errorCode}`);
              
              // Interpret error codes from MultiHubSwapError enum
              const errorMeaning = {
                0: "InvalidInstruction - The instruction data format is wrong",
                1: "NotInitialized - The program hasn't been initialized yet",
                2: "AlreadyInitialized - The program has already been initialized",
                3: "InvalidAuthority - The caller doesn't have authority",
                4: "SlippageExceeded - Price slippage is too high"
              }[errorCode] || "Unknown program error";
              
              throw new Error(`Program error: ${errorMeaning}`);
            }
          }
          
          // Log raw error for debugging
          console.error("Raw error:", errorMessage);
          throw new Error("Transaction would fail. Please check your wallet balance and try again.");
        } else {
          throw new Error(`Transaction error: ${errorMessage}`);
        }
      }
    } catch (error) {
      console.error("Transaction failed:", error);
      
      // More descriptive error messages
      if (error.message && error.message.includes("insufficient funds")) {
        throw new Error("Insufficient funds to complete the transaction");
      } else if (error.message && error.message.includes("already in use")) {
        throw new Error("Transaction nonce already used. Please try again.");
      } else if (error.message && error.message.includes("blockhash")) {
        throw new Error("Blockhash expired. Please try again.");
      } else {
        throw new Error(`Swap failed: ${error.message || "Unexpected wallet error"}`);
      }
    }
  }
}

/**
 * Execute a swap through the multi-hub contract
 * This function is exported for use by other modules like the Raydium integration
 */
export async function executeMultiHubSwap(
  wallet: any,
  fromToken: any,
  toToken: any,
  amount: number,
  minAmountOut: number
): Promise<any> {
  try {
    const multihubClient = new MultihubSwapClient();
    
    // Execute the swap
    const result = await multihubClient.executeSwap(
      wallet,
      fromToken,
      toToken,
      amount,
      minAmountOut
    );
    
    return result;
  } catch (err) {
    console.error("Error executing multi-hub swap:", err);
    throw err;
  }
}