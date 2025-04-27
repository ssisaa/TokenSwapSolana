import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useSolanaWallet";
import { useTokenData } from "@/hooks/useTokenData";
import { formatCurrency } from "@/lib/utils";

export default function Liquidity() {
  const { connected } = useWallet();
  const { poolData, balances, loading } = useTokenData();

  // Calculate pool share (placeholder - would be based on user's LP tokens in reality)
  const userPoolShare = 0;
  
  return (
    <DashboardLayout title="Liquidity">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Liquidity Overview</h1>
          <p className="text-gray-400 mt-1">
            Provide liquidity to earn trading fees and rewards
          </p>
        </div>

        {/* Pool Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-dark-200 border-dark-400 p-6">
            <h3 className="text-gray-400 text-sm mb-2">Total Liquidity</h3>
            <div className="flex items-baseline">
              <span className="text-2xl font-semibold text-white">
                ${poolData?.solBalance && poolData.yotBalance && balances ? (
                  (poolData.solBalance * (balances.solUsd / balances.sol)) + 
                  (poolData.yotBalance * (balances.yotUsd / balances.yot))
                ).toFixed(2) : "0.00"}
              </span>
            </div>
          </Card>

          <Card className="bg-dark-200 border-dark-400 p-6">
            <h3 className="text-gray-400 text-sm mb-2">Your Pool Share</h3>
            <div className="flex items-baseline">
              <span className="text-2xl font-semibold text-white">{userPoolShare}%</span>
              <span className="text-sm text-gray-400 ml-2">
                ${((poolData?.solBalance && poolData.yotBalance && balances ? (
                  (poolData.solBalance * (balances.solUsd / balances.sol)) + 
                  (poolData.yotBalance * (balances.yotUsd / balances.yot))
                ) : 0) * (userPoolShare / 100)).toFixed(2)}
              </span>
            </div>
          </Card>

          <Card className="bg-dark-200 border-dark-400 p-6">
            <h3 className="text-gray-400 text-sm mb-2">24h Trading Volume</h3>
            <div className="flex items-baseline">
              <span className="text-2xl font-semibold text-white">$1,245.67</span>
              <span className="text-sm text-green-500 ml-2">+12.3%</span>
            </div>
          </Card>
        </div>

        {/* Pool Composition */}
        <Card className="bg-dark-200 border-dark-400 p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Pool Composition</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-dark-300 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xs">
                  SOL
                </div>
                <div className="ml-3">
                  <h3 className="text-white font-medium">Solana</h3>
                </div>
              </div>
              <div className="text-xl font-semibold text-white">
                {formatCurrency(poolData?.solBalance || 0)} SOL
              </div>
              <div className="text-sm text-gray-400">
                ${(poolData?.solBalance && balances ? 
                  poolData.solBalance * (balances.solUsd / balances.sol) : 0).toFixed(2)}
              </div>
            </div>
            
            <div className="bg-dark-300 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                  YOT
                </div>
                <div className="ml-3">
                  <h3 className="text-white font-medium">Your Own Token</h3>
                </div>
              </div>
              <div className="text-xl font-semibold text-white">
                {formatCurrency(poolData?.yotBalance || 0)} YOT
              </div>
              <div className="text-sm text-gray-400">
                ${(poolData?.yotBalance && balances ? 
                  poolData.yotBalance * (balances.yotUsd / balances.yot) : 0).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-dark-300 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Current Exchange Rate:</span>
              <span className="text-white font-medium">
                1 SOL = {poolData?.solBalance && poolData.yotBalance ? 
                  (poolData.yotBalance / poolData.solBalance).toFixed(2) : "0.00"} YOT
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Pool Fee:</span>
              <span className="text-white font-medium">0.30%</span>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="bg-dark-200 border-dark-400 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Add Liquidity</h2>
            <p className="text-gray-400 text-sm mb-4">
              Provide liquidity to the SOL-YOT pool and earn fees from all trades on this pair.
            </p>
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              Add Liquidity
            </Button>
          </Card>
          
          <Card className="bg-dark-200 border-dark-400 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Remove Liquidity</h2>
            <p className="text-gray-400 text-sm mb-4">
              Remove your liquidity from the SOL-YOT pool and receive back your tokens.
            </p>
            <Button variant="outline" className="w-full bg-dark-300 border-dark-500 hover:bg-dark-400" disabled={userPoolShare <= 0}>
              Remove Liquidity
            </Button>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}