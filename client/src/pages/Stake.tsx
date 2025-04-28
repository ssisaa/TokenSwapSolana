import { useState } from "react";
import StakingCard from "@/components/StakingCard";
import StakingDashboard from "@/components/StakingDashboard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        
        <div className="grid gap-6 mt-8 lg:grid-cols-[2fr_1fr]">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Staking Dashboard */}
            <div>
              <StakingDashboard onTabChange={setActiveTab} />
            </div>
            
            {/* Staking Actions */}
            <div>
              <Tabs defaultValue="stake" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-3 mb-4 bg-muted/80 border border-border p-1">
                  <TabsTrigger value="stake" className="font-medium data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Download className="h-4 w-4 mr-2" /> Stake
                  </TabsTrigger>
                  <TabsTrigger value="unstake" className="font-medium data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Upload className="h-4 w-4 mr-2" /> Unstake
                  </TabsTrigger>
                  <TabsTrigger value="harvest" className="font-medium data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <CheckCircle className="h-4 w-4 mr-2" /> Harvest
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="stake" className="mt-0">
                  <StakingCard defaultTab="stake" />
                </TabsContent>
                
                <TabsContent value="unstake" className="mt-0">
                  <StakingCard defaultTab="unstake" />
                </TabsContent>
                
                <TabsContent value="harvest" className="mt-0">
                  <StakingCard defaultTab="harvest" />
                </TabsContent>
              </Tabs>
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
            {/* Stats Overview */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {/* Total Staked */}
              <Card className="bg-dark-200">
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium text-white mb-1">Total Staked</h3>
                  {isLoading ? (
                    <div className="animate-pulse bg-dark-300 h-6 w-24 rounded"></div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-white">{formatNumber(globalStats ? globalStats.totalStaked : 0)}</span>
                      <span className="text-sm font-semibold text-primary">YOT</span>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Earned Rewards */}
              <Card className="bg-dark-200">
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium text-white mb-1">Earned Rewards</h3>
                  {isLoading ? (
                    <div className="animate-pulse bg-dark-300 h-6 w-24 rounded"></div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-white">{formatNumber(stakingInfo.rewardsEarned)}</span>
                      <span className="text-sm font-semibold text-green-500">YOS</span>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Total Harvested */}
              <Card className="bg-dark-200">
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium text-white mb-1">Total Harvested</h3>
                  {isLoading ? (
                    <div className="animate-pulse bg-dark-300 h-6 w-24 rounded"></div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-white">{formatNumber(stakingInfo.totalHarvested)}</span>
                      <span className="text-sm font-semibold text-green-500">YOS</span>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* YOT Stake % */}
              <Card className="bg-dark-200">
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium text-white mb-1">Your Stake %</h3>
                  {isLoading ? (
                    <div className="animate-pulse bg-dark-300 h-6 w-16 rounded"></div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-white">
                        {globalStats && globalStats.totalStaked ? 
                          ((stakingInfo.stakedAmount / globalStats.totalStaked) * 100).toFixed(2) : 
                          '0.00'}
                      </span>
                      <span className="text-sm font-semibold text-primary">%</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* How Staking Works */}
            <Card className="bg-dark-200">
              <CardContent className="pt-6">
                <h3 className="text-xl font-bold mb-4 text-white">How Staking Works</h3>
                
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="mt-1">
                      <div className="bg-primary/20 p-2 rounded-full">
                        <Download className="h-4 w-4 text-primary" />
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
                      <div className="bg-primary/20 p-2 rounded-full">
                        <Clock className="h-4 w-4 text-primary" />
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
                      <div className="bg-primary/20 p-2 rounded-full">
                        <CheckCircle className="h-4 w-4 text-primary" />
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
                      <div className="bg-primary/20 p-2 rounded-full">
                        <Shield className="h-4 w-4 text-primary" />
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
            
            {/* Staking Security */}
            <Card className="bg-dark-200">
              <CardContent className="pt-6">
                <h3 className="text-xl font-bold mb-4 text-white">Staking Security</h3>
                
                <div className="space-y-3">
                  <p className="text-sm text-gray-300">
                    Security is paramount in our staking protocol. All staking operations require your explicit wallet 
                    signature, ensuring that only you can control your staked tokens.
                  </p>
                  
                  <div className="bg-primary/10 p-4 rounded-lg">
                    <h4 className="font-medium text-primary flex items-center">
                      <InfoIcon className="h-4 w-4 mr-2" />
                      Key Security Features
                    </h4>
                    <ul className="mt-2 space-y-2 text-sm text-white">
                      <li className="flex items-start">
                        <span className="font-bold mr-2 text-primary">•</span>
                        <span>Mandatory wallet signatures for all blockchain interactions</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-bold mr-2 text-primary">•</span>
                        <span>On-chain storage of staking data through Program Derived Addresses (PDAs)</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-bold mr-2 text-primary">•</span>
                        <span>Transparent rewards calculation visible on the blockchain</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-bold mr-2 text-primary">•</span>
                        <span>No client-side storage of sensitive information</span>
                      </li>
                    </ul>
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