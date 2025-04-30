import { useState, useEffect } from 'react';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchTokens } from '@/lib/token-search-api';
import { TokenMetadata } from '@/lib/multi-hub-swap';

interface TokenSearchInputProps {
  selectedToken: TokenMetadata | null;
  onSelect: (token: TokenMetadata) => void;
  excludeTokens?: string[];
}

export function TokenSearchInput({ 
  selectedToken, 
  onSelect, 
  excludeTokens = []
}: TokenSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tokens, setTokens] = useState<TokenMetadata[]>([]);
  
  // Initialize and update token list
  useEffect(() => {
    const results = searchTokens(searchQuery, excludeTokens);
    setTokens(results);
  }, [searchQuery, excludeTokens]);
  
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
            <span className="text-muted-foreground">Select token</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0">
        <Command>
          <CommandInput 
            placeholder="Search tokens..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="h-9"
          />
          <CommandList>
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
                  className="cursor-pointer"
                >
                  <div className="flex items-center w-full">
                    <div className="flex items-center gap-2 flex-1">
                      {token.logoURI && (
                        <img 
                          src={token.logoURI} 
                          alt={token.symbol} 
                          className="w-5 h-5 rounded-full"
                        />
                      )}
                      <div>
                        <div className="font-medium">{token.symbol}</div>
                        <div className="text-xs text-muted-foreground truncate">{token.name}</div>
                      </div>
                    </div>
                    
                    {selectedToken?.address === token.address && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
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