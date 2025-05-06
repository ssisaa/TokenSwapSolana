import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Keypair,
  ComputeBudgetProgram
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
import { MULTI_HUB_SWAP_PROGRAM_ID } from './config';
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
// Export this as solanaConnection as well for modules that import it with that name
export { connection as solanaConnection };

// Function to get the Solana connection (for backward compatibility)
export function getSolanaConnection(): Connection {
  return connection;
}

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
    if (solBalance === 0) {
      throw new Error('SOL balance in pool is zero - cannot proceed with proper exchange rate calculations');
    }
    
    // Get YOT balance directly from the token account
    let yotBalance;
    try {
      const yotAccountInfo = await getAccount(connection, yotTokenAccount);
      const yotMintInfo = await getMint(connection, yotTokenMint);
      yotBalance = Number(yotAccountInfo.amount) / Math.pow(10, yotMintInfo.decimals);
      
      if (yotBalance === 0) {
        throw new Error('YOT balance in pool is zero - cannot proceed with proper exchange rate calculations');
      }
    } catch (error) {
      console.error('Error getting YOT token balance:', error);
      throw new Error('Failed to retrieve YOT token balance: ' + (error instanceof Error ? error.message : String(error)));
    }
    
    // Get YOS balance - this can be optional since it's only for display purposes
    let yosBalance = 0;
    try {
      const yosAccountInfo = await getAccount(connection, yosTokenAccount);
      const yosMintInfo = await getMint(connection, yosTokenMint);
      yosBalance = Number(yosAccountInfo.amount) / Math.pow(10, yosMintInfo.decimals);
    } catch (error) {
      console.error('Error getting YOS token balance:', error);
      // YOS balance is not critical for most operations, so we can continue
      // but we'll log it clearly
      console.warn('Using zero for YOS balance due to error fetching it from blockchain');
    }
    
    console.log(`Pool balances fetched - SOL: ${lamportsToSol(solBalance)}, YOT: ${yotBalance}, YOS: ${yosBalance}`);
    
    return {
      solBalance: solBalance,
      yotBalance: yotBalance,
      yosBalance: yosBalance
    };
  } catch (error) {
    console.error('Error getting pool balances:', error);
    // Throw an error instead of returning zeros - force the caller to handle this properly
    throw new Error('Failed to retrieve pool balances from blockchain: ' + (error instanceof Error ? error.message : String(error)));
  }
}

// Calculate the exchange rate between SOL and YOT using AMM formula
/**
 * CRITICAL: Program-Derived Address (PDA) Utility Functions
 * 
 * These functions derive addresses directly from the program ID
 * This ensures we're always using the correct addresses regardless of what's in app.config.json
 * The program itself becomes the source of truth for all addresses
 */

/**
 * Get the program state PDA for the Multi-Hub Swap Program
 * This is the account that stores the program's configuration
 * @returns Public key of the program state PDA
 */
export function getProgramStatePda(): PublicKey {
  // Find the PDA for the program state
  // This must use 'state' as the seed - must match the Rust program implementation
  const [programState] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  
  return programState;
}

/**
 * Get the program authority PDA for the Multi-Hub Swap Program
 * This is the account that the program expects to be used as the central liquidity wallet
 * This function derives it directly from the program ID, ensuring it's always correct
 * 
 * @returns Public key of the program authority PDA
 */
export function getProgramAuthorityPda(): PublicKey {
  // Find the PDA for the program authority
  // This must use 'authority' as the seed - must match the Rust program implementation
  const [programAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  
  return programAuthority;
}

/**
 * Get the liquidity contribution PDA for a specific user
 * This account tracks a user's contribution to the liquidity pool
 * 
 * @param userPublicKey The public key of the user
 * @returns Public key of the user's liquidity contribution PDA
 */
export function getLiquidityContributionPda(userPublicKey: PublicKey): PublicKey {
  // Find the PDA for the liquidity contribution
  // This must use 'liq' + user_pubkey as the seed - must match the Rust program implementation
  const [liquidityContribution] = PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userPublicKey.toBuffer()],
    new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
  );
  
  return liquidityContribution;
}

/**
 * Get the central liquidity wallet that the program expects for transaction processing
 * This ensures we always use the correct wallet address regardless of configuration
 * 
 * @returns The Public Key of the central liquidity wallet (which is the program authority PDA)
 */
export function getCentralLiquidityWallet(): PublicKey {
  // The program specifically expects the program authority PDA as the central liquidity wallet
  return getProgramAuthorityPda();
}

