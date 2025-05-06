/**
 * Client interface for the simplified SOL to YOT swap program
 * 
 * This module provides functions to interact with the on-chain swap program
 * that handles direct SOL to YOT swaps with distribution based on ratios:
 * - SOL: 80% to pool, 20% to common wallet
 * - YOT: 80% to user, 20% to common wallet
 * - Additionally: 5% YOS as cashback to the user
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  SIMPLIFIED_SWAP_PROGRAM_ID,
  YOT_MINT,
  YOS_MINT,
  SOL_POOL_WALLET,
  YOT_POOL_TOKEN_ACCOUNT,
  COMMON_WALLET_ADDRESS,
  SOL_DISTRIBUTION_RATIO,
  YOT_DISTRIBUTION_RATIO,
  YOS_CASHBACK_PERCENTAGE,
  getRpcEndpoint,
} from './configConstants';
import { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction, 
  getAccount,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { Buffer } from 'buffer';

/**
 * Find program state PDA for the simplified swap program
 * @returns [pda, bump]
 */
export function findProgramStatePda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID)
  );
}

/**
 * Find program authority PDA for the simplified swap program
 * @returns [pda, bump]
 */
export function findProgramAuthorityPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID)
  );
}

/**
 * Create instruction data for the SOL to YOT swap
 * 
 * @param solAmount Amount of SOL in lamports
 * @param minYotAmount Minimum YOT amount with slippage protection
 * @returns Instruction data buffer
 */
export function createSwapSolToYotInstructionData(
  solAmount: number,
  minYotAmount: number
): Buffer {
  // Create buffer: 1 byte (instruction) + 8 bytes (amount) + 8 bytes (min amount) 
  // + 1 byte (user ratio) + 1 byte (common ratio) + 1 byte (cashback percentage)
  const buffer = Buffer.alloc(20);
  
  // Instruction discriminator: 0 for Initialize, 1 for SwapSolToYot
  buffer.writeUInt8(1, 0);
  
  // SOL amount in lamports
  buffer.writeBigUInt64LE(BigInt(solAmount), 1);
  
  // Min YOT amount (slippage protection)
  buffer.writeBigUInt64LE(BigInt(minYotAmount), 9);
  
  // Distribution ratios and cashback percentage
  buffer.writeUInt8(YOT_DISTRIBUTION_RATIO, 17); // 80% to user
  buffer.writeUInt8(100 - YOT_DISTRIBUTION_RATIO, 18); // 20% to common wallet
  buffer.writeUInt8(YOS_CASHBACK_PERCENTAGE, 19); // 5% YOS cashback
  
  return buffer;
}

/**
 * Check if token account exists and create it if needed
 * @param connection Solana connection
 * @param tokenMint Token mint address
 * @param owner Token account owner
 * @returns Token account address and a create instruction (if needed)
 */
/**
 * Create a separate transaction to create token accounts for the user
 * @param connection Solana connection
 * @param wallet User's wallet
 * @param requiredMints List of token mints to check accounts for
 * @returns Transaction to create token accounts, or null if none needed
 */
export async function createRequiredTokenAccounts(
  connection: Connection,
  wallet: PublicKey,
  requiredMints: PublicKey[]
): Promise<Transaction | null> {
  // Array to hold create instructions
  const createInstructions: TransactionInstruction[] = [];
  
  // Check each token account and add create instructions if needed
  for (const mint of requiredMints) {
    const tokenAccount = await getAssociatedTokenAddress(mint, wallet);
    
    try {
      // Check if account exists
      await getAccount(connection, tokenAccount);
      console.log(`Token account ${tokenAccount.toBase58()} already exists for mint ${mint.toBase58()}`);
    } catch (error: any) {
      // Account doesn't exist, add create instruction
      console.log(`Creating token account ${tokenAccount.toBase58()} for mint ${mint.toBase58()}`);
      
      const createInstruction = createAssociatedTokenAccountInstruction(
        wallet, // payer (using the user's wallet as the payer)
        tokenAccount, // associated token account address
        wallet, // owner
        mint // mint
      );
      
      createInstructions.push(createInstruction);
    }
  }
  
  // If no instructions needed, return null
  if (createInstructions.length === 0) {
    console.log('No token accounts need to be created');
    return null;
  }
  
  // Create and return transaction with all create instructions
  const transaction = new Transaction();
  for (const instruction of createInstructions) {
    transaction.add(instruction);
  }
  
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet;
  
  console.log(`Created transaction to create ${createInstructions.length} token accounts`);
  return transaction;
}

