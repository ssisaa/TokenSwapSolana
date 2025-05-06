import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { appConfig } from './config';
import { 
  ensureTokenAccount, 
  findProgramStateAddress, 
  findLiquidityContributionAddress,
  findProgramAuthority
} from './solana';

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
export async function swapSolToYot(
  wallet: any,
  connection: Connection,
  amountInSol: number,
  slippagePercent: number = 0.5
): Promise<{
  success: boolean,
  signature?: string,
  error?: string,
  message?: string
}> {
  try {
    console.log(`Swapping ${amountInSol} SOL to YOT...`);
    
    // Convert SOL to lamports
    const amountInLamports = Math.floor(amountInSol * LAMPORTS_PER_SOL);
    
    // Get pool balances to calculate expected output
    const solPoolAccount = new PublicKey(appConfig.pools.solana.address);
    const yotPoolAccount = new PublicKey(appConfig.pools.yot.tokenAccount);
    const yosMint = new PublicKey(appConfig.tokens.yos.mint);
    const programId = new PublicKey(appConfig.programId);
    
    // Get SOL pool balance
    const solPoolBalance = await connection.getBalance(solPoolAccount);
    
    // Get YOT token account balance
    const yotPoolInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotPoolInfo.value.amount);
    
    // Simple constant product formula (x * y = k)
    // Calculate expected output amount
    const solBalanceBefore = solPoolBalance;
    const expectedOutput = Math.floor(
      (amountInLamports * yotPoolBalance) / solBalanceBefore
    );
    
    // Apply slippage tolerance
    const minAmountOut = Math.floor(
      expectedOutput * (1 - slippagePercent / 100)
    );
    
    console.log(`Expected YOT output: ${expectedOutput}, Min output with slippage: ${minAmountOut}`);
    
    // Ensure user has YOT token account
    const userYotResult = await ensureTokenAccount(
      wallet,
      connection,
      new PublicKey(appConfig.tokens.yot.mint)
    );
    
    if (userYotResult.needsTokenAccount) {
      console.log('Creating YOT token account first...');
      await wallet.signTransaction(userYotResult.transaction);
      const createTokenAcctSignature = await connection.sendTransaction(
        userYotResult.transaction, 
        [wallet.payer]
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
    
    if (userYosResult.needsTokenAccount) {
      console.log('Creating YOS token account first...');
      await wallet.signTransaction(userYosResult.transaction);
      const createTokenAcctSignature = await connection.sendTransaction(
        userYosResult.transaction, 
        [wallet.payer]
      );
      await connection.confirmTransaction(createTokenAcctSignature);
      console.log('YOS token account created:', userYosResult.userTokenAccount);
    }
    
    // Get necessary addresses
    const userYotAccount = await getAssociatedTokenAddress(
      new PublicKey(appConfig.tokens.yot.mint),
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
    await wallet.signTransaction(transaction);
    const signature = await connection.sendTransaction(transaction, [wallet.payer]);
    
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
      message: `Successfully swapped ${amountInSol} SOL for at least ${minAmountOut} YOT tokens`
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

// Function to simulate the swap transaction without executing it
export async function simulateSolToYotSwap(
  wallet: any,
  connection: Connection,
  amountInSol: number
): Promise<{
  success: boolean,
  expectedOutput?: number,
  userPortion?: number,
  liquidityPortion?: number,
  yosCashback?: number,
  error?: string,
  message?: string
}> {
  try {
    // Convert SOL to lamports
    const amountInLamports = Math.floor(amountInSol * LAMPORTS_PER_SOL);
    
    // Get pool balances
    const solPoolAccount = new PublicKey(appConfig.pools.solana.address);
    const yotPoolAccount = new PublicKey(appConfig.pools.yot.tokenAccount);
    
    const solPoolBalance = await connection.getBalance(solPoolAccount);
    const yotPoolInfo = await connection.getTokenAccountBalance(yotPoolAccount);
    const yotPoolBalance = Number(yotPoolInfo.value.amount);
    
    // Calculate expected output using the same formula as in the smart contract
    const solBalanceBefore = solPoolBalance;
    const expectedOutput = Math.floor(
      (amountInLamports * yotPoolBalance) / solBalanceBefore
    );
    
    // Calculate distribution according to program parameters
    const userPortion = Math.floor(expectedOutput * 0.75); // 75%
    const liquidityPortion = Math.floor(expectedOutput * 0.20); // 20%
    const yosCashback = Math.floor(expectedOutput * 0.05); // 5%
    
    return {
      success: true,
      expectedOutput,
      userPortion,
      liquidityPortion,
      yosCashback,
      message: `Swapping ${amountInSol} SOL would yield approximately ${expectedOutput} YOT tokens`
    };
  } catch (error) {
    console.error('Error simulating SOL to YOT swap:', error);
    return {
      success: false,
      error: 'Simulation error',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}