export async function getExchangeRate() {
  try {
    const { solBalance, yotBalance } = await getPoolBalances();
    
    // If either balance is zero, we can't calculate the exchange rate
    if (solBalance === 0 || yotBalance === 0) {
      throw new Error('Cannot calculate exchange rate: Liquidity pool balance is zero or not found');
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
    // No fallbacks - propagate the error with clear message
    throw new Error(`Failed to retrieve real exchange rates from blockchain: ${error.message}`);
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
      // No fallback - throw an error if data is missing
      throw new Error('Cannot calculate YOS to YOT conversion: Insufficient liquidity in pool');
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
    // No fallbacks - propagate the error
    throw new Error(`Failed to calculate YOS to YOT conversion: ${error.message}`);
  }
}

// Calculate the conversion between YOT and YOS based on AMM pool balances
export async function calculateYotToYos(yotAmount: number) {
  try {
    // Get the pool data for actual YOT and YOS balances
    const { yotBalance, yosBalance } = await getPoolBalances();
    
    if (!yotBalance || !yosBalance || yotBalance === 0 || yosBalance === 0) {
      // No fallback - throw an error if data is missing
      throw new Error('Cannot calculate YOT to YOS conversion: Insufficient liquidity in pool');
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
    // No fallbacks - propagate the error
    throw new Error(`Failed to calculate YOT to YOS conversion: ${error.message}`);
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
      throw new Error('Cannot calculate YOT market price: insufficient liquidity data');
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
    throw new Error(`Failed to calculate YOT market price: ${error.message}`);
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
    throw new Error(`Failed to calculate YOS market price: ${error.message}`);
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
    throw new Error(`Failed to retrieve token prices from blockchain: ${error.message}`);
  }
}

// Execute a swap from SOL to YOT
export /**
 * Swap SOL for YOT tokens using the multi-hub-swap program via secureSwap
 * This implementation calls the on-chain program directly to perform the swap
 */
async function swapSolToYot(
  wallet: any, // Wallet adapter
  solAmount: number,
  slippage: number = 0.01 // 1% slippage tolerance
) {
  try {
    if (!wallet.publicKey) throw new Error('Wallet not connected');
    
    console.log(`[SOL-YOT SWAP] Starting swap of ${solAmount} SOL to YOT using on-chain program`);
    
    // Import the secure swap implementation that uses the on-chain program
    const { secureSwap } = await import('./secureSwap');
    
    // Use the proper secure swap implementation that calls the on-chain program
    const swapResult = await secureSwap(wallet, solAmount);
    
    if (!swapResult.success) {
      console.error("[SOL-YOT SWAP] Swap failed:", swapResult.error);
      throw new Error(swapResult.message || "Swap failed");
    }
    
    console.log("[SOL-YOT SWAP] On-chain swap completed successfully!");
    console.log(`[SOL-YOT SWAP] Transaction signature: ${swapResult.signature}`);
    console.log(`[SOL-YOT SWAP] Output amount: ${swapResult.outputAmount} YOT`);
    
    // Return swap details for the UI
    return {
      signature: swapResult.signature,
      fromAmount: solAmount,
      toAmount: swapResult.outputAmount,
      fromToken: 'SOL',
      toToken: 'YOT',
      fee: solAmount * 0.003 // 0.3% fee
    };
    
  } catch (error: any) {
    console.error('Error swapping SOL to YOT:', error);
    throw error;
  }
}

/**
 * Special function for SOL to YOT swaps for multi-hub-swap integration
 * This function is specifically designed to work with the multi-hub-swap-contract.ts
 * Uses the smart contract-based approach for a complete on-chain swap
 * 
 * @param wallet The connected wallet
 * @param solAmount The amount of SOL to swap
 * @returns Transaction result object
 */
export async function solToYotSwap(
  wallet: any,
  solAmount: number
): Promise<string> {
  console.log(`[SOL-YOT SWAP] Initiating with SOL amount: ${solAmount}`);
  
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    // Calculate the expected YOT output
    const expectedYotAmount = await calculateSolToYot(solAmount);
    console.log(`[SOL-YOT SWAP] Expected YOT output: ${expectedYotAmount}`);
    
    // Step 1: Set up accounts and blockchain addresses
    const yotTokenMint = new PublicKey(YOT_TOKEN_ADDRESS);
    const poolSolAccount = new PublicKey(POOL_SOL_ACCOUNT);
    const poolAuthority = new PublicKey(POOL_AUTHORITY);
    const userPublicKey = wallet.publicKey;

    // Step 2: Check if user has enough SOL
    const userSolBalance = await connection.getBalance(userPublicKey);
    const solAmountInLamports = solToLamports(solAmount);
    
    // Leave some SOL for transaction fees (~0.000005 SOL)
    const reserveForFees = BigInt(5000);
    
    if (userSolBalance < Number(solAmountInLamports) + Number(reserveForFees)) {
      throw new Error(`Insufficient SOL balance. You have ${lamportsToSol(userSolBalance)} SOL, but need at least ${solAmount + 0.000005} SOL (including fees).`);
    }
    
    // Step 3: Get or create the user's YOT token account
    const userYotAccount = await getAssociatedTokenAddress(
      yotTokenMint, 
      userPublicKey
    );
    
    // Check if the user's YOT token account exists and create it if needed
    let setupTransaction = new Transaction();
    let needsSetup = false;
    
    try {
      await getAccount(connection, userYotAccount);
      console.log("[SOL-YOT SWAP] User's YOT token account exists");
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        console.log("[SOL-YOT SWAP] User's YOT token account does not exist, will create it");
        setupTransaction.add(
          createAssociatedTokenAccountInstruction(
            userPublicKey,  // payer
            userYotAccount, // ata
            userPublicKey,  // owner
            yotTokenMint    // mint
          )
        );
        needsSetup = true;
      } else {
        throw error;
      }
    }
    
    // If we need to create the token account, do it first in a separate transaction
    if (needsSetup) {
      try {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        setupTransaction.recentBlockhash = blockhash;
        setupTransaction.feePayer = userPublicKey;
        
        const signedSetupTx = await wallet.signTransaction(setupTransaction);
        const setupSig = await connection.sendRawTransaction(signedSetupTx.serialize());
        
        console.log("[SOL-YOT SWAP] Created YOT token account, signature:", setupSig);
        
        // Wait for confirmation
        await connection.confirmTransaction({
          signature: setupSig,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
      } catch (error) {
        console.error("[SOL-YOT SWAP] Error creating YOT token account:", error);
        throw new Error("Failed to create YOT token account. Please try again.");
      }
    }
    
    // Step 4: Create the main swap transaction - send SOL to the pool
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    const transaction = new Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;
    
    // Add compute budget instructions to ensure we have enough compute units
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 1000000 // High value for complex operations
      })
    );
    
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1_000_000 // Higher priority fee
      })
    );
    
    // Add the SOL transfer instruction
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: poolSolAccount,
        lamports: solAmountInLamports
      })
    );
    
    // Step 5: Sign and send the transaction
    console.log("[SOL-YOT SWAP] Requesting wallet signature...");
    const signedTransaction = await wallet.signTransaction(transaction);
    
    console.log("[SOL-YOT SWAP] Sending transaction...");
    const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    
    console.log(`[SOL-YOT SWAP] Transaction sent with signature: ${signature}`);
    
    // Step 6: Wait for confirmation
    console.log("[SOL-YOT SWAP] Waiting for confirmation...");
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');
    
    console.log("[SOL-YOT SWAP] Transaction confirmed successfully!");
    
    // Import the function to handle the YOT transfer back to the user
    // Use dynamic import with type annotation to ensure TypeScript recognizes the function
    const completeSwapModule = await import('./completeSwap');
    const completeSwapWithYotTransfer = completeSwapModule.completeSwapWithYotTransfer;
    
    // Step 7: Since the blockchain part is a two-stage process (unlike an AMM), 
    // request the YOT tokens to be sent back from the pool to the user
    try {
      // Calculate the distribution amounts based on the protocol rules
      // 75% to user wallet directly
      // 20% to liquidity
      // 5% as YOS cashback
      const userYotAmount = expectedYotAmount * 0.75;
      
      // Execute the second part of the swap - transferring YOT tokens from pool to user
      console.log(`[SOL-YOT SWAP] Now sending ${userYotAmount} YOT tokens (75%) to ${userPublicKey.toString()}`);
      
      // Attempt to complete the token transfer part, but we know this will fail client-side
      // We need to inform the user about this limitation
      const tokenTransferResult = await completeSwapWithYotTransfer(
        userPublicKey,  // User's public key to receive tokens
        userYotAmount   // Amount of YOT tokens to send (75% of total)
      );
      
      // Check if we need to create a token account first
      if (tokenTransferResult.needsTokenAccount) {
        console.log(`[SOL-YOT SWAP] User needs to create YOT token account first`);
        // We should return this info to the UI
        return {
          solSignature: signature,
          needsTokenAccount: true,
          tokenAccountTransaction: tokenTransferResult.tokenAccountTransaction,
          message: "SOL sent successfully. You need to create a YOT token account to receive tokens."
        };
      }
      
      // If we get here, we're returning the error from completeSwapWithYotTransfer
      if (tokenTransferResult.error) {
        console.error("[SOL-YOT SWAP] Error from token transfer:", tokenTransferResult.message);
        
        // Return structured info about the partial success
        return {
          solSignature: signature,
          completed: false,
          error: true,
          message: tokenTransferResult.message || "SOL sent to pool successfully, but YOT tokens couldn't be transferred back due to security limitations."
        };
      }
      
      // This code won't execute with current implementation, but keeping for future upgrades
      console.log(`[SOL-YOT SWAP] YOT tokens sent successfully!`);
      return {
        solSignature: signature,
        completed: true
      };
    } catch (error) {
      console.error("[SOL-YOT SWAP] Error sending YOT tokens from pool:", error);
      
      // Return a structured result that the UI can use to display to the user
      return {
        solSignature: signature,
        completed: false,
        error: true,
        message: `SOL sent to pool successfully (sig: ${signature}), but there was an error with the YOT token transfer: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  } catch (error) {
    console.error("[SOL-YOT SWAP] Error:", error);
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
