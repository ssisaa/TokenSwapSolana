import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { solanaConfig } from './config';
import { connection, calculateSolToYot } from './solana';

// Extract necessary constants from solanaConfig
const POOL_SOL_ACCOUNT = solanaConfig.pool.solAccount;
const YOT_TOKEN_ADDRESS = solanaConfig.tokens.yot.address;
const YOS_TOKEN_ADDRESS = solanaConfig.tokens.yos.address;
const MULTI_HUB_SWAP_PROGRAM_ID = solanaConfig.multiHubSwap.programId;

// Get token accounts from the config
// For YOT and YOS token accounts, we'll use getAssociatedTokenAddress at runtime

// Helper functions
export function findProgramStateAddress(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    programId
  );
}

export function findProgramAuthority(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    programId
  );
}

export function findLiquidityContributionAddress(userWallet: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userWallet.toBuffer()],
    programId
  );
}

// Ensure user has a token account for the specified mint
export async function ensureTokenAccount(
  wallet: any,
  connection: Connection,
  tokenMint: PublicKey
): Promise<{
  needsTokenAccount: boolean;
  transaction?: Transaction;
  userTokenAccount: string;
}> {
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  const associatedTokenAddress = await getAssociatedTokenAddress(
    tokenMint,
    wallet.publicKey
  );
  
  try {
    // Check if account exists
    await connection.getTokenAccountBalance(associatedTokenAddress);
    
    // Account exists
    return {
      needsTokenAccount: false,
      userTokenAccount: associatedTokenAddress.toString()
    };
  } catch (error) {
    // Need to create token account
    const transaction = new Transaction();
    transaction.add(
      require('@solana/spl-token').createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        associatedTokenAddress, // ata
        wallet.publicKey, // owner
        tokenMint // mint
      )
    );
    
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    return {
      needsTokenAccount: true,
      transaction,
      userTokenAccount: associatedTokenAddress.toString()
    };
  }
}

// Function to create a SOL to YOT swap instruction
export function createSolToYotSwapInstruction(
  userWallet: PublicKey,
  amountInLamports: number,
  minAmountOutTokens: number,
  programId: PublicKey,
  programStateAddress: PublicKey,
  programAuthority: PublicKey,
  solPoolAccount: PublicKey,
  yotPoolAccount: PublicKey,
  userYotAccount: PublicKey,
  liquidityContributionAccount: PublicKey,
  yosMint: PublicKey,
  userYosAccount: PublicKey,
): TransactionInstruction {
  // Instruction data: [7, amountIn (8 bytes), minAmountOut (8 bytes)]
  const data = Buffer.alloc(17);
  data.writeUint8(7, 0); // SOL to YOT Swap instruction (index 7)
  data.writeBigUInt64LE(BigInt(amountInLamports), 1);
  data.writeBigUInt64LE(BigInt(minAmountOutTokens), 9);
  
  // Required accounts for the SOL to YOT swap
  const accounts = [
    { pubkey: userWallet, isSigner: true, isWritable: true },
    { pubkey: programStateAddress, isSigner: false, isWritable: false },
    { pubkey: programAuthority, isSigner: false, isWritable: false },
    { pubkey: solPoolAccount, isSigner: false, isWritable: true },
    { pubkey: yotPoolAccount, isSigner: false, isWritable: true },
    { pubkey: userYotAccount, isSigner: false, isWritable: true },
    { pubkey: liquidityContributionAccount, isSigner: false, isWritable: true },
    { pubkey: yosMint, isSigner: false, isWritable: true },
    { pubkey: userYosAccount, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), isSigner: false, isWritable: false },
    { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId,
    keys: accounts,
    data,
  });
}

