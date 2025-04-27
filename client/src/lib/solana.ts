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
  YOT_TOKEN_ACCOUNT,
  SWAP_FEE
} from './constants';

// Create a connection to the Solana cluster
export const connection = new Connection(ENDPOINT, 'confirmed');

// Convert lamports to SOL
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

// Convert SOL to lamports
export function solToLamports(sol: number): bigint {
  // Multiply by LAMPORTS_PER_SOL and convert to a BigInt
  return BigInt(Math.round(sol * LAMPORTS_PER_SOL));
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
    
    // Get blockhash for transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    // Create transaction
    const transaction = new Transaction({
      feePayer: wallet.publicKey,
      blockhash,
      lastValidBlockHeight
    });
    
    // Get the associated token account for the user's YOT
    const userYotAccount = await getAssociatedTokenAddress(
      yotTokenMint, 
      wallet.publicKey
    );
    
    // Check if the user has a YOT token account, if not create one
    try {
      try {
        await getAccount(connection, userYotAccount);
      } catch (error) {
        if (error instanceof TokenAccountNotFoundError) {
          console.log("YOT token account not found, creating it now for SOL->YOT swap");
          // Create token account in a separate transaction first
          await createTokenAccount(YOT_TOKEN_ADDRESS, wallet);
          
          // Now that we've created the account, we can continue
          console.log("YOT token account created successfully, continuing with swap");
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error("Error checking or creating YOT token account:", error);
      throw new Error(`Failed to set up YOT token account: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Add instruction to transfer SOL to the pool
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: poolSolAccount,
        lamports: solToLamports(solAmount)
      })
    );
    
    // Since we're completing a simple SOL -> YOT swap manually, we need to 
    // also include instructions for the second part of the swap
    
    // Get the pool's YOT token account from constants
    const poolYotAccount = new PublicKey(YOT_TOKEN_ACCOUNT);
    
    // Convert YOT amount to the right number of tokens based on decimals
    const mintInfo = await getMint(connection, yotTokenMint);
    const yotTokenAmount = BigInt(Math.floor(expectedYotAmount * Math.pow(10, mintInfo.decimals)));
    
    // NOTE: In a production environment, an atomic swap would be handled by the token-swap program 
    // For our current implementation, we'll execute a second transaction to handle the YOT transfer
    // since we don't have the pool authority private key
    
    // First, send the SOL to the pool
    // Handle different wallet implementations (Phantom, Solflare, etc.)
    let solSignature;
    
    // Different wallets have different implementations of sendTransaction
    try {
      if (typeof wallet.sendTransaction === 'function') {
        // Standard wallet adapter approach (Phantom)
        solSignature = await wallet.sendTransaction(transaction, connection);
        
        // Handle case where Solflare may return an object instead of a string
        if (typeof solSignature === 'object' && solSignature !== null) {
          // For Solflare wallet which might return an object with signature property
          if (solSignature.signature) {
            solSignature = solSignature.signature;
          } else {
            // Try to stringify and clean up the signature
            const sigStr = JSON.stringify(solSignature);
            if (sigStr) {
              // Remove quotes and braces if they exist
              solSignature = sigStr.replace(/[{}"]/g, '');
            }
          }
        }
      } else if (wallet.signAndSendTransaction && typeof wallet.signAndSendTransaction === 'function') {
        // Some wallet adapters use signAndSendTransaction instead
        const result = await wallet.signAndSendTransaction(transaction);
        // Handle various result formats
        if (typeof result === 'string') {
          solSignature = result;
        } else if (typeof result === 'object' && result !== null) {
          solSignature = result.signature || result.toString();
        }
      } else if (wallet.signTransaction && typeof wallet.signTransaction === 'function') {
        // If the wallet can only sign but not send, we sign first then send manually
        const signedTx = await wallet.signTransaction(transaction);
        solSignature = await connection.sendRawTransaction(signedTx.serialize());
      } else {
        throw new Error("Wallet doesn't support transaction signing");
      }
      
      // Ensure signature is a string
      if (typeof solSignature !== 'string') {
        throw new Error(`Invalid signature format: ${solSignature}`);
      }
    } catch (error) {
      console.error("Transaction signing error:", error);
      throw new Error(`Failed to sign transaction: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log("SOL transfer transaction sent with signature:", solSignature);
    
    // Confirm the transaction
    const solConfirmation = await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature: solSignature
    }, 'confirmed');
    
    if (solConfirmation.value.err) {
      throw new Error(`Transaction failed: ${solConfirmation.value.err}`);
    }
    
    // Now we need to request the pool authority to send us YOT tokens (in a real app, this would be
    // done as an atomic operation by the token-swap program)
    
    // Create a second transaction to simulate the pool sending YOT back to the user
    // In a real token-swap program, this would be part of the same atomic transaction
    console.log(`Simulating YOT transfer of ${expectedYotAmount} YOT tokens to ${wallet.publicKey.toString()}...`);
    
    // Now we'll complete the swap by sending YOT tokens from pool to user
    // Using the pool authority key that was provided
    
    console.log("Preparing to execute YOT token transfer from pool to user...");
    
    // Import the function that will handle the token transfer
    const { completeSwapWithYotTransfer } = await import('./completeSwap');
    
    try {
      // Execute the second part of the swap - transferring YOT tokens from pool to user
      console.log(`Now sending ${expectedYotAmount} YOT tokens to ${wallet.publicKey.toString()}`);
      
      // This will create a second transaction signed by the pool authority
      const tokenTransferResult = await completeSwapWithYotTransfer(
        wallet.publicKey,     // User's public key to receive tokens
        expectedYotAmount     // Amount of YOT tokens to send
      );
      
      console.log(`YOT tokens sent successfully! Transaction signature: ${tokenTransferResult.signature}`);
      console.log(`YOT sent to user's account: ${tokenTransferResult.userTokenAccount}`);
    } catch (error) {
      console.error("Error sending YOT tokens from pool:", error);
      throw new Error(`First part of swap completed (SOL deposit), but error in second part (YOT transfer): ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // For the demo, we'll return the SOL transaction signature
    console.log("Transaction confirmed with signature:", solSignature);
    
    // Return actual swap details
    return {
      signature: solSignature,
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

// Create token account for a user
export async function createTokenAccount(
  tokenMintAddress: string,
  wallet: any  // Wallet adapter
): Promise<PublicKey | null> {
  try {
    if (!wallet.publicKey) {
      console.error('Wallet not connected');
      return null;
    }

    const tokenMint = new PublicKey(tokenMintAddress);
    const associatedTokenAddress = await getAssociatedTokenAddress(
      tokenMint,
      wallet.publicKey
    );

    // Check if the account already exists
    try {
      await getAccount(connection, associatedTokenAddress);
      console.log(`Token account already exists for ${tokenMintAddress}`);
      return associatedTokenAddress;
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        // Create a transaction to create the token account
        const transaction = new Transaction();
        
        transaction.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey, // payer
            associatedTokenAddress, // associated token account
            wallet.publicKey, // owner
            tokenMint // mint
          )
        );
        
        // Get blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        
        // Sign and send the transaction with the wallet
        try {
          let signature;
          
          if (typeof wallet.sendTransaction === 'function') {
            // Standard wallet adapter approach (Phantom)
            signature = await wallet.sendTransaction(transaction, connection);
            
            // Handle case where Solflare may return an object instead of a string
            if (typeof signature === 'object' && signature !== null) {
              // For Solflare wallet which might return an object with signature property
              if (signature.signature) {
                signature = signature.signature;
              } else {
                // Try to stringify and clean up the signature
                const sigStr = JSON.stringify(signature);
                if (sigStr) {
                  // Remove quotes and braces if they exist
                  signature = sigStr.replace(/[{}"]/g, '');
                }
              }
            }
          } else if (wallet.signAndSendTransaction && typeof wallet.signAndSendTransaction === 'function') {
            // Some wallet adapters use signAndSendTransaction instead
            const result = await wallet.signAndSendTransaction(transaction);
            // Handle various result formats
            if (typeof result === 'string') {
              signature = result;
            } else if (typeof result === 'object' && result !== null) {
              signature = result.signature || result.toString();
            }
          } else if (wallet.signTransaction && typeof wallet.signTransaction === 'function') {
            // If the wallet can only sign but not send, we sign first then send manually
            const signedTx = await wallet.signTransaction(transaction);
            signature = await connection.sendRawTransaction(signedTx.serialize());
          } else {
            throw new Error("Wallet doesn't support transaction signing");
          }
          
          // Wait for confirmation
          await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
          });
          
          console.log(`Created token account ${associatedTokenAddress.toString()}`);
          return associatedTokenAddress;
        } catch (signError) {
          console.error('Error creating token account:', signError);
          throw new Error(`Failed to create token account: ${signError instanceof Error ? signError.message : String(signError)}`);
        }
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error in createTokenAccount:', error);
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
    
    // Calculate the amount of SOL the user should receive
    const expectedSolAmount = await calculateYotToSol(yotAmount);
    const minSolAmount = expectedSolAmount * (1 - slippage);
    
    // Check if the pool has enough SOL
    if (solBalance < minSolAmount) {
      throw new Error('Insufficient liquidity in the pool');
    }
    
    // Get the associated token account for the user's YOT
    const userYotAccount = await getAssociatedTokenAddress(
      yotTokenMint,
      wallet.publicKey
    );
    
    // Check if the user has a YOT token account and sufficient balance
    try {
      let account;
      let userHasTokenAccount = true;
      
      try {
        // Try to get the token account
        account = await getAccount(connection, userYotAccount);
      } catch (e) {
        if (e instanceof TokenAccountNotFoundError) {
          userHasTokenAccount = false;
          console.log("YOT token account not found, will create it now");
          
          // Create the token account
          try {
            await createTokenAccount(YOT_TOKEN_ADDRESS, wallet);
            throw new Error('YOT token account created. Please fund it with YOT tokens before swapping.');
          } catch (createError) {
            console.error('Failed to create YOT token account:', createError);
            throw new Error(`Failed to create YOT token account: ${createError instanceof Error ? createError.message : String(createError)}`);
          }
        } else {
          throw e;
        }
      }
      
      // Get token mint info for decimals
      const mintInfo = await getMint(connection, yotTokenMint);
      const tokenAmount = BigInt(Math.floor(yotAmount * Math.pow(10, mintInfo.decimals)));
      
      // Check if the user has enough YOT
      if (account.amount < tokenAmount) {
        throw new Error('Insufficient YOT balance');
      }
      
      console.log(`Swap request: ${yotAmount} YOT to approximately ${expectedSolAmount} SOL`);
      
      // Get blockhash for transaction
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      
      // Create transaction
      const transaction = new Transaction({
        feePayer: wallet.publicKey,
        blockhash,
        lastValidBlockHeight
      });
      
      // Get the pool's YOT token account from constants
      const poolYotAccount = new PublicKey(YOT_TOKEN_ACCOUNT);
      
      // Add instruction to transfer YOT tokens from user to pool
      transaction.add(
        createTransferInstruction(
          userYotAccount, // source
          poolYotAccount, // destination
          wallet.publicKey, // owner
          tokenAmount // amount
        )
      );
          
      // Sign and send the transaction
      try {
        // Handle different wallet implementations (Phantom, Solflare, etc.)
        let signature;
        
        try {
          if (typeof wallet.sendTransaction === 'function') {
            // Standard wallet adapter approach (Phantom)
            signature = await wallet.sendTransaction(transaction, connection);
            
            // Handle case where Solflare may return an object instead of a string
            if (typeof signature === 'object' && signature !== null) {
              // For Solflare wallet which might return an object with signature property
              if (signature.signature) {
                signature = signature.signature;
              } else {
                // Try to stringify and clean up the signature
                const sigStr = JSON.stringify(signature);
                if (sigStr) {
                  // Remove quotes and braces if they exist
                  signature = sigStr.replace(/[{}"]/g, '');
                }
              }
            }
          } else if (wallet.signAndSendTransaction && typeof wallet.signAndSendTransaction === 'function') {
            // Some wallet adapters use signAndSendTransaction instead
            const result = await wallet.signAndSendTransaction(transaction);
            // Handle various result formats
            if (typeof result === 'string') {
              signature = result;
            } else if (typeof result === 'object' && result !== null) {
              signature = result.signature || result.toString();
            }
          } else if (wallet.signTransaction && typeof wallet.signTransaction === 'function') {
            // If the wallet can only sign but not send, we sign first then send manually
            const signedTx = await wallet.signTransaction(transaction);
            signature = await connection.sendRawTransaction(signedTx.serialize());
          } else {
            throw new Error("Wallet doesn't support transaction signing");
          }
          
          // Ensure signature is a string
          if (typeof signature !== 'string') {
            throw new Error(`Invalid signature format: ${signature}`);
          }
        } catch (error) {
          console.error("Transaction signing error:", error);
          throw new Error(`Failed to sign transaction: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        console.log("Transaction sent with signature:", signature);
        
        // Confirm transaction
        const confirmation = await connection.confirmTransaction({
          signature, 
          blockhash,
          lastValidBlockHeight
        });
        
        console.log("Transaction confirmed:", confirmation);
        
        // Now we'll complete the second part of the swap by sending SOL back to the user
        console.log(`Executing SOL transfer of ${expectedSolAmount} SOL to ${wallet.publicKey.toString()}...`);
        
        // Import the pool authority keypair from completeSwap
        const { poolAuthorityKeypair } = await import('./completeSwap');
        
        // Get recent blockhash for the second transaction
        const solTransferBlockhash = await connection.getLatestBlockhash();
        
        // Create a second transaction to transfer SOL from pool to user
        const solTransferTransaction = new Transaction({
          feePayer: poolAuthorityKeypair.publicKey,
          blockhash: solTransferBlockhash.blockhash,
          lastValidBlockHeight: solTransferBlockhash.lastValidBlockHeight
        });
        
        try {
          // Convert SOL amount to lamports as BigInt
          // Round to ensure we have an integer value
          const lamports = BigInt(Math.round(expectedSolAmount * LAMPORTS_PER_SOL));
          
          console.log(`Converting ${expectedSolAmount} SOL to ${lamports} lamports`);
          
          // Add instruction to transfer SOL from pool to user
          solTransferTransaction.add(
            SystemProgram.transfer({
              fromPubkey: poolAuthorityKeypair.publicKey, 
              toPubkey: wallet.publicKey,
              lamports
            })
          );
          
          // Sign and send transaction with pool authority
          const solTransferSignature = await sendAndConfirmTransaction(
            connection,
            solTransferTransaction,
            [poolAuthorityKeypair]
          );
          
          console.log(`SOL transfer complete! Signature: ${solTransferSignature}`);
        } catch (error) {
          console.error('Error sending SOL from pool to user:', error);
          throw new Error(`First part of swap completed (YOT deposit), but error in second part (SOL transfer): ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // Return actual swap details
        return {
          signature,
          fromAmount: yotAmount,
          toAmount: expectedSolAmount,
          fromToken: 'YOT',
          toToken: 'SOL',
          fee: expectedSolAmount * SWAP_FEE
        };
      } catch (err) {
        console.error("Transaction error:", err);
        throw new Error("Failed to send transaction: " + (err instanceof Error ? err.message : String(err)));
      }
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
            // Get account keys based on transaction version
            let accountKeys: string[] = [];
            if (txDetails.transaction.message) {
              const keys = txDetails.transaction.message.getAccountKeys 
                ? txDetails.transaction.message.getAccountKeys() 
                : null;
              
              if (keys) {
                // Convert to string array safely
                for (let i = 0; i < keys.length; i++) {
                  const pubkey = keys.get(i);
                  if (pubkey) {
                    accountKeys.push(pubkey.toBase58());
                  }
                }
              }
            }
            
            // This is a pool deposit if the transaction includes the pool SOL account
            isSwap = accountKeys.includes(poolSolAccountStr);
            
            if (isSwap) {
              // Find the amount of SOL transferred (if any)
              let solAmount = 0;
              if (txDetails.meta && txDetails.meta.preBalances && txDetails.meta.postBalances) {
                // Find the index of the pool account in the transaction
                const poolIndex = accountKeys.indexOf(poolSolAccountStr);
                if (poolIndex >= 0 && poolIndex < txDetails.meta.preBalances.length) {
                  // Calculate the difference in balance
                  const preBal = txDetails.meta.preBalances[poolIndex];
                  const postBal = txDetails.meta.postBalances[poolIndex];
                  solAmount = lamportsToSol(postBal - preBal);
                }
              }

              // Determine direction based on whether SOL was sent to the pool
              if (solAmount > 0) {
                // This was a SOL -> YOT swap (deposit)
                fromToken = 'SOL';
                toToken = 'YOT';
                fromAmount = solAmount;
                toAmount = solAmount * 100; // Approximate rate
                fee = solAmount * SWAP_FEE;
              } else {
                // This might be a YOT -> SOL swap or another transaction type
                // Try to detect YOT transfer
                const hasYotTransfer = txDetails.meta?.logMessages?.some(
                  log => log.includes('Transfer') && log.includes(YOT_TOKEN_ADDRESS)
                );
                
                if (hasYotTransfer) {
                  fromToken = 'YOT';
                  toToken = 'SOL';
                  // We would need more sophisticated analysis for accurate amounts
                  fee = 0.000005; // A placeholder
                }
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
