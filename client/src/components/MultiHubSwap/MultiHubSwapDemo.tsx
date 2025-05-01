import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ArrowRightLeft, AlertTriangle, Info, Loader2, ArrowRight, ArrowDown } from 'lucide-react';
import { TokenSearchInput } from './TokenSearchInput';
import { formatNumber } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getMultiHubSwapEstimate, executeMultiHubSwap, claimYosSwapRewards, SwapProvider } from '@/lib/multi-hub-swap';
import { defaultTokens } from '@/lib/token-search-api';
import { SOL_SYMBOL, YOT_SYMBOL, SOL_TOKEN_ADDRESS, YOT_TOKEN_ADDRESS } from '@/lib/constants';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { getTokenBalance, formatTokenBalance } from '@/lib/wallet-utils';
import { ProviderSelector } from './ProviderSelector';
import { RouteDisplay } from './RouteDisplay';

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
  const [selectedProvider, setSelectedProvider] = useState<SwapProvider | undefined>(undefined);
  const [availableRewards, setAvailableRewards] = useState(0);
  const [claimLoading, setClaimLoading] = useState(false);
  const [swapEstimate, setSwapEstimate] = useState<any>(null);
  const [showRouteInfo, setShowRouteInfo] = useState(false);
  
  // Token balance state
  const [fromTokenBalance, setFromTokenBalance] = useState<number | null>(null);
  const [toTokenBalance, setToTokenBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  
  // Instant calculation for better user experience while API completes
  useEffect(() => {
    const calculateInstantEstimate = async () => {
      if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0) {
        setEstimatedAmount(null);
        return;
      }
      
      const parsedAmount = parseFloat(amount);
      
      // Try to get the pool data from API directly
      try {
        const apiUrl = `${window.location.protocol}//${window.location.host}/api/pool-data`;
        const poolResponse = await fetch(apiUrl);
        const poolData = await poolResponse.json();
        
        // If we have valid pool data, do an instant calculation using proper AMM formula
        if (poolData && poolData.sol && poolData.yot) {
          const fee = 0.003; // 0.3% swap fee
          const FEE_MULTIPLIER = 1 - fee; // 0.997
          
          // We have the data we need for accurate estimate
          const solReserve = poolData.sol;
          const yotReserve = poolData.yot;
          
          let instantEstimate = 0;
          
          if (fromToken.symbol === 'SOL' && toToken.symbol === 'YOT') {
            // SOL to YOT - using proper AMM formula
            instantEstimate = (parsedAmount * yotReserve * FEE_MULTIPLIER) / (solReserve + parsedAmount);
            console.log(`INSTANT CALC (SOL→YOT): ${parsedAmount} SOL = ${instantEstimate} YOT`);
          } 
          else if (fromToken.symbol === 'YOT' && toToken.symbol === 'SOL') {
            // YOT to SOL - using proper AMM formula
            instantEstimate = (parsedAmount * solReserve * FEE_MULTIPLIER) / (yotReserve + parsedAmount);
            console.log(`INSTANT CALC (YOT→SOL): ${parsedAmount} YOT = ${instantEstimate} SOL`);
          }
          
          // Show the instant estimate immediately
          if (instantEstimate > 0) {
            setEstimatedAmount(instantEstimate);
          }
        }
      } catch (error) {
        console.warn("Error providing instant estimate:", error);
        // Don't set loading or errors, as the main calculation will still run
      }
    };
    
    // Run the instant calculation without waiting
    calculateInstantEstimate();
  }, [fromToken, toToken, amount]);
  
  // Get full swap estimate from the backend when tokens or amount changes
  useEffect(() => {
    const getEstimate = async () => {
      if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0) {
        setEstimatedAmount(null);
        return;
      }
      
      try {
        setEstimateLoading(true);
        const parsedAmount = parseFloat(amount);
        
        // Use the selected provider for the estimation if available
        const estimate = await getMultiHubSwapEstimate(
          fromToken, 
          toToken, 
          parsedAmount, 
          slippage/100, 
          selectedProvider
        );
        
        if (estimate && estimate.estimatedAmount !== undefined) {
          setEstimatedAmount(estimate.estimatedAmount);
          
          // Only set the route provider if not manually selected
          if (!selectedProvider) {
            setRouteProvider(estimate.provider ?? SwapProvider.Contract);
          }
          
          // Store route information for display including token path
          if (estimate.route && estimate.route.length > 0) {
            console.log('Route path:', estimate.route);
            
            // Create routeInfo if not provided directly
            let routeInfoData = estimate.routeInfo || [];
            
            // If no route info was provided but route exists, create simple route info
            if (routeInfoData.length === 0 && estimate.route.length > 0) {
              // Generate route info based on route
              routeInfoData = estimate.route.map((address, index) => {
                // Skip the last one as it's the destination
                if (index === estimate.route.length - 1) return null;
                
                // Find token info - this could be improved with a token info cache
                const tokenInfo = {
                  symbol: address === fromToken.address ? fromToken.symbol : 
                          address === toToken.address ? toToken.symbol : 
                          address === 'So11111111111111111111111111111111111111112' ? 'SOL' : 
                          'Unknown',
                  address: address
                };
                
                return {
                  tokenAddress: address,
                  tokenSymbol: tokenInfo.symbol,
                  tokenName: tokenInfo.symbol,
                  percent: 100
                };
              }).filter(Boolean);
            }
            
            setSwapEstimate({
              ...estimate,
              routeInfo: routeInfoData
            });
            
            console.log('Route info set:', routeInfoData);
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
  }, [fromToken, toToken, amount, slippage, selectedProvider]);
  
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
      
      // Use the selected provider if set, otherwise use the one from the current estimate
      const providerForSwap = selectedProvider || routeProvider;
      
      console.log(`Executing swap with provider: ${
        providerForSwap === SwapProvider.Contract ? 'Multi-hub Contract' : 
        providerForSwap === SwapProvider.Raydium ? 'Raydium DEX' : 
        providerForSwap === SwapProvider.Jupiter ? 'Jupiter Aggregator' : 'Auto'
      }`);
      
      const signature = await executeMultiHubSwap(
        wallet,
        fromToken,
        toToken,
        parsedAmount,
        slippage / 100,
        providerForSwap // Pass the selected provider
      );
      
      // Transaction signature means success
      if (signature) {
        toast({
          title: 'Swap successful',
          description: `Swapped ${parsedAmount} ${fromToken.symbol} to approximately ${estimatedAmount?.toFixed(4)} ${toToken.symbol}`,
          variant: 'default'
        });
        
        // After successful swap, refresh balances
        if (wallet?.publicKey) {
          try {
            setBalanceLoading(true);
            if (fromToken) {
              const balance = await getTokenBalance(wallet.publicKey.toString(), fromToken.address);
              setFromTokenBalance(balance);
            }
            
            if (toToken) {
              const balance = await getTokenBalance(wallet.publicKey.toString(), toToken.address);
              setToTokenBalance(balance);
            }
          } catch (error) {
            console.error('Error refreshing balances:', error);
          } finally {
            setBalanceLoading(false);
          }
        }
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
        description: error instanceof Error ? error.message : 'An error occurred while processing the swap',
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
                    onClick={async () => {
                      // Force refresh the exchange rate data from blockchain
                      try {
                        // Show loading state
                        setEstimateLoading(true);
                        
                        // Use real-time blockchain data for calculating swap estimates
                        const sol = defaultTokens.find(t => t.symbol === 'SOL');
                        const yot = defaultTokens.find(t => t.symbol === 'YOT');
                        
                        if (!sol || !yot) {
                          console.error("Could not find SOL or YOT token in the default tokens list");
                          return;
                        }
                        
                        // Force set tokens to SOL and YOT for real data display
                        setFromToken(sol);
                        setToToken(yot);
                        
                        // Use a standard amount (1.65 SOL) for consistent testing
                        const inputAmount = 1.65;
                        
                        console.log(`Manually fetching exchange rate for ${inputAmount} SOL to YOT using real blockchain data...`);
                        
                        // Get real-time estimate from the blockchain
                        const realTimeEstimate = await getMultiHubSwapEstimate(
                          sol, 
                          yot, 
                          inputAmount,
                          slippage / 100,
                          SwapProvider.Contract // Force use our contract for consistent rates
                        );
                        
                        if (realTimeEstimate && realTimeEstimate.estimatedAmount) {
                          console.log(`BLOCKCHAIN DATA: ${inputAmount} SOL = ${realTimeEstimate.estimatedAmount.toFixed(2)} YOT`);
                          
                          // Update UI with real blockchain data
                          setEstimatedAmount(realTimeEstimate.estimatedAmount);
                          setSwapEstimate({
                            ...realTimeEstimate,
                            routeInfo: realTimeEstimate.routeInfo || [{
                              label: "SOL→YOT AMM Direct Pool",
                              ammId: "blockchain-liquidity-pool",
                              marketId: "7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCS9uZSPaGW4",
                              percent: 100,
                              inputMint: "So11111111111111111111111111111111111111112",
                              outputMint: "2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF",
                              marketName: "Blockchain AMM Pool",
                              poolData: {
                                solReserve: 28.777196998,
                                yotReserve: 706005627.1696466,
                                yosReserve: 562951041.1034079
                              }
                            }]
                          });
                          
                          // Set amount in the input field
                          setAmount(inputAmount.toString());
                        } else {
                          toast({
                            title: "Failed to fetch real data",
                            description: "Could not get exchange rate from blockchain",
                            variant: "destructive"
                          });
                        }
                      } catch (error) {
                        console.error("Error fetching real-time blockchain rates:", error);
                        toast({
                          title: "Connection error",
                          description: "Failed to connect to blockchain. Please try again.",
                          variant: "destructive"
                        });
                      } finally {
                        setEstimateLoading(false);
                      }
                    }}
                  >
                    Refresh Rates
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