/**
 * Check if a token account exists and if not, include an instruction to create it
 * @param connection Solana connection
 * @param tokenMint Token mint address
 * @param owner Token account owner
 * @param payer The account that will pay for the creation (usually the user)
 * @param createIfMissing Whether to create the account if it's missing
 * @returns Object with the token account address and a creation instruction if needed
 */
async function getOrCreateTokenAccount(
  connection: Connection,
  tokenMint: PublicKey,
  owner: PublicKey,
  payer: PublicKey,
  createIfMissing = true
): Promise<{
  tokenAccount: PublicKey;
  createInstruction: TransactionInstruction | null;
}> {
  // Get associated token address
  const tokenAccount = await getAssociatedTokenAddress(tokenMint, owner);
  console.log(`Token account for mint ${tokenMint.toBase58()} is ${tokenAccount.toBase58()}`);
  
  try {
    // Check if account exists
    await getAccount(connection, tokenAccount);
    console.log(`Token account ${tokenAccount.toBase58()} already exists`);
    return { tokenAccount, createInstruction: null };
  } catch (error) {
    // Account doesn't exist
    console.log(`Token account ${tokenAccount.toBase58()} doesn't exist`);
    
    if (createIfMissing) {
      console.log(`Creating instruction for token account ${tokenAccount.toBase58()}`);
      // Create instruction to create token account
      const createInstruction = createAssociatedTokenAccountInstruction(
        payer, // payer
        tokenAccount, // associated token account
        owner, // owner
        tokenMint // mint
      );
      return { tokenAccount, createInstruction };
    }
    
    // Don't create the account, just return its address
    return { tokenAccount, createInstruction: null };
  }
}

/**
 * Create a transaction for SOL to YOT swap including any needed token account creation
 */
