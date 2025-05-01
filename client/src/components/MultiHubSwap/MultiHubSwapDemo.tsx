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
  
  // Generate a test swap estimate to showcase route info visualization for the demo
  useEffect(() => {
    const generateDemoRouteInfo = async () => {
      if (!amount || parseFloat(amount) <= 0) {
        // Only generate demo data for display purposes
        // In a real app, we'd wait for a user-entered amount
        
        const testEstimate = {
          estimatedAmount: 165325.48953,
          minAmountOut: 163672.23463,
          priceImpact: 0.0325,
          fee: 0.025,
          routes: ["SOL", "YOT"],
          routeInfo: [
            {
              label: "SOL→YOT",
              ammId: "jupiter-direct-soljup928",
              marketId: "DZjbn4XC8qoHKikZqzmhemykVzmossoayV9ffbsUqxVj",
              percent: 100,
              inputMint: "So11111111111111111111111111111111111111112",
              outputMint: "2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF",
              marketName: "Jupiter"
            }
          ],
          provider: SwapProvider.Jupiter
        };
        
        // Set demo data for UI display
        if (!swapEstimate) {
          setSwapEstimate(testEstimate);
        }
      }
    };
    
    generateDemoRouteInfo();
  }, [amount, swapEstimate]);
  
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
    <Card className="w-full max-w-md bg-[#0f1421] shadow-xl border-[#1e2a45]">
      <CardHeader className="bg-gradient-to-br from-[#1e2a45] to-[#0f1421] border-b border-[#1e2a45] pb-4">
        <CardTitle className="text-2xl font-bold text-white flex items-center">
          <div className="mr-2 p-1.5 bg-gradient-to-br from-primary to-[#7043f9] rounded-lg">
            <ArrowRightLeft className="h-5 w-5 text-white" />
          </div>
          Multi-Hub Swap
        </CardTitle>
        <CardDescription className="text-[#a3accd]">Swap tokens on Solana with multi-hub routing and liquidity contribution</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4 px-5 py-4">
        {/* From Token */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-[#a3accd]">From</label>
            <label className="text-sm text-[#7d8ab1]">
              Balance: {
                walletConnected 
                  ? balanceLoading 
                    ? <Loader2 className="h-3 w-3 inline animate-spin ml-1" /> 
                    : <span className="font-medium text-[#a3accd]">{formatTokenBalance(fromTokenBalance)}</span>
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
                className="w-full px-3 py-2 bg-[#141c2f] border border-[#1e2a45] rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
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
          <div className="bg-[#1e2a45] p-2 rounded-full hover:bg-primary/20 cursor-pointer transition-colors">
            <ArrowRightLeft className="h-5 w-5 text-[#a3accd]" />
          </div>
        </div>
        
        {/* To Token */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-[#a3accd]">To (estimated)</label>
            <div className="flex items-center space-x-2">
              {!swapEstimate?.routeInfo && (
                <button
                  className="text-xs px-1.5 py-0.5 rounded bg-[#2a3553] text-primary hover:bg-[#2d3a66] transition-colors"
                  onClick={() => {
                    // Create a test multi-hop route example
                    const testMultiHopEstimate = {
                      estimatedAmount: 165325.48953,
                      minAmountOut: 163672.23463,
                      priceImpact: 0.0453,
                      fee: 0.025,
                      routes: ["SOL", "USDC", "YOT"],
                      routeInfo: [
                        {
                          label: "SOL→USDC",
                          ammId: "raydium-sol-usdc-pool-v4",
                          marketId: "DZjbn4XC8qoHKikZqzmhemykVzmossoayV9ffbsUqxVj",
                          percent: 100,
                          inputMint: "So11111111111111111111111111111111111111112",
                          outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                          marketName: "Raydium"
                        },
                        {
                          label: "USDC→YOT",
                          ammId: "jupiter-usdc-yot-lp-v3",
                          marketId: "8HSsSqcZG5gJaGLwX9nja4vr968qmVgWmqYsNoJNPPUZ",
                          percent: 100,
                          inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                          outputMint: "2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF",
                          marketName: "Jupiter"
                        }
                      ],
                      provider: SwapProvider.Jupiter
                    };
                    
                    setSwapEstimate(testMultiHopEstimate);
                  }}
                >
                  Demo Routes
                </button>
              )}
              <label className="text-sm text-[#7d8ab1]">
                Balance: {
                  walletConnected 
                    ? balanceLoading 
                      ? <Loader2 className="h-3 w-3 inline animate-spin ml-1" /> 
                      : <span className="font-medium text-[#a3accd]">{formatTokenBalance(toTokenBalance)}</span>
                    : 'Connect wallet'
                }
              </label>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <div className="flex-1 px-3 py-2 bg-[#141c2f] border border-[#1e2a45] rounded-md text-white">
              {estimateLoading ? (
                <div className="flex items-center justify-center h-5">
                  <Loader2 className="h-4 w-4 animate-spin text-[#a3accd]" />
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
        <div className="bg-[#141c2f] rounded-md p-4 space-y-3 text-sm border border-[#1e2a45]">
          <div className="flex justify-between items-center">
            <span className="text-[#7d8ab1]">Route Provider</span>
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
                      ? 'bg-gradient-to-r from-primary to-[#7043f9] text-white shadow-sm'
                      : 'bg-[#1e2a45] text-[#a3accd] hover:bg-[#252f4a]'
                  }`}
                >
                  {provider.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* Route Visualization */}
          {swapEstimate?.routeInfo && swapEstimate.routeInfo.length > 0 && (
            <div className="py-1 mt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <span className="text-[#7d8ab1]">Order Routing</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">
                        <Info className="h-3 w-3 text-[#7d8ab1]" />
                      </TooltipTrigger>
                      <TooltipContent className="bg-[#1e2a45] border-[#2a3553] text-[#a3accd]">
                        <p className="text-xs w-72">
                          The exact path your tokens will take through different liquidity pools. 
                          Multi-hop routes may use multiple pools to achieve better prices or enable 
                          trading pairs that don't have direct liquidity.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-[10px] text-[#a3accd] bg-[#1e2a45] px-1.5 py-0.5 rounded-sm">
                  {swapEstimate.routeInfo.length} {swapEstimate.routeInfo.length === 1 ? 'hop' : 'hops'}
                </span>
              </div>
              
              <div className="mt-2 mb-1 bg-[#0f1421] border border-[#1e2a45] rounded-lg overflow-hidden shadow-md">
                {swapEstimate.routeInfo.map((route: { 
                  percent?: number; 
                  label?: string; 
                  ammId?: string; 
                  marketId?: string;
                  inputMint?: string;
                  outputMint?: string;
                  marketName?: string;
                }, index: number) => (
                  <div key={index} className={`${index !== 0 ? 'border-t border-[#1e2a45]' : ''}`}>
                    <div className="p-3 relative hover:bg-[#141c2f] transition-colors">
                      {/* Route number badge - smaller and inset */}
                      <div className="absolute left-3 top-3 w-5 h-5 rounded-full bg-gradient-to-br from-primary to-[#7043f9] text-white text-xs flex items-center justify-center font-medium shadow-md">
                        {index + 1}
                      </div>
                      
                      {/* Route information with cleaner layout */}
                      <div className="ml-8 flex flex-col">
                        {/* Route header with route name and badges */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-white">
                              {route.label || `${fromToken.symbol} → ${toToken.symbol}`}
                            </div>
                            
                            {route.percent && route.percent < 100 && (
                              <div className="ml-2 rounded bg-primary/20 text-primary text-xs font-semibold px-1.5 py-0.5">
                                {route.percent}%
                              </div>
                            )}
                          </div>
                          
                          {route.marketName && (
                            <div className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-sm font-medium">
                              {route.marketName}
                            </div>
                          )}
                        </div>
                        
                        {/* Price impact if available */}
                        {index === 0 && swapEstimate.priceImpact && (
                          <div className="mt-1 text-[10px] text-[#7d8ab1]">
                            <span>Price Impact: </span>
                            <span className={`font-medium ${(swapEstimate.priceImpact * 100) > 5 ? 'text-orange-400' : 'text-green-400'}`}>
                              {(swapEstimate.priceImpact * 100).toFixed(2)}%
                            </span>
                          </div>
                        )}
                        
                        {/* Route details in row */}
                        <div className="grid grid-cols-2 gap-x-3 mt-2">
                          {/* AMM ID column */}
                          <div className="flex flex-col">
                            <span className="text-[10px] text-[#7d8ab1] mb-0.5">AMM Pool ID:</span>
                            <a 
                              href={route.ammId ? `https://explorer.solana.com/address/${route.ammId}?cluster=devnet` : '#'} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={(e) => route.ammId ? e.stopPropagation() : e.preventDefault()}
                              className="flex items-center bg-[#141c2f] border border-[#1e2a45] px-1.5 py-1 rounded text-[10px] text-[#a3accd] hover:text-primary hover:bg-[#1a2338] transition-colors"
                            >
                              <code>
                                {route.ammId ? (route.ammId.length > 12 ? 
                                  `${route.ammId.substring(0, 6)}...${route.ammId.substring(route.ammId.length - 4)}` : 
                                  route.ammId) : 'Unknown'}
                              </code>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="ml-1 opacity-70">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                              </svg>
                            </a>
                          </div>
                          
                          {/* Token paths column */}
                          <div className="flex flex-col">
                            <span className="text-[10px] text-[#7d8ab1] mb-0.5">Route Tokens:</span>
                            <div className="flex items-center">
                              {route.inputMint && route.outputMint && (
                                <div className="flex items-center text-[10px] bg-[#141c2f] border border-[#1e2a45] p-1 rounded">
                                  <a 
                                    href={`https://explorer.solana.com/address/${route.inputMint}?cluster=devnet`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-sm hover:bg-blue-500/20 transition-colors flex items-center"
                                  >
                                    {route.inputMint.substring(0, 4)}...
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="ml-0.5 opacity-70">
                                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                      <polyline points="15 3 21 3 21 9"></polyline>
                                      <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                  </a>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="mx-1 text-[#7d8ab1]">
                                    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  <a 
                                    href={`https://explorer.solana.com/address/${route.outputMint}?cluster=devnet`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded-sm hover:bg-green-500/20 transition-colors flex items-center"
                                  >
                                    {route.outputMint.substring(0, 4)}...
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="ml-0.5 opacity-70">
                                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                      <polyline points="15 3 21 3 21 9"></polyline>
                                      <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Market ID if available */}
                        {route.marketId && (
                          <div className="mt-1.5 text-[10px] text-[#7d8ab1]">
                            <span>Market: </span>
                            <a 
                              href={`https://explorer.solana.com/address/${route.marketId}?cluster=devnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-[#141c2f] px-1.5 py-0.5 rounded-sm text-[#a3accd] hover:text-primary transition-colors inline-flex items-center"
                            >
                              {route.marketId.length > 8 ? 
                                `${route.marketId.substring(0, 4)}...${route.marketId.substring(route.marketId.length - 4)}` : 
                                route.marketId}
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="ml-0.5 opacity-70">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                              </svg>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Connector between routes */}
                    {index < swapEstimate.routeInfo.length - 1 && (
                      <div className="flex justify-center py-1 bg-[#141c2f]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-primary">
                          <path d="M12 5v14M19 12l-7 7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Additional summary info when we have a swap estimate */}
          {swapEstimate && (
            <div className="mt-3 mb-2 bg-[#0f1421] border border-[#1e2a45] rounded-lg overflow-hidden shadow-md p-3">
              <h3 className="text-sm font-semibold text-white mb-2">Swap Summary</h3>
              
              <div className="space-y-1.5">
                {/* Fee summary row */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#7d8ab1]">Network Fee</span>
                  <span className="text-sm font-medium text-white">
                    {swapEstimate.fee ? `${(swapEstimate.fee * 100).toFixed(2)}%` : '~0.3%'}
                  </span>
                </div>
                
                {/* Route efficiency row */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#7d8ab1]">Route Type</span>
                  <span className={`text-sm font-medium ${
                    swapEstimate.routeInfo && swapEstimate.routeInfo.length === 1 
                      ? 'text-green-400' 
                      : 'text-amber-400'
                  }`}>
                    {swapEstimate.routeInfo && swapEstimate.routeInfo.length === 1 ? 'Direct' : 'Multi-hop'}
                  </span>
                </div>
                
                {/* Price impact row */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#7d8ab1]">Price Impact</span>
                  <span className={`text-sm font-medium ${
                    swapEstimate.priceImpact && swapEstimate.priceImpact > 0.05 
                      ? 'text-orange-400' 
                      : 'text-green-400'
                  }`}>
                    {swapEstimate.priceImpact ? `${(swapEstimate.priceImpact * 100).toFixed(2)}%` : '0.00%'}
                  </span>
                </div>
                
                {/* Minimum received */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#7d8ab1]">Minimum Received</span>
                  <span className="text-sm font-medium text-white">
                    {swapEstimate.minAmountOut ? swapEstimate.minAmountOut.toFixed(4) : '0.00'} {toToken?.symbol || ''}
                  </span>
                </div>
                
                {/* Warning if price impact is high */}
                {swapEstimate.priceImpact && swapEstimate.priceImpact > 0.05 && (
                  <div className="mt-2 bg-orange-500/10 border border-orange-500/20 rounded-md p-2 flex items-start space-x-2">
                    <svg className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span className="text-xs text-[#a3accd]">
                      High price impact of {(swapEstimate.priceImpact * 100).toFixed(2)}% may result in a less favorable rate for your trade
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Settings section styled like stats box */}
          <div className="mt-3 mb-2 bg-[#0f1421] border border-[#1e2a45] rounded-lg overflow-hidden shadow-md">
            <div className="p-3 pb-2 border-b border-[#1e2a45]">
              <h3 className="text-sm font-semibold text-white">Swap Settings</h3>
            </div>
            
            <div className="p-3 space-y-4">
              {/* Slippage Tolerance section */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-[#7d8ab1] flex items-center">
                    Slippage Tolerance
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 ml-1 text-[#7d8ab1]" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#1e2a45] border-[#2a3553] text-[#a3accd]">
                          <p className="max-w-xs text-xs">
                            The maximum difference between the expected and actual execution price.
                            Higher values increase success rate but may result in less favorable prices.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <span className="text-sm font-medium text-primary">{slippage}%</span>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {[0.5, 1, 2].map((value) => (
                    <button
                      key={value}
                      onClick={() => handleSlippageChange(value)}
                      className={`py-1.5 text-xs rounded-md flex justify-center ${
                        slippage === value
                          ? 'bg-gradient-to-r from-primary to-[#7043f9] text-white font-medium shadow-sm'
                          : 'bg-[#1e2a45] text-[#a3accd] hover:bg-[#252f4a]'
                      }`}
                    >
                      {value}%
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Contribution Features */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#7d8ab1] flex items-center">
                    Liquidity Contribution
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 ml-1 text-[#7d8ab1]" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#1e2a45] border-[#2a3553] text-[#a3accd]">
                          <p className="max-w-xs text-xs">
                            20% of your swap amount goes to the SOL-YOT liquidity pool,
                            improving liquidity for all users and ensuring long-term stability.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <span className="text-sm font-medium text-white">20%</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#7d8ab1] flex items-center">
                    YOS Cashback
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 ml-1 text-[#7d8ab1]" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#1e2a45] border-[#2a3553] text-[#a3accd]">
                          <p className="max-w-xs text-xs">
                            5% of your swap amount is converted to YOS tokens as cashback rewards.
                            These tokens can be claimed from your rewards balance.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <span className="text-sm font-medium text-white">5%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* YOS Rewards */}
        {walletConnected && availableRewards > 0 && (
          <div className="mt-3 mb-2 bg-[#0f1421] border border-[#1e2a45] rounded-lg overflow-hidden shadow-md">
            <div className="p-3 pb-2 border-b border-[#1e2a45]">
              <h3 className="text-sm font-semibold text-white">Available YOS Rewards</h3>
            </div>
            
            <div className="p-3">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[#7043f9] flex items-center justify-center mr-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="8" />
                      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{availableRewards.toFixed(4)} YOS</p>
                    <p className="text-xs text-[#7d8ab1]">Ready to claim</p>
                  </div>
                </div>
                <Button
                  className="bg-gradient-to-r from-primary to-[#7043f9] text-white border-none hover:from-[#7043f9] hover:to-primary shadow-md"
                  size="sm"
                  onClick={handleClaimRewards}
                  disabled={claimLoading}
                >
                  {claimLoading ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    'Claim Rewards'
                  )}
                </Button>
              </div>
              
              <div className="text-xs text-[#7d8ab1] bg-[#141c2f] p-2 rounded border border-[#1e2a45]">
                <p className="flex items-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                  Claiming rewards will transfer YOS tokens to your wallet for staking or trading.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Warning about slippage and price impact - only when needed */}
        {estimatedAmount !== null && estimatedAmount > 0 && slippage < 1 && (
          <div className="bg-[#2a2e1d] border border-[#f0c52b33] rounded-lg p-3 flex items-start space-x-2 mt-3 mb-2">
            <AlertTriangle className="h-5 w-5 text-[#f0c52b] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#a3accd]">
              Your slippage tolerance is set to {slippage}%. For larger swaps, consider increasing
              your slippage tolerance to ensure the transaction succeeds.
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="bg-[#0f1624] pt-4 pb-5 border-t border-[#1e2a45]">
        <Button
          className="w-full h-12 text-base font-medium bg-gradient-to-r from-primary to-[#7043f9] hover:from-[#7043f9] hover:to-primary text-white border-none shadow-lg"
          onClick={walletConnected ? handleSwapClick : () => connect()}
          disabled={walletConnected && (loading || !estimatedAmount || estimatedAmount <= 0)}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
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