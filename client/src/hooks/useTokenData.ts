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
      // Using a reasonable estimate for SOL price in USD
      const solPrice = 100; // Current SOL price in USD
      const solUsdValue = solBalance * solPrice;
      
      // Fetch pool data for AMM calculation
      const pool = await getPoolBalances();
      
      let yotUsdValue = 0;
      let yosUsdValue = 0;
      
      if (pool.solBalance && pool.yotBalance) {
        // Calculate YOT price based on AMM liquidity pool
        // Using the x * y = k formula, where k is a constant
        // The exchange rate is determined by the ratio of tokens in the pool
        const yotToSolRate = pool.solBalance / pool.yotBalance; // How much SOL 1 YOT is worth
        yotUsdValue = yotBalance * yotToSolRate * solPrice;
        
        // For YOS, we use the fixed 1:10 ratio with YOT, then calculate USD value
        // 1 YOS = 10 YOT, so 1 YOS = 10 * YOT/SOL rate * SOL price
        const yosToSolRate = yotToSolRate * 10; // Since 1 YOS = 10 YOT
        yosUsdValue = yosBalance * yosToSolRate * solPrice;
      }
      
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
