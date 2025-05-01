import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ArrowRightLeft, AlertTriangle, Info, Loader2, ArrowRight } from 'lucide-react';
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
        }
        
        if (toToken) {
          const balance = await getTokenBalance(wallet.publicKey.toString(), toToken.address);
          setToTokenBalance(balance);
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
  
  // Generate a real swap estimate using actual blockchain data
  useEffect(() => {
    const generateAccurateRouteInfo = async () => {
      try {
        // Use real-time blockchain data for calculating swap estimates
        const sol = defaultTokens.find(t => t.symbol === 'SOL');
        const yot = defaultTokens.find(t => t.symbol === 'YOT');
        
        if (!sol || !yot) {
          console.error("Could not find SOL or YOT token in the default tokens list");
          return;
        }
        
        // Input amount - if user has entered a value, use it; otherwise use 1 SOL
        const inputAmount = amount && parseFloat(amount) > 0 ? parseFloat(amount) : 1.0;
        
        console.log(`Fetching exchange rate for ${inputAmount} SOL to YOT using real blockchain data...`);
        
        // Get real-time estimate from the blockchain
        const realTimeEstimate = await getMultiHubSwapEstimate(sol, yot, inputAmount);
        
        if (realTimeEstimate && realTimeEstimate.estimatedAmount) {
          console.log(`Real-time blockchain data: ${inputAmount} SOL = ${realTimeEstimate.estimatedAmount.toFixed(2)} YOT`);
          
          // If user hasn't entered their own amount or there's no existing estimate, update the UI
          if (!swapEstimate || (!amount || parseFloat(amount) <= 0)) {
            setEstimatedAmount(realTimeEstimate.estimatedAmount);
            setSwapEstimate(realTimeEstimate);
          }
        } else {
          console.error("Failed to get valid estimate from blockchain");
        }
      } catch (error) {
        console.error("Error fetching real-time blockchain rates:", error);
      }
    };
    
    // Execute immediately
    generateAccurateRouteInfo();
    
    // Then set up an interval to refresh every 10 seconds if the user isn't actively trading
    const refreshInterval = setInterval(() => {
      if (!amount || parseFloat(amount) <= 0) {
        generateAccurateRouteInfo();
      }
    }, 10000);
    
    // Clean up interval on unmount
    return () => clearInterval(refreshInterval);
  }, [defaultTokens]);
  
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
    <div className="space-y-4 w-full">
      {/* Main Swap Card */}
      <Card className="w-full bg-[#0f1421] shadow-xl border-[#1e2a45]">
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
                            Multi-hop routing can result in better rates for your swap.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                
                {/* Route Steps */}
                <div className="mt-2 space-y-2">
                  {swapEstimate.routeInfo.map((route: any, index: number) => (
                    <div key={index} className="bg-[#1a2338] p-2 rounded border border-[#1e2a45] flex items-center justify-between">
                      <div className="flex flex-col">
                        <div className="flex items-center text-[#a3accd]">
                          <span className="text-xs">{route.label}</span>
                        </div>
                        <div className="flex items-center space-x-1 mt-1">
                          <a 
                            href={`https://explorer.solana.com/address/${route.ammId}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-[#7d8ab1] hover:text-primary"
                          >
                            AMM: {route.ammId.substring(0, 8)}...
                          </a>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end text-xs">
                        <span className="text-[#a3accd]">{route.marketName}</span>
                        <div className="flex items-center mt-1">
                          <a 
                            href={`https://explorer.solana.com/address/${route.inputMint}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-[#7d8ab1] hover:text-primary"
                          >
                            In: {route.inputMint.substring(0, 4)}...
                          </a>
                          <ArrowRight className="mx-1 h-2 w-2 text-[#7d8ab1]" />
                          <a 
                            href={`https://explorer.solana.com/address/${route.outputMint}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-[#7d8ab1] hover:text-primary"
                          >
                            Out: {route.outputMint.substring(0, 4)}...
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-[#7d8ab1]">Estimated Rate</span>
              <span className="text-[#a3accd]">
                1 {fromToken?.symbol} ≈ {formatNumber(estimatedAmount && parseFloat(amount) > 0 ? estimatedAmount / parseFloat(amount) : 0)} {toToken?.symbol}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-[#7d8ab1]">Price Impact</span>
              <span className={`${(swapEstimate?.priceImpact || 0) > 5 ? 'text-red-400' : 'text-[#a3accd]'}`}>
                {formatNumber((swapEstimate?.priceImpact || 0) * 100, 2)}%
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-[#7d8ab1]">Minimum Received</span>
              <span className="text-[#a3accd]">
                {formatNumber(swapEstimate?.minAmountOut || 0)} {toToken?.symbol}
              </span>
            </div>
            
            <div className="flex justify-between">
              <div className="flex items-center space-x-1">
                <span className="text-[#7d8ab1]">Slippage Tolerance</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="cursor-help">
                      <Info className="h-3 w-3 text-[#7d8ab1]" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-[#1e2a45] border-[#2a3553] text-[#a3accd]">
                      <p className="text-xs w-64">
                        Your transaction will revert if the price changes unfavorably by more than this percentage.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-40">
                  <Slider
                    value={[slippage]}
                    min={0.1}
                    max={5}
                    step={0.1}
                    onValueChange={(value) => handleSlippageChange(value[0])}
                    className="w-full"
                  />
                </div>
                <span className="text-[#a3accd] w-12 text-right">{slippage.toFixed(1)}%</span>
              </div>
            </div>
            
            {/* Contribution Info */}
            <div className="flex justify-between">
              <div className="flex items-center space-x-1">
                <span className="text-[#7d8ab1]">YOT-SOL Contribution</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="cursor-help">
                      <Info className="h-3 w-3 text-[#7d8ab1]" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-[#1e2a45] border-[#2a3553] text-[#a3accd]">
                      <p className="text-xs w-64">
                        20% of your transaction is automatically contributed to the SOL-YOT liquidity pool. 
                        You'll receive YOS tokens as a cashback reward.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="text-[#a3accd]">20%</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-[#7d8ab1]">YOS Cashback</span>
              <span className="text-green-400">~{formatNumber((swapEstimate?.fee || 0) * 25)} YOS</span>
            </div>
            
            {swapEstimate && (swapEstimate.priceImpact || 0) > 5 && (
              <div className="bg-red-900/20 border border-red-500/20 rounded-md p-2 mt-2 flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs text-red-300">
                  <p className="font-medium">High price impact!</p>
                  <p>This swap has a price impact of {formatNumber((swapEstimate.priceImpact || 0) * 100, 2)}%. 
                     Consider using a smaller amount to reduce slippage.</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        
        <CardFooter className="px-5 pb-5 pt-2 flex items-center justify-between space-x-2">
          {availableRewards > 0 && (
            <Button
              variant="outline"
              onClick={handleClaimRewards}
              disabled={claimLoading || !walletConnected}
              className="bg-[#1e2a45] text-[#a3accd] hover:bg-[#252f4a] hover:text-white border-[#2a3553]"
            >
              {claimLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Claiming...
                </>
              ) : (
                <>Claim {availableRewards.toFixed(2)} YOS</>
              )}
            </Button>
          )}
          
          <Button
            onClick={handleSwapClick}
            disabled={loading || !walletConnected || !fromToken || !toToken || !amount || parseFloat(amount) <= 0}
            className="w-full bg-gradient-to-r from-primary to-[#7043f9] text-white hover:opacity-90"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Swapping...
              </>
            ) : !walletConnected ? (
              'Connect Wallet'
            ) : !fromToken || !toToken || !amount || parseFloat(amount) <= 0 ? (
              'Enter Amount'
            ) : (
              'Swap'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}