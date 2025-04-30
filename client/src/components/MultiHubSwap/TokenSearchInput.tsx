import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Search, ChevronDown } from 'lucide-react';
import { TokenMetadata, searchTokens } from '@/lib/token-search-api';

interface TokenSearchInputProps {
  onTokenSelect: (token: TokenMetadata) => void;
  selectedToken?: TokenMetadata;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function TokenSearchInput({
  onTokenSelect,
  selectedToken,
  label = 'Select Token',
  placeholder = 'Search by name or address',
  disabled = false
}: TokenSearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  // Search for tokens
  useEffect(() => {
    async function performSearch() {
      setIsLoading(true);
      try {
        const results = await searchTokens(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching tokens:', error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }

    if (isOpen) {
      performSearch();
    }
  }, [searchQuery, isOpen]);

  // Toggle dropdown
  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setSearchQuery('');
      }
    }
  };

  // Handle token selection
  const handleTokenSelect = (token: TokenMetadata) => {
    onTokenSelect(token);
    setIsOpen(false);
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
            {selectedToken.logoURI && (
              <img
                src={selectedToken.logoURI}
                alt={selectedToken.name}
                className="w-5 h-5 mr-2 rounded-full"
              />
            )}
            <span>{selectedToken.symbol}</span>
          </div>
        ) : (
          <span>{label}</span>
        )}
        <ChevronDown className="h-4 w-4 ml-2" />
      </Button>
      
      {isOpen && (
        <Card className="absolute z-10 mt-1 w-full max-h-80 overflow-auto">
          <div className="p-2">
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
            
            <div className="mt-2">
              {isLoading ? (
                <div className="flex justify-center p-4">
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : searchResults.length > 0 ? (
                <ul className="space-y-1">
                  {searchResults.map((token) => (
                    <li key={token.address}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => handleTokenSelect(token)}
                      >
                        <div className="flex items-center">
                          {token.logoURI && (
                            <img
                              src={token.logoURI}
                              alt={token.name}
                              className="w-6 h-6 mr-2 rounded-full"
                            />
                          )}
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{token.symbol}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {token.name}
                            </span>
                          </div>
                        </div>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No tokens found
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}