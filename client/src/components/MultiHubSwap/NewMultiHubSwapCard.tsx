import { useState, useEffect } from 'react';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { 
  ArrowDownUp, 
  ArrowRight, 
  Loader2, 
  Info, 
  RefreshCw, 
  Settings, 
  Shield, 
  BadgeDollarSign, 
  ArrowLeftRight, 
  Gift 
} from 'lucide-react';
import { useMultiHubSwap } from '@/hooks/useMultiHubSwap';
import { useSOLPrice } from '@/hooks/useSOLPrice';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import TokenSearchInput from './TokenSearchInput';
import { YOT_TOKEN_ADDRESS } from '@/lib/constants';
import { TokenMetadata, getSwapEstimate, getTokenByAddress } from '@/lib/token-search-api';
import { getSwapRoute, swapToBuyYOT, swapToSellYOT } from '@/lib/swap-router';

export default function MultiHubSwapCard() {
  const [activeTab, setActiveTab] = useState<'swap' | 'liquidity'>('swap');
  const [swapMode, setSwapMode] = useState<'buy' | 'sell'>('buy'); // 'buy' for TokenX→YOT, 'sell' for YOT→TokenX
  const [amountIn, setAmountIn] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(1); // 1% default slippage
  const [fromToken, setFromToken] = useState<TokenMetadata | null>(null);
  const [toToken, setToToken] = useState<TokenMetadata | null>(null);
  const [estimatedOutput, setEstimatedOutput] = useState<number>(0);
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [isQuoting, setIsQuoting] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  
  // Distribution estimates
  const [estimatedUser, setEstimatedUser] = useState<number>(0);
  const [estimatedLiquidity, setEstimatedLiquidity] = useState<number>(0);
  const [estimatedCashback, setEstimatedCashback] = useState<number>(0);
  
  const { wallet, connected } = useMultiWallet();
  const { 
    swapStats, 
    liquidityInfo,
    isLoadingSwapStats,
    isLoadingLiquidityInfo,
    swapAndDistributeMutation,
    claimWeeklyRewardMutation,
    withdrawLiquidityMutation,
    canClaimReward,
    timeUntilNextClaim,
    contributedValueUSD,
    weeklyRewardValueUSD,
    isSwapping,
    isClaiming,
    isWithdrawing
  } = useMultiHubSwap();

  // Initialize tokens on load
  useEffect(() => {
    const initTokens = async () => {
      const yotToken = await getTokenByAddress(YOT_TOKEN_ADDRESS);
      const usdcToken = await getTokenByAddress('9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U');
      
      if (swapMode === 'buy') {
        setFromToken(usdcToken);
        setToToken(yotToken);
      } else {
        setFromToken(yotToken);
        setToToken(usdcToken);
      }
    };
    
    initTokens();
  }, [swapMode]);

  // Flip tokens
  const flipTokens = () => {
    const newMode = swapMode === 'buy' ? 'sell' : 'buy';
    setSwapMode(newMode);
    setAmountIn('');
    setEstimatedOutput(0);
    setPriceImpact(0);
    setEstimatedUser(0);
    setEstimatedLiquidity(0);
    setEstimatedCashback(0);
  };

  // Update estimate when input changes
  useEffect(() => {
    const updateSwapEstimate = async () => {
      if (!fromToken || !toToken || !amountIn || parseFloat(amountIn) <= 0) {
        setEstimatedOutput(0);
        setPriceImpact(0);
        setEstimatedUser(0);
        setEstimatedLiquidity(0);
        setEstimatedCashback(0);
        return;
      }
      
      setIsQuoting(true);
      try {
        // Get swap route
        const route = await getSwapRoute(
          fromToken.address,
          toToken.address,
          parseFloat(amountIn)
        );
        
        setEstimatedOutput(route.estimatedAmount);
        setPriceImpact(route.priceImpact);
        
        // Calculate distribution based on mode
        if (swapMode === 'buy') {
          // For buy flow: Any token → YOT
          const userPercent = swapStats?.buyDistribution?.userPercent || 75;
          const liquidityPercent = swapStats?.buyDistribution?.liquidityPercent || 20;
          const cashbackPercent = swapStats?.buyDistribution?.cashbackPercent || 5;
          
          setEstimatedUser(route.estimatedAmount * (userPercent / 100));
          setEstimatedLiquidity(route.estimatedAmount * (liquidityPercent / 100));
          setEstimatedCashback(route.estimatedAmount * (cashbackPercent / 100));
        } else {
          // For sell flow: YOT → Any token
          const userPercent = swapStats?.sellDistribution?.userPercent || 75;
          const liquidityPercent = swapStats?.sellDistribution?.liquidityPercent || 20;
          const cashbackPercent = swapStats?.sellDistribution?.cashbackPercent || 5;
          
          // For sell flow, the distribution applies to input amount (YOT)
          const inputAmount = parseFloat(amountIn);
          setEstimatedUser(route.estimatedAmount);
          setEstimatedLiquidity(inputAmount * (liquidityPercent / 100));
          setEstimatedCashback(inputAmount * (cashbackPercent / 100));
        }
      } catch (error) {
        console.error("Error updating estimate:", error);
        setEstimatedOutput(0);
        setPriceImpact(0);
        setEstimatedUser(0);
        setEstimatedLiquidity(0);
        setEstimatedCashback(0);
      } finally {
        setIsQuoting(false);
      }
    };
    
    if (fromToken && toToken) {
      updateSwapEstimate();
    }
  }, [amountIn, fromToken, toToken, swapMode, swapStats]);

  // Function to handle swap
  const handleSwap = async () => {
    if (!fromToken || !toToken || !amountIn || parseFloat(amountIn) <= 0) return;
    
    const amount = parseFloat(amountIn);
    
    try {
      let txSignature: string;
      
      if (swapMode === 'buy') {
        // Any token → YOT (Buy flow)
        txSignature = await swapToBuyYOT(
          wallet,
          fromToken.address,
          amount,
          slippage,
          swapStats?.buyDistribution?.userPercent || 75,
          swapStats?.buyDistribution?.liquidityPercent || 20,
          swapStats?.buyDistribution?.cashbackPercent || 5
        );
      } else {
        // YOT → Any token (Sell flow)
        txSignature = await swapToSellYOT(
          wallet,
          toToken.address,
          amount,
          slippage,
          swapStats?.sellDistribution?.userPercent || 75,
          swapStats?.sellDistribution?.liquidityPercent || 20,
          swapStats?.sellDistribution?.cashbackPercent || 5
        );
      }
      
      console.log("Swap transaction successful:", txSignature);
      
      // Reset form
      setAmountIn('');
    } catch (error) {
      console.error("Swap failed:", error);
    }
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
            ? swapMode === 'buy'
              ? 'Swap any token for YOT with YOS cashback and auto-LP' 
              : 'Swap YOT for any token with YOS cashback and auto-LP'
            : 'Manage your liquidity contributions and rewards'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activeTab === 'swap' ? (
          <div className="space-y-4">
            {/* From token */}
            <div className="space-y-2">
              <Label htmlFor="amount-in">From</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    id="amount-in"
                    type="number"
                    placeholder="0.0"
                    value={amountIn}
                    onChange={(e) => setAmountIn(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="w-40">
                  <TokenSearchInput 
                    onSelect={setFromToken}
                    selectedToken={fromToken || undefined}
                    placeholder="Select token"
                    excludeTokens={toToken ? [toToken.address] : []}
                  />
                </div>
              </div>
              <div className="text-xs text-right text-muted-foreground">
                Balance: -
              </div>
            </div>
            
            {/* Swap direction button */}
            <div className="flex justify-center">
              <div 
                className="bg-muted rounded-full p-2 cursor-pointer hover:bg-accent transition-colors"
                onClick={flipTokens}
              >
                <ArrowDownUp className="h-4 w-4" />
              </div>
            </div>
            
            {/* To token */}
            <div className="space-y-2">
              <Label htmlFor="amount-out">To</Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    id="amount-out"
                    type="number"
                    placeholder="0.0"
                    value={isQuoting ? '...' : estimatedOutput.toFixed(6)}
                    readOnly
                    className="w-full"
                  />
                  {isQuoting && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                </div>
                <div className="w-40">
                  <TokenSearchInput 
                    onSelect={setToToken}
                    selectedToken={toToken || undefined}
                    placeholder="Select token"
                    excludeTokens={fromToken ? [fromToken.address] : []}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Price Impact: {priceImpact.toFixed(2)}%</span>
                <span>Balance: -</span>
              </div>
            </div>
            
            {/* Settings */}
            <div className="flex justify-between items-center">
              <span className="text-sm">Settings</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label htmlFor="slippage">Slippage Tolerance</Label>
                        <span className="text-sm">{slippage}%</span>
                      </div>
                      <Slider 
                        id="slippage"
                        min={0.1}
                        max={5}
                        step={0.1}
                        value={[slippage]}
                        onValueChange={(values) => setSlippage(values[0])}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0.1%</span>
                        <span>5%</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="advanced-mode">Advanced Mode</Label>
                        <Switch 
                          id="advanced-mode" 
                          checked={showAdvanced}
                          onCheckedChange={setShowAdvanced}
                        />
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Distribution details */}
            <div className="space-y-2 rounded-lg bg-accent/20 p-3">
              {swapMode === 'buy' ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <span>You Receive ({swapStats?.buyDistribution?.userPercent || 75}%)</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5 ml-1">
                              <Info className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{swapStats?.buyDistribution?.userPercent || 75}% of YOT is sent directly to your wallet.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span>{isQuoting ? '...' : estimatedUser.toFixed(6)} YOT</span>
                  </div>
                  
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
                            <p className="max-w-xs">{swapStats?.buyDistribution?.liquidityPercent || 20}% automatically goes to SOL-YOT liquidity pool (50% SOL, 50% YOT). Earn weekly YOS rewards for contributing to liquidity.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span>{isQuoting ? '...' : estimatedLiquidity.toFixed(6)} YOT</span>
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
                    <span>{isQuoting ? '...' : estimatedCashback.toFixed(6)} YOS</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <span>You Receive ({swapStats?.sellDistribution?.userPercent || 75}%)</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5 ml-1">
                              <Info className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{swapStats?.sellDistribution?.userPercent || 75}% of the value is sent directly to your wallet.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span>{isQuoting ? '...' : estimatedOutput.toFixed(6)} {toToken?.symbol || ''}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <span>Liquidity Contribution ({swapStats?.sellDistribution?.liquidityPercent || 20}%)</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5 ml-1">
                              <Info className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{swapStats?.sellDistribution?.liquidityPercent || 20}% of YOT goes to liquidity pool. Earn weekly YOS rewards.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span>{isQuoting ? '...' : estimatedLiquidity.toFixed(6)} YOT</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <span>YOS Cashback ({swapStats?.sellDistribution?.cashbackPercent || 5}%)</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5 ml-1">
                              <Info className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Receive {swapStats?.sellDistribution?.cashbackPercent || 5}% instant cashback in YOS tokens.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span>{isQuoting ? '...' : estimatedCashback.toFixed(6)} YOS</span>
                  </div>
                </>
              )}
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
                <p className="text-sm mt-2">Swap any token for YOT to start earning weekly YOS rewards!</p>
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
            disabled={
              !connected || 
              isSwapping || 
              isQuoting || 
              !amountIn || 
              parseFloat(amountIn) <= 0 ||
              !fromToken ||
              !toToken
            }
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
          <div className="w-full text-xs space-y-1">
            <div className="text-muted-foreground flex justify-between">
              <span>Total Liquidity: {swapStats.totalLiquidityContributed.toLocaleString()} YOT</span>
              <span>APR: {swapStats.yearlyAPR}%</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="p-1 rounded-sm bg-muted/40 flex items-center">
                <Shield className="h-3 w-3 mr-1 text-green-500" />
                <span className="text-[10px]">Auto-strengthened liquidity pool</span>
              </div>
              <div className="p-1 rounded-sm bg-muted/40 flex items-center">
                <BadgeDollarSign className="h-3 w-3 mr-1 text-green-500" />
                <span className="text-[10px]">Passive income (100% APR)</span>
              </div>
              <div className="p-1 rounded-sm bg-muted/40 flex items-center">
                <ArrowLeftRight className="h-3 w-3 mr-1 text-green-500" />
                <span className="text-[10px]">Auto-switch Jupiter/Raydium</span>
              </div>
              <div className="p-1 rounded-sm bg-muted/40 flex items-center">
                <Gift className="h-3 w-3 mr-1 text-green-500" />
                <span className="text-[10px]">YOS Cashback (non-dumping)</span>
              </div>
            </div>
          </div>
        ) : null}
      </CardFooter>
    </Card>
  );
}