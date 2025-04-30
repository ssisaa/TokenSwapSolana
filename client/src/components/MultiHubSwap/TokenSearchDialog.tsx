import { useState, useEffect, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Check, 
  ChevronDown, 
  Search, 
  CircleDashed, 
  ChevronsUpDown,
  Coins,
  Hash,
  Clock,
  Star,
  ArrowDownUp
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchSolanaTokens } from '@/lib/token-search-api';
import { TokenInfo } from '@/lib/token-search-api';
import { SOL_TOKEN_ADDRESS, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS } from '@/lib/constants';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface TokenSearchDialogProps {
  selectedToken: TokenInfo | null;
  onSelect: (token: TokenInfo) => void;
  exclude?: string[];
  excludeTokens?: string[];  // For backward compatibility
  disabled?: boolean;
}

export function TokenSearchDialog({ 
  selectedToken, 
  onSelect, 
  exclude = [],
  excludeTokens = [],
  disabled = false
}: TokenSearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchTab, setSearchTab] = useState<'symbol' | 'address'>('symbol');
  
  const { data: tokens, isLoading: tokensLoading } = useQuery({
    queryKey: ['solana-tokens'],
    queryFn: fetchSolanaTokens
  });

  // Filter tokens based on search and exclude list
  const filteredTokens = useMemo(() => {
    if (!tokens) return [];
    
    const priorityTokens = [
      SOL_TOKEN_ADDRESS,
      YOT_TOKEN_ADDRESS,
      YOS_TOKEN_ADDRESS
    ];
    
    // Filter tokens
    let filtered = tokens.filter(token => {
      // Check both exclude lists
      if (exclude.includes(token.address) || excludeTokens.includes(token.address)) return false;
      
      if (!searchValue) return true;
      
      const searchLower = searchValue.toLowerCase();
      
      if (searchTab === 'address') {
        return token.address.toLowerCase().includes(searchLower);
      } else {
        return (
          token.symbol.toLowerCase().includes(searchLower) ||
          token.name.toLowerCase().includes(searchLower)
        );
      }
    });
    
    // Sort tokens: priority tokens first, then by symbol
    filtered.sort((a, b) => {
      const aPriority = priorityTokens.indexOf(a.address);
      const bPriority = priorityTokens.indexOf(b.address);
      
      // Both are priority tokens
      if (aPriority >= 0 && bPriority >= 0) {
        return aPriority - bPriority;
      }
      
      // One is a priority token
      if (aPriority >= 0) return -1;
      if (bPriority >= 0) return 1;
      
      // Sort by symbol
      return a.symbol.localeCompare(b.symbol);
    });
    
    return filtered;
  }, [tokens, searchValue, searchTab, exclude, excludeTokens]);

  // Handle token selection
  const handleTokenSelect = (token: TokenInfo) => {
    onSelect(token);
    setOpen(false);
    setSearchValue('');
  };

  // Reset search when closing
  useEffect(() => {
    if (!open) {
      setSearchValue('');
      setSearchTab('symbol');
    }
  }, [open]);
  
  // Extract the recently used tokens
  const recentTokens = useMemo(() => {
    if (!tokens) return [];
    
    // In a real app, we'd track this in localStorage
    // For now, just use the 3 primary tokens as "recent"
    return tokens.filter(token => 
      [SOL_TOKEN_ADDRESS, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS].includes(token.address) &&
      !exclude.includes(token.address) && 
      !excludeTokens.includes(token.address)
    );
  }, [tokens, exclude, excludeTokens]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="flex items-center justify-between min-w-[120px] h-10 bg-dark-300 border-dark-400"
          disabled={disabled}
        >
          {selectedToken ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <Avatar className="h-5 w-5">
                <AvatarImage 
                  src={selectedToken.logoURI} 
                  alt={selectedToken.symbol} 
                />
                <AvatarFallback>
                  <CircleDashed className="h-3 w-3 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <span className="font-medium truncate">{selectedToken.symbol}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Select token</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md md:max-w-lg bg-dark-200 border-dark-300 overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-dark-300">
          <DialogTitle className="text-xl">Select a Token</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Search by symbol or contract address
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6">
          {/* Search Bar with Tabs */}
          <Tabs 
            defaultValue="symbol" 
            value={searchTab} 
            onValueChange={(value) => setSearchTab(value as 'symbol' | 'address')}
            className="mb-6"
          >
            <div className="flex items-center border rounded-md px-4 py-2 mb-2 bg-dark-300 border-dark-400">
              <Search className="h-4 w-4 mr-2 text-muted-foreground" />
              <Input 
                placeholder={searchTab === 'symbol' ? "Search by token name or symbol" : "Enter token contract address"} 
                className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-sm"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>
            
            <TabsList className="grid grid-cols-2 bg-dark-300">
              <TabsTrigger value="symbol" className="flex items-center gap-1">
                <Coins className="h-4 w-4" />
                <span>Symbol/Name</span>
              </TabsTrigger>
              <TabsTrigger value="address" className="flex items-center gap-1">
                <Hash className="h-4 w-4" />
                <span>Contract Address</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {/* Recently Used */}
          {!searchValue && recentTokens.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center mb-2">
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground">Recently Used</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {recentTokens.map(token => (
                  <Button
                    key={`recent-${token.address}`}
                    variant="outline"
                    className="flex flex-col items-center justify-center h-20 p-2 bg-dark-300 border-dark-400 hover:bg-dark-400"
                    onClick={() => handleTokenSelect(token)}
                  >
                    <Avatar className="h-8 w-8 mb-1">
                      <AvatarImage src={token.logoURI} alt={token.symbol} />
                      <AvatarFallback>
                        <CircleDashed className="h-4 w-4 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">{token.symbol}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {/* Popular Tokens */}
          {!searchValue && (
            <div className="mb-6">
              <div className="flex items-center mb-2">
                <Star className="h-4 w-4 mr-2 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground">Popular Tokens</h3>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {tokens && 
                  tokens
                    .filter(token => [SOL_TOKEN_ADDRESS, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'].includes(token.address))
                    .filter(token => !exclude.includes(token.address) && !excludeTokens.includes(token.address))
                    .map(token => (
                      <Button
                        key={token.address}
                        variant="outline"
                        className="flex flex-col items-center justify-center h-20 p-2 bg-dark-300 border-dark-400 hover:bg-dark-400"
                        onClick={() => handleTokenSelect(token)}
                      >
                        <Avatar className="h-8 w-8 mb-1">
                          <AvatarImage src={token.logoURI} alt={token.symbol} />
                          <AvatarFallback>
                            <CircleDashed className="h-4 w-4 text-muted-foreground" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">{token.symbol}</span>
                      </Button>
                    ))
                }
              </div>
            </div>
          )}
          
          {/* Token List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <ArrowDownUp className="h-4 w-4 mr-2 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground">
                  {searchValue ? 'Search Results' : 'All Tokens'}
                </h3>
              </div>
              
              {searchValue && filteredTokens.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {filteredTokens.length} result{filteredTokens.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            
            {tokensLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full bg-dark-300" />
                <Skeleton className="h-14 w-full bg-dark-300" />
                <Skeleton className="h-14 w-full bg-dark-300" />
              </div>
            ) : filteredTokens.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground bg-dark-300/30 rounded-lg">
                <p className="font-medium">No tokens found</p>
                <p className="text-sm mt-1">
                  Try a different search term or check the token address format
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-1">
                  {filteredTokens.map(token => (
                    <Button
                      key={token.address}
                      variant="ghost"
                      className="w-full justify-start py-3 px-3 h-auto"
                      onClick={() => handleTokenSelect(token)}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={token.logoURI} alt={token.symbol} />
                            <AvatarFallback>
                              <CircleDashed className="h-4 w-4 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex flex-col items-start overflow-hidden">
                            <span className="font-medium">{token.symbol}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {token.name}
                            </span>
                          </div>
                        </div>
                        
                        {selectedToken?.address === token.address && (
                          <Check className="h-4 w-4 ml-2" />
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}