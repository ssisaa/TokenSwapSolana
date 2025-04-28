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
  YOS_TOKEN_ACCOUNT,
  YOT_TOKEN_ADDRESS
} from "@/lib/constants";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts';
import { shortenAddress, formatDollarAmount } from "@/lib/utils";
import { 
  getAllTokenPrices, 
  getYotMarketPrice, 
  getPoolBalances, 
  getExchangeRate,
  lamportsToSol,
  getSolMarketPrice
} from "@/lib/solana";

export default function Liquidity() {
  const { connected } = useWallet();
  const { poolData, balances, loading } = useTokenData();
  const [selectedTimeframe, setSelectedTimeframe] = useState("1W");
  
  // Sample historical data for the liquidity pool growth chart
  const [liquidityChartData, setLiquidityChartData] = useState([
    { date: 'Mar 25', yot: 600000, sol: 15, value: 2300 },
    { date: 'Apr 01', yot: 680000, sol: 18, value: 2900 },
    { date: 'Apr 08', yot: 702000, sol: 21, value: 3200 },
    { date: 'Apr 15', yot: 715000, sol: 22, value: 3400 },
    { date: 'Apr 22', yot: 725000, sol: 23, value: 3600 },
    { date: 'Apr 27', yot: 734266, sol: 23.47, value: 3800 },
  ]);
  
  // Default state
  const [poolStats, setPoolStats] = useState({
    totalLiquidity: "$0.00",
    liquidityChange: "+$0.00 (24h)",
    yourContribution: "$0.00",
    yourTokens: "0.00 YOT tokens",
    nextClaimDays: 20,
    nextClaimHours: 23,
    nextClaimMinutes: 59,
    claimPeriod: "Q2 2024",
    
    yotBalance: "0.00 YOT (50.0%)",
    solBalance: "0.00 SOL (50.0%)",
    
    exchangeRateYotToSol: "0 : 1",
    exchangeRateSolToYot: "1 : 0",
    
    yotPerSol: "0 YOT per SOL",
    solPerYot: "1 SOL per 0 YOT",
    
    yotUsdPrice: "$0.00000000",
    poolHealth: "Loading...",
    
    change24h: "+$0.00",
    
    // Percentages for progress bars
    yotPercentage: "50%",
    solPercentage: "50%"
  });
  
  // Fetch real-time pool data
  const fetchPoolData = useCallback(async () => {
    try {
      // Get pool balances
      const pool = await getPoolBalances();
      
      // Get SOL price
      const solPrice = await getSolMarketPrice();
      
      // Get exchange rates
      const rates = await getExchangeRate();
      
      if (pool.solBalance && pool.yotBalance) {
        // Convert SOL from lamports
        const solBalanceInSol = lamportsToSol(pool.solBalance);
        
        // Calculate YOT price based on pool ratio and SOL price
        const yotPriceUsd = (solPrice * solBalanceInSol) / pool.yotBalance;
        
        // Calculate total liquidity value in USD
        const totalLiquidityValue = (solBalanceInSol * solPrice) + (pool.yotBalance * yotPriceUsd);
        
        // Calculate percentages
        const solValuePercent = (solBalanceInSol * solPrice) / totalLiquidityValue * 100;
        const yotValuePercent = (pool.yotBalance * yotPriceUsd) / totalLiquidityValue * 100;
        
        // Format YOT amount for display (in millions if large)
        const formattedYotBalance = pool.yotBalance >= 1000000 
          ? `${(pool.yotBalance / 1000000).toFixed(2)}M` 
          : formatCurrency(pool.yotBalance);
        
        // Get exchange rates from the API instead of direct calculation
        // This ensures we're using the same rates across the app
        const yotPerSolFormatted = rates.yotPerSol || rates.solToYot || (pool.yotBalance / solBalanceInSol);
        const solPerYotFormatted = rates.solPerYot || rates.yotToSol || (solBalanceInSol / pool.yotBalance);
        
        // Format the exchange rates with sensible numbers
        // If the YOT token supply is extremely large compared to SOL, we need to format it specially
        const normalizedYotPerSol = yotPerSolFormatted > 10000
          ? Number(yotPerSolFormatted.toFixed(2))  // Round to 2 decimal places for large numbers
          : yotPerSolFormatted;
          
        const normalizedSolPerYot = solPerYotFormatted > 10000 
          ? Number(solPerYotFormatted.toFixed(8))  // More precision for SOL (as it's more valuable)
          : solPerYotFormatted;
        
        // Update the pool stats
        setPoolStats({
          totalLiquidity: formatDollarAmount(totalLiquidityValue),
          liquidityChange: "+$198.00 (24h)", // This would come from historical data
          yourContribution: "$0.00", // This would come from user's wallet
          yourTokens: "0.00 YOT tokens", // This would come from user's wallet
          nextClaimDays: 20,
          nextClaimHours: 23,
          nextClaimMinutes: 59,
          claimPeriod: "Q2 2024",
          
          yotBalance: `${formattedYotBalance} YOT (${yotValuePercent.toFixed(1)}%)`,
          solBalance: `${formatCurrency(solBalanceInSol)} SOL (${solValuePercent.toFixed(1)}%)`,
          
          // Exchange rates formatted for display - using fixed decimal formatting
          exchangeRateYotToSol: `${normalizedYotPerSol.toFixed(2)} : 1`,
          exchangeRateSolToYot: `1 : ${normalizedYotPerSol.toFixed(2)}`,
          
          yotPerSol: `${normalizedYotPerSol.toFixed(2)} YOT per SOL`,
          solPerYot: `1 SOL per ${normalizedYotPerSol.toFixed(2)} YOT`,
          
          yotUsdPrice: `$${yotPriceUsd.toFixed(8)}`,
          poolHealth: totalLiquidityValue > 1000 ? "Excellent" : "Good",
          
          change24h: "+$0.00", // This would come from historical data
          
          // Percentages for progress bars
          yotPercentage: `${yotValuePercent}%`,
          solPercentage: `${solValuePercent}%`
        });
        
        console.log(`Pool data updated: SOL=${solBalanceInSol}, YOT=${pool.yotBalance}, Total Value=${totalLiquidityValue}`);
      }
    } catch (error) {
      console.error("Error fetching pool data:", error);
    }
  }, []);
  
  // Initialize and update pool data
  useEffect(() => {
    fetchPoolData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchPoolData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchPoolData]);

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
                {poolStats.totalLiquidity}
              </div>
              <div className="text-sm text-green-500">
                {poolStats.liquidityChange}
              </div>
              <div className="flex mt-2 space-x-2">
                <div className="text-sm text-gray-400">
                  {poolStats.yotBalance.split(' ')[0]} YOT
                </div>
                <div className="px-2 py-1 bg-amber-700 rounded text-xs text-white">
                  {poolStats.solBalance.split(' ')[0]} SOL
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
                  <span className="text-white">{poolStats.yotBalance}</span>
                </div>
                <div className="h-2 bg-dark-400 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" 
                      style={{ width: poolStats.yotPercentage }}
                      title={`YOT makes up ${poolStats.yotPercentage} of the pool's value`}>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">SOL</span>
                  <span className="text-white">{poolStats.solBalance}</span>
                </div>
                <div className="h-2 bg-dark-400 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-600 rounded-full" 
                      style={{ width: poolStats.solPercentage }}
                      title={`SOL makes up ${poolStats.solPercentage} of the pool's value`}>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-dark-400">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Liquidity Value:</span>
                <span className="text-white font-semibold">{poolStats.totalLiquidity}</span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-gray-400">24h Change:</span>
                <span className="text-green-500">{poolStats.change24h}</span>
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
                  {poolStats.exchangeRateYotToSol}
                </div>
                <div className="text-center text-sm text-gray-400 mt-1">
                  {poolStats.yotPerSol}
                </div>
              </div>
              
              <div className="bg-dark-300 p-4 rounded-lg">
                <div className="text-center mb-2 text-gray-400">SOL → YOT</div>
                <div className="text-center text-white text-xl font-semibold">
                  {poolStats.exchangeRateSolToYot}
                </div>
                <div className="text-center text-sm text-gray-400 mt-1">
                  {poolStats.solPerYot}
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <h4 className="text-lg text-white mb-2">Price Estimates</h4>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">YOT Price (USD)</span>
                <div className="flex items-center">
                  <span className="text-white font-mono">{poolStats.yotUsdPrice}</span>
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
            
            {/* Chart Component */}
            <div className="bg-dark-300 rounded-lg h-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={liquidityChartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    axisLine={{ stroke: '#4b5563' }}  
                  />
                  <YAxis 
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    axisLine={{ stroke: '#4b5563' }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: 'white' }}
                    labelStyle={{ color: 'white' }}
                    formatter={(value, name) => {
                      if (name === 'value') return [`$${value}`, 'Value'];
                      if (name === 'yot') return [`${value.toLocaleString()}`, 'YOT'];
                      if (name === 'sol') return [`${value}`, 'SOL'];
                      return [value, name];
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey={selectedTimeframe === "YOT" ? "yot" : selectedTimeframe === "SOL" ? "sol" : "value"} 
                    stroke={selectedTimeframe === "SOL" ? "#d97706" : "#3b82f6"} 
                    fill={selectedTimeframe === "SOL" ? "url(#colorSOL)" : "url(#colorValue)"}
                    fillOpacity={1}
                    activeDot={{ r: 8 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
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