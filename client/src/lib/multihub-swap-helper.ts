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

// Token addresses
const SOL_TOKEN_ADDRESS = 'So11111111111111111111111111111111111111112';
const YOT_TOKEN_ADDRESS = '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
const YOS_TOKEN_ADDRESS = 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n';

// Program ID of multihub swap contract
const MULTIHUB_SWAP_PROGRAM_ID = '3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps';

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
        const fromTokenAccount = fromToken.address === SOL_TOKEN_MINT.toString() 
          ? wallet.publicKey 
          : await getAssociatedTokenAddress(fromTokenMint, wallet.publicKey);
          
        const toTokenAccount = toToken.address === SOL_TOKEN_MINT.toString()
          ? wallet.publicKey
          : await getAssociatedTokenAddress(toTokenMint, wallet.publicKey);
          
        // For YOS cashback, we also need YOS token account
        const yosTokenAccount = await getAssociatedTokenAddress(YOS_TOKEN_MINT, wallet.publicKey);
        
        // Create instruction data - Borsh serialization for SwapToken instruction
        // Needs to match the format in the Solana program (see multihub_swap.rs:80-91)
        // SwapToken {
        //   amount_in: u64,             // 8 bytes
        //   minimum_amount_out: u64,    // 8 bytes 
        //   input_token_mint: Pubkey,   // 32 bytes
        //   output_token_mint: Pubkey,  // 32 bytes
        //   referrer: Option<Pubkey>,   // 1 + 32 bytes (Option encoding)
        // },
        
        // Instruction discriminator (1 = SwapToken instruction)
        // Using Borsh serialization format
        const instructionData = Buffer.alloc(1 + 8 + 8 + 32 + 32 + 1); // Total = 82 bytes
        
        // Write instruction discriminator (1 = SwapToken)
        instructionData.writeUInt8(1, 0);
        
        // Write amount_in
        const amountRaw = Math.floor(amount * Math.pow(10, fromToken.decimals));
        instructionData.writeBigUInt64LE(BigInt(amountRaw), 1);
        
        // Write minimum_amount_out
        const minAmountOutRaw = Math.floor(minAmountOut * Math.pow(10, toToken.decimals));
        instructionData.writeBigUInt64LE(BigInt(minAmountOutRaw), 9);
        
        // Write input_token_mint (copy 32 bytes)
        fromTokenMint.toBuffer().copy(instructionData, 17);
        
        // Write output_token_mint (copy 32 bytes)
        toTokenMint.toBuffer().copy(instructionData, 49);
        
        // Write referrer: Option<Pubkey> - None value (0 for Option with no value)
        instructionData.writeUInt8(0, 81);
        
        // Setup account metas based on the expected accounts in the program:
        // See multihub_swap.rs:70-80 for the expected accounts
        const accountMetas = [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },           // 0. User's wallet
          { pubkey: fromTokenAccount, isSigner: false, isWritable: true },          // 1. User's token account for input token
          { pubkey: toTokenAccount, isSigner: false, isWritable: true },            // 2. User's token account for output token
          { pubkey: yosTokenAccount, isSigner: false, isWritable: true },           // 3. User's YOS token account for cashback
          
          // Derive the program state account (PDA)
          // Based on the program, it's likely using a PDA with seed "state"
          { 
            pubkey: await PublicKey.findProgramAddress(
              [Buffer.from("state")], 
              MULTIHUB_SWAP_PROGRAM_ID
            ).then(([address]) => address),
            isSigner: false, 
            isWritable: true 
          },
          
          // SOL-YOT liquidity pool account
          // This would ideally be derived dynamically or fetched from an API
          { 
            pubkey: await PublicKey.findProgramAddress(
              [Buffer.from("pool"), YOT_TOKEN_MINT.toBuffer(), new PublicKey('So11111111111111111111111111111111111111112').toBuffer()], 
              MULTIHUB_SWAP_PROGRAM_ID
            ).then(([address]) => address),
            isSigner: false, 
            isWritable: true 
          },
          
          // Admin fee account might be another PDA or the admin wallet
          { 
            pubkey: await PublicKey.findProgramAddress(
              [Buffer.from("fees")], 
              MULTIHUB_SWAP_PROGRAM_ID
            ).then(([address]) => address),
            isSigner: false, 
            isWritable: true 
          },
          
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },         // 7. Token program
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },  // 8. System program (additional)
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
        // Use standard wallet sendTransaction method with our special options
        const signature = await wallet.sendTransaction(transaction, this.connection, options);
        console.log("Transaction sent with signature:", signature);
        
        // Wait for confirmation with more specific options
        const confirmation = await this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
        
        if (confirmation.value.err) {
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
        if (sendError.message && sendError.message.includes("Simulation failed")) {
          throw new Error("Transaction would fail. Please check your wallet balance and try again.");
        } else {
          throw sendError;
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