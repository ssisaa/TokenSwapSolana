import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader, 
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowDown, 
  Info, 
  BarChart3, 
  RefreshCw, 
  Settings
} from 'lucide-react';
import TokenSearchInput from './TokenSearchInput';
import PriceChart from './PriceChart';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  TokenMetadata, 
  getTokenByAddress,
  getSwapEstimate,
  SwapEstimate
} from '@/lib/token-search-api';
import { YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS } from '@/lib/constants';
import { executeSwapAndDistribute } from '@/lib/multi-hub-swap-contract';
import { useToast } from '@/hooks/use-toast';

export default function EnhancedMultiHubSwapCard() {
  const { toast } = useToast();
  const wallet = useWallet();
  
  // Token states
  const [fromToken, setFromToken] = useState<TokenMetadata | null>(null);
  const [toToken, setToToken] = useState<TokenMetadata | null>(null);
  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');
  
  // UI states
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [swapEstimate, setSwapEstimate] = useState<SwapEstimate | null>(null);
  const [activeTab, setActiveTab] = useState<'swap' | 'chart'>('swap');
  const [slippage, setSlippage] = useState<number>(1); // 1% slippage
  
  // Load default tokens on component mount
  useEffect(() => {
    async function loadDefaultTokens() {
      // Set SOL as default "from" token
      const solToken = await getTokenByAddress('So11111111111111111111111111111111111111112');
      if (solToken) {
        setFromToken(solToken);
      }
      
      // Set YOT as default "to" token
      const yotToken = await getTokenByAddress(YOT_TOKEN_ADDRESS);
      if (yotToken) {
        setToToken(yotToken);
      }
    }
    
    loadDefaultTokens();
  }, []);
  
  // Update estimate when tokens or amount changes
  useEffect(() => {
    async function updateEstimate() {
      if (fromToken && toToken && fromAmount && parseFloat(fromAmount) > 0) {
        try {
          const estimate = await getSwapEstimate(
            fromToken,
            toToken,
            parseFloat(fromAmount)
          );
          
          setSwapEstimate(estimate);
          if (estimate) {
            setToAmount(estimate.outputAmount.toFixed(6));
          }
        } catch (error) {
          console.error('Error updating swap estimate:', error);
          setSwapEstimate(null);
          setToAmount('');
        }
      } else {
        setSwapEstimate(null);
        setToAmount('');
      }
    }
    
    updateEstimate();
  }, [fromToken, toToken, fromAmount]);
  
  // Handle token swap buttons
  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount(toAmount);
    // toAmount will be updated via the useEffect
  };
  
  // Handle swap execution
  const handleSwap = async () => {
    if (!wallet.connected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to swap tokens',
        variant: 'destructive'
      });
      return;
    }
    
    if (!fromToken || !toToken || !swapEstimate) {
      toast({
        title: 'Invalid swap parameters',
        description: 'Please check your input values and try again',
        variant: 'destructive'
      });
      return;
    }
    
    setIsSwapping(true);
    
    try {
      const signature = await executeSwapAndDistribute(
        wallet,
        parseFloat(fromAmount),
        swapEstimate.minimumReceived
      );
      
      toast({
        title: 'Swap successful',
        description: `Transaction signature: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
        variant: 'default'
      });
      
      // Reset input values
      setFromAmount('');
      setToAmount('');
      setSwapEstimate(null);
    } catch (error) {
      console.error('Swap error:', error);
      toast({
        title: 'Swap failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsSwapping(false);
    }
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 w-full max-w-7xl mx-auto">
      {/* Mobile header */}
      <div className="lg:hidden col-span-1">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>MultiHub Swap</CardTitle>
            <CardDescription>
              Swap tokens with automatic liquidity contribution and YOS rewards
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="flex space-x-2">
              <Button 
                variant={activeTab === 'swap' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setActiveTab('swap')}
              >
                Swap
              </Button>
              <Button 
                variant={activeTab === 'chart' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setActiveTab('chart')}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Charts
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Chart section (left side on desktop, conditionally shown on mobile) */}
      <div className={`col-span-1 lg:col-span-4 ${activeTab === 'chart' || activeTab === 'swap' && window.innerWidth >= 1024 ? 'block' : 'hidden'}`}>
        <div className="space-y-4">
          {fromToken && (
            <PriceChart 
              tokenAddress={fromToken.address} 
              tokenSymbol={fromToken.symbol} 
            />
          )}
          
          {toToken && fromToken && toToken.address !== fromToken.address && (
            <PriceChart 
              tokenAddress={toToken.address} 
              tokenSymbol={toToken.symbol} 
            />
          )}
        </div>
      </div>
      
      {/* Swap section (right side on desktop, conditionally shown on mobile) */}
      <div className={`col-span-1 lg:col-span-3 ${activeTab === 'swap' || activeTab === 'chart' && window.innerWidth >= 1024 ? 'block' : 'hidden'}`}>
        <Card className="h-full">
          {/* Desktop header */}
          <CardHeader className="hidden lg:flex flex-col pb-2">
            <div className="flex justify-between items-center">
              <CardTitle>MultiHub Swap</CardTitle>
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              Swap tokens with automatic liquidity contribution and YOS rewards
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* From token */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium">From</label>
                {wallet.connected && fromToken && (
                  <span className="text-xs text-muted-foreground">
                    Balance: 0.00 {fromToken.symbol}
                  </span>
                )}
              </div>
              
              <div className="flex space-x-2">
                <TokenSearchInput
                  onTokenSelect={setFromToken}
                  selectedToken={fromToken || undefined}
                  label="Select token"
                  placeholder="Search tokens"
                />
                
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    className="text-right"
                  />
                </div>
              </div>
            </div>
            
            {/* Swap button */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwapTokens}
                className="bg-muted rounded-full h-8 w-8"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
            
            {/* To token */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium">To</label>
                {wallet.connected && toToken && (
                  <span className="text-xs text-muted-foreground">
                    Balance: 0.00 {toToken.symbol}
                  </span>
                )}
              </div>
              
              <div className="flex space-x-2">
                <TokenSearchInput
                  onTokenSelect={setToToken}
                  selectedToken={toToken || undefined}
                  label="Select token"
                  placeholder="Search tokens"
                />
                
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={toAmount}
                    readOnly
                    className="text-right bg-muted"
                  />
                </div>
              </div>
            </div>
            
            {/* Swap details */}
            {swapEstimate && (
              <div className="bg-muted rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span>
                    1 {fromToken?.symbol} = {swapEstimate.price.toFixed(6)} {toToken?.symbol}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Route</span>
                  <div className="flex items-center space-x-1">
                    {swapEstimate.route.map((symbol, index) => (
                      <span key={index} className="flex items-center">
                        {index > 0 && <span className="mx-1">→</span>}
                        {symbol}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price Impact</span>
                  <span className={swapEstimate.priceImpact > 2 ? 'text-amber-500' : 'text-green-500'}>
                    {swapEstimate.priceImpact.toFixed(2)}%
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Minimum Received</span>
                  <span>{swapEstimate.minimumReceived.toFixed(6)} {toToken?.symbol}</span>
                </div>
                
                <Separator />
                
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Liquidity Contribution</span>
                    <span>20%</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">YOS Cashback</span>
                    <Badge variant="secondary" className="font-normal">
                      ≈5% in YOS
                    </Badge>
                  </div>
                </div>
              </div>
            )}
            
            {/* Swap button */}
            <Button
              className="w-full"
              disabled={!wallet.connected || !fromToken || !toToken || !swapEstimate || isSwapping}
              onClick={handleSwap}
            >
              {isSwapping ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Swapping...
                </>
              ) : !wallet.connected ? (
                'Connect Wallet'
              ) : !fromToken || !toToken ? (
                'Select Tokens'
              ) : !swapEstimate ? (
                'Enter Amount'
              ) : (
                'Swap'
              )}
            </Button>
            
            {/* Info footer */}
            <div className="flex justify-center text-xs text-muted-foreground">
              <Info className="h-3 w-3 mr-1" />
              <span>
                20% of your swap amount contributes to SOL-YOT liquidity pool
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}