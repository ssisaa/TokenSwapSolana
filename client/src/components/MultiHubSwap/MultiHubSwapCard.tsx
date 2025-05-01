import { useState, useMemo, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ArrowDownUp,
  ArrowRightLeft,
  ChevronDown,
  RefreshCw,
  Info,
  AlertCircle,
  Search, 
  X, 
  CircleDashed,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchSolanaTokens, TokenInfo } from '@/lib/token-search-api';
import { SOL_TOKEN_ADDRESS, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS } from '@/lib/constants';
import useMultiHubSwap from '@/hooks/useMultiHubSwap';
import { formatNumber } from '@/lib/utils';
import TokenPriceChart from './TokenPriceChart';
import { SwapProvider } from '@/lib/multi-hub-swap';

export default function MultiHubSwapCard() {
  const wallet = useWallet();
  const {
    fromToken,
    toToken,
    amount,
    slippage,
    setFromToken,
    setToToken,
    setAmount,
    setSlippage,
    switchTokens,
    swapEstimate,
    estimateLoading,
    swap,
    isSwapping,
    swapSummary,
    isValid,
    preferredProvider,
    setPreferredProvider
  } = useMultiHubSwap();

  const [slippageInput, setSlippageInput] = useState(slippage * 100 + '');
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [showProviderSettings, setShowProviderSettings] = useState(false);
  const [fromDialogOpen, setFromDialogOpen] = useState(false);
  const [toDialogOpen, setToDialogOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [routeDetails, setRouteDetails] = useState(false);

  // Get tokens data
  const { data: tokens, isLoading: tokensLoading } = useQuery({
    queryKey: ['solana-tokens'],
    queryFn: fetchSolanaTokens
  });

  // Filter tokens based on search
  const filteredTokens = useMemo(() => {
    if (!tokens) return [];
    
    // Priority tokens
    const priorityTokens = [
      SOL_TOKEN_ADDRESS,
      YOT_TOKEN_ADDRESS,
      YOS_TOKEN_ADDRESS,
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC devnet
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' // USDT devnet
    ];
    
    // Filter based on search
    let filtered = tokens.filter((token: TokenInfo) => {
      if (!searchValue) return true;
      
      const searchLower = searchValue.toLowerCase();
      
      return (
        token.symbol.toLowerCase().includes(searchLower) ||
        token.name.toLowerCase().includes(searchLower) ||
        token.address.toLowerCase().includes(searchLower)
      );
    });
    
    // Sort tokens
    filtered.sort((a: TokenInfo, b: TokenInfo) => {
      const aPriority = priorityTokens.indexOf(a.address);
      const bPriority = priorityTokens.indexOf(b.address);
      
      if (aPriority >= 0 && bPriority >= 0) return aPriority - bPriority;
      if (aPriority >= 0) return -1;
      if (bPriority >= 0) return 1;
      
      return a.symbol.localeCompare(b.symbol);
    });
    
    return filtered;
  }, [tokens, searchValue]);

  // Get popular tokens
  const popularTokens = useMemo(() => {
    if (!tokens) return [];
    
    return tokens.filter((token: TokenInfo) => 
      ['So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 'RAY111111111111111111111111111111111111111'].includes(token.address)
    );
  }, [tokens]);

  // Reset search when dialog closes
  useEffect(() => {
    if (!fromDialogOpen && !toDialogOpen) {
      setSearchValue('');
    }
  }, [fromDialogOpen, toDialogOpen]);

  // Conditionally render swap summary data
  const renderSwapSummary = useMemo(() => {
    if (!swapSummary) return null;

    return (
      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Rate</span>
          <span>
            1 {fromToken?.symbol} ≈ {formatNumber(swapSummary.estimatedOutputAmount / parseFloat(amount || '1'))} {toToken?.symbol}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Minimum received</span>
          <span>{formatNumber(swapSummary.minReceived)} {toToken?.symbol}</span>
        </div>
        <div className="flex justify-between">
          <span>Liquidity contribution</span>
          <span>{formatNumber(swapSummary.liquidityContribution)} {fromToken?.symbol}</span>
        </div>
        <div className="flex justify-between">
          <span>YOS cashback</span>
          <span>{formatNumber(swapSummary.yosCashback)} YOS</span>
        </div>
        <div className="flex justify-between">
          <span>Provider</span>
          <span>{swapSummary.provider}</span>
        </div>
      </div>
    );
  }, [fromToken, toToken, amount, swapSummary]);

  // Update slippage tolerance
  const updateSlippage = () => {
    const newSlippage = parseFloat(slippageInput) / 100;
    if (!isNaN(newSlippage) && newSlippage > 0 && newSlippage <= 5) {
      setSlippage(newSlippage);
      setShowSlippageSettings(false);
    }
  };

  // Set quick slippage values
  const setQuickSlippage = (value: number) => {
    setSlippageInput(value.toString());
    setSlippage(value / 100);
    setShowSlippageSettings(false);
  };

  // Conditional warning based on swap estimate
  const swapWarning = useMemo(() => {
    if (!swapEstimate) return null;
    
    if (swapEstimate.provider === SwapProvider.Contract) {
      return (
        <div className="flex items-center gap-2 text-xs text-amber-500 mt-1">
          <AlertCircle className="h-3 w-3" />
          <span>Using smart contract for best efficiency</span>
        </div>
      );
    }
    
    if (swapEstimate.provider && swapEstimate.provider !== SwapProvider.Direct) {
      return (
        <div className="flex items-center gap-2 text-xs text-amber-500 mt-1">
          <AlertCircle className="h-3 w-3" />
          <span>Routing via {swapEstimate.provider} for best price</span>
        </div>
      );
    }
    
    return null;
  }, [swapEstimate]);

  return (
    <Card className="w-full max-w-md mx-auto bg-dark-200 border-dark-300">
      <CardHeader className="space-y-1">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold">Swap Tokens</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh prices</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          Trade tokens with multi-hub routing for the best price
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* From Token Section */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label htmlFor="from-amount">From</label>
            {wallet.publicKey && fromToken && (
              <span className="text-muted-foreground">
                Balance: {/* Add wallet balance here */}
              </span>
            )}
          </div>
          
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Input
                id="from-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-dark-300 border-dark-400"
              />
            </div>
            
            <Dialog open={fromDialogOpen} onOpenChange={setFromDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="flex items-center justify-between min-w-[120px] h-10 bg-dark-300 border-dark-400"
                >
                  {fromToken ? (
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={fromToken.logoURI} alt={fromToken.symbol} />
                        <AvatarFallback>
                          <CircleDashed className="h-3 w-3 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium truncate">{fromToken.symbol}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Select token</span>
                  )}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-[#0D1224] border-[#1E2847] overflow-hidden p-0">
                <DialogHeader className="px-4 pt-4 pb-2 flex flex-row justify-between items-center">
                  <DialogTitle className="text-lg font-medium">Select a token</DialogTitle>
                  <DialogClose asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <X className="h-4 w-4" />
                    </Button>
                  </DialogClose>
                </DialogHeader>
                
                <div className="space-y-4 px-4 pb-4">
                  {/* Search Bar */}
                  <div className="relative w-full">
                    <Input 
                      placeholder="Search by token or paste address"
                      className="pl-10 py-6 w-full bg-[#111729] border-0 focus-visible:ring-0 text-sm rounded-lg"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                    />
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {searchValue && (
                      <div className="absolute inset-y-0 right-3 flex items-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 text-muted-foreground"
                          onClick={() => setSearchValue('')}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {/* Popular Tokens */}
                  {!searchValue && popularTokens.length > 0 && (
                    <div>
                      <p className="text-sm text-blue-400 mb-2">Popular tokens</p>
                      <div className="grid grid-cols-4 gap-2">
                        {popularTokens.map((token: TokenInfo) => (
                          <Button
                            key={token.address}
                            variant="outline"
                            className="flex items-center justify-center h-12 py-5 px-3 bg-[#111729] border-0 hover:bg-[#1a2340] rounded-md"
                            onClick={() => {
                              setFromToken(token);
                              setFromDialogOpen(false);
                            }}
                            disabled={toToken ? token.address === toToken.address : false}
                          >
                            <Avatar className="h-5 w-5 mr-2">
                              <AvatarImage src={token.logoURI} alt={token.symbol} />
                              <AvatarFallback>
                                <CircleDashed className="h-3 w-3 text-muted-foreground" />
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{token.symbol}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Token List Section */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm text-blue-400">Token</p>
                      <p className="text-sm text-blue-400">Balance/Address</p>
                    </div>
                    
                    {tokensLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-14 w-full bg-[#111729]" />
                        <Skeleton className="h-14 w-full bg-[#111729]" />
                        <Skeleton className="h-14 w-full bg-[#111729]" />
                      </div>
                    ) : filteredTokens.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <p className="text-sm mb-2">Can't find the token you're looking for? Try entering the mint address or check token list settings below.</p>
                        <Button 
                          variant="outline" 
                          className="mt-4 text-sm bg-[#111729] border-[#2D4380] hover:bg-[#1a2340] text-white rounded-md font-medium py-6"
                        >
                          View Token List
                        </Button>
                      </div>
                    ) : (
                      <ScrollArea className="h-[300px] pr-2">
                        <div className="space-y-1">
                          {filteredTokens
                            .filter(token => !toToken || token.address !== toToken.address)
                            .map((token: TokenInfo) => (
                            <div
                              key={token.address}
                              onClick={() => {
                                setFromToken(token);
                                setFromDialogOpen(false);
                              }}
                              className="flex justify-between items-center py-3 px-2 hover:bg-[#111729] rounded-md cursor-pointer relative"
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={token.logoURI} alt={token.symbol} />
                                  <AvatarFallback>
                                    <CircleDashed className="h-3 w-3 text-muted-foreground" />
                                  </AvatarFallback>
                                </Avatar>
                                
                                <div className="flex flex-col items-start">
                                  <span className="font-medium">{token.symbol}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {token.name}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-end text-right">
                                <span className="font-medium">
                                  {token.symbol === 'SOL' ? '0.61' : '0'}
                                </span>
                                <div className="flex items-center text-xs text-muted-foreground">
                                  <span>{token.address.substring(0, 6)}...{token.address.substring(token.address.length - 6)}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-5 w-5 ml-1 text-blue-400 hover:text-blue-300 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(token.address);
                                    }}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              
                              {fromToken?.address === token.address && (
                                <div className="absolute right-2 text-green-500">✓</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        {/* Switch Button */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={switchTokens}
            className="h-8 w-8 rounded-full bg-dark-300"
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>
        
        {/* To Token Section */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label htmlFor="to-amount">To (Estimated)</label>
            {wallet.publicKey && toToken && (
              <span className="text-muted-foreground">
                Balance: {/* Add wallet balance here */}
              </span>
            )}
          </div>
          
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              {estimateLoading ? (
                <Skeleton className="h-10 w-full bg-dark-300" />
              ) : (
                <Input
                  id="to-amount"
                  readOnly
                  value={swapEstimate?.estimatedAmount 
                    ? formatNumber(swapEstimate.estimatedAmount) 
                    : '0.00'
                  }
                  placeholder="0.00"
                  className="bg-dark-300 border-dark-400"
                />
              )}
            </div>
            
            <Dialog open={toDialogOpen} onOpenChange={setToDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="flex items-center justify-between min-w-[120px] h-10 bg-dark-300 border-dark-400"
                >
                  {toToken ? (
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={toToken.logoURI} alt={toToken.symbol} />
                        <AvatarFallback>
                          <CircleDashed className="h-3 w-3 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium truncate">{toToken.symbol}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Select token</span>
                  )}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-[#0D1224] border-[#1E2847] overflow-hidden p-0">
                <DialogHeader className="px-4 pt-4 pb-2 flex flex-row justify-between items-center">
                  <DialogTitle className="text-lg font-medium">Select a token</DialogTitle>
                  <DialogClose asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <X className="h-4 w-4" />
                    </Button>
                  </DialogClose>
                </DialogHeader>
                
                <div className="space-y-4 px-4 pb-4">
                  {/* Search Bar */}
                  <div className="relative w-full">
                    <Input 
                      placeholder="Search by token or paste address"
                      className="pl-10 py-6 w-full bg-[#111729] border-0 focus-visible:ring-0 text-sm rounded-lg"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                    />
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {searchValue && (
                      <div className="absolute inset-y-0 right-3 flex items-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 text-muted-foreground"
                          onClick={() => setSearchValue('')}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {/* Popular Tokens */}
                  {!searchValue && popularTokens.length > 0 && (
                    <div>
                      <p className="text-sm text-blue-400 mb-2">Popular tokens</p>
                      <div className="grid grid-cols-4 gap-2">
                        {popularTokens.map((token: TokenInfo) => (
                          <Button
                            key={token.address}
                            variant="outline"
                            className="flex items-center justify-center h-12 py-5 px-3 bg-[#111729] border-0 hover:bg-[#1a2340] rounded-md"
                            onClick={() => {
                              setToToken(token);
                              setToDialogOpen(false);
                            }}
                            disabled={fromToken ? token.address === fromToken.address : false}
                          >
                            <Avatar className="h-5 w-5 mr-2">
                              <AvatarImage src={token.logoURI} alt={token.symbol} />
                              <AvatarFallback>
                                <CircleDashed className="h-3 w-3 text-muted-foreground" />
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{token.symbol}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Token List Section */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm text-blue-400">Token</p>
                      <p className="text-sm text-blue-400">Balance/Address</p>
                    </div>
                    
                    {tokensLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-14 w-full bg-[#111729]" />
                        <Skeleton className="h-14 w-full bg-[#111729]" />
                        <Skeleton className="h-14 w-full bg-[#111729]" />
                      </div>
                    ) : filteredTokens.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <p className="text-sm mb-2">Can't find the token you're looking for? Try entering the mint address or check token list settings below.</p>
                        <Button 
                          variant="outline" 
                          className="mt-4 text-sm bg-[#111729] border-[#2D4380] hover:bg-[#1a2340] text-white rounded-md font-medium py-6"
                        >
                          View Token List
                        </Button>
                      </div>
                    ) : (
                      <ScrollArea className="h-[300px] pr-2">
                        <div className="space-y-1">
                          {filteredTokens
                            .filter(token => !fromToken || token.address !== fromToken.address)
                            .map((token: TokenInfo) => (
                            <div
                              key={token.address}
                              onClick={() => {
                                setToToken(token);
                                setToDialogOpen(false);
                              }}
                              className="flex justify-between items-center py-3 px-2 hover:bg-[#111729] rounded-md cursor-pointer relative"
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={token.logoURI} alt={token.symbol} />
                                  <AvatarFallback>
                                    <CircleDashed className="h-3 w-3 text-muted-foreground" />
                                  </AvatarFallback>
                                </Avatar>
                                
                                <div className="flex flex-col items-start">
                                  <span className="font-medium">{token.symbol}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {token.name}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-end text-right">
                                <span className="font-medium">
                                  {token.symbol === 'SOL' ? '0.61' : '0'}
                                </span>
                                <div className="flex items-center text-xs text-muted-foreground">
                                  <span>{token.address.substring(0, 6)}...{token.address.substring(token.address.length - 6)}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-5 w-5 ml-1 text-blue-400 hover:text-blue-300 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(token.address);
                                    }}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              
                              {toToken?.address === token.address && (
                                <div className="absolute right-2 text-green-500">✓</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          {swapWarning}
        </div>
        
        {/* Slippage Settings */}
        <div className="flex justify-between items-center">
          <Popover open={showSlippageSettings} onOpenChange={setShowSlippageSettings}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 border-dark-400 bg-dark-300"
              >
                Slippage: {(slippage * 100).toFixed(1)}%
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 bg-dark-200 border-dark-300">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Slippage Tolerance</h4>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuickSlippage(0.5)}
                    className="flex-1 h-7 text-xs"
                  >
                    0.5%
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuickSlippage(1.0)}
                    className="flex-1 h-7 text-xs"
                  >
                    1.0%
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuickSlippage(2.0)}
                    className="flex-1 h-7 text-xs"
                  >
                    2.0%
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={slippageInput}
                    onChange={(e) => setSlippageInput(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="Custom"
                  />
                  <span className="text-xs">%</span>
                  <Button
                    size="sm"
                    onClick={updateSlippage}
                    className="h-7 text-xs"
                  >
                    Set
                  </Button>
                </div>
                <div className="flex items-start gap-1 text-xs text-muted-foreground mt-1">
                  <Info className="h-3 w-3 mt-0.5" />
                  <span>
                    Your transaction will revert if the price changes unfavorably by more than this percentage.
                  </span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center text-xs text-muted-foreground">
              <ArrowRightLeft className="mr-1 h-3 w-3" />
              <span>Exchange:</span>
            </div>
            <div className="bg-dark-300 rounded-md p-1 flex text-xs">
              <Button 
                variant={swapEstimate?.provider === SwapProvider.Raydium ? "secondary" : "ghost"}
                size="sm" 
                className="h-6 px-2 rounded-sm text-xs"
                onClick={() => swapEstimate?.provider !== SwapProvider.Raydium && setPreferredProvider && setPreferredProvider(SwapProvider.Raydium)}
              >
                Raydium
              </Button>
              <Button 
                variant={swapEstimate?.provider === SwapProvider.Jupiter ? "secondary" : "ghost"}
                size="sm" 
                className="h-6 px-2 rounded-sm text-xs"
                onClick={() => swapEstimate?.provider !== SwapProvider.Jupiter && setPreferredProvider && setPreferredProvider(SwapProvider.Jupiter)}
              >
                Jupiter
              </Button>
            </div>
          </div>
        </div>
        
        {/* Token Price Chart */}
        {fromToken && toToken && (
          <TokenPriceChart fromToken={fromToken} toToken={toToken} />
        )}
        
        {amount && parseFloat(amount) > 0 && (
          <>
            <Separator />
            {renderSwapSummary}
          </>
        )}
      </CardContent>
      
      <CardFooter className="flex flex-col gap-3">
        {/* Swap Route Details */}
        {fromToken && toToken && swapEstimate && (
          <div className="w-full mb-2">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center">
                <span className="text-sm font-medium">Route</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-0 h-6 ml-1"
                  onClick={() => setRouteDetails(!routeDetails)}
                >
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
              <Popover open={showProviderSettings} onOpenChange={setShowProviderSettings}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 border-dark-400 bg-dark-300"
                  >
                    Provider: {preferredProvider || 'Auto'}
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3 bg-dark-200 border-dark-300">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Preferred Provider</h4>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant={!preferredProvider ? "default" : "outline"}
                        onClick={() => setPreferredProvider(undefined)}
                        className="h-8 text-xs justify-start"
                      >
                        Auto (Best Route)
                      </Button>
                      <Button
                        size="sm"
                        variant={preferredProvider === SwapProvider.Contract ? "default" : "outline"}
                        onClick={() => setPreferredProvider(SwapProvider.Contract)}
                        className="h-8 text-xs justify-start"
                      >
                        Smart Contract (Direct)
                      </Button>
                      <Button
                        size="sm"
                        variant={preferredProvider === SwapProvider.Raydium ? "default" : "outline"}
                        onClick={() => setPreferredProvider(SwapProvider.Raydium)}
                        className="h-8 text-xs justify-start"
                      >
                        Raydium
                      </Button>
                      <Button
                        size="sm"
                        variant={preferredProvider === SwapProvider.Jupiter ? "default" : "outline"}
                        onClick={() => setPreferredProvider(SwapProvider.Jupiter)}
                        className="h-8 text-xs justify-start"
                      >
                        Jupiter
                      </Button>
                    </div>
                    <div className="pt-2 border-t border-dark-400 mt-2">
                      <p className="text-xs text-muted-foreground mb-2">
                        Selecting a provider may impact price and fees. Auto uses our multi-hub router to find the best path.
                      </p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Route visualization */}
            <div className="rounded-md bg-dark-300 p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={fromToken.logoURI} alt={fromToken.symbol} />
                    <AvatarFallback>{fromToken.symbol.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="ml-2 text-sm font-medium">{fromToken.symbol}</span>
                </div>
                
                <ArrowRightLeft className="h-4 w-4 mx-2 text-muted-foreground" />
                
                <div className="flex items-center">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={toToken.logoURI} alt={toToken.symbol} />
                    <AvatarFallback>{toToken.symbol.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="ml-2 text-sm font-medium">{toToken.symbol}</span>
                </div>
                
                <div className="ml-2 px-2 py-1 rounded bg-dark-400 text-xs">
                  via {swapEstimate.provider || 'Contract'}
                </div>
              </div>
              
              {/* Expanded route details */}
              {routeDetails && swapEstimate.route && (
                <div className="mt-2 pt-2 border-t border-dark-400 text-xs text-muted-foreground">
                  <div className="flex items-center mb-1">
                    <span>Hops: {swapEstimate.route.length || 1}</span>
                    <span className="mx-2">•</span>
                    <span>Price Impact: {(swapEstimate.priceImpact * 100).toFixed(2)}%</span>
                  </div>
                  {swapEstimate.intermediateTokens && swapEstimate.intermediateTokens.length > 0 && (
                    <div>
                      <span>Via: {swapEstimate.intermediateTokens.map((token: string) => {
                        const tokenInfo = tokens?.find((t: TokenInfo) => t.address === token);
                        return tokenInfo?.symbol || token.substring(0, 6) + '...';
                      }).join(' → ')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {wallet.connected ? (
          <Button
            onClick={() => swap()}
            disabled={!isValid || isSwapping}
            className="w-full"
          >
            {isSwapping && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            {isSwapping ? 'Swapping...' : 'Swap'}
          </Button>
        ) : (
          <Button
            onClick={() => wallet.connect()}
            className="w-full"
          >
            Connect Wallet
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}