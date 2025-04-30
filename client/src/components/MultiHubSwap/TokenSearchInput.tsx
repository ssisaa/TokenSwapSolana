import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Search, ChevronDown, ExternalLink, Plus, AlertCircle } from 'lucide-react';
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
  placeholder = 'Search by name or paste address',
  disabled = false,
  excludeTokens = []
}: TokenSearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenMetadata[]>([]);
  const [popularTokens, setPopularTokens] = useState<TokenMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingAddress, setIsValidatingAddress] = useState(false);
  const [addressValidationError, setAddressValidationError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load popular tokens on initial open
  useEffect(() => {
    async function loadPopularTokens() {
      try {
        const tokens = await searchTokens('');
        const filteredTokens = tokens.filter(token => 
          !excludeTokens.includes(token.address)
        ).slice(0, 4); // Show top 4 tokens
        setPopularTokens(filteredTokens);
      } catch (error) {
        console.error('Error loading popular tokens:', error);
      }
    }

    if (isOpen && popularTokens.length === 0) {
      loadPopularTokens();
    }
  }, [isOpen, excludeTokens]);

  // Search for tokens
  useEffect(() => {
    async function performSearch() {
      setIsLoading(true);
      setAddressValidationError(null);
      
      try {
        // Check if input looks like a Solana address
        const isAddress = searchQuery.length >= 32 && searchQuery.length <= 44;
        
        if (isAddress) {
          setIsValidatingAddress(true);
          try {
            // Validate the address
            new PublicKey(searchQuery);
            
            // Check if this is a valid SPL token
            const validationResult = await validateTokenAddress(searchQuery);
            
            if (validationResult) {
              // If valid token, add it to results
              setSearchResults([validationResult]);
            } else {
              setAddressValidationError('Not a valid SPL token');
              // Still show other search results
              const results = await searchTokens(searchQuery);
              setSearchResults(results.filter(token => 
                !excludeTokens.includes(token.address)
              ));
            }
          } catch (err) {
            setAddressValidationError('Invalid address format');
            // Still show other search results
            const results = await searchTokens(searchQuery);
            setSearchResults(results.filter(token => 
              !excludeTokens.includes(token.address)
            ));
          }
          setIsValidatingAddress(false);
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
        setIsValidatingAddress(false);
      }
    }

    if (isOpen && searchQuery.trim()) {
      performSearch();
    } else if (isOpen) {
      // If no search query, show popular tokens
      setSearchResults([]);
      setAddressValidationError(null);
    }
  }, [searchQuery, isOpen, excludeTokens]);

  // Toggle dropdown
  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setSearchQuery('');
        setAddressValidationError(null);
      }
    }
  };

  // Handle token selection
  const handleTokenSelect = (token: TokenMetadata) => {
    onTokenSelect(token);
    setIsOpen(false);
  };

  // Handle "Add Custom Token" button
  const handleAddCustomToken = async () => {
    if (!searchQuery.trim() || isValidatingAddress) return;
    
    try {
      setIsValidatingAddress(true);
      
      // Validate address
      const pubkey = new PublicKey(searchQuery.trim());
      const customToken = await validateTokenAddress(pubkey.toString());
      
      if (customToken) {
        onTokenSelect(customToken);
        setIsOpen(false);
      } else {
        setAddressValidationError('Not a valid SPL token mint address');
      }
    } catch (error) {
      setAddressValidationError('Invalid address format');
      console.error('Error adding custom token:', error);
    } finally {
      setIsValidatingAddress(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        className="w-full justify-between"
        onClick={handleToggle}
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
          <span>{label}</span>
        )}
        <ChevronDown className="h-4 w-4 ml-2" />
      </Button>
      
      {isOpen && (
        <Card className="absolute z-10 mt-1 w-full max-h-[350px] overflow-hidden flex flex-col">
          <div className="p-3 border-b">
            <div className="text-lg font-semibold mb-3">Select a token</div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={placeholder}
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          
          {/* Popular tokens section */}
          {!searchQuery.trim() && (
            <div className="p-3 border-b">
              <div className="text-sm text-muted-foreground mb-2">Popular tokens</div>
              <div className="flex flex-wrap gap-2">
                {popularTokens.map((token) => (
                  <Button
                    key={token.address}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => handleTokenSelect(token)}
                  >
                    {token.logoURI ? (
                      <img src={token.logoURI} alt={token.symbol} className="w-4 h-4 rounded-full" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs">{token.symbol.charAt(0)}</span>
                      </div>
                    )}
                    {token.symbol}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {/* Search results / token list */}
          <div className="flex-1 overflow-auto p-0">
            {isLoading || isValidatingAddress ? (
              <div className="flex justify-center items-center p-4">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : searchQuery.trim() && searchQuery.length >= 32 && !addressValidationError ? (
              <Button
                variant="ghost"
                className="w-full justify-start p-3 rounded-none"
                onClick={handleAddCustomToken}
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 mr-3 rounded-full bg-muted flex items-center justify-center">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Add Custom Token</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {searchQuery.slice(0, 10)}...{searchQuery.slice(-8)}
                    </span>
                  </div>
                </div>
              </Button>
            ) : addressValidationError ? (
              <div className="flex items-center justify-center p-4 text-destructive">
                <AlertCircle className="h-4 w-4 mr-2" />
                <span className="text-sm">{addressValidationError}</span>
              </div>
            ) : searchResults.length > 0 ? (
              <ul className="divide-y">
                {searchResults.map((token) => (
                  <li key={token.address}>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-3 rounded-none h-auto"
                      onClick={() => handleTokenSelect(token)}
                    >
                      <div className="flex items-center">
                        {token.logoURI ? (
                          <img
                            src={token.logoURI}
                            alt={token.name}
                            className="w-8 h-8 mr-3 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 mr-3 rounded-full bg-muted flex items-center justify-center">
                            <span>{token.symbol.charAt(0)}</span>
                          </div>
                        )}
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{token.symbol}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {token.name}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div>0</div>
                        <div className="text-xs text-muted-foreground flex items-center">
                          {token.address.slice(0, 4)}...{token.address.slice(-4)}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </div>
                      </div>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : searchQuery.trim() ? (
              <div className="text-center py-6 px-4">
                <div className="text-sm text-muted-foreground mb-1">
                  Can't find the token you're looking for? Try entering the mint
                  address or check token list settings below.
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="mt-2"
                  onClick={() => {/* View token list settings */}}
                >
                  View Token List
                </Button>
              </div>
            ) : (
              <div className="flex justify-center items-center p-4 text-muted-foreground">
                Search for a token or paste an address
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}