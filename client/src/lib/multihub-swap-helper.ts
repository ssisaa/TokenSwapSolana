/**
 * Multihub Swap Helper Functions
 * Bridge between Raydium and our MultihubSwap contract
 */

import { MultihubSwapProvider } from './multihub-contract';

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
    const multihubProvider = new MultihubSwapProvider();
    console.log(`Executing multi-hub swap: ${amount} ${fromToken.symbol} -> ${toToken.symbol}`);
    console.log(`This will include 20% liquidity contribution and 5% YOS cashback`);
    
    // Execute the swap
    const result = await multihubProvider.executeSwap(
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