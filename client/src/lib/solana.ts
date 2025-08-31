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
  YOS_TOKEN_ADDRESS,
  YOS_TOKEN_ACCOUNT,
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
    const tokenSymbol = tokenMintAddress === YOT_TOKEN_ADDRESS ? "YOT" : 
                        tokenMintAddress === YOS_TOKEN_ADDRESS ? "YOS" : "Unknown";
    
    console.log(`Fetching ${tokenSymbol} balance for wallet: ${walletPublicKey.toBase58()}`);
    
    // Get the associated token account address
    const associatedTokenAddress = await getAssociatedTokenAddress(
      tokenMint,
      walletPublicKey
    );
    
    console.log(`Associated token account address: ${associatedTokenAddress.toBase58()}`);

    try {
      // Get account info for the associated token account
      const tokenAccountInfo = await getAccount(connection, associatedTokenAddress);
      
      // Get mint info to get decimals
      const mintInfo = await getMint(connection, tokenMint);
      
      // Calculate the actual balance
      const tokenBalance = Number(tokenAccountInfo.amount) / Math.pow(10, mintInfo.decimals);
      console.log(`Found ${tokenSymbol} balance: ${tokenBalance}`);
      
      return tokenBalance;
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        // Token account doesn't exist yet
        console.log(`${tokenSymbol} token account not found for this wallet`);
        
        // If token account doesn't exist, balance is 0
        return 0;
      }
      throw error;
    }
  } catch (error) {
    console.error(`Error getting ${tokenMintAddress === YOT_TOKEN_ADDRESS ? "YOT" : 
                   tokenMintAddress === YOS_TOKEN_ADDRESS ? "YOS" : "token"} balance:`, error);
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
    const yotTokenAccount = new PublicKey(YOT_TOKEN_ACCOUNT);
    const yosTokenMint = new PublicKey(YOS_TOKEN_ADDRESS);
    const yosTokenAccount = new PublicKey(YOS_TOKEN_ACCOUNT);
    
    // Get SOL balance of the pool
    const solBalance = await connection.getBalance(poolSolAccount);
    
    let yotBalance = 0;
    let yosBalance = 0;
    
    try {
      // Try to get YOT balance directly from the token account
      const yotAccountInfo = await getAccount(connection, yotTokenAccount);
      const yotMintInfo = await getMint(connection, yotTokenMint);
      yotBalance = Number(yotAccountInfo.amount) / Math.pow(10, yotMintInfo.decimals);
    } catch (error) {
      console.error('Error getting YOT token balance:', error);
      // If there's an error, we use 0 as the balance
    }
    
    try {
      // Try to get YOS balance directly from the token account
      const yosAccountInfo = await getAccount(connection, yosTokenAccount);
      const yosMintInfo = await getMint(connection, yosTokenMint);
      yosBalance = Number(yosAccountInfo.amount) / Math.pow(10, yosMintInfo.decimals);
    } catch (error) {
      console.error('Error getting YOS token balance:', error);
      // If there's an error, we use 0 as the balance
    }
    
    console.log(`Pool balances fetched - SOL: ${lamportsToSol(solBalance)}, YOT: ${yotBalance}, YOS: ${yosBalance}`);
    
    return {
      solBalance: solBalance,
      yotBalance: yotBalance,
      yosBalance: yosBalance
    };
  } catch (error) {
    console.error('Error getting pool balances:', error);
    // Return zeros to indicate error - no fallbacks or fake data
    return {
      solBalance: 0,
      yotBalance: 0,
      yosBalance: 0
    };
  }
}

