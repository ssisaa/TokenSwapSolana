import React, { createContext, useState, useEffect, useCallback, ReactNode, useContext } from 'react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { WalletError, WalletAdapter } from '@solana/wallet-adapter-base';
import { Cluster, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { SOLANA_CLUSTER, ADMIN_WALLET_ADDRESS } from '../lib/constants';

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

export function MultiWalletProvider({ children, cluster = SOLANA_CLUSTER as Cluster }: MultiWalletProviderProps) {
  // Convert Solana Cluster to WalletAdapterNetwork
  const walletAdapterNetwork = cluster === 'mainnet-beta' 
    ? WalletAdapterNetwork.Mainnet 
    : cluster === 'testnet' 
      ? WalletAdapterNetwork.Testnet
      : WalletAdapterNetwork.Devnet;
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<WalletInfo | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);

  // Initialize wallet adapters
  useEffect(() => {
    const availableWallets: WalletInfo[] = [];

    try {
      // Define window object compatibility
      if (typeof window === 'undefined') {
        console.warn('Window object not available');
        setWallets(availableWallets);
        return;
      }

      // Function to detect wallet with safer checks
      const detectWallet = (walletName: string) => {
        // In Vite browser builds, we'll always consider wallets as potentially available
        // This avoids TypeScript errors and wallet detection issues
        // The actual check happens when trying to connect
        
        // Simple checks that don't rely on window properties
        try {
          if (walletName === 'phantom') {
            // Check if phantom-like object exists - both modern and legacy structures
            const hasPhantom = typeof window !== 'undefined' && (
                // Modern Phantom structure (more reliable)
                (typeof (window as any).phantom !== 'undefined' && 
                 typeof (window as any).phantom.solana !== 'undefined') ||
                // Legacy structure 
                (typeof (window as any).solana !== 'undefined' && 
                 (window as any).solana.isPhantom)
            );
            
            console.log(`Phantom detection details:`, {
              modern: typeof (window as any).phantom !== 'undefined' && typeof (window as any).phantom.solana !== 'undefined',
              legacy: typeof (window as any).solana !== 'undefined' && (window as any).solana.isPhantom
            });
            
            return hasPhantom;
          } else if (walletName === 'solflare') {
            // Check if solflare-like object exists - multiple detection methods
            const hasSolflare = typeof window !== 'undefined' && (
                // Direct solflare object
                (typeof (window as any).solflare !== 'undefined') || 
                // Solflare via solana object
                (typeof (window as any).solana !== 'undefined' && 
                 (window as any).solana.isSolflare) ||
                // Solflare in user agent
                (navigator.userAgent && navigator.userAgent.indexOf('Solflare') > -1)
            );
            
            console.log(`Solflare detection details:`, {
              direct: typeof (window as any).solflare !== 'undefined',
              viaSolana: typeof (window as any).solana !== 'undefined' && (window as any).solana.isSolflare,
              userAgent: navigator.userAgent && navigator.userAgent.indexOf('Solflare') > -1
            });
            
            return hasSolflare;
          }
        } catch (err) {
          console.warn(`Error checking for wallet ${walletName}:`, err);
        }
        
        // Always return true to ensure wallets are available for connection attempts
        // This ensures we don't prematurely filter out wallets that might be available
        return true;
      };

      // Support all possible network configurations
      const allNetworks = [
        WalletAdapterNetwork.Devnet,   // Our primary target
        WalletAdapterNetwork.Testnet,  // In case wallet is on testnet
        WalletAdapterNetwork.Mainnet   // In case wallet is on mainnet
      ];
      
      // Phantom Wallet - initialize with all network options
      try {
        // Check if phantom is installed first
        const phantomDetected = detectWallet('phantom');
        console.log('Phantom wallet detection:', phantomDetected);
        
        // Create an adapter for each network (we'll select the right one during connection)
        for (const network of allNetworks) {
          const phantomAdapter = new PhantomWalletAdapter({ network });
          
          // Only add each network version once
          if (!availableWallets.some(w => w.name === `Phantom (${network})`)) {
            availableWallets.push({
              name: `Phantom (${network})`,
              icon: 'https://www.phantom.app/img/logo.png',
              adapter: phantomAdapter,
              installed: phantomDetected
            });
          }
        }
      } catch (error) {
        console.error('Error initializing Phantom adapter:', error);
      }
      
      // Solflare Wallet with proper adapter - support all networks
      try {
        // Check if Solflare is available
        const solflareDetected = detectWallet('solflare');
        console.log('Solflare wallet detection:', solflareDetected);
        
        // Create an adapter for each network
        for (const network of allNetworks) {
          const solflareAdapter = new SolflareWalletAdapter({ network });
          
          // Only add each network version once
          if (!availableWallets.some(w => w.name === `Solflare (${network})`)) {
            availableWallets.push({
              name: `Solflare (${network})`,
              icon: 'https://solflare.com/logo.png',
              adapter: solflareAdapter,
              installed: solflareDetected
            });
          }
        }
      } catch (error) {
        console.error('Error initializing Solflare adapter:', error);
      }
      
      // Import and use the DemoWalletAdapter
      try {
        // Import synchronously to avoid async issues
        const DemoWalletAdapter = require('../lib/DemoWalletAdapter').DemoWalletAdapter;
        const demoAdapter = new DemoWalletAdapter();
        
        // Add the demo wallet first (for easy access)
        availableWallets.unshift({
          name: 'Demo Wallet',
          icon: 'https://cdn-icons-png.flaticon.com/512/2534/2534310.png', // Generic wallet icon
          adapter: demoAdapter,
          installed: true // Mark as installed so it can be used
        });
        
        console.log('Added Demo Wallet for testing without browser extensions');
      } catch (error) {
        console.error('Error setting up Demo Wallet:', error);
      }
      
      // If no wallets were detected at all, add basic fallback options
      if (availableWallets.length === 0) {
        console.warn('No wallets detected, adding basic fallback options');
        
        // Basic Phantom fallback
        const phantomAdapter = new PhantomWalletAdapter({ network: walletAdapterNetwork });
        availableWallets.push({
          name: 'Phantom',
          icon: 'https://www.phantom.app/img/logo.png',
          adapter: phantomAdapter,
          installed: false // Explicitly mark as not installed
        });
        
        // Basic Solflare fallback
        const solflareAdapter = new SolflareWalletAdapter({ network: walletAdapterNetwork });
        availableWallets.push({
          name: 'Solflare',
          icon: 'https://solflare.com/logo.png',
          adapter: solflareAdapter,
          installed: false // Explicitly mark as not installed
        });
      }
      
      console.log("Available wallets:", availableWallets.map(w => w.name));
      setWallets(availableWallets);
    } catch (error) {
      console.error("Error initializing wallets:", error);
    }
  }, [walletAdapterNetwork]);

  // Setup wallet event listeners when wallet changes
  useEffect(() => {
    if (!wallet) return;
    
    const onConnect = () => {
      if (wallet.publicKey) {
        setPublicKey(wallet.publicKey);
        setConnected(true);
        setConnecting(false);
      }
    };
    
    const onDisconnect = () => {
      setPublicKey(null);
      setConnected(false);
    };
    
    const onError = (error: WalletError) => {
      console.error("Wallet error:", error);
      setConnecting(false);
    };
    
    wallet.on('connect', onConnect);
    wallet.on('disconnect', onDisconnect);
    wallet.on('error', onError);
    
    // Check immediate state in case wallet is already connected
    if (wallet.publicKey) {
      setPublicKey(wallet.publicKey);
      setConnected(true);
    }
    
    return () => {
      wallet.off('connect', onConnect);
      wallet.off('disconnect', onDisconnect);
      wallet.off('error', onError);
    };
  }, [wallet]);

  // Disconnect function that handles clean disconnection
  const disconnect = useCallback(async () => {
    if (!wallet) return;
    
    try {
      // Only try to disconnect if we're currently connected
      if (connected) {
        await wallet.disconnect();
      }
      
      // Clean up regardless of wallet disconnect success
      setWallet(null);
      setSelectedWallet(null);
      setPublicKey(null);
      setConnected(false);
      
      // Clear local storage flags
      localStorage.removeItem('selectedWallet');
      localStorage.removeItem('shouldAutoConnect');
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  }, [wallet, connected]);

  // Connect function with improved wallet switching and validation
  const connect = useCallback(async (walletName?: string) => {
    try {
      // Early return if already connecting
      if (connecting) return;
      
      // If trying to switch wallets while connected, disconnect first
      if (connected && walletName && selectedWallet && selectedWallet.name !== walletName) {
        setConnecting(true);
        await disconnect();
      } 
      // If trying to connect to the same wallet that's already connected, do nothing
      else if (connected && walletName && selectedWallet && selectedWallet.name === walletName) {
        return;
      }
      
      setConnecting(true);
      
      if (walletName) {
        // Find the specified wallet
        const targetWallet = wallets.find(w => w.name === walletName);
        
        // Always allow connecting even if wallet extension is not detected
        // This ensures we can handle browser extensions that may not be detected correctly
        if (targetWallet) {
          setSelectedWallet(targetWallet);
          setWallet(targetWallet.adapter);
          
          try {
            // Connect to wallet
            await targetWallet.adapter.connect();
            
            // Verify we have a Solana wallet by checking properties
            if (!targetWallet.adapter.publicKey || 
                typeof targetWallet.adapter.publicKey.toBase58 !== 'function') {
              throw new Error("Connected wallet does not appear to be Solana-compatible");
            }
            
            // Save preference
            localStorage.setItem('selectedWallet', targetWallet.name);
            localStorage.setItem('shouldAutoConnect', 'true');
          } catch (err) {
            // Handle wallet not installed case more gracefully
            if (err instanceof Error && (
                err.message.includes('not installed') ||
                err.message.includes('not detected') ||
                err.message.includes('wallet adapter unavailable'))) {
              console.warn(`Wallet extension not detected: ${targetWallet.name}`);
              // Don't throw, just set the error state
              setConnecting(false);
              return; // Exit early
            }
            
            // Check if this is a non-Solana wallet error
            if (err instanceof Error && 
                (err.message.includes('not Solana') || 
                 err.message.includes('wrong network') ||
                 !targetWallet.adapter.publicKey)) {
              throw new Error("Please connect to a Solana-compatible wallet");
            }
            throw err; // Re-throw all other errors
          }
        } else {
          throw new Error(`Wallet ${walletName} not found`);
        }
      } else if (wallet) {
        // Connect to default wallet if no specific wallet requested
        try {
          await wallet.connect();
          
          // Verify we have a Solana wallet
          if (!wallet.publicKey || typeof wallet.publicKey.toBase58 !== 'function') {
            throw new Error("Connected wallet does not appear to be Solana-compatible");
          }
          
          if (selectedWallet) {
            localStorage.setItem('selectedWallet', selectedWallet.name);
            localStorage.setItem('shouldAutoConnect', 'true');
          }
        } catch (err) {
          // Check if this is a non-Solana wallet error
          if (err instanceof Error && 
              (err.message.includes('not Solana') || 
               err.message.includes('wrong network') ||
               !wallet.publicKey)) {
            throw new Error("Please connect to a Solana-compatible wallet");
          }
          throw err; // Re-throw all other errors
        }
      } else if (wallets.length > 0) {
        // If no wallet specified but wallets exist, try the first available wallet
        const firstWallet = wallets.find(w => w.installed) || wallets[0];
        console.log(`No wallet specified, trying first available: ${firstWallet.name}`);
        
        // Recursively call connect with the first wallet
        return await connect(firstWallet.name);
      } else {
        console.error("No wallet adapters available at all");
        throw new Error("Please install a Solana wallet extension like Phantom or Solflare");
      }
    } catch (error) {
      console.error("Connection error:", error);
      setConnecting(false);
      throw error;
    }
  }, [wallets, wallet, selectedWallet, connecting, connected, disconnect]);

  // Check for previously connected wallet on startup
  useEffect(() => {
    const autoConnectEnabled = localStorage.getItem('shouldAutoConnect') === 'true';
    const savedWalletName = localStorage.getItem('selectedWallet');
    
    if (autoConnectEnabled && savedWalletName && wallets.length > 0 && !connected && !connecting) {
      const savedWallet = wallets.find(w => w.name === savedWalletName && w.installed);
      if (savedWallet) {
        // Set the wallet without connecting yet (just to select it in the UI)
        setSelectedWallet(savedWallet);
        setWallet(savedWallet.adapter);
        
        // Try to connect
        connect(savedWalletName).catch(error => {
          console.error("Auto-connect error:", error);
          localStorage.removeItem('shouldAutoConnect');
        });
      }
    }
  }, [wallets, connected, connecting, connect]);

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
  const context = useContext(MultiWalletContext);
  if (!context) {
    throw new Error('useMultiWallet must be used within a MultiWalletProvider');
  }
  return context;
}