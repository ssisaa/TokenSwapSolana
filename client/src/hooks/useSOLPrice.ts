import { useState, useEffect } from 'react';
import { Connection } from '@solana/web3.js';
import { ENDPOINT } from '@/lib/constants';

interface UseSOLPriceResult {
  solPrice: number;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch the current SOL price
 * For demo purposes, this simulates a price that fluctuates slightly
 * In production, this would fetch from a price oracle or API
 */
export function useSOLPrice(): UseSOLPriceResult {
  const [solPrice, setSOLPrice] = useState<number>(22.45); // Initial SOL price estimate
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchSOLPrice() {
      setIsLoading(true);
      setError(null);

      try {
        // In a real implementation, we would fetch from a price oracle or API
        // For demonstration, we're using a simulated price with small random fluctuations
        
        // Add a small random fluctuation to simulate price changes
        const fluctuation = (Math.random() * 0.2) - 0.1; // -0.1 to +0.1
        const newPrice = 22.45 + fluctuation;
        
        setSOLPrice(newPrice);
      } catch (err) {
        console.error('Error fetching SOL price:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch SOL price'));
      } finally {
        setIsLoading(false);
      }
    }

    fetchSOLPrice();
    
    // In a real app, we would set up an interval to refresh the price
    const intervalId = setInterval(() => {
      fetchSOLPrice();
    }, 60000); // Refresh every minute
    
    return () => clearInterval(intervalId);
  }, []);

  return { solPrice, isLoading, error };
}