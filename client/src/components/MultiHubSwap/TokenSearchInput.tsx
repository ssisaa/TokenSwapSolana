import { useState, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown, Search, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TokenMetadata, searchTokens } from '@/lib/token-search-api';
import { YOT_TOKEN_ADDRESS } from '@/lib/constants';

interface TokenSearchInputProps {
  onSelect: (token: TokenMetadata) => void;
  selectedToken?: TokenMetadata;
  placeholder?: string;
  excludeTokens?: string[];
  disabled?: boolean;
}

export default function TokenSearchInput({ 
  onSelect, 
  selectedToken, 
  placeholder = "Search tokens...",
  excludeTokens = [],
  disabled = false
}: TokenSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [tokens, setTokens] = useState<TokenMetadata[]>([]);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Function to load tokens
  const loadTokens = async (query: string) => {
    setIsSearching(true);
    try {
      const results = await searchTokens(query);
      // Filter out excluded tokens
      const filteredResults = results.filter(token => 
        !excludeTokens.includes(token.address)
      );
      setTokens(filteredResults);
    } catch (error) {
      console.error("Error searching tokens:", error);
      setTokens([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Search tokens with debounce
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    searchTimeout.current = setTimeout(() => {
      loadTokens(searchQuery);
    }, 300);
    
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery]);
  
  // Load initial tokens
  useEffect(() => {
    loadTokens('');
  }, []);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between w-full"
          disabled={disabled}
        >
          {selectedToken ? (
            <div className="flex items-center">
              {selectedToken.logoURI && (
                <img 
                  src={selectedToken.logoURI} 
                  alt={selectedToken.symbol} 
                  className="w-5 h-5 mr-2 rounded-full" 
                />
              )}
              <span>{selectedToken.symbol}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput 
              placeholder="Search tokens..." 
              className="h-9 flex-1"
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
          </div>
          <CommandList>
            {isSearching ? (
              <div className="py-6 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Searching tokens...</p>
              </div>
            ) : (
              <>
                <CommandEmpty>No tokens found.</CommandEmpty>
                <CommandGroup>
                  {tokens.map((token) => (
                    <CommandItem
                      key={token.address}
                      value={token.address}
                      onSelect={() => {
                        onSelect(token);
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-center">
                        {token.logoURI && (
                          <img 
                            src={token.logoURI} 
                            alt={token.symbol} 
                            className="w-5 h-5 mr-2 rounded-full" 
                          />
                        )}
                        <span className="font-medium">{token.symbol}</span>
                        <span className="ml-2 text-xs text-muted-foreground truncate max-w-[100px]">
                          {token.name}
                        </span>
                      </div>
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          selectedToken?.address === token.address 
                            ? "opacity-100" 
                            : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}