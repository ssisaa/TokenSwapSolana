import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Keypair
} from '@solana/web3.js';
import { 
  createTransferInstruction, 
  getAccount, 
  getMint, 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TokenAccountNotFoundError,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { 
  ENDPOINT, 
  POOL_AUTHORITY, 
  POOL_SOL_ACCOUNT, 
  YOT_TOKEN_ADDRESS,
  SWAP_FEE
} from './constants';

// Create a connection to the Solana cluster
export const connection = new Connection(ENDPOINT, 'confirmed');

// Convert lamports to SOL
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

// Convert SOL to lamports
export function solToLamports(sol: number): number {
  return sol * LAMPORTS_PER_SOL;
}

// Get SOL balance for a wallet
export async function getSolBalance(publicKey: PublicKey): Promise<number> {
  try {
    const balance = await connection.getBalance(publicKey);
    return lamportsToSol(balance);
  } catch (error) {
    console.error('Error getting SOL balance:', error);
    throw error;
  }
}

// Get token balance for a wallet
export async function getTokenBalance(
  tokenMintAddress: string,
  walletPublicKey: PublicKey
): Promise<number> {
  try {
    const tokenMint = new PublicKey(tokenMintAddress);
    
    // Get the associated token account address
    const associatedTokenAddress = await getAssociatedTokenAddress(
      tokenMint,
      walletPublicKey
    );

    try {
      // Get account info for the associated token account
      const tokenAccountInfo = await getAccount(connection, associatedTokenAddress);
      
      // Get mint info to get decimals
      const mintInfo = await getMint(connection, tokenMint);
      
      // Calculate the actual balance
      const tokenBalance = Number(tokenAccountInfo.amount) / Math.pow(10, mintInfo.decimals);
      
      return tokenBalance;
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        // Token account doesn't exist yet
        return 0;
      }
      throw error;
    }
  } catch (error) {
    console.error('Error getting token balance:', error);
    throw error;
  }
}

// Get token mint info
export async function getTokenInfo(tokenMintAddress: string) {
  try {
    const tokenMint = new PublicKey(tokenMintAddress);
    const mintInfo = await getMint(connection, tokenMint);
    
    return {
      address: tokenMintAddress,
      decimals: mintInfo.decimals,
      supply: Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals),
      freezeAuthority: mintInfo.freezeAuthority?.toBase58() || null,
      mintAuthority: mintInfo.mintAuthority?.toBase58() || null,
    };
  } catch (error) {
    console.error('Error getting token info:', error);
    throw error;
  }
}

// Get pool balances
export async function getPoolBalances() {
  try {
    const poolSolAccount = new PublicKey(POOL_SOL_ACCOUNT);
    const poolAuthority = new PublicKey(POOL_AUTHORITY);
    const yotTokenMint = new PublicKey(YOT_TOKEN_ADDRESS);
    
    // Get SOL balance of the pool
    const solBalance = await connection.getBalance(poolSolAccount);
    
    // Get YOT balance of the pool authority
    const yotTokenAccount = await getAssociatedTokenAddress(
      yotTokenMint,
      poolAuthority
    );
    
    let yotBalance = 0;
    
    try {
      const tokenAccountInfo = await getAccount(connection, yotTokenAccount);
      const mintInfo = await getMint(connection, yotTokenMint);
      yotBalance = Number(tokenAccountInfo.amount) / Math.pow(10, mintInfo.decimals);
    } catch (error) {
      if (!(error instanceof TokenAccountNotFoundError)) {
        throw error;
      }
    }
    
    return {
      solBalance: lamportsToSol(solBalance),
      yotBalance: yotBalance
    };
  } catch (error) {
    console.error('Error getting pool balances:', error);
    throw error;
  }
}

// Calculate the exchange rate between SOL and YOT
export async function getExchangeRate() {
  try {
    const { solBalance, yotBalance } = await getPoolBalances();
    
    // If either balance is zero, we can't calculate the exchange rate
    if (solBalance === 0 || yotBalance === 0) {
      return {
        solToYot: 0,
        yotToSol: 0
      };
    }
    
    const solToYot = yotBalance / solBalance;
    const yotToSol = solBalance / yotBalance;
    
    return {
      solToYot,
      yotToSol
    };
  } catch (error) {
    console.error('Error calculating exchange rate:', error);
    throw error;
  }
}

