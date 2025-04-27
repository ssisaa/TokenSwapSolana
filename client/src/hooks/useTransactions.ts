import { useState, useCallback } from "react";
import { getRecentTransactions } from "@/lib/solana";

interface Transaction {
  signature: string;
  timestamp: number;
  status: string;
  isSwap: boolean;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  fee: number;
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransactions = useCallback(async (address: string) => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const fetchedTransactions = await getRecentTransactions(address);
      setTransactions(fetchedTransactions as Transaction[]);
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch transactions"));
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    transactions,
    loading,
    error,
    fetchTransactions
  };
}
