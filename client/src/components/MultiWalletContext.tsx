import { createContext, useContext } from 'react';

interface WalletContextType {
  wallet: any;
  connected: boolean;
  connecting: boolean;
  connect: (walletName?: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextType | null>(null);

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within a WalletProvider');
  }
  return context;
}