// Calculate the amount of YOT received for a given SOL amount
export async function calculateSolToYot(solAmount: number) {
  try {
    const { solToYot } = await getExchangeRate();
    const fee = solAmount * SWAP_FEE;
    const solAmountAfterFee = solAmount - fee;
    return solAmountAfterFee * solToYot;
  } catch (error) {
    console.error('Error calculating SOL to YOT:', error);
    throw error;
  }
}

// Calculate the amount of SOL received for a given YOT amount
export async function calculateYotToSol(yotAmount: number) {
  try {
    const { yotToSol } = await getExchangeRate();
    const solBeforeFee = yotAmount * yotToSol;
    const fee = solBeforeFee * SWAP_FEE;
    return solBeforeFee - fee;
  } catch (error) {
    console.error('Error calculating YOT to SOL:', error);
    throw error;
  }
}

// Execute a swap from SOL to YOT
export async function swapSolToYot(
  wallet: any, // Wallet adapter
  solAmount: number,
  slippage: number = 0.01 // 1% slippage tolerance
) {
  try {
    if (!wallet.publicKey) throw new Error('Wallet not connected');

    const { yotBalance, solBalance } = await getPoolBalances();
    const yotTokenMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const poolSolAccount = new PublicKey(POOL_SOL_ACCOUNT);
    const poolAuthority = new PublicKey(POOL_AUTHORITY);
    
    // Calculate the amount of YOT the user should receive
    const expectedYotAmount = await calculateSolToYot(solAmount);
    const minYotAmount = expectedYotAmount * (1 - slippage);
    
    // Check if the pool has enough YOT
    if (yotBalance < minYotAmount) {
      throw new Error('Insufficient liquidity in the pool');
    }
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Add instruction to transfer SOL to the pool
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: poolSolAccount,
        lamports: solToLamports(solAmount)
      })
    );
    
    // Get the associated token account for the user's YOT
    const userYotAccount = await getAssociatedTokenAddress(
      yotTokenMint, 
      wallet.publicKey
    );
    
    // Check if the user has a YOT token account, if not create one
    try {
      await getAccount(connection, userYotAccount);
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey, // payer
            userYotAccount, // associated token account
            wallet.publicKey, // owner
            yotTokenMint // mint
          )
        );
      } else {
        throw error;
      }
    }
    
    // Get the pool's YOT account
    const poolYotAccount = await getAssociatedTokenAddress(
      yotTokenMint,
      poolAuthority
    );
    
    // Add instruction to transfer YOT from pool to user
    const mintInfo = await getMint(connection, yotTokenMint);
    const tokenAmount = BigInt(Math.floor(minYotAmount * Math.pow(10, mintInfo.decimals)));
    
    transaction.add(
      createTransferInstruction(
        poolYotAccount, // source
        userYotAccount, // destination
        poolAuthority, // owner
        tokenAmount, // amount
        [/* Additional signers if needed */]
      )
    );
    
    // Send the transaction
    const signature = await wallet.sendTransaction(transaction, connection);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    return {
      signature,
      fromAmount: solAmount,
      toAmount: expectedYotAmount,
      fromToken: 'SOL',
      toToken: 'YOT',
      fee: solAmount * SWAP_FEE
    };
  } catch (error) {
    console.error('Error swapping SOL to YOT:', error);
    throw error;
  }
}

