import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TokenListDialog } from './TokenListDialog';
import { TokenInfo } from '@/lib/token-search-api';
import { CircleDashed, ChevronDown } from 'lucide-react';

interface TokenSelectorProps {
  selectedToken: TokenInfo | null;
  onSelect: (token: TokenInfo) => void;
  exclude?: string[];
  disabled?: boolean;
}

export function TokenSelector({
  selectedToken,
  onSelect,
  exclude = [],
  disabled = false
}: TokenSelectorProps) {
  return (
    <div className="relative">
      <TokenListDialog 
        selectedToken={selectedToken}
        onSelect={onSelect}
        exclude={exclude}
        disabled={disabled}
      />
    </div>
  );
}