import { useState, useCallback } from "react";
import { 
  getTokenInfo, 
  getTokenBalance, 
  getSolBalance, 
  getPoolBalances 
} from "@/lib/solana";
import { 
  YOT_TOKEN_ADDRESS, 
  YOS_TOKEN_ADDRESS 
} from "@/lib/constants";
import { PublicKey } from "@solana/web3.js";
import { useToast } from "@/hooks/use-toast";

// Define types for token info
interface TokenInfo {
  address: string;
  decimals: number;
  supply: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
}

interface TokenData {
  yot: TokenInfo | null;
  yos: TokenInfo | null;
}

interface PoolData {
  solBalance: number | null;
  yotBalance: number | null;
}

interface Balances {
  sol: number;
  solUsd: number;
  yot: number;
  yotUsd: number;
  yos: number;
  yosUsd: number;
}

export function useTokenData() {
  const [tokenData, setTokenData] = useState<TokenData>({ yot: null, yos: null });
  const [poolData, setPoolData] = useState<PoolData>({ solBalance: null, yotBalance: null });
  const [balances, setBalances] = useState<Balances>({ sol: 0, solUsd: 0, yot: 0, yotUsd: 0, yos: 0, yosUsd: 0 });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Fetch token information
  const fetchTokenInfo = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch YOT token info
      const yotInfo = await getTokenInfo(YOT_TOKEN_ADDRESS);
      
      // Fetch YOS token info
      const yosInfo = await getTokenInfo(YOS_TOKEN_ADDRESS);
      
      // Fetch pool balances
      const pool = await getPoolBalances();
      
      setTokenData({
        yot: yotInfo,
        yos: yosInfo
      });
      
      setPoolData({
        solBalance: pool.solBalance,
        yotBalance: pool.yotBalance
      });
    } catch (error) {
      console.error("Error fetching token information:", error);
      toast({
        title: "Error fetching token data",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch user balances
  const fetchBalances = useCallback(async (walletAddress: string) => {
    if (!walletAddress) return;
    
    try {
      const publicKey = new PublicKey(walletAddress);
      
      // Fetch SOL balance
      const solBalance = await getSolBalance(publicKey);
      
      // Fetch YOT balance
      const yotBalance = await getTokenBalance(YOT_TOKEN_ADDRESS, publicKey);
      
      // Fetch YOS balance
      const yosBalance = await getTokenBalance(YOS_TOKEN_ADDRESS, publicKey);
      
      // Calculate estimated USD value (in a real app, this would use an oracle)
      // Using a hardcoded price for demo purposes
      const solPrice = 100; // Mock price in USD
      const solUsdValue = solBalance * solPrice;
      
      // Calculate YOT and YOS USD values based on their exchange rate with SOL
      // In a real app, we would fetch prices from an oracle
      // Here we use a simple calculation relative to SOL
      const yotExchangeRate = 0.00001; // YOT to SOL rate
      const yosExchangeRate = 0.005;   // YOS to SOL rate
      
      const yotUsdValue = yotBalance * yotExchangeRate * solPrice;
      const yosUsdValue = yosBalance * yosExchangeRate * solPrice;
      
      setBalances({
        sol: solBalance,
        solUsd: solUsdValue,
        yot: yotBalance,
        yotUsd: yotUsdValue,
        yos: yosBalance,
        yosUsd: yosUsdValue
      });
    } catch (error) {
      console.error("Error fetching balances:", error);
      toast({
        title: "Error fetching balances",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  }, [toast]);

  return {
    tokenData,
    poolData,
    balances,
    loading,
    fetchTokenInfo,
    fetchBalances
  };
}
