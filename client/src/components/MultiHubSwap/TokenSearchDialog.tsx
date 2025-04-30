import { useState, useEffect, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  CircleDashed, 
  ChevronsUpDown,
  Copy,
  X
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchSolanaTokens } from '@/lib/token-search-api';
import { TokenInfo } from '@/lib/token-search-api';
import { SOL_TOKEN_ADDRESS, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS, EXPLORER_URL } from '@/lib/constants';
import { ScrollArea } from '@/components/ui/scroll-area';

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
      <DialogContent className="sm:max-w-md md:max-w-lg bg-dark-950 border-dark-800 overflow-hidden p-0">
        <DialogHeader className="px-4 pt-4 pb-2 flex flex-row justify-between items-center">
          <DialogTitle className="text-base font-medium">Select a token</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>
        
        <div className="p-4 space-y-4">
          {/* Search Bar */}
          <div className="flex items-center rounded-md px-4 py-2 bg-dark-900 border-0">
            <Search className="h-4 w-4 mr-2 text-muted-foreground" />
            <Input 
              placeholder="Search by token or paste address"
              className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-sm"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          
          {/* Popular Tokens */}
          {!searchValue && (
            <div className="mb-2">
              <h3 className="text-sm text-muted-foreground mb-2">Popular tokens</h3>
              <div className="grid grid-cols-4 gap-2">
                {tokens && 
                  tokens
                    .filter(token => ['So11111111111111111111111111111111111111112', YOT_TOKEN_ADDRESS, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'].includes(token.address))
                    .filter(token => !exclude.includes(token.address) && !excludeTokens.includes(token.address))
                    .map(token => (
                      <Button
                        key={token.address}
                        variant="outline"
                        className="flex items-center justify-start h-12 p-2 bg-dark-800 border-dark-700 hover:bg-dark-700"
                        onClick={() => handleTokenSelect(token)}
                      >
                        <Avatar className="h-6 w-6 mr-2">
                          <AvatarImage src={token.logoURI} alt={token.symbol} />
                          <AvatarFallback>
                            <CircleDashed className="h-3 w-3 text-muted-foreground" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">{token.symbol}</span>
                      </Button>
                    ))
                }
              </div>
            </div>
          )}
          
          {/* Token List Section */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm text-muted-foreground">Token</h3>
              <h3 className="text-sm text-muted-foreground">Balance/Address</h3>
            </div>
            
            {tokensLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full bg-dark-800" />
                <Skeleton className="h-14 w-full bg-dark-800" />
                <Skeleton className="h-14 w-full bg-dark-800" />
              </div>
            ) : filteredTokens.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground bg-dark-900/30 rounded-md">
                <p className="text-sm">Can't find the token you're looking for? Try entering the mint address or check token list settings below.</p>
                <Button variant="outline" className="mt-4 text-sm">
                  View Token List
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-2">
                <div className="space-y-1">
                  {filteredTokens.map(token => (
                    <Button
                      key={token.address}
                      variant="ghost"
                      className="w-full justify-between py-2 px-2 h-auto bg-transparent hover:bg-dark-800"
                      onClick={() => handleTokenSelect(token)}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={token.logoURI} alt={token.symbol} />
                          <AvatarFallback>
                            <CircleDashed className="h-4 w-4 text-muted-foreground" />
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
                          {/* We'd normally get the real balance here */}
                          {token.symbol === 'SOL' ? '0.61' : '0'}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center">
                          {token.address.substring(0, 6)}...{token.address.substring(token.address.length - 6)}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-4 w-4 ml-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(token.address);
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </span>
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