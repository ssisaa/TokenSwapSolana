import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { connection } from '@/lib/completeSwap';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useMultiWallet } from '@/context/MultiWalletContext';

export function useTokenBalance(tokenMintAddress: string) {
  const { publicKey, connected } = useMultiWallet();
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchBalance = async () => {
      if (!publicKey || !connected || !tokenMintAddress) {
        if (isMounted) {
          setBalance(0);
          setIsLoading(false);
        }
        return;
      }
      
      if (isMounted) {
        setIsLoading(true);
        setError(null);
      }
      
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
        
        // Fetch the account info
        const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
        
        if (accountInfo && accountInfo.value && isMounted) {
          // If decimals is 9, divide by 10^9 to get the actual token amount
          const decimals = accountInfo.value.decimals;
          const amount = parseFloat(accountInfo.value.amount) / Math.pow(10, decimals);
          setBalance(amount);
        }
      } catch (err) {
        console.error('Error fetching token balance:', err);
        // If the token account doesn't exist, that means the balance is 0
        if (isMounted) {
          setBalance(0);
          setError(err instanceof Error ? err : new Error('Unknown error occurred'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    // Initial fetch
    fetchBalance();
    
    // Set up an interval to refresh the balance every 15 seconds (reduced from 30)
    const intervalId = setInterval(fetchBalance, 15000);
    
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [publicKey, connected, tokenMintAddress]);
  
  // If the wallet is connected but the token address is invalid, provide a clear error
  // Return balance 0 instead of undefined when loading or on error
  return { 
    balance: balance || 0, 
    isLoading, 
    error 
  };
}