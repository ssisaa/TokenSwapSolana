import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowDownUp, ArrowRight, Info, Loader2 } from 'lucide-react';
import { useMultiHubSwap } from '@/hooks/useMultiHubSwap';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { useSOLPrice } from '../../hooks/useSOLPrice';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function MultiHubSwapCard() {
  const { wallet, connected, publicKey } = useMultiWallet();
  const { solPrice } = useSOLPrice();
  const {
    swapStats,
    liquidityInfo,
    isLoadingSwapStats,
    isLoadingLiquidityInfo,
    swapAndDistributeMutation,
    canClaimReward,
    timeUntilNextClaim,
    contributedValueUSD,
    weeklyRewardValueUSD,
    isSwapping,
    isClaiming,
    isWithdrawing,
    claimWeeklyRewardMutation,
    withdrawLiquidityMutation
  } = useMultiHubSwap();

  // Form state
  const [amountIn, setAmountIn] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(1); // 1% slippage
  const [activeTab, setActiveTab] = useState<string>('swap');

  // Estimated output amounts
  const [estimatedYot, setEstimatedYot] = useState<number>(0);
  const [estimatedLiquidity, setEstimatedLiquidity] = useState<number>(0);
  const [estimatedCashback, setEstimatedCashback] = useState<number>(0);
  
  // Fictional exchange rates for demonstration
  const usdcToYotRate = 0.5; // 1 USDC = 0.5 YOT

  // Update estimated amounts when input changes
  useEffect(() => {
    const numAmount = parseFloat(amountIn) || 0;
    const totalYot = numAmount * usdcToYotRate;
    
    // Distribution according to configured percentages (defaults: 75% user, 20% liquidity, 5% cashback)
    const userPercent = swapStats?.buyDistribution?.userPercent || 75;
    const liquidityPercent = swapStats?.buyDistribution?.liquidityPercent || 20;
    const cashbackPercent = swapStats?.buyDistribution?.cashbackPercent || 5;
    
    setEstimatedYot(totalYot * (userPercent / 100));
    setEstimatedLiquidity(totalYot * (liquidityPercent / 100));
    setEstimatedCashback(totalYot * (cashbackPercent / 100));
  }, [amountIn, swapStats]);

  // Function to handle swap
  const handleSwap = async () => {
    const numAmount = parseFloat(amountIn) || 0;
    if (numAmount <= 0) return;
    
    // Calculate minimum output with slippage
    const totalYot = numAmount * usdcToYotRate;
    const minAmountOut = totalYot * (1 - slippage / 100);
    
    await swapAndDistributeMutation.mutateAsync({
      amountIn: numAmount,
      minAmountOut
    });
    
    // Reset form
    setAmountIn('');
  };

  // Function to handle claim
  const handleClaim = async () => {
    if (!canClaimReward) return;
    await claimWeeklyRewardMutation.mutateAsync();
  };

  // Function to handle withdrawal
  const handleWithdraw = async () => {
    if (!liquidityInfo || liquidityInfo.contributedAmount <= 0) return;
    await withdrawLiquidityMutation.mutateAsync();
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Multi-Hub Swap</span>
          <div className="flex space-x-2">
            <Button 
              variant={activeTab === 'swap' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setActiveTab('swap')}
            >
              Swap
            </Button>
            <Button 
              variant={activeTab === 'liquidity' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setActiveTab('liquidity')}
            >
              Liquidity
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          {activeTab === 'swap' 
            ? 'Swap USDC for YOT with 5% YOS cashback and 20% auto-LP' 
            : 'Manage your liquidity contributions and rewards'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activeTab === 'swap' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount-in">From (USDC)</Label>
              <div className="relative">
                <Input
                  id="amount-in"
                  type="number"
                  placeholder="0.0"
                  value={amountIn}
                  onChange={(e) => setAmountIn(e.target.value)}
                  className="pr-16"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  USDC
                </div>
              </div>
              <div className="text-xs text-right text-muted-foreground">
                Balance: -
              </div>
            </div>
            
            <div className="flex justify-center">
              <div className="bg-muted rounded-full p-1.5">
                <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="amount-out">To (YOT)</Label>
                <div className="relative">
                  <Input
                    id="amount-out"
                    type="number"
                    placeholder="0.0"
                    value={estimatedYot.toFixed(6)}
                    readOnly
                    className="pr-16"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    YOT
                  </div>
                </div>
                <div className="text-xs text-right text-muted-foreground">
                  Balance: -
                </div>
              </div>
              
              <div className="space-y-2 rounded-lg bg-accent/20 p-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <span>Liquidity Contribution ({swapStats?.buyDistribution?.liquidityPercent || 20}%)</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-5 w-5 ml-1">
                            <Info className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{swapStats?.buyDistribution?.liquidityPercent || 20}% of YOT goes to liquidity pool. Earn weekly YOS rewards.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span>{estimatedLiquidity.toFixed(6)} YOT</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <span>YOS Cashback ({swapStats?.buyDistribution?.cashbackPercent || 5}%)</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-5 w-5 ml-1">
                            <Info className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Receive {swapStats?.buyDistribution?.cashbackPercent || 5}% instant cashback in YOS tokens.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span>{estimatedCashback.toFixed(6)} YOS</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {isLoadingLiquidityInfo ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !liquidityInfo || liquidityInfo.contributedAmount <= 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">You have no liquidity contributions yet.</p>
                <p className="text-sm mt-2">Swap USDC for YOT to start earning weekly YOS rewards!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-accent/20 p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Your Liquidity</span>
                    <span className="font-semibold">{liquidityInfo.contributedAmount.toFixed(2)} YOT</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Value</span>
                    <span className="font-semibold">${contributedValueUSD.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Weekly Reward</span>
                    <span className="font-semibold">{liquidityInfo.estimatedWeeklyReward.toFixed(4)} YOS</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Reward Value</span>
                    <span className="font-semibold">${weeklyRewardValueUSD.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Claimed</span>
                    <span className="font-semibold">{liquidityInfo.totalClaimedYos.toFixed(2)} YOS</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Next Claim</span>
                    <span className="font-semibold">{timeUntilNextClaim}</span>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <Button 
                    variant="default"
                    className="flex-1"
                    disabled={!canClaimReward || isClaiming}
                    onClick={handleClaim}
                  >
                    {isClaiming ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    Claim Rewards
                  </Button>
                  
                  <Button 
                    variant="outline"
                    className="flex-1"
                    disabled={isWithdrawing}
                    onClick={handleWithdraw}
                  >
                    {isWithdrawing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Withdraw
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        {activeTab === 'swap' ? (
          <Button 
            className="w-full" 
            disabled={!connected || isSwapping || !amountIn || parseFloat(amountIn) <= 0}
            onClick={handleSwap}
          >
            {!connected ? (
              "Connect Wallet"
            ) : isSwapping ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Swapping...
              </>
            ) : (
              "Swap"
            )}
          </Button>
        ) : null}
        
        {isLoadingSwapStats ? (
          <div className="w-full flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : swapStats ? (
          <div className="w-full text-xs text-muted-foreground flex justify-between">
            <span>Total Liquidity: {swapStats.totalLiquidityContributed.toLocaleString()} YOT</span>
            <span>APR: {swapStats.yearlyAPR}%</span>
          </div>
        ) : null}
      </CardFooter>
    </Card>
  );
}