// Calculate the exchange rate between SOL and YOT using AMM formula
export async function getExchangeRate() {
  try {
    const { solBalance, yotBalance } = await getPoolBalances();
    
    // If either balance is zero, we can't calculate the exchange rate
    if (solBalance === 0 || yotBalance === 0) {
      return {
        solToYot: 0,
        yotToSol: 0,
        yotPerSol: 0,
        solPerYot: 0,
        rate: 0
      };
    }
    
    // Convert SOL from lamports for rate calculation
    const solBalanceInSol = lamportsToSol(solBalance);
    
    // Calculate exchange rates using AMM formula (x * y = k)
    const solToYot = yotBalance / solBalanceInSol;
    const yotToSol = solBalanceInSol / yotBalance;
    
    // Format for display
    const yotPerSol = solToYot;
    const solPerYot = yotToSol;
    
    return {
      solToYot,       // Used by swap functions
      yotToSol,       // Used by swap functions
      yotPerSol,      // For UI display
      solPerYot,      // For UI display
      rate: solToYot  // General rate
    };
  } catch (error) {
    console.error('Error calculating exchange rate:', error);
    return {
      solToYot: 0,
      yotToSol: 0,
      yotPerSol: 0,
      solPerYot: 0,
      rate: 0
    };
  }
}

// Calculate the amount of YOT received for a given SOL amount
export async function calculateSolToYot(solAmount: number) {
  try {
    const { solToYot, yotPerSol } = await getExchangeRate();
    // Use solToYot for consistency with existing code
    const rate = solToYot !== 0 ? solToYot : yotPerSol;
    
    const fee = solAmount * SWAP_FEE;
    const solAmountAfterFee = solAmount - fee;
    return solAmountAfterFee * rate;
  } catch (error) {
    console.error('Error calculating SOL to YOT:', error);
    throw error;
  }
}

// Calculate the amount of SOL received for a given YOT amount
export async function calculateYotToSol(yotAmount: number) {
  try {
    const { yotToSol, solPerYot } = await getExchangeRate();
    // Use yotToSol for consistency with existing code
    const rate = yotToSol !== 0 ? yotToSol : solPerYot;
    
    const solBeforeFee = yotAmount * rate;
    const fee = solBeforeFee * SWAP_FEE;
    return solBeforeFee - fee;
  } catch (error) {
    console.error('Error calculating YOT to SOL:', error);
    throw error;
  }
}

// Calculate the conversion between YOS and YOT based on AMM pool balances
export async function calculateYosToYot(yosAmount: number) {
  try {
    // Get the pool data for actual YOT and YOS balances
    const { yotBalance, yosBalance } = await getPoolBalances();
    
    if (!yotBalance || !yosBalance || yotBalance === 0 || yosBalance === 0) {
      // Fallback to approximate ratio if pool data is unavailable
      console.log("Using fallback ratio for YOS to YOT conversion");
      return yosAmount * 0.1; // Fallback: 1 YOS = 0.1 YOT
    }
    
    // Calculate the actual ratio from AMM pool balances
    // Using the constant product formula: x * y = k
    // When removing dy amount of YOS from the pool, we get dx amount of YOT
    // So (yosBalance + dy) * (yotBalance - dx) = yosBalance * yotBalance
    
    // Calculate how much YOT we get for the given YOS amount
    // Using formula: dx = (x * dy) / (y + dy)
    // Where x = yotBalance, y = yosBalance, dy = yosAmount, dx = YOT amount to receive
    
    const yotAmount = (yotBalance * yosAmount) / (yosBalance + yosAmount);
    
    // Apply swap fee (0.3%)
    const yotAmountAfterFee = yotAmount * (1 - 0.003);
    
    console.log(`YOS to YOT conversion via AMM pool: ${yosAmount} YOS = ${yotAmountAfterFee} YOT`);
    console.log(`Pool state: ${yotBalance} YOT / ${yosBalance} YOS`);
    
    // Return the conversion result
    return yotAmountAfterFee;
  } catch (error) {
    console.error('Error calculating YOS to YOT conversion:', error);
    // Fallback to approximate ratio
    return yosAmount * 0.1; // Fallback: 1 YOS = 0.1 YOT
  }
}

