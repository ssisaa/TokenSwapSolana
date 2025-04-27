import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet } from "@/hooks/useSolanaWallet";
import { useTokenData } from "@/hooks/useTokenData";
import { formatCurrency } from "@/lib/utils";
import { ExternalLink, Info } from "lucide-react";
import { 
  POOL_AUTHORITY, 
  YOT_TOKEN_ACCOUNT, 
  POOL_SOL_ACCOUNT, 
  YOS_TOKEN_ACCOUNT 
} from "@/lib/constants";
import { shortenAddress } from "@/lib/utils";

export default function Liquidity() {
  const { connected } = useWallet();
  const { poolData, balances, loading } = useTokenData();
  const [selectedTimeframe, setSelectedTimeframe] = useState("1W");
  const [liquidityChange, setLiquidityChange] = useState("+$198.00 (24h)");
  const [totalLiquidity, setTotalLiquidity] = useState("$3,300.00");
  const [exchangeRates, setExchangeRates] = useState({
    yotToSol: "75000000 : 1",
    solToYot: "1 : 75000000"
  });
  const [poolHealth, setPoolHealth] = useState("Excellent");

  // Calculate pool values and exchange rates
  const calculatePoolData = useCallback(() => {
    if (!poolData?.solBalance || !poolData?.yotBalance) return;
    
    const yotPerSol = poolData.yotBalance / poolData.solBalance;
    const solPerYot = poolData.solBalance / poolData.yotBalance;
    
    setExchangeRates({
      yotToSol: `${formatCurrency(yotPerSol)} : 1`,
      solToYot: `1 : ${formatCurrency(yotPerSol)}`
    });
    
    // Calculate total liquidity in USD (using approximated values for demo)
    if (balances?.sol && balances?.yot && balances.solUsd && balances.yotUsd) {
      const solValue = poolData.solBalance * (balances.solUsd / balances.sol);
      const yotValue = poolData.yotBalance * (balances.yotUsd / balances.yot);
      const totalValue = solValue + yotValue;
      
      setTotalLiquidity(`$${formatCurrency(totalValue)}`);
    }
  }, [poolData, balances]);

  useEffect(() => {
    calculatePoolData();
  }, [calculatePoolData]);

  return (
    <DashboardLayout title="Liquidity">
      <div className="max-w-6xl mx-auto">
        {/* Liquidity Pool Overview */}
        <Card className="bg-dark-200 border-dark-400 p-6 mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Liquidity Pool Overview</h1>
          <p className="text-gray-400 mb-6">
            0.3% of every buy and sell automatically contributes to the liquidity pool
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Total Liquidity Value */}
            <div>
              <h3 className="text-gray-400 text-sm mb-2">Total Liquidity Value</h3>
              <div className="text-2xl font-semibold text-white">
                {totalLiquidity}
              </div>
              <div className="text-sm text-green-500">
                {liquidityChange}
              </div>
              <div className="flex mt-2 space-x-2">
                <div className="text-sm text-gray-400">
                  {formatCurrency(poolData?.yotBalance || 0)} YOT
                </div>
                <div className="px-2 py-1 bg-amber-700 rounded text-xs text-white">
                  {formatCurrency(poolData?.solBalance || 0)} SOL
                </div>
              </div>
            </div>
            
            {/* Your Contributions */}
            <div>
              <h3 className="text-gray-400 text-sm mb-2">Your Contributions</h3>
              <div className="text-2xl font-semibold text-white">
                $0.00
              </div>
              <div className="text-sm text-gray-400">
                0.00 YOT tokens
              </div>
            </div>
            
            {/* Next Claim Window */}
            <div>
              <h3 className="text-gray-400 text-sm mb-2">Next Claim Window</h3>
              <div className="text-2xl font-semibold text-white">
                20d 23h 59m
              </div>
              <div className="text-sm text-gray-400">
                Opens Q2 2024
              </div>
            </div>
          </div>
        </Card>
        
        {/* Real-Time Pool Status */}
        <h2 className="text-xl font-bold text-white mb-4">Real-Time Pool Status</h2>
        
        {/* Liquidity Pool Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Pool Composition */}
          <Card className="bg-dark-200 border-dark-400 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Pool Composition</h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">YOT Tokens</span>
                  <span className="text-white">{formatCurrency(poolData?.yotBalance || 0)} YOT (50.0%)</span>
                </div>
                <div className="h-2 bg-dark-400 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '50%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">SOL</span>
                  <span className="text-white">{formatCurrency(poolData?.solBalance || 0)} SOL (50.0%)</span>
                </div>
                <div className="h-2 bg-dark-400 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '50%' }}></div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-dark-400">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Liquidity Value:</span>
                <span className="text-white font-semibold">{totalLiquidity}</span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-gray-400">24h Change:</span>
                <span className="text-green-500">+$0.00</span>
              </div>
            </div>
          </Card>
          
          {/* Exchange Rates */}
          <Card className="bg-dark-200 border-dark-400 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Exchange Rates</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-dark-300 p-4 rounded-lg">
                <div className="text-center mb-2 text-gray-400">YOT → SOL</div>
                <div className="text-center text-white text-xl font-semibold">
                  {poolData?.solBalance && poolData?.yotBalance ? 
                    `${formatCurrency(poolData.yotBalance / poolData.solBalance)} : 1` : 
                    "75000000 : 1"}
                </div>
                <div className="text-center text-sm text-gray-400 mt-1">
                  {formatCurrency(poolData?.yotBalance || 75000000)} YOT per SOL
                </div>
              </div>
              
              <div className="bg-dark-300 p-4 rounded-lg">
                <div className="text-center mb-2 text-gray-400">SOL → YOT</div>
                <div className="text-center text-white text-xl font-semibold">
                  1 : {poolData?.solBalance && poolData?.yotBalance ? 
                    formatCurrency(poolData.yotBalance / poolData.solBalance) : 
                    "75000000"}
                </div>
                <div className="text-center text-sm text-gray-400 mt-1">
                  1 SOL per {formatCurrency(poolData?.yotBalance || 75000000)} YOT
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <h4 className="text-lg text-white mb-2">Price Estimates</h4>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">YOT Price (USD)</span>
                <div className="flex items-center">
                  <span className="text-white font-mono">${poolData?.solBalance && balances?.solUsd ? 
                    (balances.solUsd / balances.sol * poolData.solBalance / poolData.yotBalance).toFixed(8) : 
                    "0.00000200"}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Pool Health</span>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-green-500">Excellent</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
        
        {/* Liquidity Pool Growth Chart */}
        <Card className="bg-dark-200 border-dark-400 p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Liquidity Pool Growth</h3>
          
          <div className="mb-4">
            <div className="flex space-x-2 mb-4">
              <Button 
                variant={selectedTimeframe === "YOT" ? "default" : "outline"} 
                className={`${selectedTimeframe === "YOT" ? "bg-dark-300" : "bg-dark-400 border-dark-500"} text-xs py-1 h-8`}
                onClick={() => setSelectedTimeframe("YOT")}
              >
                YOT
              </Button>
              <Button 
                variant={selectedTimeframe === "SOL" ? "default" : "outline"} 
                className={`${selectedTimeframe === "SOL" ? "bg-amber-700" : "bg-dark-400 border-dark-500"} text-xs py-1 h-8`}
                onClick={() => setSelectedTimeframe("SOL")}
              >
                SOL
              </Button>
              <div className="flex-grow"></div>
              <Button 
                variant={selectedTimeframe === "1D" ? "default" : "outline"} 
                className={`${selectedTimeframe === "1D" ? "bg-dark-300" : "bg-dark-400 border-dark-500"} text-xs py-1 h-8`}
                onClick={() => setSelectedTimeframe("1D")}
              >
                1D
              </Button>
              <Button 
                variant={selectedTimeframe === "1W" ? "default" : "outline"} 
                className={`${selectedTimeframe === "1W" ? "bg-dark-300" : "bg-dark-400 border-dark-500"} text-xs py-1 h-8`}
                onClick={() => setSelectedTimeframe("1W")}
              >
                1W
              </Button>
              <Button 
                variant={selectedTimeframe === "1M" ? "default" : "outline"} 
                className={`${selectedTimeframe === "1M" ? "bg-dark-300" : "bg-dark-400 border-dark-500"} text-xs py-1 h-8`}
                onClick={() => setSelectedTimeframe("1M")}
              >
                1M
              </Button>
              <Button 
                variant={selectedTimeframe === "ALL" ? "default" : "outline"} 
                className={`${selectedTimeframe === "ALL" ? "bg-dark-300" : "bg-dark-400 border-dark-500"} text-xs py-1 h-8`}
                onClick={() => setSelectedTimeframe("ALL")}
              >
                ALL
              </Button>
            </div>
            
            {/* Chart Placeholder */}
            <div className="bg-dark-300 rounded-lg h-60 flex items-center justify-center">
              <div className="text-gray-400 text-sm">
                Liquidity growth chart will appear here with real-time data
              </div>
            </div>
            
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>Mar 25</span>
              <span>Apr 01</span>
              <span>Apr 08</span>
              <span>Apr 15</span>
              <span>Apr 22</span>
              <span>Apr 27</span>
            </div>
          </div>
        </Card>
        
        {/* Pool Token Accounts */}
        <Card className="bg-dark-200 border-dark-400 p-6 mb-8">
          <h3 className="flex items-center text-lg font-semibold text-white mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Pool Token Accounts
          </h3>
          
          <div className="space-y-4">
            {/* Pool Authority */}
            <div className="flex items-start">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 mr-3"></div>
              <div className="flex-grow">
                <div className="flex justify-between">
                  <div className="text-white font-medium">Pool Authority</div>
                  <a 
                    href={`https://explorer.solana.com/address/${POOL_AUTHORITY}?cluster=devnet`} 
                    target="_blank" 
                    className="text-blue-400 hover:text-blue-300 flex items-center text-sm"
                  >
                    {shortenAddress(POOL_AUTHORITY)} <ExternalLink size={12} className="ml-1" />
                  </a>
                </div>
                <div className="text-xs text-gray-400">Controls the pool and manages token operations</div>
              </div>
            </div>
            
            {/* YOT Token Account */}
            <div className="flex items-start">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 mr-3"></div>
              <div className="flex-grow">
                <div className="flex justify-between">
                  <div className="text-white font-medium">YOT Token Account</div>
                  <a 
                    href={`https://explorer.solana.com/address/${YOT_TOKEN_ACCOUNT}?cluster=devnet`} 
                    target="_blank" 
                    className="text-blue-400 hover:text-blue-300 flex items-center text-sm"
                  >
                    {shortenAddress(YOT_TOKEN_ACCOUNT)} <ExternalLink size={12} className="ml-1" />
                  </a>
                </div>
                <div className="text-xs text-gray-400">Holds YOT tokens in the liquidity pool</div>
              </div>
            </div>
            
            {/* SOL Token Account */}
            <div className="flex items-start">
              <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 mr-3"></div>
              <div className="flex-grow">
                <div className="flex justify-between">
                  <div className="text-white font-medium">SOL Token Account</div>
                  <a 
                    href={`https://explorer.solana.com/address/${POOL_SOL_ACCOUNT}?cluster=devnet`} 
                    target="_blank" 
                    className="text-blue-400 hover:text-blue-300 flex items-center text-sm"
                  >
                    {shortenAddress(POOL_SOL_ACCOUNT)} <ExternalLink size={12} className="ml-1" />
                  </a>
                </div>
                <div className="text-xs text-gray-400">Holds Wrapped SOL in the liquidity pool</div>
              </div>
            </div>
            
            {/* YOS Token Account */}
            <div className="flex items-start">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-2 mr-3"></div>
              <div className="flex-grow">
                <div className="flex justify-between">
                  <div className="text-white font-medium">YOS Token Account</div>
                  <a 
                    href={`https://explorer.solana.com/address/${YOS_TOKEN_ACCOUNT}?cluster=devnet`} 
                    target="_blank" 
                    className="text-blue-400 hover:text-blue-300 flex items-center text-sm"
                  >
                    {shortenAddress(YOS_TOKEN_ACCOUNT)} <ExternalLink size={12} className="ml-1" />
                  </a>
                </div>
                <div className="text-xs text-gray-400">Holds YOS tokens for staking & reward distribution</div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-400 italic">
            * Data retrieved directly from Solana blockchain. Updates every 10 seconds or with transactions.
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}