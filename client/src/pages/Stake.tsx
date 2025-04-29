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
import ProgramFunding from "@/components/ProgramFunding";
import YosDistribution from "@/components/YosDistribution";

export default function Stake() {
  const { connected, wallet } = useMultiWallet();
  const { balance: yotBalance } = useTokenBalance(YOT_TOKEN_ADDRESS);
  const { balance: yosBalance } = useTokenBalance(YOS_TOKEN_ADDRESS);
  
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'stake' | 'unstake' | 'harvest'>('stake');
  
  const {
    stakingInfo,
    stakingRates,
    globalStats,
    isLoadingStakingInfo,
    isLoadingRates,
    stakeMutation,
    unstakeMutation,
    harvestMutation,
    stakingError,
    ratesError
  } = useStaking();

  // Renamed for easier use in UI
  const isLoading = isLoadingStakingInfo || isLoadingRates;
  const isStaking = stakeMutation.isPending;
  const isUnstaking = unstakeMutation.isPending;
  const isHarvesting = harvestMutation.isPending;
  
  // Handle stake button click
  const handleStake = () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;
    stakeMutation.mutate({ amount: parseFloat(stakeAmount) });
    setStakeAmount('');
  };
  
  // Handle unstake button click
  const handleUnstake = () => {
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) return;
    const amount = Math.min(parseFloat(unstakeAmount), stakingInfo.stakedAmount);
    unstakeMutation.mutate({ amount });
    setUnstakeAmount('');
  };
  
  // Handle harvest button click
  const handleHarvest = () => {
    harvestMutation.mutate();
  };
  
  // Handle max stake button
  const handleMaxStake = () => {
    setStakeAmount(yotBalance.toString());
  };
  
  // Handle max unstake button
  const handleMaxUnstake = () => {
    setUnstakeAmount(stakingInfo.stakedAmount.toString());
  };
  
  // Check if rewards can be harvested
  const canHarvest = stakingInfo.rewardsEarned > 0;
  
  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 bg-dark-100">
        <h1 className="text-3xl font-bold tracking-tight">Staking Dashboard</h1>
        
        {/* Top Row - 4 Stats Boxes */}
        <div className="grid grid-cols-4 gap-4 mt-8 mb-6">
          {/* Global Total Staked */}
          <Card className="bg-dark-200 border border-slate-700">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Global Total Staked</h3>
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
          
          {/* Your Staked Amount */}
          <Card className="bg-dark-200 border border-slate-700">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Your Staked Amount</h3>
              {isLoading ? (
                <div className="animate-pulse bg-dark-300 h-6 w-24 rounded"></div>
              ) : (
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-white">{formatNumber(stakingInfo.stakedAmount)}</span>
                    <span className="text-sm font-semibold text-blue-400">YOT</span>
                  </div>
                  {globalStats && globalStats.totalStaked > 0 && stakingInfo.stakedAmount > 0 && (
                    <span className="text-xs text-gray-400 ml-1">
                      ({((stakingInfo.stakedAmount / globalStats.totalStaked) * 100).toFixed(2)}% of global)
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Earned Rewards */}
          <Card className="bg-dark-200 border border-slate-700">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Your Pending Rewards</h3>
              {isLoading ? (
                <div className="animate-pulse bg-dark-300 h-6 w-24 rounded"></div>
              ) : (
                <div className="space-y-2">
                  {/* Show the actual value (without multiplier) as the primary display */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-white">{formatNumber(stakingInfo.rewardsEarned / 10000)}</span>
                    <span className="text-sm font-semibold text-green-400">YOS</span>
                  </div>
                  
                  {/* Info about the program multiplier */}
                  <div className="text-xs p-2 text-amber-400 bg-amber-950/30 rounded border border-amber-700/50 mb-1">
                    <InfoIcon className="h-3 w-3 inline mr-1" />
                    <span className="font-semibold">IMPORTANT:</span> Program has a built-in 10,000× multiplier
                  </div>
                  
                  {/* Show the raw blockchain value as secondary information with clearer explanation */}
                  <div className="flex flex-col gap-1 border border-slate-700 p-2 rounded-sm bg-slate-800/50">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-gray-400">UI shows:</span>
                      <span className="text-xs font-semibold text-white">{formatNumber(stakingInfo.rewardsEarned / 10000)} YOS</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-gray-400">Blockchain receives:</span>
                      <span className="text-xs font-semibold text-blue-400">{formatNumber(stakingInfo.rewardsEarned)} YOS</span>
                    </div>
                    <div className="text-xs text-amber-500 mt-1 text-[10px]">
                      The wallet will show the higher amount in transactions.
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Your YOS Tokens */}
          <Card className="bg-dark-200 border border-slate-700">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Your YOS Tokens</h3>
              {isLoading ? (
                <div className="animate-pulse bg-dark-300 h-6 w-16 rounded"></div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-white">{formatNumber(yosBalance)}</span>
                  <span className="text-sm font-semibold text-green-400">YOS</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
{/* Removed YOS Distribution section - users should not have to request tokens */}
        
        {/* Admin Controls - Only visible to admin on Admin page, not shown on user Stake page */}
        
        {/* Main Content */}
        <div className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            {/* YOT Staking Stats */}
            <div className="space-y-6">
              <Card className="bg-dark-200 border border-slate-700">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4 text-white">YOT Staking</h3>
                  <p className="text-sm text-gray-300 mb-4">
                    Stake YOT tokens to earn YOS rewards. All actions require wallet signature.
                  </p>
                  
                  {/* Stats */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Staked:</span>
                      <span className="font-medium text-white">{formatNumber(isLoading ? 0 : stakingInfo.stakedAmount)} YOT</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-400">Pending Rewards:</span>
                      <span className="font-medium text-white">{formatNumber(isLoading ? 0 : stakingInfo.rewardsEarned / 10000)} YOS</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-400">Staking Since:</span>
                      <span className="font-medium text-white">
                        {isLoading ? 'Loading...' : (stakingInfo.startTimestamp === 0 ? 'Not staked yet' : new Date(stakingInfo.startTimestamp * 1000).toLocaleDateString())}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Harvest:</span>
                      <span className="font-medium text-white">
                        {isLoading ? 'Loading...' : (stakingInfo.lastHarvestTime === 0 ? 'Never harvested' : `${Math.floor((Date.now()/1000 - stakingInfo.lastHarvestTime) / 3600)} hours ago`)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Harvested:</span>
                      <span className="font-medium text-white">{formatNumber(isLoading ? 0 : stakingInfo.totalHarvested / 10000)} YOS</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Staking APR/APY Rates */}
              <Card className="bg-dark-200 border border-slate-700">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold mb-4 text-white">Staking APR/APY Rates</h3>
                  
                  <div className="border-t border-slate-700 py-3">
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium text-white">Per Second Rate:</div>
                      <div className="text-sm font-bold text-green-400">
                        {stakingRates ? 
                          // Format to avoid scientific notation (e.g., 1.25e-9)
                          `${parseFloat((stakingRates.stakeRatePerSecond || 0).toFixed(10)).toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 10,
                            useGrouping: false
                          })}%` : 
                          '0.00000000%'
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2 border-b border-slate-700">
                      <div className="text-xs font-medium text-gray-400">Daily APR:</div>
                      <div className="text-sm font-bold text-green-400">
                        {`${(stakingRates?.dailyAPR || 0).toFixed(2)}%`}
                      </div>
                    </div>
                    <div className="p-2 border-b border-slate-700">
                      <div className="text-xs font-medium text-gray-400">Daily APY:</div>
                      <div className="text-sm font-bold text-green-400">
                        {`${(stakingRates?.dailyAPY || 0).toFixed(2)}%`}
                      </div>
                    </div>
                    <div className="p-2 border-b border-slate-700">
                      <div className="text-xs font-medium text-gray-400">Weekly APR:</div>
                      <div className="text-sm font-bold text-green-400">
                        {`${(stakingRates?.weeklyAPR || 0).toFixed(2)}%`}
                      </div>
                    </div>
                    <div className="p-2 border-b border-slate-700">
                      <div className="text-xs font-medium text-gray-400">Weekly APY:</div>
                      <div className="text-sm font-bold text-green-400">
                        {`${(stakingRates?.weeklyAPY || 0).toFixed(2)}%`}
                      </div>
                    </div>
                    <div className="p-2 border-b border-slate-700">
                      <div className="text-xs font-medium text-gray-400">Monthly APR:</div>
                      <div className="text-sm font-bold text-green-400">
                        {`${(stakingRates?.monthlyAPR || 0).toFixed(2)}%`}
                      </div>
                    </div>
                    <div className="p-2 border-b border-slate-700">
                      <div className="text-xs font-medium text-gray-400">Monthly APY:</div>
                      <div className="text-sm font-bold text-green-400">
                        {`${(stakingRates?.monthlyAPY || 0).toFixed(2)}%`}
                      </div>
                    </div>
                    <div className="p-2">
                      <div className="text-xs font-medium text-gray-400">Yearly APR:</div>
                      <div className="text-sm font-bold text-green-400">
                        {`${(stakingRates?.yearlyAPR || 0).toFixed(2)}%`}
                      </div>
                    </div>
                    <div className="p-2">
                      <div className="text-xs font-medium text-gray-400">Yearly APY:</div>
                      <div className="text-sm font-bold text-green-400">
                        {`${(stakingRates?.yearlyAPY || 0).toFixed(2)}%`}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-400 flex items-center mt-2">
                    <InfoIcon className="h-3 w-3 mr-1 text-blue-400" />
                    Rates are set by the admin and may change
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Staking Actions Form */}
            <Card className="bg-dark-200 border border-slate-700">
              <CardContent className="p-6">
                {/* Action Tabs */}
                <div className="flex border-b border-slate-700 mb-4">
                  <button 
                    className={`flex items-center mr-4 pb-3 px-1 ${activeTab === 'stake' ? 'border-b-2 border-blue-500 text-white font-medium' : 'text-gray-400'}`}
                    onClick={() => setActiveTab('stake')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Stake
                  </button>
                  <button 
                    className={`flex items-center mr-4 pb-3 px-1 ${activeTab === 'unstake' ? 'border-b-2 border-blue-500 text-white font-medium' : 'text-gray-400'}`}
                    onClick={() => setActiveTab('unstake')}
                    disabled={stakingInfo.stakedAmount <= 0}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Unstake
                  </button>
                  <button 
                    className={`flex items-center pb-3 px-1 ${activeTab === 'harvest' ? 'border-b-2 border-blue-500 text-white font-medium' : 'text-gray-400'}`}
                    onClick={() => setActiveTab('harvest')}
                    disabled={stakingInfo.rewardsEarned <= 0}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Harvest
                  </button>
                </div>
                
                {/* Stake Tab */}
                {activeTab === 'stake' && (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white">Stake YOT</h3>
                      <div className="flex items-center text-sm">
                        <span className="text-gray-400">Available: </span>
                        <span className="font-medium ml-1 text-white">{formatNumber(yotBalance)} YOT</span>
                      </div>
                    </div>
                    
                    {/* Input Field */}
                    <div className="flex flex-col gap-1 mb-2">
                      <div className="bg-dark-100 rounded-md border border-slate-700 flex justify-between items-center">
                        <input 
                          type="number"
                          placeholder={`Min: ${stakingRates?.harvestThreshold || 0} YOT`}
                          value={stakeAmount}
                          onChange={(e) => setStakeAmount(e.target.value)}
                          className="border-0 bg-transparent h-14 px-4 focus:outline-none flex-1 text-white"
                          disabled={!connected || isStaking}
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="mr-2 bg-slate-700 text-white hover:bg-slate-600"
                          onClick={handleMaxStake}
                          disabled={!connected || isStaking}
                        >
                          MAX
                        </Button>
                      </div>
                      <div className="text-xs text-amber-400 flex items-center">
                        <span className="mr-1">⚠️</span>
                        Minimum stake: {stakingRates?.stakeThreshold || 0} YOT
                      </div>
                    </div>
                    
                    <Button 
                      onClick={handleStake}
                      className="h-14 bg-blue-600 hover:bg-blue-700 text-white font-medium w-full mb-4"
                      disabled={!connected || !stakeAmount || isStaking || parseFloat(stakeAmount || '0') <= 0}
                    >
                      {isStaking ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : null}
                      Stake
                    </Button>
                    
                    <div className="bg-dark-300 border border-slate-700 p-3 rounded-lg text-sm">
                      <div className="flex items-start">
                        <InfoIcon className="h-4 w-4 mr-2 mt-0.5 text-blue-400" />
                        <div className="text-gray-300">
                          <p>
                            Staking locks your YOT tokens in the smart contract and automatically begins generating YOS rewards at {(stakingRates?.dailyAPY || 0).toFixed(2)}% daily APY (compound interest).
                          </p>
                          <p className="mt-2 font-medium text-amber-300">
                            Minimum staking amount: {stakingRates?.stakeThreshold || 0} YOT
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Unstake Tab */}
                {activeTab === 'unstake' && (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white">Unstake YOT</h3>
                      <div className="flex items-center text-sm">
                        <span className="text-gray-400">Staked: </span>
                        <span className="font-medium ml-1 text-white">{formatNumber(stakingInfo.stakedAmount)} YOT</span>
                      </div>
                    </div>
                    
                    {/* Input Field */}
                    <div className="flex flex-col gap-1 mb-2">
                      <div className="bg-dark-100 rounded-md border border-slate-700 flex justify-between items-center">
                        <input 
                          type="number"
                          placeholder={`Min: ${stakingRates?.unstakeThreshold || 0} YOT`}
                          value={unstakeAmount}
                          onChange={(e) => setUnstakeAmount(e.target.value)}
                          className="border-0 bg-transparent h-14 px-4 focus:outline-none flex-1 text-white"
                          disabled={!connected || isUnstaking}
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="mr-2 bg-slate-700 text-white hover:bg-slate-600"
                          onClick={handleMaxUnstake}
                          disabled={!connected || isUnstaking}
                        >
                          MAX
                        </Button>
                      </div>
                      <div className="text-xs text-amber-400 flex items-center">
                        <span className="mr-1">⚠️</span>
                        Minimum unstake: {stakingRates?.unstakeThreshold || 0} YOT
                      </div>
                    </div>
                    
                    <Button 
                      onClick={handleUnstake}
                      className="h-14 bg-blue-600 hover:bg-blue-700 text-white font-medium w-full mb-4"
                      disabled={!connected || !unstakeAmount || isUnstaking || parseFloat(unstakeAmount || '0') <= 0}
                    >
                      {isUnstaking ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : null}
                      Unstake
                    </Button>
                    
                    <div className="bg-dark-300 border border-slate-700 p-3 rounded-lg text-sm">
                      <div className="flex items-start">
                        <InfoIcon className="h-4 w-4 mr-2 mt-0.5 text-blue-400" />
                        <div className="text-gray-300">
                          <p>
                            Unstaking will return your YOT tokens to your wallet. There is no lock-up period or penalties for unstaking.
                          </p>
                          <p className="mt-2 font-medium text-amber-300">
                            Minimum unstake amount: {stakingRates?.unstakeThreshold || 0} YOT
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Harvest Tab */}
                {activeTab === 'harvest' && (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white">Harvest Rewards</h3>
                      <span className="text-sm text-gray-400">
                        <span className="font-medium text-white">{formatNumber(stakingInfo.rewardsEarned / 10000)}</span> YOS available
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 mb-4">
                      {/* Progress indicator for available rewards */}
                      <div className="bg-dark-100 rounded-md border border-slate-700 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-300">Available rewards:</span>
                          <span className="text-sm font-medium text-white">{formatNumber(stakingInfo.rewardsEarned / 10000)} YOS</span>
                        </div>
                        
                        <div className="w-full bg-slate-700 rounded-full h-2.5 mb-1">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full" 
                            style={{ 
                              width: `${Math.min(100, ((stakingInfo.rewardsEarned / 10000) / (stakingRates?.harvestThreshold || 1)) * 100)}%` 
                            }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-400">0</span>
                          <span className={`font-medium ${(stakingInfo.rewardsEarned / 10000) >= (stakingRates?.harvestThreshold || 0) ? 'text-green-400' : 'text-amber-400'}`}>
                            Threshold: {typeof stakingRates?.harvestThreshold === 'number' ? 
                              stakingRates.harvestThreshold.toLocaleString('en-US', {maximumFractionDigits: 0}) : '0'} YOS
                          </span>
                        </div>
                      </div>
                      
                      <Button 
                        onClick={handleHarvest}
                        className="h-14 bg-blue-600 hover:bg-blue-700 text-white font-medium w-full"
                        disabled={!connected || !canHarvest || isHarvesting}
                      >
                        {isHarvesting ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <CheckCircle className="h-5 w-5 mr-2" />}
                        Harvest Rewards
                      </Button>
                      
                      {(stakingInfo.rewardsEarned / 10000) < (stakingRates?.harvestThreshold || 0) && (
                        <div className="text-xs text-amber-400 flex items-center">
                          <span className="mr-1">⚠️</span>
                          Need at least {typeof stakingRates?.harvestThreshold === 'number' ? 
                              stakingRates.harvestThreshold.toLocaleString('en-US', {maximumFractionDigits: 0}) : '0'} YOS to harvest (you have {formatNumber(stakingInfo.rewardsEarned / 10000)})
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-dark-300 border border-slate-700 p-3 rounded-lg text-sm">
                      <div className="flex items-start">
                        <InfoIcon className="h-4 w-4 mr-2 mt-0.5 text-blue-400" />
                        <div className="text-gray-300">
                          <p>
                            Harvesting will claim your earned YOS rewards and send them to your wallet. You can harvest anytime rewards are available.
                          </p>
                          <p className="mt-2 font-medium text-amber-300">
                            Minimum harvest amount: {typeof stakingRates?.harvestThreshold === 'number' ? 
                              stakingRates.harvestThreshold.toLocaleString('en-US', {maximumFractionDigits: 0}) : '0'} YOS
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Wallet Not Connected Message */}
                {!connected && (
                  <div className="bg-dark-300 border border-slate-700 p-4 rounded-lg text-center mt-4">
                    <p className="text-sm text-gray-300">
                      Connect your wallet to use staking features
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* How Staking Works (Below the forms) */}
          <Card className="bg-dark-200 border border-slate-700 mb-6">
            <CardContent className="pt-6">
              <h3 className="text-xl font-bold mb-4 text-white">How Staking Works</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-blue-600/20 p-3 rounded-full mb-3">
                    <Download className="h-5 w-5 text-blue-400" />
                  </div>
                  <h4 className="font-medium text-white mb-2">Stake YOT</h4>
                  <p className="text-sm text-gray-300">
                    Lock your YOT tokens in the staking contract to start earning rewards.
                  </p>
                </div>
                
                <div className="flex flex-col items-center text-center">
                  <div className="bg-blue-600/20 p-3 rounded-full mb-3">
                    <Clock className="h-5 w-5 text-blue-400" />
                  </div>
                  <h4 className="font-medium text-white mb-2">Earn Rewards</h4>
                  <p className="text-sm text-gray-300">
                    Earn YOS rewards continuously based on your staked amount and the current APY.
                  </p>
                </div>
                
                <div className="flex flex-col items-center text-center">
                  <div className="bg-blue-600/20 p-3 rounded-full mb-3">
                    <CheckCircle className="h-5 w-5 text-blue-400" />
                  </div>
                  <h4 className="font-medium text-white mb-2">Harvest Anytime</h4>
                  <p className="text-sm text-gray-300">
                    Claim your YOS rewards whenever you want. No lock-up period or vesting.
                  </p>
                </div>
                
                <div className="flex flex-col items-center text-center">
                  <div className="bg-blue-600/20 p-3 rounded-full mb-3">
                    <Shield className="h-5 w-5 text-blue-400" />
                  </div>
                  <h4 className="font-medium text-white mb-2">Staking Security</h4>
                  <p className="text-sm text-gray-300">
                    All operations require your explicit wallet signature. Your funds remain secure through Solana's smart contracts.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* We're hiding the original StakingCard component since we've implemented our own UI */}
          {/* <StakingCard /> */}
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
              <h3 className="text-lg font-semibold">Are there minimum amounts for staking operations?</h3>
              <p className="mt-2 text-muted-foreground">
                Yes, to prevent dust attacks and ensure efficient use of network resources, there are minimums for each operation. 
                You need to stake at least {stakingRates?.stakeThreshold || 0} YOT, unstake at least {stakingRates?.unstakeThreshold || 0} YOT, and you can only harvest rewards when you've accumulated at least {typeof stakingRates?.harvestThreshold === 'number' ? 
                              stakingRates.harvestThreshold.toLocaleString('en-US', {maximumFractionDigits: 0}) : '0'} YOS.
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
    </DashboardLayout>
  );
}