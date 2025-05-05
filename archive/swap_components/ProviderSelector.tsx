import React from 'react';
import { SwapProvider } from '@/lib/multi-hub-swap';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ProviderSelectorProps {
  selectedProvider?: SwapProvider;
  currentProvider: SwapProvider;
  onSelectProvider: (provider?: SwapProvider) => void;
}

export function ProviderSelector({ 
  selectedProvider, 
  currentProvider, 
  onSelectProvider 
}: ProviderSelectorProps) {
  return (
    <div className="flex items-center space-x-1 text-sm">
      <div className="flex items-center">
        <Badge variant="outline" className="bg-[#141c2f] text-[#a3accd] border-[#1e2a45] text-xs font-normal px-2 py-0 h-6">
          <Zap className="mr-1 h-3 w-3 text-primary" />
          {selectedProvider === undefined ? 'Auto' : 
           selectedProvider === SwapProvider.Contract ? 'Multi-hub' : 
           selectedProvider === SwapProvider.Raydium ? 'Raydium' : 
           selectedProvider === SwapProvider.Jupiter ? 'Jupiter' : 'Direct'}
          {selectedProvider === undefined && (
            <span className="ml-1 text-[#7d8ab1]">
              ({currentProvider === SwapProvider.Contract ? 'Multi-hub' : 
              currentProvider === SwapProvider.Raydium ? 'Raydium' : 
              currentProvider === SwapProvider.Jupiter ? 'Jupiter' : 'Direct'})
            </span>
          )}
        </Badge>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Settings className="h-3 w-3 text-[#a3accd]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-[#0f1421] border-[#1e2a45]">
          <DropdownMenuLabel className="text-[#a3accd]">Select Provider</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-[#1e2a45]" />
          <DropdownMenuItem 
            className={`${selectedProvider === undefined ? 'bg-primary/20 text-primary' : 'text-[#a3accd]'}`}
            onClick={() => onSelectProvider(undefined)}
          >
            Auto (Best Price)
          </DropdownMenuItem>
          <DropdownMenuItem 
            className={`${selectedProvider === SwapProvider.Contract ? 'bg-primary/20 text-primary' : 'text-[#a3accd]'}`}
            onClick={() => onSelectProvider(SwapProvider.Contract)}
          >
            Multi-hub Contract
          </DropdownMenuItem>
          <DropdownMenuItem 
            className={`${selectedProvider === SwapProvider.Raydium ? 'bg-primary/20 text-primary' : 'text-[#a3accd]'}`}
            onClick={() => onSelectProvider(SwapProvider.Raydium)}
          >
            Raydium DEX
          </DropdownMenuItem>
          <DropdownMenuItem 
            className={`${selectedProvider === SwapProvider.Jupiter ? 'bg-primary/20 text-primary' : 'text-[#a3accd]'}`}
            onClick={() => onSelectProvider(SwapProvider.Jupiter)}
          >
            Jupiter Aggregator
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}