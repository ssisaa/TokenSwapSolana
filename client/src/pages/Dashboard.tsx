import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useSolanaWallet";
import { useTokenData } from "@/hooks/useTokenData";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import MultiWalletConnect from "@/components/MultiWalletConnect";
import { getExchangeRate, getPoolBalances, getSolMarketPrice } from "@/lib/solana";

export default function Dashboard() {
  const { connected, wallet } = useWallet();
  const { tokenData, poolData, balances, loading, fetchTokenInfo, fetchBalances } = useTokenData();
  const [priceData, setPriceData] = useState({
    yotPrice: 0.00000200,
    yosPrice: 0.00002000,
    solPrice: 151, // Will be updated with live market price
    totalLiquidity: 3795.03,
    yotPriceChange: "+2.5%", // Default value
    yosPriceChange: "+1.1%", // Default value
    liquidityChange: "+$198.00 (24h)" // Default value
  });

  // Fetch live token data
  const fetchPriceData = useCallback(async () => {
    try {
      // Get the real-time SOL price from CoinGecko
      const solPrice = await getSolMarketPrice();
      
      // Get pool balances
      const pool = await getPoolBalances();
      
      // Get current exchange rate
      const exchangeRate = await getExchangeRate();
      
      if (pool.solBalance && pool.yotBalance) {
        // Convert SOL balance from lamports to SOL
        const solBalanceInSol = pool.solBalance / 1e9;
        
        // Calculate YOT price in USD (based on SOL price and pool ratio)
        const yotPrice = (solPrice * solBalanceInSol) / pool.yotBalance;
        
        // Calculate YOS price (YOS is 10x less valuable than YOT)
        const yosPrice = yotPrice / 10;
        
        // Calculate total liquidity
        const totalLiquidity = (solBalanceInSol * solPrice) + 
                              (pool.yotBalance * yotPrice);
        
        setPriceData(prev => ({
          ...prev,
          solPrice,
          yotPrice,
          yosPrice,
          totalLiquidity
        }));
        
        console.log(`Live SOL price from CoinGecko: $${solPrice}`);
      }
    } catch (error) {
      console.error("Error fetching price data:", error);
    }
  }, []);

  // Initial data loading
  useEffect(() => {
    fetchTokenInfo();
    fetchPriceData();
    
    // Fetch wallet balances when connected
    if (connected && wallet?.publicKey) {
      console.log("Fetching balances for connected wallet:", wallet.publicKey.toString());
      fetchTokenInfo();
      // Call fetchBalances with the wallet address
      fetchBalances(wallet.publicKey.toString());
    }
    
    // Set up interval to refresh price data
    const interval = setInterval(() => {
      fetchPriceData();
      
      // Also refresh balances if wallet is connected
      if (connected && wallet?.publicKey) {
        fetchTokenInfo();
        fetchBalances(wallet.publicKey.toString());
      }
    }, 15000); // Refresh every 15 seconds
    
    return () => clearInterval(interval);
  }, [fetchTokenInfo, fetchPriceData, fetchBalances, connected, wallet]);

  // Removed countdown timer for next claim feature
  
  // Use dynamically calculated price changes
  const getYotPriceChange = () => {
    return priceData.yotPriceChange;
  };
  
  const getYosPriceChange = () => {
    return priceData.yosPriceChange;
  };

  return (
    <DashboardLayout title="Dashboard">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Welcome to YOT/YOS</h1>
          <p className="text-gray-400 mt-1">Your Own Token, Your Own Story</p>
        </div>

        {/* Token Prices Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-dark-200 border-dark-400 p-4">
            <h3 className="text-gray-400 text-sm">YOT Price</h3>
            <div className="mt-1">
              <span className="text-xl font-semibold text-white">
                ${priceData.yotPrice.toFixed(8)}
              </span>
              <span className="ml-2 text-green-500 text-sm">+2.5%</span>
            </div>
          </Card>
          
          <Card className="bg-dark-200 border-dark-400 p-4">
            <h3 className="text-gray-400 text-sm">YOS Price</h3>
            <div className="mt-1">
              <span className="text-xl font-semibold text-white">
                ${priceData.yosPrice.toFixed(8)}
              </span>
              <span className="ml-2 text-green-500 text-sm">+1.1%</span>
            </div>
          </Card>
          
          <Card className="bg-dark-200 border-dark-400 p-4">
            <h3 className="text-gray-400 text-sm">SOL Price</h3>
            <div className="mt-1">
              <span className="text-xl font-semibold text-white">
                ${priceData.solPrice.toFixed(2)}
              </span>
              <span className="ml-2 text-gray-400 text-sm">Live market data</span>
            </div>
          </Card>
          
          <Card className="bg-dark-200 border-dark-400 p-4">
            <h3 className="text-gray-400 text-sm">Total Liquidity</h3>
            <div className="mt-1">
              <span className="text-xl font-semibold text-white">
                ${formatCurrency(priceData.totalLiquidity)}
              </span>
              <span className="ml-2 text-green-500 text-sm">{priceData.liquidityChange}</span>
            </div>
          </Card>
        </div>

        {/* Next Claim and Wallet Balance Bar removed */}

        {/* Token Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* YOT Card */}
          <Card className="bg-dark-200 border-dark-400 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                YOT
              </div>
              <div className="ml-3">
                <h3 className="text-white font-semibold">Your Own Token</h3>
                <p className="text-xs text-gray-400">Trading & Staking Token</p>
              </div>
              <div className="ml-auto text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded">
                SPL Token
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-gray-400 text-sm">Balance</div>
                <div className="text-xl font-semibold text-white">
                  {loading ? "Loading..." : formatCurrency(balances?.yot || 0)} YOT
                </div>
                <div className="text-xs text-gray-500">Balance verified</div>
              </div>
              <div>
                <div className="text-gray-400 text-sm">Value</div>
                <div className="text-xl font-semibold text-white">
                  ${loading ? "Loading..." : formatCurrency((balances?.yot || 0) * priceData.yotPrice)}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <Link href="/swap">
                <a className="bg-blue-600 text-white text-center py-2 px-4 rounded font-medium hover:bg-blue-700 transition">
                  Buy
                </a>
              </Link>
              <Link href="/swap">
                <a className="bg-dark-300 text-white text-center py-2 px-4 rounded font-medium hover:bg-dark-400 transition">
                  Sell
                </a>
              </Link>
              <Link href="/stake">
                <a className="bg-dark-300 text-white text-center py-2 px-4 rounded font-medium hover:bg-dark-400 transition">
                  Stake
                </a>
              </Link>
            </div>
          </Card>
          
          {/* YOS Card */}
          <Card className="bg-dark-200 border-dark-400 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
                YOS
              </div>
              <div className="ml-3">
                <h3 className="text-white font-semibold">Your Own Story</h3>
                <p className="text-xs text-gray-400">Rewards & Claims Token</p>
              </div>
              <div className="ml-auto text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">
                SPL Token
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-gray-400 text-sm">Balance</div>
                <div className="text-xl font-semibold text-white">
                  {loading ? "Loading..." : formatCurrency(balances?.yos || 0)} YOS
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-sm">Value</div>
                <div className="text-xl font-semibold text-white">
                  ${loading ? "Loading..." : formatCurrency((balances?.yos || 0) * priceData.yosPrice)}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Link href="/swap">
                <a className="flex items-center justify-center bg-green-600 text-white py-2 px-4 rounded font-medium hover:bg-green-700 transition">
                  <span>Swap to YOT</span>
                </a>
              </Link>
              <Link href="/stake">
                <a className="flex items-center justify-center bg-dark-300 text-white py-2 px-4 rounded font-medium hover:bg-dark-400 transition">
                  <span>Claim Info</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </a>
              </Link>
            </div>
          </Card>
        </div>
        
        {/* Staking Dashboard Preview */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Your Staking Dashboard</h2>
            <Link href="/stake">
              <a className="text-primary-400 hover:text-primary-300 flex items-center text-sm">
                <span>View Details</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </a>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-dark-200 border-dark-400 p-4">
              <h3 className="text-gray-400 text-sm">Total Staked</h3>
              <div className="text-xl font-semibold text-white mt-1">
                {loading ? "Loading..." : formatCurrency(balances?.yot || 0)} YOT 
                <span className="text-sm text-gray-400">
                  ${formatCurrency((balances?.yot || 0) * priceData.yotPrice)}
                </span>
              </div>
            </Card>
            
            <Card className="bg-dark-200 border-dark-400 p-4">
              <h3 className="text-gray-400 text-sm">Earned Rewards</h3>
              <div className="text-xl font-semibold text-white mt-1">
                {loading ? "Loading..." : formatCurrency(balances?.yos || 0)} YOS 
                <span className="text-sm text-gray-400">
                  ${formatCurrency((balances?.yos || 0) * priceData.yosPrice)}
                </span>
              </div>
            </Card>
          </div>
        </div>
        
        {!connected && (
          <Card className="bg-dark-200 border-dark-400 p-6 text-center">
            <h2 className="text-white text-xl font-semibold mb-2">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-4">Connect your wallet to view your token balances and start interacting with YOT/YOS.</p>
            <div className="flex justify-center">
              <MultiWalletConnect />
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}