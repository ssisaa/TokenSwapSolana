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
      </PopoverTrigger>
      <PopoverContent 
        className="w-[300px] p-0"
        align="start"
      >
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
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
            <CommandList className="max-h-[300px]">
              <CommandEmpty className="py-6 text-center text-sm">
                No tokens found.
              </CommandEmpty>
              
              <CommandGroup>
                {filteredTokens.map((token) => (
                  <CommandItem
                    key={token.address}
                    value={token.address}
                    onSelect={() => onSelect(token)}
                    className="flex items-center gap-2 py-2 px-2 cursor-pointer hover:bg-accent"
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
                    
                    {selectedToken?.address === token.address && (
                      <Check className="ml-auto h-4 w-4" />
                    )}
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