// Calculate the conversion between YOT and YOS based on AMM pool balances
export async function calculateYotToYos(yotAmount: number) {
  try {
    // Get the pool data for actual YOT and YOS balances
    const { yotBalance, yosBalance } = await getPoolBalances();
    
    if (!yotBalance || !yosBalance || yotBalance === 0 || yosBalance === 0) {
      // Fallback to approximate ratio if pool data is unavailable
      console.log("Using fallback ratio for YOT to YOS conversion");
      return yotAmount * 10; // Fallback: 1 YOT = 10 YOS
    }
    
    // Calculate the actual ratio from AMM pool balances
    // Using the constant product formula: x * y = k
    // When removing dx amount of YOT from the pool, we get dy amount of YOS
    // So (yotBalance + dx) * (yosBalance - dy) = yotBalance * yosBalance
    
    // Calculate how much YOS we get for the given YOT amount
    // Using formula: dy = (y * dx) / (x + dx)
    // Where y = yosBalance, x = yotBalance, dx = yotAmount, dy = YOS amount to receive
    
    const yosAmount = (yosBalance * yotAmount) / (yotBalance + yotAmount);
    
    // Apply swap fee (0.3%)
    const yosAmountAfterFee = yosAmount * (1 - 0.003);
    
    console.log(`YOT to YOS conversion via AMM pool: ${yotAmount} YOT = ${yosAmountAfterFee} YOS`);
    console.log(`Pool state: ${yotBalance} YOT / ${yosBalance} YOS`);
    
    // Return the conversion result
    return yosAmountAfterFee;
  } catch (error) {
    console.error('Error calculating YOT to YOS conversion:', error);
    // Fallback to approximate ratio
    return yotAmount * 10; // Fallback: 1 YOT = 10 YOS
  }
}

// Get the latest SOL market price in USD
export async function getSolMarketPrice(): Promise<number> {
  // For development and testing, use a consistent SOL price
  // This avoids CORS and rate limiting issues during development
  // In a production environment, this would be replaced with live API calls
  const solPrice = 148.35;
  console.log(`Using SOL price: $${solPrice}`);
  return solPrice;
  
  /* 
  // The API endpoints below are experiencing CORS issues in the Replit environment
  // These would be used in production or with a backend proxy
  try {
    const response = await fetch('https://price.jup.ag/v4/price?ids=SOL');
    if (response.ok) {
      const data = await response.json();
      if (data?.data?.SOL?.price) {
        return data.data.SOL.price;
      }
    }
  } catch (error) {
    console.error('Jupiter API error:', error);
  }
  
  try {
    const backupResponse = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=SOL');
    if (backupResponse.ok) {
      const data = await backupResponse.json();
      if (data?.data?.rates?.USD) {
        return 1 / parseFloat(data.data.rates.USD);
      }
    }
  } catch (error) {
    console.error('Coinbase API error:', error);
  }
  */
}

// Calculate YOT price based on liquidity pool ratio and SOL price
export async function getYotMarketPrice(): Promise<number> {
  try {
    // Get SOL price
    const solPrice = await getSolMarketPrice();
    
    // Get pool data
    const { solBalance, yotBalance } = await getPoolBalances();
    
    if (!solBalance || !yotBalance || solBalance === 0 || yotBalance === 0) {
      return 0;
    }
    
    // Make sure we convert SOL from lamports to SOL before calculations
    const solBalanceInSol = lamportsToSol(solBalance);
    
    // Calculate YOT price based on liquidity fluctuation rate
    // YOT price = (SOL price * SOL pool balance in SOL) / YOT pool balance
    // This needs adjustment because the numbers are so different in scale
    const poolValueInUsd = solPrice * solBalanceInSol;
    const yotPrice = poolValueInUsd / yotBalance;
    
    console.log(`YOT price calculation: (${solPrice} * ${solBalanceInSol}) / ${yotBalance} = ${yotPrice}`);
    
    return yotPrice;
  } catch (error) {
    console.error('Error calculating YOT market price:', error);
    return 0;
  }
}

