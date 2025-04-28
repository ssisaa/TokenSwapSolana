import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStaking } from '@/hooks/useStaking';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { formatNumber } from '@/lib/utils';
import { Loader2, Wallet, Info as InfoIcon, Download, Upload, CheckCircle } from 'lucide-react';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { YOT_TOKEN_ADDRESS } from '@/lib/constants';

interface StakingCardProps {
  defaultTab?: 'stake' | 'unstake' | 'harvest';
}

export default function StakingCard({ defaultTab = 'stake' }: StakingCardProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  const { connected } = useMultiWallet();
  
  // Fetch the user's YOT token balance
  const { balance: yotBalance, isLoading: isLoadingBalance } = useTokenBalance(YOT_TOKEN_ADDRESS);
  
  const {
    stakingInfo,
    stakingRates,
    isLoading,
    stakeTokens,
    unstakeTokens,
    harvestRewards,
    isStaking,
    isUnstaking,
    isHarvesting
  } = useStaking();
  
  // Update activeTab when defaultTab prop changes
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);
  
  // Format the timestamp to a readable date
  const formatDate = (timestamp: number): string => {
    if (timestamp === 0) return 'Not staked yet';
    return new Date(timestamp * 1000).toLocaleDateString();
  };
  
  // Calculate time since last harvest
  const getTimeSinceLastHarvest = (): string => {
    if (stakingInfo.lastHarvestTime === 0) return 'Never harvested';
    
    const now = Math.floor(Date.now() / 1000);
    const seconds = now - stakingInfo.lastHarvestTime;
    
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  };

  // Handle stake button click
  const handleStake = () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;
    stakeTokens({ amount: parseFloat(stakeAmount) });
    setStakeAmount('');
  };

  // Handle unstake button click
  const handleUnstake = () => {
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) return;
    
    // Ensure user can't unstake more than they have staked
    const amount = Math.min(parseFloat(unstakeAmount), stakingInfo.stakedAmount);
    unstakeTokens({ amount });
    setUnstakeAmount('');
  };

  // Handle max stake/unstake buttons
  const handleMaxStake = () => {
    // Use the actual YOT balance from wallet
    setStakeAmount(yotBalance.toString());
  };

  const handleMaxUnstake = () => {
    setUnstakeAmount(stakingInfo.stakedAmount.toString());
  };

  // Handle harvest button click
  const handleHarvest = () => {
    harvestRewards();
  };

  // Check if rewards can be harvested
  const canHarvest = stakingInfo.rewardsEarned > 0;

  return (
    <Card className="w-full bg-dark-200">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-white">YOT Staking</CardTitle>
        <CardDescription className="text-gray-300">
          Stake YOT tokens to earn YOS rewards. All actions require wallet signature.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {/* Staking Stats */}
              <div className="grid gap-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Staked:</span>
                  <span className="font-medium text-white">{formatNumber(stakingInfo.stakedAmount)} YOT</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Pending Rewards:</span>
                  <span className="font-medium text-white">{formatNumber(stakingInfo.rewardsEarned)} YOS</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Staking Since:</span>
                  <span className="font-medium text-white">{formatDate(stakingInfo.startTimestamp)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Last Harvest:</span>
                  <span className="font-medium text-white">{getTimeSinceLastHarvest()} ago</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Harvested:</span>
                  <span className="font-medium text-white">{formatNumber(stakingInfo.totalHarvested)} YOS</span>
                </div>
              </div>
              
              <div className="h-px bg-border" />
              
              {/* Staking APR Information */}
              <div className="bg-dark-300 rounded-lg p-4 space-y-3 border border-border">
                <h3 className="text-base font-semibold text-white">Staking APR Rates</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-dark-200 rounded-md p-3 border border-border">
                    <div className="text-xs text-gray-300">Daily APR</div>
                    <div className="text-lg font-bold text-green-400">
                      {`${stakingRates.dailyAPR.toFixed(2)}%`}
                    </div>
                  </div>
                  <div className="bg-dark-200 rounded-md p-3 border border-border">
                    <div className="text-xs text-gray-300">Weekly APR</div>
                    <div className="text-lg font-bold text-green-400">
                      {`${stakingRates.weeklyAPR.toFixed(2)}%`}
                    </div>
                  </div>
                  <div className="bg-dark-200 rounded-md p-3 border border-border">
                    <div className="text-xs text-gray-300">Monthly APR</div>
                    <div className="text-lg font-bold text-green-400">
                      {`${stakingRates.monthlyAPR.toFixed(2)}%`}
                    </div>
                  </div>
                  <div className="bg-dark-200 rounded-md p-3 border border-border">
                    <div className="text-xs text-gray-300">Yearly APR</div>
                    <div className="text-lg font-bold text-green-400">
                      {`${stakingRates.yearlyAPR.toFixed(2)}%`}
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-400 flex items-center mt-2">
                  <InfoIcon className="h-3 w-3 mr-1" />
                  Rates are set by the admin and may change
                </div>
              </div>
              
              <div className="h-px bg-border" />
              
              {/* Staking Actions with Tabs */}
              <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-3 mb-4">
                  <TabsTrigger value="stake" disabled={!connected}>
                    <Download className="h-4 w-4 mr-2" />
                    Stake
                  </TabsTrigger>
                  <TabsTrigger value="unstake" disabled={!connected || stakingInfo.stakedAmount <= 0}>
                    <Upload className="h-4 w-4 mr-2" />
                    Unstake
                  </TabsTrigger>
                  <TabsTrigger value="harvest" disabled={!connected || stakingInfo.rewardsEarned <= 0}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Harvest
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="stake" className="mt-0 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-white">Stake YOT</h3>
                    <div className="flex items-center text-sm">
                      <Wallet className="h-4 w-4 mr-1 text-gray-400" />
                      <span className="text-gray-400">Available: </span>
                      <span className="font-medium ml-1 text-white">{formatNumber(yotBalance)} YOT</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        placeholder="Amount to stake"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        className="pr-16"
                        disabled={isStaking || !connected}
                      />
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="absolute right-0 top-0 h-full"
                        onClick={handleMaxStake}
                        disabled={isStaking || !connected}
                      >
                        MAX
                      </Button>
                    </div>
                    <Button 
                      onClick={handleStake} 
                      disabled={!stakeAmount || isStaking || !connected}
                      className="min-w-[80px]"
                    >
                      {isStaking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Stake'}
                    </Button>
                  </div>
                  <div className="bg-dark-300 border border-border p-3 rounded-lg text-sm mt-4">
                    <div className="flex items-start">
                      <InfoIcon className="h-4 w-4 mr-2 mt-0.5 text-primary" />
                      <p className="text-gray-300">
                        Staking locks your YOT tokens in the smart contract and automatically begins generating YOS rewards at {stakingRates.dailyAPR.toFixed(2)}% daily APR.
                      </p>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="unstake" className="mt-0 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-white">Unstake YOT</h3>
                    <div className="flex items-center text-sm">
                      <span className="text-gray-400">Staked: </span>
                      <span className="font-medium ml-1 text-white">{formatNumber(stakingInfo.stakedAmount)} YOT</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        placeholder="Amount to unstake"
                        value={unstakeAmount}
                        onChange={(e) => setUnstakeAmount(e.target.value)}
                        className="pr-16"
                        disabled={isUnstaking || !connected}
                      />
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="absolute right-0 top-0 h-full"
                        onClick={handleMaxUnstake}
                        disabled={isUnstaking || !connected}
                      >
                        MAX
                      </Button>
                    </div>
                    <Button 
                      onClick={handleUnstake} 
                      disabled={!unstakeAmount || isUnstaking || !connected}
                      className="min-w-[80px]"
                    >
                      {isUnstaking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unstake'}
                    </Button>
                  </div>
                  <div className="bg-dark-300 border border-border p-3 rounded-lg text-sm mt-4">
                    <div className="flex items-start">
                      <InfoIcon className="h-4 w-4 mr-2 mt-0.5 text-primary" />
                      <p className="text-gray-300">
                        Unstaking will return your YOT tokens to your wallet. There is no lock-up period or penalties for unstaking.
                      </p>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="harvest" className="mt-0 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-white">Harvest Rewards</h3>
                    <span className="text-sm text-gray-400">
                      <span className="font-medium text-white">{formatNumber(stakingInfo.rewardsEarned)}</span> YOS available
                    </span>
                  </div>
                  <Progress value={(stakingInfo.rewardsEarned / (stakingInfo.rewardsEarned + 100)) * 100} className="h-2" />
                  <Button 
                    onClick={handleHarvest} 
                    disabled={!canHarvest || isHarvesting || !connected}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    {isHarvesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Harvest Rewards
                  </Button>
                  <div className="bg-dark-300 border border-border p-3 rounded-lg text-sm mt-4">
                    <div className="flex items-start">
                      <InfoIcon className="h-4 w-4 mr-2 mt-0.5 text-primary" />
                      <p className="text-gray-300">
                        Harvesting will claim your earned YOS rewards and send them to your wallet. You can harvest anytime rewards are available.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              
              {!connected && (
                <div className="bg-dark-300 border border-border p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-300">
                    Connect your wallet to use staking features
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}