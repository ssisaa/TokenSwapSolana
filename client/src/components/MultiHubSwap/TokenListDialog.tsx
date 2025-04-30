import React, { useState, useEffect, useMemo } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  X, 
  CircleDashed,
  Copy,
  ExternalLink,
  ChevronsUpDown,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchSolanaTokens } from '@/lib/token-search-api';
import { TokenInfo } from '@/lib/token-search-api';
import { SOL_TOKEN_ADDRESS, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS, EXPLORER_URL } from '@/lib/constants';

interface TokenListDialogProps {
  selectedToken: TokenInfo | null;
  onSelect: (token: TokenInfo) => void;
  exclude?: string[];
  disabled?: boolean;
}

export function TokenListDialog({ 
  selectedToken, 
  onSelect, 
  exclude = [],
  disabled = false
}: TokenListDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  
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
      YOS_TOKEN_ADDRESS,
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC devnet
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' // USDT devnet
    ];
    
    // Filter tokens
    let filtered = tokens.filter(token => {
      // Check exclude list
      if (exclude.includes(token.address)) return false;
      
      if (!searchValue) return true;
      
      const searchLower = searchValue.toLowerCase();
      
      return (
        token.symbol.toLowerCase().includes(searchLower) ||
        token.name.toLowerCase().includes(searchLower) ||
        token.address.toLowerCase().includes(searchLower)
      );
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
  }, [tokens, searchValue, exclude]);

  // Get popular tokens
  const popularTokens = useMemo(() => {
    if (!tokens) return [];
    
    return tokens.filter(token => 
      ['So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 'RAY111111111111111111111111111111111111111'].includes(token.address) 
      && !exclude.includes(token.address)
    );
  }, [tokens, exclude]);

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
    }
  }, [open]);

  const copyAddress = (e: React.MouseEvent, address: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
  };

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
                {popularTokens.map(token => (
                  <Button
                    key={token.address}
                    variant="outline"
                    className="flex items-center justify-center h-12 py-5 px-3 bg-[#111729] border-0 hover:bg-[#1a2340] rounded-md"
                    onClick={() => handleTokenSelect(token)}
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
                  {filteredTokens.map(token => (
                    <div
                      key={token.address}
                      onClick={() => handleTokenSelect(token)}
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
                            onClick={(e) => copyAddress(e, token.address)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {selectedToken?.address === token.address && (
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
  );
}