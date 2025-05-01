import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Search, Check } from "lucide-react";

// Type for token information
export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
}

interface TokenSearchInputProps {
  selectedToken: TokenInfo;
  onTokenSelect: (token: TokenInfo) => void;
  commonTokens?: TokenInfo[];
  placeholder?: string;
  label?: string;
}

export const TokenSearchInput: React.FC<TokenSearchInputProps> = ({
  selectedToken,
  onTokenSelect,
  commonTokens = [],
  placeholder = "Search tokens...",
  label = "Select token"
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter tokens based on search query
  const filteredTokens = commonTokens.filter(token =>
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 w-40"
        >
          {selectedToken.logoURI && (
            <img
              src={selectedToken.logoURI}
              alt={selectedToken.symbol}
              className="w-5 h-5 rounded-full"
            />
          )}
          <span className="font-medium">{selectedToken.symbol}</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent>
        <DialogTitle className="mb-4">{label}</DialogTitle>
        
        <Command>
          <CommandInput
            placeholder={placeholder}
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="mb-2"
          />
          
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>No tokens found.</CommandEmpty>
            
            <CommandGroup>
              {filteredTokens.map((token) => (
                <CommandItem
                  key={token.address}
                  onSelect={() => {
                    onTokenSelect(token);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                  className="flex items-center gap-2 cursor-pointer p-2 hover:bg-accent"
                >
                  {token.logoURI && (
                    <img
                      src={token.logoURI}
                      alt={token.symbol}
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  
                  <div className="flex flex-col flex-1">
                    <span className="font-medium">{token.symbol}</span>
                    <span className="text-xs text-muted-foreground">{token.name}</span>
                  </div>
                  
                  {selectedToken.address === token.address && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};