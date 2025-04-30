import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

// Interface for our price data
interface SOLPriceData {
  solana: {
    usd: number;
  };
}

export function useSOLPrice() {
  const { data, isLoading, error } = useQuery<SOLPriceData>({
    queryKey: ['sol-price'],
    queryFn: async () => {
      try {
        // Use CoinGecko API to get SOL price
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        if (!response.ok) {
          throw new Error('Failed to fetch SOL price');
        }
        const data = await response.json();
        console.log('Live SOL price from CoinGecko:', `$${data.solana.usd}`);
        return data;
      } catch (error) {
        console.error('Error fetching SOL price:', error);
        // Return fallback price if API fails
        return { solana: { usd: 148.35 } }; // Fallback price
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Extract the price value or use the fallback
  const solPrice = data?.solana?.usd || 148.35;

  // Log when the hook is used
  useEffect(() => {
    console.log('Using SOL price:', `$${solPrice}`);
  }, [solPrice]);

  return {
    solPrice,
    isLoading,
    error,
  };
}