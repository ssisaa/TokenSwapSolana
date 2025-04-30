import React, { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { TokenMetadata, searchTokens, validateTokenAddress } from '@/lib/token-search-api';
import { Loader2 } from 'lucide-react';

interface TokenSearchInputProps {
  onTokenSelect: (token: TokenMetadata | null) => void;
  selectedToken?: TokenMetadata;
  placeholder?: string;
  excludeTokens?: string[];
}

export default function TokenSearchInput({
  onTokenSelect,
  selectedToken,
  placeholder = 'Select Token',
  excludeTokens = []
}: TokenSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddressValidating, setIsAddressValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial popular tokens
  useEffect(() => {
    const fetchInitialTokens = async () => {
      setIsSearching(true);
      try {
        const results = await searchTokens('');
        setSearchResults(results.filter(token => 
          !excludeTokens.includes(token.address)
        ));
      } catch (err) {
        console.error('Error fetching initial tokens:', err);
        setError('Failed to load tokens');
      } finally {
        setIsSearching(false);
      }
    };

    fetchInitialTokens();
  }, [excludeTokens]);

  // Handle search input changes
  useEffect(() => {
    if (!searchQuery.trim()) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setError(null);

      try {
        // Check if the search query is a valid Solana address
        if (searchQuery.length >= 32 && /^[A-HJ-NP-Za-km-z1-9]*$/.test(searchQuery)) {
          setIsAddressValidating(true);
          const validatedToken = await validateTokenAddress(searchQuery);
          
          if (validatedToken) {
            setSearchResults([validatedToken]);
          } else {
            setSearchResults([]);
            setError('Not a valid token address');
          }
          setIsAddressValidating(false);
        } else {
          // Regular token search by name/symbol
          const results = await searchTokens(searchQuery);
          setSearchResults(results.filter(token => 
            !excludeTokens.includes(token.address)
          ));
        }
      } catch (err) {
        console.error('Search error:', err);
        setError('Error searching for tokens');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, excludeTokens]);

  const handleTokenSelect = (token: TokenMetadata) => {
    onTokenSelect(token);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedToken ? (
            <div className="flex items-center gap-2">
              {selectedToken.logoURI && (
                <img 
                  src={selectedToken.logoURI} 
                  alt={selectedToken.symbol} 
                  className="w-5 h-5 rounded-full"
                />
              )}
              <span>{selectedToken.symbol}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 opacity-50"
          >
            <path d="m7 15 5 5 5-5" />
            <path d="m7 9 5-5 5 5" />
          </svg>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search by name or paste address" 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {isSearching ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="py-6 text-center text-sm text-destructive">{error}</div>
              ) : (
                <div className="py-6 text-center text-sm">No tokens found</div>
              )}
            </CommandEmpty>
            <CommandGroup heading="Tokens">
              {searchResults.map((token) => (
                <CommandItem
                  key={token.address}
                  value={token.address}
                  onSelect={() => handleTokenSelect(token)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    {token.logoURI ? (
                      <img 
                        src={token.logoURI} 
                        alt={token.symbol} 
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs">{token.symbol.charAt(0)}</span>
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium">{token.symbol}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {token.name}
                      </span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}