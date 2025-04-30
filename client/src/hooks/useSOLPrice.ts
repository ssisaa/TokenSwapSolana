import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

interface SOLPriceData {
  solana: {
    usd: number;
  };
}

export function useSOLPrice() {
  const [solPrice, setSolPrice] = useState<number>(0);

  const { data, isLoading, error } = useQuery<SOLPriceData>({
    queryKey: ['sol-price'],
    queryFn: async () => {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
        { 
          headers: { 'Accept': 'application/json' }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch SOL price');
      }
      
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });

  // Set the SOL price whenever the data changes
  useEffect(() => {
    if (data?.solana?.usd) {
      console.log("Live SOL price from CoinGecko:", `$${data.solana.usd}`);
      setSolPrice(data.solana.usd);
    } else {
      // Fallback price if API call fails
      const fallbackPrice = 142.18;
      console.log("Using SOL price:", `$${fallbackPrice}`);
      setSolPrice(fallbackPrice);
    }
  }, [data]);

  // Even before the query resolves, set a reasonable default
  useEffect(() => {
    if (isLoading) {
      const initialPrice = 148.35;
      console.log("Using SOL price:", `$${initialPrice}`);
      setSolPrice(initialPrice);
    }
  }, [isLoading]);

  return {
    solPrice,
    isLoading,
    error
  };
}