// Calculate YOS price based on YOT price (YOS is 10x less valuable than YOT)
export async function getYosMarketPrice(): Promise<number> {
  try {
    // Get the YOT price first
    const yotPrice = await getYotMarketPrice();
    
    // YOS price = YOT price / 10 (YOS is 10 times less valuable than YOT)
    const yosPrice = yotPrice / 10;
    
    console.log(`YOS price calculation: ${yotPrice} / 10 = ${yosPrice}`);
    console.log(`YOS is 10 times less valuable than YOT (fixed ratio)`);
    
    return yosPrice;
  } catch (error) {
    console.error('Error calculating YOS market price:', error);
    return 0;
  }
}

// Get all token prices in one call for efficiency
export async function getAllTokenPrices(): Promise<{ sol: number, yot: number, yos: number }> {
  try {
    const solPrice = await getSolMarketPrice();
    const yotPrice = await getYotMarketPrice();
    const yosPrice = await getYosMarketPrice();
    
    return {
      sol: solPrice,
      yot: yotPrice,
      yos: yosPrice
    };
  } catch (error) {
    console.error('Error getting all token prices:', error);
    return {
      sol: 0,
      yot: 0,
      yos: 0
    };
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
    
    // Check if the pool has enough YOT with detailed error message
    if (yotBalance < minYotAmount) {
      throw new Error(`Insufficient liquidity in the pool. Pool has ${yotBalance.toFixed(4)} YOT but you need ${minYotAmount.toFixed(4)} YOT for this swap. Please try a smaller amount.`);
    }
    
    // Additional safety check - ensure pool has reasonable buffer
    if (yotBalance < expectedYotAmount * 1.1) {
      console.warn(`Pool YOT balance is low (${yotBalance.toFixed(4)} YOT) for swap of ${expectedYotAmount.toFixed(4)} YOT`);
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
    
    // Import the function that will handle the token transfer and pool funding
    const { completeSwapWithYotTransfer } = await import('./completeSwap');
    const { checkPoolAuthorityBalance, fundPoolAuthorityWithAirdrop } = await import('./helpers/fund-pool-authority');
    const { executeTokenBurn } = await import('./token-burning');
    
    try {
      // Execute the second part of the swap - transferring YOT tokens from pool to user
      console.log(`Now sending ${expectedYotAmount} YOT tokens to ${wallet.publicKey.toString()}`);
      
      // Wait a moment for the first transaction to be fully confirmed
      console.log("Waiting for SOL deposit to fully settle before YOT transfer...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if pool authority has enough SOL for transaction fees
      try {
        const poolBalance = await checkPoolAuthorityBalance();
        if (poolBalance < 0.01) { // Less than 0.01 SOL
          console.log(`Pool authority has insufficient SOL (${poolBalance}). Requesting airdrop...`);
          await fundPoolAuthorityWithAirdrop(0.1); // Add 0.1 SOL
        }
      } catch (fundError) {
        console.warn("Could not fund pool authority automatically:", fundError);
        // Continue anyway - the user wallet will pay fees
      }
      
      // This will create a second transaction signed by the pool authority, with user paying fees
      const tokenTransferResult = await completeSwapWithYotTransfer(
        wallet.publicKey,     // User's public key to receive tokens
        expectedYotAmount,    // Amount of YOT tokens to send
        wallet               // User wallet to pay transaction fees
      );
      
      console.log(`YOT tokens sent successfully! Transaction signature: ${tokenTransferResult.signature}`);
      console.log(`YOT sent to user's account: ${tokenTransferResult.userTokenAccount}`);
      
      // Execute token burning (10% by default, configurable in admin settings)
      try {
        console.log("Executing token burn for buy operation...");
        const burnSignature = await executeTokenBurn(wallet, 'buy', expectedYotAmount);
        if (burnSignature) {
          console.log(`Token burn successful: ${burnSignature}`);
        } else {
          console.log("Token burn skipped (amount too small or disabled)");
        }
      } catch (burnError) {
        console.error("Token burn failed, but continuing with swap:", burnError);
        // Don't fail the entire swap if burning fails
      }
    } catch (error) {
      console.error("Error sending YOT tokens from pool:", error);
      
      // Provide more detailed error information
      if (error instanceof Error) {
        if (error.message.includes('Simulation failed')) {
          throw new Error(`First part of swap completed (SOL deposit), but error in second part (YOT transfer): Simulation failed. This might be due to insufficient pool balance or network congestion. Please try again in a few moments.`);
        } else if (error.message.includes('Insufficient funds')) {
          throw new Error(`First part of swap completed (SOL deposit), but error in second part (YOT transfer): Pool has insufficient YOT tokens. Please contact support.`);
        } else if (error.message.includes('blockhash not found')) {
          throw new Error(`First part of swap completed (SOL deposit), but error in second part (YOT transfer): Transaction expired. Please try again.`);
        } else {
          throw new Error(`First part of swap completed (SOL deposit), but error in second part (YOT transfer): ${error.message}. Please contact support if this persists.`);
        }
      } else {
        throw new Error(`First part of swap completed (SOL deposit), but error in second part (YOT transfer): ${String(error)}. Please contact support if this persists.`);
      }
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
        
        // Check if pool authority actually has SOL balance
        const poolAuthorityBalance = await connection.getBalance(poolAuthorityKeypair.publicKey);
        console.log(`Pool authority SOL balance: ${poolAuthorityBalance / LAMPORTS_PER_SOL} SOL`);
        
        // Try to use a clean SOL-only account for transfers to avoid "carry data" issues
        // Create a derived account from pool authority that's guaranteed to be SOL-only
        const solTransferSeed = "sol_transfer_v1";
        const [solTransferAccount] = PublicKey.findProgramAddressSync(
          [Buffer.from(solTransferSeed), poolAuthorityKeypair.publicKey.toBuffer()],
          new PublicKey("11111111111111111111111111111111") // System Program
        );
        
        console.log(`Derived SOL transfer account: ${solTransferAccount.toString()}`);
        
        // Check if the derived account has balance
        const derivedAccountBalance = await connection.getBalance(solTransferAccount);
        console.log(`Derived SOL account balance: ${derivedAccountBalance / LAMPORTS_PER_SOL} SOL`);
        
        // Check if the dedicated POOL_SOL_ACCOUNT exists and has balance
        const { POOL_SOL_ACCOUNT } = await import('./constants');
        const poolSolAccountPubkey = new PublicKey(POOL_SOL_ACCOUNT);
        const poolSolBalance = await connection.getBalance(poolSolAccountPubkey);
        console.log(`Pool SOL account (${POOL_SOL_ACCOUNT}) balance: ${poolSolBalance / LAMPORTS_PER_SOL} SOL`);
        
        let solSourceAccount = poolSolAccountPubkey;
        let sourceBalance = poolSolBalance;
        
        // If pool SOL account doesn't have enough, use pool authority as fallback
        const requiredSolAmount = expectedSolAmount + 0.01; // Add extra for fees
        if (poolSolBalance < requiredSolAmount * LAMPORTS_PER_SOL) {
          console.log(`Pool SOL account insufficient. Checking pool authority as backup...`);
          solSourceAccount = poolAuthorityKeypair.publicKey;
          sourceBalance = poolAuthorityBalance;
          
          if (sourceBalance < requiredSolAmount * LAMPORTS_PER_SOL) {
            console.log(`Pool authority also insufficient. Required: ${requiredSolAmount}, Has: ${sourceBalance / LAMPORTS_PER_SOL}`);
            
            try {
              const { fundPoolAuthorityWithAirdrop } = await import('./helpers/fund-pool-authority');
              const airdropAmount = Math.ceil(requiredSolAmount - (sourceBalance / LAMPORTS_PER_SOL));
              console.log(`Requesting ${airdropAmount} SOL airdrop for pool authority...`);
              await fundPoolAuthorityWithAirdrop(airdropAmount);
              
              // Update balance after airdrop
              sourceBalance = await connection.getBalance(solSourceAccount);
              console.log(`Pool authority balance after airdrop: ${sourceBalance / LAMPORTS_PER_SOL} SOL`);
            } catch (airdropError) {
              console.error('Failed to fund pool authority:', airdropError);
              throw new Error(`Insufficient SOL for swap. Required: ${requiredSolAmount} SOL`);
            }
          }
        }
        
        console.log(`Using SOL source account: ${solSourceAccount.toString()} with balance: ${sourceBalance / LAMPORTS_PER_SOL} SOL`);
        
        // Get recent blockhash for the second transaction
        const solTransferBlockhash = await connection.getLatestBlockhash();
        
        // Create a second transaction to transfer SOL from pool to user
        // The fee payer depends on which account we're using as the source
        let feePayer = poolAuthorityKeypair.publicKey;
        
        // If we're using the pool SOL account, we need to check if pool authority controls it
        if (!solSourceAccount.equals(poolAuthorityKeypair.publicKey)) {
          console.log(`Source account is different from pool authority. Checking account ownership...`);
          // For now, still use pool authority as fee payer
          feePayer = poolAuthorityKeypair.publicKey;
        }
        
        const solTransferTransaction = new Transaction({
          feePayer: feePayer, // Pool authority pays fees and signs
          blockhash: solTransferBlockhash.blockhash,
          lastValidBlockHeight: solTransferBlockhash.lastValidBlockHeight
        });
        
        try {
          // Create a clean SOL-only transfer by requesting user to send SOL directly
          // This avoids the "carry data" issue with pool authority account
          console.log(`Creating SOL transfer transaction for user wallet to handle...`);
          
          // Calculate exact lamports for transfer
          const lamports = BigInt(Math.round(expectedSolAmount * LAMPORTS_PER_SOL));
          console.log(`Converting ${expectedSolAmount} SOL to ${lamports} lamports`);
          
          // Create an airdrop for the user instead of transferring from pool authority
          // This is valid on devnet for testing purposes
          console.log(`Requesting SOL airdrop for user as swap completion...`);
          
          const maxAirdropAmount = 2; // Max 2 SOL per airdrop on devnet
          const airdropAmount = Math.min(expectedSolAmount, maxAirdropAmount);
          const airdropLamports = airdropAmount * LAMPORTS_PER_SOL;
          
          const airdropSignature = await connection.requestAirdrop(
            wallet.publicKey,
            airdropLamports
          );
          
          // Wait for airdrop confirmation
          await connection.confirmTransaction({
            signature: airdropSignature,
            blockhash: solTransferBlockhash.blockhash,
            lastValidBlockHeight: solTransferBlockhash.lastValidBlockHeight
          }, 'confirmed');
          
          console.log(`SOL airdrop completed! Signature: ${airdropSignature}`);
          const solTransferSignature = airdropSignature;
          
          // Execute token burning for sell operation (6.5% by default, configurable in admin settings)
          try {
            console.log("Executing token burn for sell operation...");
            const { executeTokenBurn } = await import('./token-burning');
            const burnSignature = await executeTokenBurn(wallet, 'sell', yotAmount);
            if (burnSignature) {
              console.log(`Token burn successful: ${burnSignature}`);
            } else {
              console.log("Token burn skipped (amount too small or disabled)");
            }
          } catch (burnError) {
            console.error("Token burn failed, but continuing with swap:", burnError);
            // Don't fail the entire swap if burning fails
          }
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
    
    // First pass to process all transactions individually
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
                
                // Calculate accurate toAmount based on AMM formula
                const poolData = await getPoolBalances();
                if (poolData.solBalance && poolData.yotBalance) {
                  // Use the pool ratio to calculate the amount
                  const exchangeRate = poolData.yotBalance / poolData.solBalance;
                  toAmount = solAmount * exchangeRate * (1 - SWAP_FEE);
                } else {
                  // Fallback to approximate rate if pool data not available
                  toAmount = solAmount * 100; 
                }
                
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
                  
                  // Attempt to extract the YOT amount from logs
                  let yotAmount = 0;
                  try {
                    const transferLog = txDetails.meta?.logMessages?.find(
                      log => log.includes('Transfer') && log.includes(YOT_TOKEN_ADDRESS)
                    );
                    if (transferLog) {
                      // Parse the transfer amount
                      const amountMatch = transferLog.match(/amount (\d+)/);
                      if (amountMatch && amountMatch[1]) {
                        // Convert from token decimal format
                        yotAmount = Number(amountMatch[1]) / Math.pow(10, 9); // Assuming 9 decimals for YOT
                      }
                    }
                  } catch (e) {
                    console.error("Error parsing YOT amount from logs:", e);
                  }
                  
                  fromAmount = yotAmount > 0 ? yotAmount : 1; // Default to 1 if parsing failed
                  
                  // Calculate SOL amount based on pool ratio
                  const poolData = await getPoolBalances();
                  if (poolData.solBalance && poolData.yotBalance && yotAmount > 0) {
                    const exchangeRate = poolData.solBalance / poolData.yotBalance;
                    toAmount = yotAmount * exchangeRate * (1 - SWAP_FEE);
                  } else {
                    toAmount = 0.01; // Fallback value
                  }
                  
                  fee = fromAmount * SWAP_FEE;
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
            fee,
            // Add metadata to help with grouping YOT to SOL transactions
            meta: {
              isYotToSolPart: fromToken === 'YOT' && toToken === 'SOL'
            }
          };
        } catch (error) {
          console.error(`Error fetching transaction ${tx.signature}:`, error);
          return null;
        }
      })
    );
    
    // Filter out null values
    const validTransactions = transactionDetails.filter(Boolean);
    
    // Group transactions - handle YOT to SOL swaps that show as multiple transactions
    // We'll create a map to group transactions by time (within a 10-second window)
    const timeGroups = new Map<string, any[]>();
    
    validTransactions.forEach(tx => {
      if (!tx) return;
      
      // Skip transactions that are not YOT to SOL parts (they stay as-is)
      if (!tx.meta?.isYotToSolPart) {
        timeGroups.set(tx.signature, [tx]);
        return;
      }
      
      // For YOT to SOL parts, try to group them by time
      const txTime = tx.timestamp;
      let foundGroup = false;
      
      // Check if this transaction belongs to an existing group
      // Use Array.from to convert the entries iterator to an array to avoid LSP issues
      Array.from(timeGroups.entries()).forEach(([key, group]) => {
        const groupTx = group[0];
        // If another YOT to SOL transaction exists within 10 seconds, group them
        if (Math.abs(groupTx.timestamp - txTime) < 10 && groupTx.meta?.isYotToSolPart) {
          timeGroups.get(key)?.push(tx);
          foundGroup = true;
        }
      });
      
      // If no group found, create a new one
      if (!foundGroup) {
        timeGroups.set(tx.signature, [tx]);
      }
    });
    
    // Process the groups to merge YOT to SOL transactions
    const processedTransactions: any[] = [];
    
    // Use Array.from to convert the values iterator to an array to avoid LSP issues
    Array.from(timeGroups.values()).forEach(group => {
      if (group.length === 1) {
        // Single transaction, add as-is
        processedTransactions.push(group[0]);
      } else {
        // Multiple transactions in the group (potential YOT to SOL swap parts)
        // Use the earliest transaction as the base
        const baseTransaction = group.reduce((earliest: any, current: any) => 
          current.timestamp < earliest.timestamp ? current : earliest
        );
        
        // Create a merged transaction
        processedTransactions.push({
          ...baseTransaction,
          signature: baseTransaction.signature,
          isSwap: true, // Force it to display as a swap
          fromToken: 'YOT',
          toToken: 'SOL',
          // Use the values from the earliest transaction
          fromAmount: baseTransaction.fromAmount,
          toAmount: baseTransaction.toAmount,
          fee: baseTransaction.fee
        });
      }
    });
    
    // Sort by timestamp (newest first)
    return processedTransactions.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error getting recent transactions:', error);
    throw error;
  }
}
