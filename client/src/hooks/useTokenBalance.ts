import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { connection } from '@/lib/completeSwap';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useMultiWallet } from '@/context/MultiWalletContext';

export function useTokenBalance(tokenMintAddress: string) {
  const { publicKey, connected } = useMultiWallet();
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Create a memoized function for fetching the balance
  const fetchBalance = useCallback(async () => {
    if (!publicKey || !connected || !tokenMintAddress) {
      setBalance(0);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Make sure token address is valid
      if (tokenMintAddress.length < 32) {
        throw new Error("Invalid token mint address");
      }
      
      // Convert the mint address string to a PublicKey
      const mintPublicKey = new PublicKey(tokenMintAddress);
      
      // Get the associated token account address for the user's wallet
      const tokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        publicKey
      );
      
      // First check if the token account exists to avoid RPC errors
      const tokenAccountInfo = await connection.getAccountInfo(tokenAccount);
      
      if (!tokenAccountInfo) {
        // Token account doesn't exist yet, set balance to 0
        console.log(`Token account for ${tokenMintAddress.slice(0, 8)}... doesn't exist yet for this wallet`);
        setBalance(0);
        return;
      }
      
      // If account exists, fetch the token balance
      const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
      
      if (accountInfo && accountInfo.value) {
        // If decimals is 9, divide by 10^9 to get the actual token amount
        const decimals = accountInfo.value.decimals;
        const amount = parseFloat(accountInfo.value.amount) / Math.pow(10, decimals);
        setBalance(amount);
        // Clear any errors if we successfully got the balance
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching token balance:', err);
      // If there was an error, set balance to 0 but keep the error for debugging
      setBalance(0);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, connected, tokenMintAddress]);
  
  // Manual refresh function that can be called by components
  const refreshBalance = useCallback(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    let isMounted = true;
    
    // A wrapper function to respect the mounted state
    const safelyFetchBalance = async () => {
      if (isMounted) {
        await fetchBalance();
      }
    };
    
    // Initial fetch
    safelyFetchBalance();
    
    // Set up an interval to refresh the balance every 15 seconds
    const intervalId = setInterval(safelyFetchBalance, 15000);
    
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [fetchBalance]);
  
  // Return the balance and add refreshBalance function
  return { 
    balance: balance || 0, 
    isLoading, 
    error,
    refreshBalance
  };
}