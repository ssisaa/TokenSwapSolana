import { useState } from "react";
import StakingCard from "@/components/StakingCard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, 
  ArrowDown, 
  Clock, 
  Shield, 
  HelpCircle, 
  Download, 
  Upload, 
  CheckCircle,
  Info as InfoIcon
} from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { useStaking } from "@/hooks/useStaking";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS } from "@/lib/constants";
import { useMultiWallet } from "@/context/MultiWalletContext";

export default function Stake() {
  const [activeTab, setActiveTab] = useState("stake");
  const { connected } = useMultiWallet();
  const { balance: yotBalance } = useTokenBalance(YOT_TOKEN_ADDRESS);
  const { balance: yosBalance } = useTokenBalance(YOS_TOKEN_ADDRESS);
  
  const {
    stakingInfo,
    stakingRates,
    isLoading,
    globalStats
  } = useStaking();
  
  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 bg-dark-100">
        <h1 className="text-3xl font-bold tracking-tight">Staking Dashboard</h1>
        
        {/* Top Row - 4 Stats Boxes */}
        <div className="grid grid-cols-4 gap-4 mt-8 mb-6">
          {/* Total Staked */}
          <Card className="bg-dark-200 border border-slate-700">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Total Staked</h3>
              {isLoading ? (
                <div className="animate-pulse bg-dark-300 h-6 w-24 rounded"></div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-white">{formatNumber(globalStats ? globalStats.totalStaked : 0)}</span>
                  <span className="text-sm font-semibold text-blue-400">YOT</span>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Earned Rewards */}
          <Card className="bg-dark-200 border border-slate-700">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Earned Rewards</h3>
              {isLoading ? (
                <div className="animate-pulse bg-dark-300 h-6 w-24 rounded"></div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-white">{formatNumber(stakingInfo.rewardsEarned)}</span>
                  <span className="text-sm font-semibold text-green-400">YOS</span>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Total Harvested */}
          <Card className="bg-dark-200 border border-slate-700">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Total Harvested</h3>
              {isLoading ? (
                <div className="animate-pulse bg-dark-300 h-6 w-24 rounded"></div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-white">{formatNumber(stakingInfo.totalHarvested)}</span>
                  <span className="text-sm font-semibold text-green-400">YOS</span>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Your Stake % */}
          <Card className="bg-dark-200 border border-slate-700">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Your Stake %</h3>
              {isLoading ? (
                <div className="animate-pulse bg-dark-300 h-6 w-16 rounded"></div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-white">
                    {globalStats && globalStats.totalStaked ? 
                      ((stakingInfo.stakedAmount / globalStats.totalStaked) * 100).toFixed(2) : 
                      '0.00'}
                  </span>
                  <span className="text-sm font-semibold text-blue-400">%</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Action Buttons */}
            <div className="flex gap-3 mb-6">
              <Button 
                variant="default" 
                className="flex-1 flex justify-center items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 font-medium py-5" 
                disabled={!connected}
                onClick={() => setActiveTab("stake")}
              >
                <Download className="h-5 w-5" /> Stake YOT
              </Button>
              <Button 
                variant="default" 
                className="flex-1 flex justify-center items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 font-medium py-5" 
                disabled={!connected || stakingInfo.rewardsEarned <= 0}
                onClick={() => setActiveTab("harvest")}
              >
                <CheckCircle className="h-5 w-5" /> Harvest Rewards
              </Button>
            </div>
            
            {/* Staking Actions */}
            <div className="mt-4">
              {activeTab === "stake" && <StakingCard defaultTab="stake" />}
              {activeTab === "unstake" && <StakingCard defaultTab="unstake" />}
              {activeTab === "harvest" && <StakingCard defaultTab="harvest" />}
            </div>
            
            {/* FAQ Section */}
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4">Staking FAQ</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold">What is YOT staking?</h3>
                  <p className="mt-2 text-muted-foreground">
                    Staking YOT allows you to earn YOS rewards while supporting the network. When you stake your YOT tokens, 
                    they are locked up, and you earn YOS rewards at a rate of {stakingRates?.stakeRatePerSecond?.toFixed(6) || '0.000000'}% per second.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold">How are rewards calculated?</h3>
                  <p className="mt-2 text-muted-foreground">
                    Rewards accrue at a rate of {stakingRates?.stakeRatePerSecond?.toFixed(6) || '0.000000'}% per second on your staked YOT tokens. 
                    This equals approximately {stakingRates?.dailyAPR?.toFixed(2) || '0.00'}% per day, {stakingRates?.monthlyAPR?.toFixed(2) || '0.00'}% per month, or {stakingRates?.yearlyAPR?.toFixed(2) || '0.00'}% annually.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold">What can I do with YOS rewards?</h3>
                  <p className="mt-2 text-muted-foreground">
                    YOS tokens can be swapped 1:1 for YOT tokens, allowing you to stake more, trade, or contribute to liquidity pools.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold">Is there a lock-up period?</h3>
                  <p className="mt-2 text-muted-foreground">
                    No, you can unstake your YOT at any time. However, the longer you stake, the more rewards you'll accumulate.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold">How is staking security ensured?</h3>
                  <p className="mt-2 text-muted-foreground">
                    All staking operations are performed on-chain using secure Solana smart contracts. Every transaction requires 
                    your explicit wallet signature for authorization, and no private keys or sensitive data are ever stored outside your wallet.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column */}
          <div className="space-y-6">
            {/* How Staking Works */}
            <Card className="bg-dark-200 h-full">
              <CardContent className="pt-6">
                <h3 className="text-xl font-bold mb-4 text-white">How Staking Works</h3>
                
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="mt-1">
                      <div className="bg-blue-600/20 p-2 rounded-full">
                        <Download className="h-4 w-4 text-blue-400" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-white">Stake YOT</h4>
                      <p className="text-sm text-gray-300 mt-1">
                        Lock your YOT tokens in the staking contract to start earning rewards.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="mt-1">
                      <div className="bg-blue-600/20 p-2 rounded-full">
                        <Clock className="h-4 w-4 text-blue-400" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-white">Earn Rewards</h4>
                      <p className="text-sm text-gray-300 mt-1">
                        Earn YOS rewards continuously based on your staked amount and the current APY.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="mt-1">
                      <div className="bg-blue-600/20 p-2 rounded-full">
                        <CheckCircle className="h-4 w-4 text-blue-400" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-white">Harvest Anytime</h4>
                      <p className="text-sm text-gray-300 mt-1">
                        Claim your YOS rewards whenever you want. No lock-up period or vesting.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="mt-1">
                      <div className="bg-blue-600/20 p-2 rounded-full">
                        <Shield className="h-4 w-4 text-blue-400" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-white">Staking Security</h4>
                      <p className="text-sm text-gray-300 mt-1">
                        All operations require your explicit wallet signature. Your funds remain secure through Solana's smart contracts.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}