export async function createSwapSolToYotTransaction(
  wallet: PublicKey,
  solAmount: number,
  minYotAmount: number,
  connection: Connection
): Promise<Transaction> {
  console.log(`Creating SOL to YOT swap transaction for ${solAmount} SOL (${wallet.toBase58()})`);
  
  // Convert SOL to lamports
  const lamports = solAmount * LAMPORTS_PER_SOL;
  
  // Get required PDAs
  const [programStatePda] = findProgramStatePda();
  const [programAuthorityPda] = findProgramAuthorityPda();
  
  // Get token accounts for the user and create them if needed
  const yotMintPubkey = new PublicKey(YOT_MINT);
  const yosMintPubkey = new PublicKey(YOS_MINT);
  
  // Create transaction
  const transaction = new Transaction();
  
  // Create token accounts if needed
  console.log('Checking user YOT token account...');
  const { tokenAccount: userYotAccount, createInstruction: createYotInstruction } = 
    await getOrCreateTokenAccount(connection, yotMintPubkey, wallet, wallet);
  
  console.log('Checking user YOS token account...');
  const { tokenAccount: userYosAccount, createInstruction: createYosInstruction } = 
    await getOrCreateTokenAccount(connection, yosMintPubkey, wallet, wallet);
  
  // Get the common wallet token account
  console.log('Checking common wallet YOT token account...');
  const commonWalletPubkey = new PublicKey(COMMON_WALLET_ADDRESS);
  const { tokenAccount: commonWalletYotAccount, createInstruction: createCommonWalletYotInstruction } = 
    await getOrCreateTokenAccount(connection, yotMintPubkey, commonWalletPubkey, wallet, true);
  
  // Add create instructions if needed
  if (createYotInstruction) {
    console.log('Adding instruction to create YOT token account');
    transaction.add(createYotInstruction);
  }
  
  if (createYosInstruction) {
    console.log('Adding instruction to create YOS token account');
    transaction.add(createYosInstruction);
  }
  
  if (createCommonWalletYotInstruction) {
    console.log('Adding instruction to create common wallet YOT token account');
    transaction.add(createCommonWalletYotInstruction);
  }
  
  // Create the swap instruction data
  console.log(`Creating swap instruction with ${lamports} lamports and minimum ${minYotAmount} YOT`);
  const instructionData = createSwapSolToYotInstructionData(lamports, minYotAmount);
  
  // Create the swap instruction with detailed logging
  console.log('Creating swap instruction with the following accounts:');
  console.log(`1. Wallet (signer): ${wallet.toBase58()}`);
  console.log(`2. Program State PDA: ${programStatePda.toBase58()}`);
  console.log(`3. Program Authority PDA: ${programAuthorityPda.toBase58()}`);
  console.log(`4. SOL Pool Wallet: ${SOL_POOL_WALLET}`);
  console.log(`5. YOT Pool Token Account: ${YOT_POOL_TOKEN_ACCOUNT}`);
  console.log(`6. User YOT Account: ${userYotAccount.toBase58()}`);
  console.log(`7. Common Wallet: ${COMMON_WALLET_ADDRESS}`);
  console.log(`8. YOS Mint: ${YOS_MINT}`);
  console.log(`9. User YOS Account: ${userYosAccount.toBase58()}`);
  console.log(`10. System Program: ${SystemProgram.programId.toBase58()}`);
  console.log(`11. Token Program: ${TOKEN_PROGRAM_ID.toBase58()}`);
  console.log(`12. Common Wallet YOT Account: ${commonWalletYotAccount.toBase58()}`);
  
  const accountMetas = [
    { pubkey: wallet, isSigner: true, isWritable: true },
    { pubkey: programStatePda, isSigner: false, isWritable: true }, // Changed to writable
    { pubkey: programAuthorityPda, isSigner: false, isWritable: true }, // Changed to writable
    { pubkey: new PublicKey(SOL_POOL_WALLET), isSigner: false, isWritable: true },
    { pubkey: new PublicKey(YOT_POOL_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
    { pubkey: userYotAccount, isSigner: false, isWritable: true },
    { pubkey: new PublicKey(COMMON_WALLET_ADDRESS), isSigner: false, isWritable: true },
    { pubkey: new PublicKey(YOS_MINT), isSigner: false, isWritable: true },
    { pubkey: userYosAccount, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: commonWalletYotAccount, isSigner: false, isWritable: true },
  ];
  
  const swapInstruction = new TransactionInstruction({
    programId: new PublicKey(SIMPLIFIED_SWAP_PROGRAM_ID),
    keys: accountMetas,
    data: instructionData,
  });
  
  // Add the swap instruction
  transaction.add(swapInstruction);
  
  // Get recent blockhash for transaction
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet;
  
  console.log(`Transaction created with ${transaction.instructions.length} instructions`);
  if (transaction.instructions.length > 1) {
    console.log(`Including ${transaction.instructions.length - 1} token account creation instructions`);
  }
  
  return transaction;
}

/**
 * Execute a SOL to YOT swap 
 * 
 * @param wallet User's wallet (must have sendTransaction method)
 * @param solAmount Amount of SOL to swap
 * @param minYotAmount Minimum YOT tokens to receive (slippage protection)
 * @param connection Solana connection
 * @returns Transaction signature
 */
export async function swapSolToYot(
  wallet: any,
  solAmount: number,
  minYotAmount: number,
  connection: Connection
): Promise<string> {
  try {
    console.log(`Initiating SOL to YOT swap: ${solAmount} SOL with minimum ${minYotAmount} YOT`);
    console.log(`Distribution ratios: ${YOT_DISTRIBUTION_RATIO}% to user, ${100-YOT_DISTRIBUTION_RATIO}% to common wallet, ${YOS_CASHBACK_PERCENTAGE}% YOS cashback`);
    
    // First, check if all token accounts already exist
    const yotMintPubkey = new PublicKey(YOT_MINT);
    const yosMintPubkey = new PublicKey(YOS_MINT);
    const userYotAccount = await getAssociatedTokenAddress(yotMintPubkey, wallet.publicKey);
    const userYosAccount = await getAssociatedTokenAddress(yosMintPubkey, wallet.publicKey);
    const commonWalletPubkey = new PublicKey(COMMON_WALLET_ADDRESS);
    const commonWalletYotAccount = await getAssociatedTokenAddress(yotMintPubkey, commonWalletPubkey);
    
    let userAccountsExist = true;
    let commonAccountsExist = true;
    
    // Check user accounts
    try {
      await getAccount(connection, userYotAccount);
      console.log(`User YOT account ${userYotAccount.toBase58()} exists`);
    } catch (error) {
      console.log(`User YOT account ${userYotAccount.toBase58()} does not exist`);
      userAccountsExist = false;
    }
    
    try {
      await getAccount(connection, userYosAccount);
      console.log(`User YOS account ${userYosAccount.toBase58()} exists`);
    } catch (error) {
      console.log(`User YOS account ${userYosAccount.toBase58()} does not exist`);
      userAccountsExist = false;
    }
    
    // Check common wallet account
    try {
      await getAccount(connection, commonWalletYotAccount);
      console.log(`Common wallet YOT account ${commonWalletYotAccount.toBase58()} exists`);
    } catch (error) {
      console.log(`Common wallet YOT account ${commonWalletYotAccount.toBase58()} does not exist`);
      commonAccountsExist = false;
    }
    
    // If any accounts are missing, create them in separate transactions first
    if (!userAccountsExist || !commonAccountsExist) {
      console.log("One or more token accounts need to be created...");
      
      // Create user accounts if needed
      if (!userAccountsExist) {
        console.log("Creating user token accounts...");
        
        const userAccountsTx = new Transaction();
        let instructionCount = 0;
        
        try {
          await getAccount(connection, userYotAccount);
        } catch (error) {
          userAccountsTx.add(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey,
              userYotAccount,
              wallet.publicKey,
              yotMintPubkey
            )
          );
          instructionCount++;
        }
        
        try {
          await getAccount(connection, userYosAccount);
        } catch (error) {
          userAccountsTx.add(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey,
              userYosAccount,
              wallet.publicKey,
              yosMintPubkey
            )
          );
          instructionCount++;
        }
        
        if (instructionCount > 0) {
          const { blockhash } = await connection.getLatestBlockhash();
          userAccountsTx.recentBlockhash = blockhash;
          userAccountsTx.feePayer = wallet.publicKey;
          
          console.log(`Sending transaction to create ${instructionCount} user token accounts...`);
          
          try {
            let signature;
            if (wallet.signTransaction) {
              const signedTx = await wallet.signTransaction(userAccountsTx);
              signature = await connection.sendRawTransaction(signedTx.serialize());
            } else {
              signature = await wallet.sendTransaction(userAccountsTx, connection);
            }
            
            console.log(`User accounts creation transaction sent: ${signature}`);
            await connection.confirmTransaction(signature, 'confirmed');
            console.log("User token accounts created successfully");
          } catch (error) {
            console.error("Failed to create user token accounts:", error);
            throw new Error("Failed to create required user token accounts. Please try again.");
          }
        }
      }
      
      // If common wallet account is missing, we need to inform the user
      if (!commonAccountsExist) {
        console.warn("Common wallet token account is missing!");
        console.warn("This account must be created by the admin wallet.");
        console.warn("Continuing with swap regardless to test if it succeeds...");
      }
    }
    
    // Now create the actual swap transaction
    console.log("Creating swap transaction...");
    const transaction = await createSwapSolToYotTransaction(
      wallet.publicKey,
      solAmount,
      minYotAmount,
      connection
    );
    
    // Sign and send the transaction
    console.log('Sending transaction to wallet for approval...');
    
    try {
      // Send with skipPreflight=true to bypass simulation errors
      console.log('Using skipPreflight=true to bypass simulation checks');
      
      let signature;
      if (wallet.signTransaction) {
        console.log('Using sign + send approach for transaction...');
        const signedTransaction = await wallet.signTransaction(transaction);
        
        // Send with skipPreflight=true to bypass simulation errors
        signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: true
        });
      } else {
        // Standard sendTransaction approach
        console.log('Using standard wallet.sendTransaction approach with skipPreflight');
        const options = {
          skipPreflight: true
        };
        signature = await wallet.sendTransaction(transaction, connection, options);
      }
      
      console.log(`Swap transaction sent: ${signature}`);
      
      // Wait for confirmation
      console.log('Waiting for transaction confirmation...');
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        console.error('Transaction failed during confirmation:', confirmation.value.err);
        throw new Error(`Transaction confirmed but failed: ${confirmation.value.err}`);
      }
      
      console.log('Transaction confirmed successfully!');
      return signature;
      
    } catch (txError) {
      console.error('Error in transaction signing/sending:', txError);
      
      // Log the error details for debugging
      console.error('Detailed error:', JSON.stringify(txError, null, 2));
      
      // InstructionError is a common error that needs special handling
      if (txError && typeof txError === 'object' && 'InstructionError' in txError) {
        const instructionIndex = txError.InstructionError[0];
        const errorDetails = txError.InstructionError[1];
        
        console.error(`Instruction Error at index ${instructionIndex}:`, errorDetails);
        
        // Provide a more detailed error message
        if (typeof errorDetails === 'object' && 'Custom' in errorDetails) {
          const customErrorCode = errorDetails.Custom;
          throw new Error(`Program custom error: Code ${customErrorCode}. This is likely a constraint in the on-chain program that wasn't met.`);
        } else if (typeof errorDetails === 'string') {
          throw new Error(`Transaction failed: ${errorDetails} at instruction ${instructionIndex}. This might be due to the token accounts not being properly set up.`);
        } else {
          throw new Error(`Transaction failed at instruction ${instructionIndex}. The program returned an error. This might be due to missing accounts or permissions.`);
        }
      }
      
      // Enhanced error handling with specific user-friendly messages
      const errorMessage = txError instanceof Error ? txError.message : JSON.stringify(txError);
      
      if (errorMessage.includes('User rejected')) {
        throw new Error('Transaction was rejected by the user in wallet');
      } else if (errorMessage.includes('insufficient funds')) {
        throw new Error('Insufficient SOL in wallet to complete the transaction');
      } else if (errorMessage.includes('invalid account data')) {
        throw new Error('Transaction failed: One of the required token accounts may be missing or invalid. Please try using the admin wallet to create the required token accounts first.');
      } else if (errorMessage.includes('reverted during simulation')) {
        throw new Error('Transaction simulation failed: The transaction would fail on-chain. This might be due to a bug in the program or missing token accounts for the common wallet. Please check with the admin to ensure all required accounts are set up.');
      } else if (errorMessage.includes('exceeded the maximum number of instructions')) {
        throw new Error('Transaction failed: Too many instructions in one transaction. Please try a smaller amount');
      } else {
        // For other errors, provide as much context as possible
        throw new Error(`Transaction error: ${errorMessage}. This might be due to an issue with the on-chain program or account setup.`);
      }
    }
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error executing SOL to YOT swap:', errorMessage);
    throw error;
  }
}