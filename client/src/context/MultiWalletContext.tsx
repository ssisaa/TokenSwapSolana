import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { WalletError } from '@solana/wallet-adapter-base';
import { Cluster, PublicKey } from '@solana/web3.js';
import { CLUSTER } from '../lib/constants';

interface WalletInfo {
  name: string;
  icon: string;
  adapter: any;
  installed: boolean;
}

export interface MultiWalletContextType {
  wallets: WalletInfo[];
  selectedWallet: WalletInfo | null;
  wallet: any;
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  connect: (walletName?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  showWalletSelector: boolean;
  setShowWalletSelector: (show: boolean) => void;
}

export const MultiWalletContext = createContext<MultiWalletContextType | null>(null);

interface MultiWalletProviderProps {
  children: ReactNode;
  cluster?: Cluster;
}

export function MultiWalletProvider({ children, cluster = CLUSTER }: MultiWalletProviderProps) {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<WalletInfo | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);

  // Initialize wallet adapters
  useEffect(() => {
    const detectedWallets: WalletInfo[] = [];
    
    // Check for Phantom wallet
    const phantomAdapter = new PhantomWalletAdapter();
    const phantomInstalled = 'phantom' in window || typeof window.solana !== 'undefined';
    
    detectedWallets.push({
      name: 'Phantom',
      icon: 'https://www.phantom.app/img/logo.png',
      adapter: phantomAdapter,
      installed: phantomInstalled
    });
    
    // We can add more wallet adapters here in the future

    // Set detected wallets
    setWallets(detectedWallets);
    
    // If we have a previously selected wallet in localStorage, use that
    const storedWallet = localStorage.getItem('selectedWallet');
    if (storedWallet) {
      const foundWallet = detectedWallets.find(w => w.name === storedWallet);
      if (foundWallet && foundWallet.installed) {
        setSelectedWallet(foundWallet);
        setWallet(foundWallet.adapter);
      }
    }
    // Otherwise, default to Phantom if it's installed
    else if (phantomInstalled) {
      setSelectedWallet(detectedWallets[0]);
      setWallet(phantomAdapter);
    }
  }, [cluster]);

  // Set up wallet event listeners
  useEffect(() => {
    if (!wallet) return;

    const onConnect = () => {
      if (wallet.publicKey) {
        setPublicKey(wallet.publicKey);
        setConnected(true);
        setConnecting(false);
        
        // Save selected wallet name to localStorage
        if (selectedWallet) {
          localStorage.setItem('selectedWallet', selectedWallet.name);
        }
      }
    };

    const onDisconnect = () => {
      setPublicKey(null);
      setConnected(false);
      localStorage.removeItem('selectedWallet');
    };

    const onError = (error: WalletError) => {
      console.error('Wallet error:', error);
      setConnecting(false);
    };

    wallet.on('connect', onConnect);
    wallet.on('disconnect', onDisconnect);
    wallet.on('error', onError);

    // If wallet was already connected, set the state appropriately
    if (wallet.connected && wallet.publicKey) {
      setPublicKey(wallet.publicKey);
      setConnected(true);
    }

    return () => {
      wallet.off('connect', onConnect);
      wallet.off('disconnect', onDisconnect);
      wallet.off('error', onError);
    };
  }, [wallet, selectedWallet]);

  // Auto-connect to the last connected wallet on page load, but only once
  useEffect(() => {
    // Only run auto-connect on initial load
    const shouldAutoConnect = localStorage.getItem('shouldAutoConnect') === 'true';
    
    const autoConnect = async () => {
      if (wallet && !connected && shouldAutoConnect) {
        try {
          if (wallet.readyState === 'Installed' || wallet.readyState === 'Loadable') {
            setConnecting(true);
            await wallet.connect();
            // After auto-connecting once, disable auto-connect until user manually connects again
            localStorage.setItem('shouldAutoConnect', 'false');
          }
        } catch (error) {
          console.error('Auto-connect error:', error);
          setConnecting(false);
          localStorage.setItem('shouldAutoConnect', 'false');
        }
      }
    };

    autoConnect();
  }, [wallet, connected]);

  // Helper function to handle wallet disconnection - defined outside callbacks to avoid circular dependencies
  const handleDisconnect = async () => {
    if (wallet && connected) {
      try {
        // First disconnect the wallet
        await wallet.disconnect();
        
        // Clear local storage data
        localStorage.removeItem('selectedWallet');
        localStorage.removeItem('shouldAutoConnect');
        
        // Reset state
        setSelectedWallet(null);
        setPublicKey(null);
        setConnected(false);
      } catch (error) {
        console.error('Disconnection error:', error);
      }
    }
  };

  // Create a standard callback for disconnection
  const disconnect = useCallback(() => handleDisconnect(), [wallet, connected]);

  const connect = useCallback(async (walletName?: string) => {
    try {
      // If already connected and trying to switch wallets, disconnect first
      if (connected && walletName && selectedWallet?.name !== walletName) {
        await handleDisconnect();
      } else if (connecting || (connected && !walletName)) {
        // If already connecting or already connected to the same wallet, do nothing
        return;
      }
      
      setConnecting(true);

      if (walletName) {
        // User selected a specific wallet
        const selectedWallet = wallets.find(w => w.name === walletName);
        if (selectedWallet) {
          setSelectedWallet(selectedWallet);
          setWallet(selectedWallet.adapter);
          
          // Connect to the newly selected wallet
          if (!selectedWallet.adapter.connected) {
            await selectedWallet.adapter.connect();
            
            // Set auto-connect flag for future sessions
            localStorage.setItem('shouldAutoConnect', 'true');
            localStorage.setItem('selectedWallet', selectedWallet.name);
          }
        } else {
          throw new Error(`Wallet "${walletName}" not found or not installed`);
        }
      } else if (wallet) {
        // Use the current wallet adapter
        await wallet.connect();
        
        // Set auto-connect flag
        if (selectedWallet) {
          localStorage.setItem('shouldAutoConnect', 'true');
          localStorage.setItem('selectedWallet', selectedWallet.name);
        }
      } else {
        throw new Error("No wallet adapter available");
      }
    } catch (error) {
      console.error('Connection error:', error);
      setConnecting(false);
      throw error;
    }
  }, [wallets, wallet, connecting, connected, selectedWallet]);

  return (
    <MultiWalletContext.Provider
      value={{
        wallets,
        selectedWallet,
        wallet,
        publicKey,
        connected,
        connecting,
        connect,
        disconnect,
        showWalletSelector,
        setShowWalletSelector
      }}
    >
      {children}
    </MultiWalletContext.Provider>
  );
}

export function useMultiWallet() {
  const context = React.useContext(MultiWalletContext);
  if (!context) {
    throw new Error('useMultiWallet must be used within a MultiWalletProvider');
  }
  return context;
}