// Execute a swap from YOT to SOL
export async function swapYotToSol(
  wallet: any, // Wallet adapter
  yotAmount: number,
  slippage: number = 0.01 // 1% slippage tolerance
) {
  try {
    if (!wallet.publicKey) throw new Error('Wallet not connected');

    const { yotBalance, solBalance } = await getPoolBalances();
    const yotTokenMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const poolSolAccount = new PublicKey(POOL_SOL_ACCOUNT);
    const poolAuthority = new PublicKey(POOL_AUTHORITY);
    
    // Calculate the amount of SOL the user should receive
    const expectedSolAmount = await calculateYotToSol(yotAmount);
    const minSolAmount = expectedSolAmount * (1 - slippage);
    
    // Check if the pool has enough SOL
    if (solBalance < minSolAmount) {
      throw new Error('Insufficient liquidity in the pool');
    }
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Get the associated token account for the user's YOT
    const userYotAccount = await getAssociatedTokenAddress(
      yotTokenMint,
      wallet.publicKey
    );
    
    // Check if the user has a YOT token account
    try {
      const account = await getAccount(connection, userYotAccount);
      const mintInfo = await getMint(connection, yotTokenMint);
      const tokenAmount = BigInt(Math.floor(yotAmount * Math.pow(10, mintInfo.decimals)));
      
      // Check if the user has enough YOT
      if (account.amount < tokenAmount) {
        throw new Error('Insufficient YOT balance');
      }
      
      // Get the pool's YOT account
      const poolYotAccount = await getAssociatedTokenAddress(
        yotTokenMint,
        poolAuthority
      );
      
      // Add instruction to transfer YOT from user to pool
      transaction.add(
        createTransferInstruction(
          userYotAccount, // source
          poolYotAccount, // destination
          wallet.publicKey, // owner
          tokenAmount, // amount
          [/* Additional signers if needed */]
        )
      );
      
      // Add instruction to transfer SOL from pool to user
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: poolSolAccount,
          toPubkey: wallet.publicKey,
          lamports: solToLamports(minSolAmount)
        })
      );
      
      // Send the transaction
      const signature = await wallet.sendTransaction(transaction, connection);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      
      return {
        signature,
        fromAmount: yotAmount,
        toAmount: expectedSolAmount,
        fromToken: 'YOT',
        toToken: 'SOL',
        fee: expectedSolAmount * SWAP_FEE
      };
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        throw new Error('You do not have a YOT token account');
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error swapping YOT to SOL:', error);
    throw error;
  }
}

// Get recent transactions for an account
export async function getRecentTransactions(address: string, limit: number = 10) {
  try {
    const publicKey = new PublicKey(address);
    const transactions = await connection.getSignaturesForAddress(publicKey, { limit });
    
    const transactionDetails = await Promise.all(
      transactions.map(async (tx) => {
        try {
          const txDetails = await connection.getTransaction(tx.signature, {
            maxSupportedTransactionVersion: 0,
          });
          
          // Try to determine if this was a swap transaction
          let isSwap = false;
          let fromToken = '';
          let toToken = '';
          let fromAmount = 0;
          let toAmount = 0;
          let fee = 0;
          
          if (txDetails) {
            // Check if transaction involved the pool SOL account
            const poolSolAccountStr = POOL_SOL_ACCOUNT;
            const accountKeys = txDetails.transaction.message.accountKeys.map(key => 
              key.toBase58()
            );
            
            isSwap = accountKeys.includes(poolSolAccountStr);
            
            if (isSwap) {
              // Further analyze to determine swap details
              // This is a simplified approach and may need refinement
              const hasYotTransfer = txDetails.meta?.logMessages?.some(
                log => log.includes('Transfer') && log.includes(YOT_TOKEN_ADDRESS)
              );
              
              if (hasYotTransfer) {
                // SOL -> YOT or YOT -> SOL
                // Would need more sophisticated analysis for accurate amounts
                fromToken = accountKeys.indexOf(poolSolAccountStr) < accountKeys.indexOf(publicKey.toBase58()) 
                  ? 'YOT' : 'SOL';
                toToken = fromToken === 'SOL' ? 'YOT' : 'SOL';
                
                // Simplified fee calculation
                fee = 0.000005; // A placeholder
              }
            }
          }
          
          return {
            signature: tx.signature,
            timestamp: tx.blockTime || 0,
            status: tx.confirmationStatus,
            isSwap,
            fromToken,
            toToken,
            fromAmount,
            toAmount,
            fee
          };
        } catch (error) {
          console.error(`Error fetching transaction ${tx.signature}:`, error);
          return null;
        }
      })
    );
    
    return transactionDetails.filter(Boolean);
  } catch (error) {
    console.error('Error getting recent transactions:', error);
    throw error;
  }
}
