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
 * Utility function to get token balance
 */
async function getTokenBalance(connection: Connection, walletAddress: PublicKey, mint: PublicKey): Promise<number> {
  try {
    // Get the associated token account address
    const tokenAccount = await getAssociatedTokenAddress(mint, walletAddress);
    
    // Check if the account exists
    try {
      const account = await getAccount(connection, tokenAccount);
      // Convert from raw units to decimal
      return Number(account.amount) / 1e9; // Assuming 9 decimals for all tokens
    } catch (error) {
      console.log(`Token account for ${mint.toString()} does not exist yet`);
      return 0;
    }
  } catch (error) {
    console.error("Error fetching token balance:", error);
    return 0;
  }
}

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

    // Ensure program ID is a PublicKey object
    const programId = new PublicKey(MULTIHUB_SWAP_PROGRAM_ID);
    
    // Try to find the program state account - must match the contract's findProgramStateAddress
    const [programStateAddress] = await PublicKey.findProgramAddress(
      [Buffer.from("state")],
      programId
    );
    console.log("Program state address:", programStateAddress.toString());
    
    // Find SOL-YOT pool address - must match what's defined in the contract
    const SOL_YOT_POOL_SEED = "sol_yot_pool";
    const [poolAddress] = await PublicKey.findProgramAddress(
      [Buffer.from(SOL_YOT_POOL_SEED)],
      programId
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

    // Create instruction data for swap that matches the contract's expected format
    // In the contract:
    // fn process_swap(
    //   program_id: &Pubkey,
    //   accounts: &[AccountInfo],
    //   amount_in: u64,
    //   minimum_amount_out: u64,
    //   input_token_mint: Pubkey,
    //   output_token_mint: Pubkey,
    //   referrer: Option<Pubkey>,
    // )
    
    // Simplify the instruction data format to avoid serialization issues
    // Instruction format:
    // - 1 byte: instruction type (1 = swap)
    // - 8 bytes: amount_in as u64
    // - 8 bytes: minimum_amount_out as u64
    
    const instructionType = 1; // Swap instruction type
    
    // Calculate the total data size - simplified version
    // 1 byte for instruction + 8 bytes for amount_in + 8 bytes for min_amount_out
    const data = Buffer.alloc(1 + 8 + 8);
    
    // Write instruction type
    data.writeUInt8(instructionType, 0);
    let offset = 1;
    
    // Write amount_in and minimum_amount_out (as fixed-point numbers with 9 decimals)
    const amountInRaw = BigInt(Math.floor(amount * 1_000_000_000));
    const minAmountOutRaw = BigInt(Math.floor(minAmountOut * 1_000_000_000));
    
    // Write the values directly to the buffer
    data.writeBigUInt64LE(amountInRaw, offset);
    offset += 8;
    
    data.writeBigUInt64LE(minAmountOutRaw, offset);
    // The token mints are already provided as accounts in the transaction instruction
    
    console.log("Swap instruction data:", data.toString('hex'));
    
    console.log(`Converting ${amount} to raw value: ${amountInRaw}`);
    console.log(`Converting ${minAmountOut} to raw value: ${minAmountOutRaw}`);
    
    // Account ordering must exactly match what's expected in the process_swap function:
    // 
    // 0. `[signer]` User's wallet
    // 1. `[writable]` User's token account for input token
    // 2. `[writable]` User's token account for output token
    // 3. `[writable]` User's YOS token account for cashback
    // 4. `[writable]` Program state account
    // 5. `[writable]` SOL-YOT liquidity pool account
    // 6. `[writable]` Admin fee account 
    // 7. `[]` Token program
    // 8. `[]` Input token mint
    // 9. `[]` Output token mint
    // 10. `[writable]` (Optional) Referrer's account
    //
    
    // For admin fee account, use a derived address
    const [adminFeeAddress] = await PublicKey.findProgramAddress(
      [Buffer.from("fee")],
      programId
    );
    console.log("Admin fee address:", adminFeeAddress.toString());
    
    // Add the system program as we might need it for account creation
    const systemProgram = SystemProgram.programId;
    
    // Include the token mints explicitly in the transaction
    const swapInstruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },             // 0. User wallet (signer)
        { pubkey: fromTokenAccount, isSigner: false, isWritable: true },            // 1. User's input token account
        { pubkey: toTokenAccount, isSigner: false, isWritable: true },              // 2. User's output token account
        { pubkey: yosTokenAccount, isSigner: false, isWritable: true },             // 3. User's YOS token account for cashback
        { pubkey: programStateAddress, isSigner: false, isWritable: true },         // 4. Program state account
        { pubkey: poolAddress, isSigner: false, isWritable: true },                 // 5. SOL-YOT liquidity pool account
        { pubkey: adminFeeAddress, isSigner: false, isWritable: true },             // 6. Admin fee account
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },           // 7. Token program
        { pubkey: fromMint, isSigner: false, isWritable: false },                   // 8. Input token mint
        { pubkey: toMint, isSigner: false, isWritable: false },                     // 9. Output token mint
        { pubkey: systemProgram, isSigner: false, isWritable: false },              // 10. System program
        // No referrer for now
      ],
      programId,
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
    
    // First - log the transaction for debugging
    console.log("Transaction accounts:", transaction.instructions[transaction.instructions.length - 1].keys.map(k => 
      `${k.pubkey.toString()} (writable: ${k.isWritable}, signer: ${k.isSigner})`
    ));
    
    // Sign and send transaction - with improved error handling
    try {
      console.log("Sending transaction to wallet...");
      
      // Simulate the transaction before sending to catch any issues
      console.log("Simulating transaction before sending...");
      try {
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          console.error("Transaction simulation failed:", simulation.value.err);
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
        console.log("Simulation successful!");
      } catch (simError: any) {
        console.error("Simulation error:", simError);
        throw new Error(`Pre-flight simulation failed: ${simError.message}`);
      }
      
      // Try signing and sending with preflight disabled as a fallback option
      console.log("Attempting to send transaction with wallet.sendTransaction...");
      let signature;
      
      try {
        // First attempt - normal sign and send
        signature = await wallet.sendTransaction(transaction, connection, {
          skipPreflight: true, // Disable preflight as we've already simulated
          preflightCommitment: 'processed',
          maxRetries: 3,
        });
      } catch (sendError: any) {
        console.error("Initial transaction send failed:", sendError.message);
        
        // Fallback for Phantom wallet - use signTransaction + sendRawTransaction pattern
        if (sendError.name === "WalletSendTransactionError" && wallet.signTransaction) {
          console.log("Trying alternative sign + send pattern...");
          
          // 1. Sign transaction with wallet
          const signedTransaction = await wallet.signTransaction(transaction);
          console.log("Transaction signed successfully, now sending raw transaction...");
          
          // 2. Send raw transaction
          signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
            skipPreflight: true,
            preflightCommitment: 'processed',
            maxRetries: 5,
          });
          
          console.log("Raw transaction sent successfully");
        } else {
          // Re-throw if we can't handle it
          throw sendError;
        }
      }
      
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
      
      // Enhanced wallet error handling
      if (error.name === 'WalletSendTransactionError') {
        console.error("Wallet send transaction error:", error);
        
        if (error.message.includes("Unexpected error")) {
          // Could be a wallet connection issue
          throw new Error("Wallet connection error. Please reconnect your wallet and try again.");
        } else if (error.message.includes("User rejected")) {
          throw new Error("Transaction was rejected by the wallet. Please approve the transaction.");
        } else {
          throw new Error(`Wallet error: ${error.message}`);
        }
      }
      
      // Handle simulation errors
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