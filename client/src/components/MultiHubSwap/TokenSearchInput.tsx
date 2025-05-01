import { useState, useEffect, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Check, 
  ChevronDown, 
  Search, 
  CircleDashed, 
  ChevronsUpDown
} from 'lucide-react';
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { useQuery } from '@tanstack/react-query';
import { fetchSolanaTokens } from '@/lib/token-search-api';
import { TokenInfo } from '@/lib/token-search-api';
import { SOL_TOKEN_ADDRESS, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS } from '@/lib/constants';
import { SwapProvider } from '@/lib/multi-hub-swap';

interface TokenSearchInputProps {
  selectedToken: TokenInfo | null;
  onSelect: (token: TokenInfo) => void;
  exclude?: string[];
  excludeTokens?: string[];  // For backward compatibility
  disabled?: boolean;
  provider?: SwapProvider; // The swap provider to filter tokens by
}

export function TokenSearchInput({ 
  selectedToken, 
  onSelect, 
  exclude = [],
  excludeTokens = [],
  disabled = false,
  provider = SwapProvider.Contract
}: TokenSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  
  // Use provider in the query key to refetch when provider changes
  const { data: tokens, isLoading: tokensLoading } = useQuery({
    queryKey: ['solana-tokens', provider.toString()],
    queryFn: async () => fetchSolanaTokens(provider),
    staleTime: 1000 * 60 * 5, // 5 minutes
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
  }, [tokens, searchValue, exclude, excludeTokens]);

  // Close popover when token is selected
  useEffect(() => {
    if (selectedToken) {
      setOpen(false);
    }
  }, [selectedToken]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="flex items-center justify-between min-w-[120px] h-10 bg-[#141c2f] border-[#1e2a45] hover:bg-[#1a2338] hover:border-[#2a3553] text-white"
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
      </PopoverTrigger>
      <PopoverContent 
        className="w-[300px] p-0 bg-[#0f1421] border border-[#1e2a45] shadow-lg"
        align="start"
      >
        <Command className="bg-[#0f1421] border-none rounded-none">
          <div className="flex items-center border-b border-[#1e2a45] px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-[#7d8ab1]" />
            <input
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none text-[#a3accd] placeholder:text-[#7d8ab1] disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search token..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          
          {tokensLoading ? (
            <div className="p-2 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <CommandList className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#1e2a45] scrollbar-track-[#0f1421]">
              <CommandEmpty className="py-6 text-center text-sm text-[#7d8ab1]">
                No tokens found.
              </CommandEmpty>
              
              <CommandGroup>
                {filteredTokens.map((token) => (
                  <CommandItem
                    key={token.address}
                    value={token.address}
                    onSelect={() => onSelect(token)}
                    className="flex items-center gap-2 py-2 px-3 cursor-pointer text-[#a3accd] hover:bg-[#1a2338] hover:text-white border-b border-[#1e2a45] last:border-b-0"
                  >
                    <Avatar className="h-8 w-8 rounded-full">
                      <AvatarImage 
                        src={token.logoURI} 
                        alt={token.symbol}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-muted">
                        {token.symbol.substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-medium">{token.symbol}</span>
                      <span className="text-xs text-muted-foreground truncate">{token.name}</span>
                    </div>
                    
                    <div className="ml-auto flex items-center gap-1">
                      <a 
                        href={`https://explorer.solana.com/address/${token.address}?cluster=devnet`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs p-1 rounded-sm bg-[#1e2a45] text-[#a3accd] hover:bg-[#252f4a] hover:text-primary transition-colors flex items-center"
                        title="View on Solana Explorer"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                          <polyline points="15 3 21 3 21 9"></polyline>
                          <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                      </a>
                      
                      {selectedToken?.address === token.address && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}