// Main function to perform SOL to YOT swap
export async function swapSolToYotV2(
  wallet: any,
  solAmount: number,
  slippagePercent: number = 1.0
): Promise<{
  success: boolean,
  signature?: string,
  error?: string,
  message?: string
}> {
  try {
    console.log(`Swapping ${solAmount} SOL to YOT with ${slippagePercent}% slippage...`);
    
    // Use the imported connection instead of getConnection
    if (!wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    // Convert SOL to lamports
    const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    
    // Get pool balances and accounts
    const solPoolAccount = new PublicKey(POOL_SOL_ACCOUNT);
    const poolAuthority = new PublicKey(solanaConfig.pool.authority);
    const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const programId = new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID);
    
    // Get the pool's YOT token account (ATA owned by pool authority)
    const yotPoolAccount = await getAssociatedTokenAddress(
      yotMint,
      poolAuthority
    );
    
    // Calculate expected YOT output using the AMM rate
    const expectedOutput = await calculateSolToYot(solAmount);
    console.log(`Expected YOT output based on AMM rate: ${expectedOutput}`);
    
    // Apply slippage tolerance
    const minAmountOut = Math.floor(
      expectedOutput * (1 - slippagePercent / 100) * Math.pow(10, 9) // Convert to token units with 9 decimals
    );
    
    console.log(`Min YOT output with slippage: ${minAmountOut / Math.pow(10, 9)}`);
    
    // Ensure user has YOT token account
    const userYotResult = await ensureTokenAccount(
      wallet,
      connection,
      new PublicKey(YOT_TOKEN_ADDRESS)
    );
    
    if (userYotResult.needsTokenAccount && userYotResult.transaction) {
      console.log('Creating YOT token account first...');
      await wallet.signTransaction(userYotResult.transaction);
      const createTokenAcctSignature = await connection.sendRawTransaction(
        userYotResult.transaction.serialize()
      );
      await connection.confirmTransaction(createTokenAcctSignature);
      console.log('YOT token account created:', userYotResult.userTokenAccount);
    }
    
    // Ensure user has YOS token account
    const userYosResult = await ensureTokenAccount(
      wallet,
      connection,
      yosMint
    );
    
    if (userYosResult.needsTokenAccount && userYosResult.transaction) {
      console.log('Creating YOS token account first...');
      await wallet.signTransaction(userYosResult.transaction);
      const createTokenAcctSignature = await connection.sendRawTransaction(
        userYosResult.transaction.serialize()
      );
      await connection.confirmTransaction(createTokenAcctSignature);
      console.log('YOS token account created:', userYosResult.userTokenAccount);
    }
    
    // Get necessary addresses
    const userYotAccount = await getAssociatedTokenAddress(
      new PublicKey(YOT_TOKEN_ADDRESS),
      wallet.publicKey
    );
    
    const userYosAccount = await getAssociatedTokenAddress(
      yosMint,
      wallet.publicKey
    );
    
    const [programStateAddress] = findProgramStateAddress(programId);
    const [programAuthority] = findProgramAuthority(programId);
    const [liquidityContributionAccount] = findLiquidityContributionAddress(
      wallet.publicKey,
      programId
    );
    
    // Create the swap instruction
    const swapInstruction = createSolToYotSwapInstruction(
      wallet.publicKey,
      amountInLamports,
      minAmountOut,
      programId,
      programStateAddress,
      programAuthority,
      solPoolAccount,
      yotPoolAccount,
      userYotAccount,
      liquidityContributionAccount,
      yosMint,
      userYosAccount
    );
    
    // Create and sign the transaction
    const transaction = new Transaction();
    transaction.add(swapInstruction);
    transaction.feePayer = wallet.publicKey;
    
    const blockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash.blockhash;
    
    // Sign and send the transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    console.log(`SOL to YOT swap transaction sent: ${signature}`);
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature);
    if (confirmation.value.err) {
      console.error('Transaction failed:', confirmation.value.err);
      return {
        success: false,
        error: 'Transaction failed on-chain',
        message: JSON.stringify(confirmation.value.err)
      };
    }
    
    console.log('SOL to YOT swap completed successfully!');
    return {
      success: true,
      signature,
      message: `Successfully swapped ${solAmount} SOL for YOT tokens`
    };
  } catch (error) {
    console.error('Error during SOL to YOT swap:', error);
    return {
      success: false,
      error: 'Error during swap',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

// Export the main entry point for integration with solana.ts
export async function solToYotSwap(wallet: any, solAmount: number): Promise<string | any> {
  console.log(`[SOL-YOT SWAP V2] Initiating with SOL amount: ${solAmount}`);
  
  try {
    // Use 1% slippage by default
    const slippagePercent = 1.0;
    
    // Execute the smart contract swap
    const result = await swapSolToYotV2(wallet, solAmount, slippagePercent);
    
    if (result.success) {
      console.log(`[SOL-YOT SWAP V2] Complete swap successful! Signature: ${result.signature}`);
      return result.signature;
    } else {
      console.error(`[SOL-YOT SWAP V2] Swap failed: ${result.message}`);
      throw new Error(result.message || "Swap failed. Please try again.");
    }
  } catch (error) {
    console.error("[SOL-YOT SWAP V2] Error:", error);
    throw error;
  }
}