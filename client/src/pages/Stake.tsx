import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/hooks/useSolanaWallet";
import { useTokenData } from "@/hooks/useTokenData";
import { ArrowDown, Download, Upload, Award } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function Stake() {
  const { connected } = useWallet();
  const { tokenData, poolData, balances, loading } = useTokenData();
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [activeModal, setActiveModal] = useState<'stake' | 'unstake' | null>(null);

  // In a real app, these would come from actual staking data
  const stakingData = {
    totalStaked: 0.00,
    earnedRewards: 0.00,
    apr: "NaN",
    totalStakers: 0,
    hourlyRate: 0.00125,
    dailyRate: 0.03,
    monthlyRate: 0.90
  };

  const handleStakeSubmit = () => {
    // In a real implementation, this would call a staking contract
    console.log("Staking", stakeAmount, "YOT");
    setActiveModal(null);
    setStakeAmount("");
  };

  const handleUnstakeSubmit = () => {
    // In a real implementation, this would call a staking contract
    console.log("Unstaking", unstakeAmount, "YOT");
    setActiveModal(null);
    setUnstakeAmount("");
  };

  const handleClaimRewards = () => {
    // In a real implementation, this would call a claiming function
    console.log("Claiming rewards");
  };

  return (
    <DashboardLayout title="Stake">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Your Staking Overview</h1>
        </div>

        {/* Staking Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-dark-200 border-dark-400 p-6">
            <h3 className="text-gray-400 text-sm mb-2">Total Staked</h3>
            <div className="flex items-baseline">
              <span className="text-3xl font-semibold text-white">{stakingData.totalStaked.toFixed(2)} YOT</span>
              <span className="text-sm text-gray-400 ml-2">${(stakingData.totalStaked * (balances?.yotUsd || 0) / (balances?.yot || 1)).toFixed(2)}</span>
            </div>
          </Card>

          <Card className="bg-dark-200 border-dark-400 p-6">
            <h3 className="text-gray-400 text-sm mb-2">Earned Rewards</h3>
            <div className="flex items-baseline">
              <span className="text-3xl font-semibold text-white">{stakingData.earnedRewards.toFixed(2)} YOS</span>
              <span className="text-sm text-gray-400 ml-2">${(stakingData.earnedRewards * (balances?.yosUsd || 0) / (balances?.yos || 1)).toFixed(2)}</span>
            </div>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-10">
          <Button 
            variant="outline" 
            className="flex items-center bg-blue-600/20 text-blue-400 border-blue-500 hover:bg-blue-600/30 hover:text-blue-300"
            onClick={() => setActiveModal('stake')}
          >
            <Upload className="h-4 w-4 mr-2" />
            Stake YOT
          </Button>
          
          <Button 
            variant="outline" 
            className="flex items-center bg-dark-300 text-gray-300 border-gray-600 hover:bg-dark-400 hover:text-white"
            onClick={() => setActiveModal('unstake')}
          >
            <Download className="h-4 w-4 mr-2" />
            Unstake YOT
          </Button>
          
          <Button 
            variant="outline" 
            className="flex items-center bg-green-600/20 text-green-400 border-green-500 hover:bg-green-600/30 hover:text-green-300"
            onClick={handleClaimRewards}
            disabled={stakingData.earnedRewards <= 0}
          >
            <Award className="h-4 w-4 mr-2" />
            Claim Rewards
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Staking FAQ */}
          <div className="md:col-span-3">
            <h2 className="text-xl font-semibold text-white mb-6">Staking FAQ</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-medium mb-2">What is YOT staking?</h3>
                <p className="text-gray-400 text-sm">
                  Staking YOT allows you to earn YOS rewards while supporting the network. When you stake your YOT tokens, they are locked up, 
                  and you earn YOS rewards at a rate of 0.00125% per hour.
                </p>
              </div>
              
              <div>
                <h3 className="text-white font-medium mb-2">How are rewards calculated?</h3>
                <p className="text-gray-400 text-sm">
                  Rewards accrue at a rate of 0.00125% per hour on your staked YOT tokens. This equals approximately 3% per month or NaN% 
                  annually.
                </p>
              </div>
              
              <div>
                <h3 className="text-white font-medium mb-2">What can I do with YOS rewards?</h3>
                <p className="text-gray-400 text-sm">
                  YOS tokens can be swapped 1:1 for YOT tokens, allowing you to stake more, trade, or contribute to liquidity pools.
                </p>
              </div>
              
              <div>
                <h3 className="text-white font-medium mb-2">Is there a lock-up period?</h3>
                <p className="text-gray-400 text-sm">
                  No, you can unstake your YOT at any time. However, the longer you stake, the more rewards you'll accumulate.
                </p>
              </div>
            </div>
          </div>
          
          {/* Staking Information */}
          <div className="md:col-span-1">
            <Card className="bg-dark-200 border-dark-400 p-4">
              <h3 className="text-white font-medium mb-4">Staking Information</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="text-gray-400 text-sm mb-1">Current APR</div>
                  <div className="text-white font-medium">{stakingData.apr}%</div>
                </div>
                
                <div>
                  <div className="text-gray-400 text-sm mb-1">Total Stakers</div>
                  <div className="text-white font-medium">{stakingData.totalStakers}</div>
                  <Progress value={0} max={100} className="h-2 mt-1" />
                </div>
                
                <div>
                  <div className="text-gray-400 text-sm mb-1">Total Staked</div>
                  <div className="text-white font-medium">{stakingData.totalStaked.toFixed(2)} YOT</div>
                  <Progress value={0} max={100} className="h-2 mt-1" />
                </div>
                
                <div>
                  <div className="text-gray-400 text-sm mb-1">Hourly Rate</div>
                  <div className="text-white font-medium">{stakingData.hourlyRate.toFixed(5)}%</div>
                </div>
                
                <div>
                  <div className="text-gray-400 text-sm mb-1">Daily Rate</div>
                  <div className="text-white font-medium">{stakingData.dailyRate.toFixed(2)}%</div>
                </div>
                
                <div>
                  <div className="text-gray-400 text-sm mb-1">Monthly Rate</div>
                  <div className="text-white font-medium">{stakingData.monthlyRate.toFixed(2)}%</div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Staking Modal */}
        {activeModal === 'stake' && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <Card className="bg-dark-200 border-dark-400 p-6 max-w-md w-full">
              <h3 className="text-white font-semibold mb-4">Stake YOT</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Amount to Stake</label>
                  <Input 
                    type="number" 
                    placeholder="0.00"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    className="bg-dark-300 border-dark-400 text-white"
                  />
                  <div className="text-gray-400 text-xs mt-1">
                    Available: {balances?.yot.toFixed(2) || "0.00"} YOT
                  </div>
                </div>
                
                <div className="flex items-center justify-center text-gray-400">
                  <ArrowDown className="h-5 w-5" />
                </div>
                
                <div>
                  <div className="text-gray-400 text-sm mb-1">Estimated Rewards (24h)</div>
                  <div className="bg-dark-300 p-3 rounded-md">
                    <span className="text-white font-medium">
                      {stakeAmount ? (parseFloat(stakeAmount) * stakingData.hourlyRate / 100 * 24).toFixed(6) : "0.00"} YOS
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-3 pt-2">
                  <Button 
                    variant="default" 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleStakeSubmit}
                    disabled={!stakeAmount || parseFloat(stakeAmount) <= 0}
                  >
                    Stake
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="flex-1 bg-dark-300 hover:bg-dark-400 text-white border-dark-400"
                    onClick={() => setActiveModal(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Unstaking Modal */}
        {activeModal === 'unstake' && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <Card className="bg-dark-200 border-dark-400 p-6 max-w-md w-full">
              <h3 className="text-white font-semibold mb-4">Unstake YOT</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Amount to Unstake</label>
                  <Input 
                    type="number" 
                    placeholder="0.00"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    className="bg-dark-300 border-dark-400 text-white"
                  />
                  <div className="text-gray-400 text-xs mt-1">
                    Staked: {stakingData.totalStaked.toFixed(2)} YOT
                  </div>
                </div>
                
                <div className="flex items-center justify-center text-gray-400">
                  <ArrowDown className="h-5 w-5" />
                </div>
                
                <div>
                  <div className="text-gray-400 text-sm mb-1">You will receive</div>
                  <div className="bg-dark-300 p-3 rounded-md">
                    <span className="text-white font-medium">
                      {unstakeAmount ? parseFloat(unstakeAmount).toFixed(2) : "0.00"} YOT
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-3 pt-2">
                  <Button 
                    variant="default" 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleUnstakeSubmit}
                    disabled={!unstakeAmount || parseFloat(unstakeAmount) <= 0 || parseFloat(unstakeAmount) > stakingData.totalStaked}
                  >
                    Unstake
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="flex-1 bg-dark-300 hover:bg-dark-400 text-white border-dark-400"
                    onClick={() => setActiveModal(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}