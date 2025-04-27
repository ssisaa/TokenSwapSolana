import React from 'react';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { shortenAddress } from '@/lib/utils';
import { CLUSTER } from '@/lib/constants';
import MultiWalletConnect from './MultiWalletConnect';

export default function ConnectionStatusBar() {
  const { connected, publicKey } = useMultiWallet();

  return (
    <div className="w-full bg-zinc-900 text-white py-2 px-4 flex justify-between items-center shadow-md">
      <div className="flex items-center">
        <div className="w-2 h-2 bg-green-500 rounded-full mr-2 pulse"></div>
        <span className="text-sm">Connected to Solana {CLUSTER}</span>
      </div>
      
      <div>
        {connected && publicKey && (
          <div className="flex items-center">
            <span className="text-sm mr-4 text-gray-300">
              {shortenAddress(publicKey.toString())}
            </span>
            <MultiWalletConnect />
          </div>
        )}
        
        {!connected && (
          <MultiWalletConnect />
        )}
      </div>
    </div>
  );
}