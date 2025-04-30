import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, ChevronDown } from 'lucide-react';
import { TokenMetadata, searchTokens, validateTokenAddress } from '@/lib/token-search-api';
import { PublicKey } from '@solana/web3.js';

interface TokenSearchInputProps {
  onTokenSelect: (token: TokenMetadata) => void;
  selectedToken?: TokenMetadata;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  excludeTokens?: string[];
}

export default function TokenSearchInput({
  onTokenSelect,
  selectedToken,
  label = 'Select Token',
  placeholder = 'Search tokens',
  disabled = false,
  excludeTokens = []
}: TokenSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenMetadata[]>([]);
  const [popularTokens, setPopularTokens] = useState<TokenMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Load popular tokens on initial open
  useEffect(() => {
    async function loadPopularTokens() {
      try {
        const tokens = await searchTokens('');
        const filteredTokens = tokens.filter(token => 
          !excludeTokens.includes(token.address)
        ).slice(0, 6);
        setPopularTokens(filteredTokens);
      } catch (error) {
        console.error('Error loading popular tokens:', error);
      }
    }

    if (open && popularTokens.length === 0) {
      loadPopularTokens();
    }
  }, [open, excludeTokens]);

  // Search for tokens
  useEffect(() => {
    async function performSearch() {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      
      setIsLoading(true);
      try {
        // Check if input looks like a Solana address
        const isAddress = searchQuery.length >= 32 && searchQuery.length <= 44;
        
        if (isAddress) {
          try {
            // Validate the address
            new PublicKey(searchQuery);
            
            // Check if this is a valid SPL token
            const validationResult = await validateTokenAddress(searchQuery);
            
            if (validationResult) {
              // If valid token, add it to results
              setSearchResults([validationResult]);
            } else {
              const results = await searchTokens(searchQuery);
              setSearchResults(results.filter(token => 
                !excludeTokens.includes(token.address)
              ));
            }
          } catch (err) {
            const results = await searchTokens(searchQuery);
            setSearchResults(results.filter(token => 
              !excludeTokens.includes(token.address)
            ));
          }
        } else {
          // Regular search
          const results = await searchTokens(searchQuery);
          setSearchResults(results.filter(token => 
            !excludeTokens.includes(token.address)
          ));
        }
      } catch (error) {
        console.error('Error searching tokens:', error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }

    if (open) {
      const timeoutId = setTimeout(performSearch, 300); // Debounce search
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, open, excludeTokens]);

  // Handle token selection
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
          disabled={disabled}
        >
          {selectedToken ? (
            <div className="flex items-center">
              {selectedToken.logoURI ? (
                <img
                  src={selectedToken.logoURI}
                  alt={selectedToken.name}
                  className="w-5 h-5 mr-2 rounded-full"
                />
              ) : (
                <div className="w-5 h-5 mr-2 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xs">{selectedToken.symbol.charAt(0)}</span>
                </div>
              )}
              <span>{selectedToken.symbol}</span>
            </div>
          ) : (
            <span>Select a token</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <div className="p-2 border-b">
          <div className="flex items-center rounded-md border px-3">
            <Search className="mr-2 h-4 w-4 opacity-50" />
            <Input
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 p-2 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
        
        <div className="px-2 py-1 text-sm">Popular tokens</div>
        
        <div className="max-h-[250px] overflow-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-1">
              {searchResults.map((token) => (
                <Button
                  key={token.address}
                  variant="ghost"
                  className="w-full justify-start text-left font-normal"
                  onClick={() => handleTokenSelect(token)}
                >
                  <div className="flex items-center">
                    {token.logoURI ? (
                      <img
                        src={token.logoURI}
                        alt={token.name}
                        className="mr-2 h-5 w-5 rounded-full"
                      />
                    ) : (
                      <div className="mr-2 h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs">{token.symbol.charAt(0)}</span>
                      </div>
                    )}
                    <span>{token.symbol}</span>
                  </div>
                </Button>
              ))}
            </div>
          ) : searchQuery.trim() ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              No results found
            </div>
          ) : (
            <div className="space-y-1">
              {popularTokens.map((token) => (
                <Button
                  key={token.address}
                  variant="ghost"
                  className="w-full justify-start text-left font-normal"
                  onClick={() => handleTokenSelect(token)}
                >
                  <div className="flex items-center">
                    {token.logoURI ? (
                      <img
                        src={token.logoURI}
                        alt={token.name}
                        className="mr-2 h-5 w-5 rounded-full"
                      />
                    ) : (
                      <div className="mr-2 h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs">{token.symbol.charAt(0)}</span>
                      </div>
                    )}
                    <span>{token.symbol}</span>
                  </div>
                </Button>
              ))}
            </div>
          )}

          {searchQuery.length >= 32 && !isLoading && (
            <div className="border-t mt-2 pt-2">
              <Button
                variant="ghost"
                className="w-full justify-start font-normal"
                onClick={() => {
                  try {
                    const pubkey = new PublicKey(searchQuery.trim());
                    validateTokenAddress(pubkey.toString())
                      .then(token => {
                        if (token) handleTokenSelect(token);
                      });
                  } catch (e) {
                    // Invalid address
                  }
                }}
              >
                <div className="flex flex-col items-start">
                  <span>Import token</span>
                  <span className="text-xs text-muted-foreground">
                    {searchQuery.slice(0, 8)}...{searchQuery.slice(-8)}
                  </span>
                </div>
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}