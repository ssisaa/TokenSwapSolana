import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Common Solana tokens
const COMMON_TOKENS = [
  {
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
  },
  {
    address: '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF',
    symbol: 'YOT',
    name: 'YOT Token',
    decimals: 9,
    logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=024' // Placeholder logo
  },
  {
    address: 'GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n',
    symbol: 'YOS',
    name: 'YOS Rewards Token',
    decimals: 9,
    logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=024' // Placeholder logo
  },
  {
    address: '9T7uw5dqaEmEC4McqyefzYsEg5hoC4e2oV8it1Uc4f1U',
    symbol: 'USDC',
    name: 'USD Coin (Devnet)',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
  }
];

export interface TokenSearchInputProps {
  selectedToken: any;
  onSelect: (token: any) => void;
  excludeTokens?: string[];
  placeholder?: string;
}

export function TokenSearchInput({ 
  selectedToken, 
  onSelect, 
  excludeTokens = [],
  placeholder = 'Search token...'
}: TokenSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tokens, setTokens] = useState(COMMON_TOKENS);

  // Filter tokens based on search query and excluded tokens
  const filteredTokens = tokens.filter(token => {
    // Exclude tokens that should not be shown
    if (excludeTokens.includes(token.address)) return false;
    
    // If search query is empty, show all
    if (!searchQuery) return true;
    
    // Search by symbol, name, or address
    const query = searchQuery.toLowerCase();
    return (
      token.symbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query) ||
      token.address.toLowerCase().includes(query)
    );
  });

  // Handle token selection
  const handleSelectToken = (token: any) => {
    onSelect(token);
    setOpen(false);
  };

  // Format token icon and fallback
  const getTokenIcon = (token: any) => {
    return token?.logoURI || 'https://cryptologos.cc/logos/solana-sol-logo.png?v=024';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-background"
        >
          {selectedToken ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <img 
                src={getTokenIcon(selectedToken)}
                alt={selectedToken.symbol}
                className="h-5 w-5 rounded-full" 
              />
              <span className="truncate">{selectedToken.symbol}</span>
            </div>
          ) : (
            <span>Select token</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder={placeholder}
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="py-6 text-center text-sm">No tokens found</div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredTokens.map((token) => (
                <CommandItem
                  key={token.address}
                  value={`${token.symbol}-${token.address}`}
                  onSelect={() => handleSelectToken(token)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <img 
                      src={getTokenIcon(token)}
                      alt={token.symbol}
                      className="h-5 w-5 rounded-full" 
                    />
                    <span className="truncate">{token.symbol}</span>
                    <span className="truncate text-muted-foreground text-xs">{token.name}</span>
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}