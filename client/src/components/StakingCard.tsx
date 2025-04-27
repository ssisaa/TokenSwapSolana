import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useStaking } from '@/hooks/useStaking';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { formatNumber } from '@/lib/utils';
import { Loader2, Wallet } from 'lucide-react';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { YOT_TOKEN_ADDRESS } from '@/lib/constants';

export default function StakingCard() {
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  const { connected } = useMultiWallet();
  
  // Fetch the user's YOT token balance
  const { balance: yotBalance, isLoading: isLoadingBalance } = useTokenBalance(YOT_TOKEN_ADDRESS);
  
  const {
    stakingInfo,
    isLoading,
    stakeTokens,
    unstakeTokens,
    harvestRewards,
    isStaking,
    isUnstaking,
    isHarvesting
  } = useStaking();
  
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold">YOT Staking</CardTitle>
        <CardDescription>
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
                  <span className="text-muted-foreground">Total Staked:</span>
                  <span className="font-medium">{formatNumber(stakingInfo.stakedAmount)} YOT</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pending Rewards:</span>
                  <span className="font-medium">{formatNumber(stakingInfo.rewardsEarned)} YOS</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Staking Since:</span>
                  <span className="font-medium">{formatDate(stakingInfo.startTimestamp)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Harvest:</span>
                  <span className="font-medium">{getTimeSinceLastHarvest()} ago</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Harvested:</span>
                  <span className="font-medium">{formatNumber(stakingInfo.totalHarvested)} YOS</span>
                </div>
              </div>
              
              <div className="h-px bg-border" />
              
              {/* Staking Actions */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Stake YOT</h3>
                  <div className="flex items-center text-sm">
                    <Wallet className="h-4 w-4 mr-1 text-muted-foreground" />
                    <span className="text-muted-foreground">Available: </span>
                    <span className="font-medium ml-1">{formatNumber(yotBalance)} YOT</span>
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
              </div>
              
              {stakingInfo.stakedAmount > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Unstake YOT</h3>
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
                </div>
              )}
              
              {stakingInfo.rewardsEarned > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Harvest Rewards</h3>
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(stakingInfo.rewardsEarned)} YOS available
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
                </div>
              )}
              
              {!connected && (
                <div className="bg-muted p-4 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">
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