import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ArrowRightLeft, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { TokenSearchInput } from './TokenSearchInput';
import { formatNumber } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getMultiHubSwapEstimate, executeMultiHubSwap, claimYosSwapRewards, SwapProvider } from '@/lib/multi-hub-swap';
import { defaultTokens } from '@/lib/token-search-api';
import { SOL_SYMBOL, YOT_SYMBOL, SOL_TOKEN_ADDRESS, YOT_TOKEN_ADDRESS } from '@/lib/constants';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { getTokenBalance, formatTokenBalance } from '@/lib/wallet-utils';

interface MultiHubSwapDemoProps {
  onTokenChange?: (fromToken: any, toToken: any) => void;
}

export default function MultiHubSwapDemo({ onTokenChange }: MultiHubSwapDemoProps) {
  const { wallet = null, connected: walletConnected = false, connect } = useMultiWallet() || {};
  const { toast } = useToast();
  
  // Token state
  const [fromToken, setFromToken] = useState(defaultTokens[0]); // Default to SOL
  const [toToken, setToToken] = useState(defaultTokens[1]); // Default to YOT
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(1.0); // Default 1% slippage
  
  // When tokens change, call the onTokenChange callback
  useEffect(() => {
    if (onTokenChange && fromToken && toToken) {
      onTokenChange(fromToken, toToken);
    }
  }, [fromToken, toToken, onTokenChange]);
  
  // UI state
  const [estimatedAmount, setEstimatedAmount] = useState<number | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routeProvider, setRouteProvider] = useState(SwapProvider.Contract);
  const [availableRewards, setAvailableRewards] = useState(0);
  const [claimLoading, setClaimLoading] = useState(false);
  const [swapEstimate, setSwapEstimate] = useState<any>(null);
  
  // Token balance state
  const [fromTokenBalance, setFromTokenBalance] = useState<number | null>(null);
  const [toTokenBalance, setToTokenBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  
  // Get swap estimate when tokens or amount changes
  useEffect(() => {
    const getEstimate = async () => {
      if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0) {
        setEstimatedAmount(null);
        return;
      }
      
      try {
        setEstimateLoading(true);
        const parsedAmount = parseFloat(amount);
        const estimate = await getMultiHubSwapEstimate(fromToken, toToken, parsedAmount);
        
        if (estimate && estimate.estimatedAmount !== undefined) {
          setEstimatedAmount(estimate.estimatedAmount);
          setRouteProvider(estimate.provider ?? SwapProvider.Contract);
          
          // Store route information for display
          if (estimate.routeInfo && estimate.routeInfo.length > 0) {
            console.log('Route info:', estimate.routeInfo);
            const routeInfoData = estimate.routeInfo;
            setSwapEstimate({
              ...estimate,
              routeInfo: routeInfoData
            });
          } else {
            setSwapEstimate(estimate);
          }
        } else {
          setEstimatedAmount(null);
          setSwapEstimate(null);
          console.error('Failed to get estimate');
        }
      } catch (error) {
        console.error('Error getting swap estimate:', error);
        setEstimatedAmount(null);
        setSwapEstimate(null);
      } finally {
        setEstimateLoading(false);
      }
    };
    
    getEstimate();
  }, [fromToken, toToken, amount]);
  
  // Fetch token balances from the blockchain when the wallet or tokens change
  useEffect(() => {
    async function fetchTokenBalances() {
      if (!walletConnected || !wallet?.publicKey) {
        setFromTokenBalance(null);
        setToTokenBalance(null);
        return;
      }
      
      setBalanceLoading(true);
      
      try {
        // Fetch balances for both tokens
        if (fromToken) {
          const balance = await getTokenBalance(wallet.publicKey.toString(), fromToken.address);
          setFromTokenBalance(balance);
          console.log(`Fetched ${fromToken.symbol} balance: ${balance}`);
        }
        
        if (toToken) {
          const balance = await getTokenBalance(wallet.publicKey.toString(), toToken.address);
          setToTokenBalance(balance);
          console.log(`Fetched ${toToken.symbol} balance: ${balance}`);
        }
      } catch (error) {
        console.error('Error fetching token balances:', error);
      } finally {
        setBalanceLoading(false);
      }
    }
    
    fetchTokenBalances();
  }, [walletConnected, wallet?.publicKey, fromToken?.address, toToken?.address]);
  
  // Simulate fetching available rewards
  useEffect(() => {
    if (walletConnected && wallet?.publicKey) {
      // In a real app, we would fetch rewards from the blockchain
      setAvailableRewards(0.75); // Example: 0.75 YOS tokens available
    } else {
      setAvailableRewards(0);
    }
  }, [walletConnected, wallet?.publicKey]);
  
  const handleSwapClick = async () => {
    if (!walletConnected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to continue',
        variant: 'destructive'
      });
      return;
    }
    
    if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0) {
      toast({
        title: 'Invalid input',
        description: 'Please enter a valid amount and select tokens',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      setLoading(true);
      const parsedAmount = parseFloat(amount);
      const signature = await executeMultiHubSwap(
        wallet,
        fromToken,
        toToken,
        parsedAmount,
        slippage / 100
      );
      
      // Transaction signature means success
      if (signature) {
        toast({
          title: 'Swap successful',
          description: `Swapped ${parsedAmount} ${fromToken.symbol} to approximately ${estimatedAmount?.toFixed(4)} ${toToken.symbol}`,
          variant: 'default'
        });
      } else {
        toast({
          title: 'Swap failed',
          description: 'Unknown error occurred',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error executing swap:', error);
      toast({
        title: 'Swap failed',
        description: 'An error occurred while processing the swap',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleClaimRewards = async () => {
    if (!walletConnected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to continue',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      setClaimLoading(true);
      const signature = await claimYosSwapRewards(wallet);
      
      if (signature) {
        toast({
          title: 'Rewards claimed successfully',
          description: `Your YOS rewards have been transferred to your wallet`,
          variant: 'default'
        });
        setAvailableRewards(0);
      } else {
        toast({
          title: 'Failed to claim rewards',
          description: 'Unknown error occurred',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error claiming rewards:', error);
      toast({
        title: 'Failed to claim rewards',
        description: 'An error occurred while claiming your rewards',
        variant: 'destructive'
      });
    } finally {
      setClaimLoading(false);
    }
  };
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only allow numbers and one decimal point
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setAmount(value);
    }
  };
  
  const handleSlippageChange = (newSlippage: number) => {
    setSlippage(newSlippage);
  };
  
  // Helper function to format token logo URL
  const getTokenLogo = (token: any) => {
    return token?.logoURI || 'https://cryptologos.cc/logos/solana-sol-logo.png?v=024';
  };
  
  return (
    <Card className="w-full max-w-md bg-background shadow-lg border-border">
      <CardHeader>
        <CardTitle className="text-2xl">Multi-Hub Swap</CardTitle>
        <CardDescription>Swap tokens on Solana with multi-hub routing and liquidity contribution</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* From Token */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium">From</label>
            <label className="text-sm text-muted-foreground">
              Balance: {
                walletConnected 
                  ? balanceLoading 
                    ? <Loader2 className="h-3 w-3 inline animate-spin ml-1" /> 
                    : formatTokenBalance(fromTokenBalance)
                  : 'Connect wallet'
              }
            </label>
          </div>
          
          <div className="flex space-x-2">
            <div className="flex-1">
              <Input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="0.0"
              />
            </div>
            
            <div className="w-32">
              <TokenSearchInput
                selectedToken={fromToken}
                onSelect={setFromToken}
                excludeTokens={toToken ? [toToken.address] : []}
                provider={routeProvider}
              />
            </div>
          </div>
        </div>
        
        {/* Swap Icon */}
        <div className="flex justify-center py-2">
          <div className="bg-muted/50 p-2 rounded-full">
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        
        {/* To Token */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium">To (estimated)</label>
            <label className="text-sm text-muted-foreground">
              Balance: {
                walletConnected 
                  ? balanceLoading 
                    ? <Loader2 className="h-3 w-3 inline animate-spin ml-1" /> 
                    : formatTokenBalance(toTokenBalance)
                  : 'Connect wallet'
              }
            </label>
          </div>
          
          <div className="flex space-x-2">
            <div className="flex-1 px-3 py-2 bg-muted border border-border rounded-md">
              {estimateLoading ? (
                <div className="flex items-center justify-center h-5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <span>{estimatedAmount !== null ? estimatedAmount.toFixed(4) : '0.0'}</span>
              )}
            </div>
            
            <div className="w-32">
              <TokenSearchInput
                selectedToken={toToken}
                onSelect={setToToken}
                excludeTokens={fromToken ? [fromToken.address] : []}
                provider={routeProvider}
              />
            </div>
          </div>
        </div>
        
        {/* Swap Details */}
        <div className="bg-muted/30 rounded-md p-3 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Route Provider</span>
            <div className="flex space-x-1">
              {[
                { id: SwapProvider.Contract, name: 'YOT' },
                { id: SwapProvider.Raydium, name: 'Raydium' },
                { id: SwapProvider.Jupiter, name: 'Jupiter' }
              ].map((provider) => (
                <button
                  key={provider.id}
                  onClick={async () => {
                    // First directly set the UI state
                    setRouteProvider(provider.id);
                    
                    // Then recalculate the estimate with the chosen provider
                    try {
                      setEstimateLoading(true);
                      if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0) return;
                      
                      const parsedAmount = parseFloat(amount);
                      console.log(`Getting estimate with provider: ${provider.id}`);
                      
                      const estimate = await getMultiHubSwapEstimate(
                        fromToken, 
                        toToken, 
                        parsedAmount,
                        slippage / 100, 
                        provider.id
                      );
                      
                      if (estimate && estimate.estimatedAmount !== undefined) {
                        setEstimatedAmount(estimate.estimatedAmount);
                        setSwapEstimate(estimate);
                        // Don't override the provider we just set
                        //setRouteProvider(estimate.provider ?? SwapProvider.Contract);
                      }
                    } catch (error) {
                      console.error(`Error getting estimate with provider ${provider.id}:`, error);
                    } finally {
                      setEstimateLoading(false);
                    }
                  }}
                  className={`px-2 py-0.5 text-xs rounded-md ${
                    routeProvider === provider.id
                      ? 'bg-primary text-white'
                      : 'bg-muted hover:bg-primary/20'
                  }`}
                >
                  {provider.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* Route Visualization */}
          {swapEstimate?.routeInfo && swapEstimate.routeInfo.length > 0 && (
            <div className="py-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <span className="text-muted-foreground">Order Routing</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs w-72">
                          The exact path your tokens will take through different liquidity pools. 
                          Multi-hop routes may use multiple pools to achieve better prices or enable 
                          trading pairs that don't have direct liquidity.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded-sm">
                  {swapEstimate.routeInfo.length} {swapEstimate.routeInfo.length === 1 ? 'hop' : 'hops'}
                </span>
              </div>
              
              <div className="flex flex-col space-y-3 mt-2 mb-1">
                {swapEstimate.routeInfo.map((route: { 
                  percent?: number; 
                  label?: string; 
                  ammId?: string; 
                  marketId?: string;
                  inputMint?: string;
                  outputMint?: string;
                  marketName?: string;
                }, index: number) => (
                  <div key={index} className="relative">
                    {/* Enhanced route node with more details */}
                    <div className="bg-background border border-border rounded-md p-2 relative hover:border-primary/50 transition-colors">
                      {/* Route percentage badge - positioned better */}
                      {route.percent && route.percent < 100 && (
                        <div className="absolute -top-2 -right-2 rounded-full bg-primary/20 text-primary text-xs font-semibold px-1.5 py-0.5 shadow-sm border border-primary/30">
                          {route.percent}%
                        </div>
                      )}
                      
                      {/* Route number badge */}
                      <div className="absolute -left-2 -top-2 w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-medium shadow-sm">
                        {index + 1}
                      </div>
                    
                      {/* Route information with improved layout */}
                      <div className="ml-3 flex flex-col">
                        {/* Route label with market name in badge */}
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">
                            {route.label || `${fromToken.symbol} → ${toToken.symbol}`}
                          </div>
                          
                          {route.marketName && (
                            <div className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-sm font-medium">
                              {route.marketName}
                            </div>
                          )}
                        </div>
                        
                        {/* Enhanced details with tooltips */}
                        <div className="flex items-center justify-between mt-1.5 gap-2">
                          {/* AMM ID with tooltip */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="cursor-help group">
                                <div className="flex items-center text-[10px] text-muted-foreground">
                                  <span className="mr-1">AMM:</span>
                                  <code className="bg-muted/30 px-1.5 py-0.5 rounded-sm group-hover:bg-muted/50">
                                    {route.ammId ? (route.ammId.length > 12 ? 
                                      `${route.ammId.substring(0, 6)}...${route.ammId.substring(route.ammId.length - 4)}` : 
                                      route.ammId) : 'Unknown'}
                                  </code>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">Automated Market Maker ID: {route.ammId || 'Unknown'}</p>
                                <p className="text-xs mt-1 text-muted-foreground">This identifies the specific liquidity pool that your swap will route through.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          {/* Price impact estimate */}
                          {index === 0 && swapEstimate.priceImpact && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="cursor-help">
                                  <div className="text-[10px] px-1.5 py-0.5 rounded-sm font-medium bg-orange-500/10 text-orange-600">
                                    Impact: {(swapEstimate.priceImpact * 100).toFixed(2)}%
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p className="text-xs">Price impact measures how much your trade affects the market price.</p>
                                  <p className="text-xs mt-1 text-muted-foreground">Lower is better. High impact means you're getting a worse price due to the size of your trade.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        
                        {/* Additional details when available */}
                        {(route.marketId || route.inputMint || route.outputMint) && (
                          <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1.5">
                            {/* Market ID */}
                            {route.marketId && (
                              <div className="text-[10px] text-muted-foreground">
                                <span className="mr-1">Market:</span>
                                <code className="bg-muted/30 px-1 py-0.5 rounded-sm">
                                  {route.marketId.length > 8 ? 
                                    `${route.marketId.substring(0, 4)}...${route.marketId.substring(route.marketId.length - 4)}` : 
                                    route.marketId}
                                </code>
                              </div>
                            )}
                            
                            {/* Input/Output currency mini-badges */}
                            {route.inputMint && route.outputMint && (
                              <div className="text-[10px] text-muted-foreground flex items-center ml-auto">
                                <span className="bg-blue-500/10 text-blue-600 px-1 py-0.5 rounded-sm">
                                  In: {route.inputMint.substring(0, 4)}...
                                </span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="mx-0.5">
                                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <span className="bg-green-500/10 text-green-600 px-1 py-0.5 rounded-sm">
                                  Out: {route.outputMint.substring(0, 4)}...
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Animated arrow connector */}
                    {index < swapEstimate.routeInfo.length - 1 && (
                      <div className="flex justify-center py-1">
                        <div className="w-6 h-6 flex items-center justify-center rounded-full bg-muted">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-primary animate-pulse">
                            <path d="M12 5v14M19 12l-7 7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Additional summary info when we have a swap estimate */}
          {swapEstimate && (
            <div className="border border-border rounded-md p-2 mt-1 mb-1 bg-background/50">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {/* Fee summary */}
                <div className="flex items-center space-x-1">
                  <svg className="h-3 w-3 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12l2 2 4-4" />
                  </svg>
                  <span className="text-muted-foreground">
                    Network fee: <span className="font-medium">{swapEstimate.fee ? `${(swapEstimate.fee * 100).toFixed(2)}%` : '~0.3%'}</span>
                  </span>
                </div>
                
                {/* Route efficiency */}
                <div className="flex items-center space-x-1 justify-end">
                  <span className="text-muted-foreground flex items-center">
                    Route: 
                    <span className={`ml-1 font-medium ${
                      swapEstimate.routeInfo && swapEstimate.routeInfo.length === 1 
                        ? 'text-green-500' 
                        : 'text-amber-500'
                    }`}>
                      {swapEstimate.routeInfo && swapEstimate.routeInfo.length === 1 ? 'Direct' : 'Multi-hop'}
                    </span>
                  </span>
                </div>
                
                {/* Price impact warning if it's high */}
                {swapEstimate.priceImpact && swapEstimate.priceImpact > 0.05 && (
                  <div className="col-span-2 flex items-center space-x-1 mt-1">
                    <svg className="h-3 w-3 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span className="text-amber-500">
                      High price impact: {(swapEstimate.priceImpact * 100).toFixed(2)}% - your trade significantly affects market price
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Slippage Tolerance</span>
            <div className="flex space-x-1">
              {[0.5, 1, 2].map((value) => (
                <button
                  key={value}
                  onClick={() => handleSlippageChange(value)}
                  className={`px-2 py-0.5 text-xs rounded-md ${
                    slippage === value
                      ? 'bg-primary text-white'
                      : 'bg-muted hover:bg-primary/20'
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground flex items-center">
              Liquidity Contribution
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 ml-1 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      20% of your swap amount goes to the SOL-YOT liquidity pool,
                      improving liquidity for all users.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
            <span className="font-medium">20%</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground flex items-center">
              YOS Cashback
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 ml-1 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      5% of your swap amount is converted to YOS tokens as cashback rewards.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
            <span className="font-medium">5%</span>
          </div>
        </div>
        
        {/* YOS Rewards */}
        {walletConnected && availableRewards > 0 && (
          <div className="bg-primary/10 border border-primary/20 rounded-md p-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium text-primary">Available YOS Rewards</h4>
                <p className="text-sm text-muted-foreground">
                  {availableRewards.toFixed(4)} YOS can be claimed
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClaimRewards}
                disabled={claimLoading}
              >
                {claimLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Claiming
                  </>
                ) : (
                  'Claim'
                )}
              </Button>
            </div>
          </div>
        )}
        
        {/* Warning about slippage and price impact - only when needed */}
        {estimatedAmount !== null && estimatedAmount > 0 && slippage < 1 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 flex items-start space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Your slippage tolerance is set to {slippage}%. For larger swaps, consider increasing
              your slippage tolerance to ensure the transaction succeeds.
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        <Button
          className="w-full"
          size="lg"
          onClick={walletConnected ? handleSwapClick : () => connect()}
          disabled={walletConnected && (loading || !estimatedAmount || estimatedAmount <= 0)}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Swapping...
            </>
          ) : !walletConnected ? (
            "Connect Wallet"
          ) : !estimatedAmount || estimatedAmount <= 0 ? (
            "Enter an amount"
          ) : (
            `Swap ${fromToken.symbol} to ${toToken.symbol}`
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}