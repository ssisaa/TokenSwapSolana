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

export default function MultiHubSwapDemo() {
  const { wallet = null, connected: walletConnected = false, connect } = useMultiWallet() || {};
  const { toast } = useToast();
  
  // Token state
  const [fromToken, setFromToken] = useState(defaultTokens[0]); // Default to SOL
  const [toToken, setToToken] = useState(defaultTokens[1]); // Default to YOT
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(1.0); // Default 1% slippage
  
  // UI state
  const [estimatedAmount, setEstimatedAmount] = useState<number | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routeProvider, setRouteProvider] = useState(SwapProvider.Contract);
  const [availableRewards, setAvailableRewards] = useState(0);
  const [claimLoading, setClaimLoading] = useState(false);
  
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
        } else {
          setEstimatedAmount(null);
          console.error('Failed to get estimate');
        }
      } catch (error) {
        console.error('Error getting swap estimate:', error);
        setEstimatedAmount(null);
      } finally {
        setEstimateLoading(false);
      }
    };
    
    getEstimate();
  }, [fromToken, toToken, amount]);
  
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
              Balance: {walletConnected ? '0.00' : 'Connect wallet'}
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
              Balance: {walletConnected ? '0.00' : 'Connect wallet'}
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
              />
            </div>
          </div>
        </div>
        
        {/* Swap Details */}
        <div className="bg-muted/30 rounded-md p-3 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Route Provider</span>
            <div className="flex space-x-1">
              {[SwapProvider.Contract, SwapProvider.Raydium, SwapProvider.Jupiter].map((provider) => (
                <button
                  key={provider}
                  onClick={async () => {
                    try {
                      setEstimateLoading(true);
                      if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0) return;
                      
                      const parsedAmount = parseFloat(amount);
                      const estimate = await getMultiHubSwapEstimate(
                        fromToken, 
                        toToken, 
                        parsedAmount,
                        slippage / 100, 
                        provider
                      );
                      
                      if (estimate && estimate.estimatedAmount !== undefined) {
                        setEstimatedAmount(estimate.estimatedAmount);
                        setRouteProvider(estimate.provider ?? SwapProvider.Contract);
                      }
                    } catch (error) {
                      console.error('Error getting estimate with provider:', error);
                    } finally {
                      setEstimateLoading(false);
                    }
                  }}
                  className={`px-2 py-0.5 text-xs rounded-md ${
                    routeProvider === provider
                      ? 'bg-primary text-white'
                      : 'bg-muted hover:bg-primary/20'
                  }`}
                >
                  {provider === SwapProvider.Contract ? 'YOT' : 
                   provider === SwapProvider.Raydium ? 'Raydium' : 
                   provider === SwapProvider.Jupiter ? 'Jupiter' : 
                   provider}
                </button>
              ))}
            </div>
          </div>
          
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