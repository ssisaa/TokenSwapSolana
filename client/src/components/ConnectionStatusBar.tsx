import React from 'react';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { CLUSTER } from '@/lib/constants';
import TokenBalanceDisplay from './TokenBalanceDisplay';
import { Button } from '@/components/ui/button';
import WalletSelectorModal from './WalletSelectorModal';

export default function ConnectionStatusBar() {
  const { connected, setShowWalletSelector, showWalletSelector } = useMultiWallet();

  return (
    <div className="w-full bg-zinc-900 text-white py-2 px-4 flex justify-between items-center shadow-md">
      <div className="flex items-center">
        <div className="w-2 h-2 bg-green-500 rounded-full mr-2 pulse"></div>
        <span className="text-sm">Connected to Solana {CLUSTER}</span>
      </div>
      
      {connected ? (
        <TokenBalanceDisplay />
      ) : (
        <Button 
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => setShowWalletSelector(true)}
        >
          Connect Wallet
        </Button>
      )}
      
      <WalletSelectorModal />
    </div>
  );
}