import React, { useState, useEffect } from 'react';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ChevronRight } from 'lucide-react';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast.ts';

export default function WalletSelectorModal() {
  const {
    wallets,
    showWalletSelector,
    setShowWalletSelector,
    connect,
    connecting
  } = useMultiWallet();

  const [connectorError, setConnectorError] = useState<string | null>(null);
  const [installedWallets, setInstalledWallets] = useState<string[]>([]);
  const { toast } = useToast();
  
  // Check for installed wallets on component mount
  useEffect(() => {
    // Simple detection for popular wallets
    const detectedWallets = [];
    
    // Enhanced Check for Phantom with fallback for new wallet versions
    try {
      if (typeof window !== 'undefined' && 
          ((window as any).phantom?.solana || // New phantom structure
           (window.solana && window.solana.isPhantom))) { // Legacy structure
        detectedWallets.push('Phantom');
        console.log("Phantom wallet detection:", true);
      }
    } catch (err) {
      console.warn("Error checking for Phantom:", err);
    }
    
    // Enhanced Check for Solflare (multiple detection methods)
    try {
      if (typeof window !== 'undefined' && 
          ((window as any).solflare || 
           (window.solana && window.solana.isSolflare) || 
           (navigator.userAgent && navigator.userAgent.indexOf('Solflare') > -1))) {
        detectedWallets.push('Solflare');
        console.log("Solflare wallet detection:", true);
      }
    } catch (err) {
      console.warn("Error checking for Solflare:", err);
    }
    
    // Check for other browser-extension Solana wallets
    if (typeof window !== 'undefined' && window.solana && !window.solana.isPhantom && !window.solana.isSolflare) {
      detectedWallets.push('OtherWallets');
    }
    
    // Log for debugging - all available wallets from the MultiWalletContext
    console.log("Available wallets:", wallets.map(w => w.name));
    
    setInstalledWallets(detectedWallets);
  }, [wallets]);
  
  // Try to connect with network options
  const handleConnect = async (walletName: string) => {
    const networks = ['devnet', 'testnet', 'mainnet-beta'];
    let connected = false;
    let lastError = null;
    
    setConnectorError(null);
    
    // Get wallet network information
    const getWalletNetworkInfo = () => {
      try {
        if (typeof window !== 'undefined') {
          // Try to detect the network from Phantom
          if (window.solana && window.solana.isPhantom) {
            const network = (window.solana as any)._network;
            return network ? network : 'unknown';
          }
          
          // Try to detect from phantom new structure
          if ((window as any).phantom?.solana) {
            const network = (window as any).phantom.solana._network;
            return network ? network : 'unknown';
          }
        }
      } catch (err) {
        console.warn("Error detecting wallet network:", err);
      }
      return 'unknown';
    };
    
    // Show a message about current wallet network
    const currentNetwork = getWalletNetworkInfo();
    console.log("Detected wallet network:", currentNetwork);
    
    // Notify user about detected network
    if (currentNetwork !== 'unknown') {
      toast({
        title: "Wallet Network",
        description: `Your wallet appears to be on ${currentNetwork} network. Our app runs on devnet.`,
        variant: "default",
      });
    }
    
    try {
      // First, try to connect with wallet + network combinations which are more reliable
      const preferredNetwork = 'devnet'; // We prefer devnet for our app
      try {
        const specificWalletName = `${walletName} (${preferredNetwork})`;
        console.log(`Trying to connect to ${specificWalletName}...`);
        
        await connect(specificWalletName);
        connected = true;
        setShowWalletSelector(false);
        return;
      } catch (initialError) {
        console.log(`Preferred network connection failed:`, initialError);
        lastError = initialError;
      }
      
      // If preferred network failed, try other explicit network options
      for (const network of networks.filter(n => n !== preferredNetwork)) {
        try {
          const networkWalletName = `${walletName} (${network})`;
          console.log(`Trying to connect to ${networkWalletName}...`);
          
          await connect(networkWalletName);
          connected = true;
          setShowWalletSelector(false);
          return;
        } catch (error) {
          console.log(`Failed to connect with ${network}:`, error);
          lastError = error;
        }
      }
      
      // Finally try the base wallet name as fallback
      try {
        console.log(`Trying to connect to ${walletName} without network...`);
        await connect(walletName);
        connected = true;
        setShowWalletSelector(false);
        return;
      } catch (error) {
        console.log(`Base wallet connection failed:`, error);
        lastError = error;
      }
      
      // If we get here, all connection attempts failed
      throw lastError || new Error("Failed to connect to wallet");
    } catch (error) {
      console.error('All connection attempts failed:', error);
      
      // Show user-friendly error message and store for display
      if (error instanceof Error) {
        let errorMessage = error.message;
        
        // Improve error message for common cases
        if (errorMessage === "No wallet adapter available") {
          errorMessage = "No wallet extension detected. Please install a Solana wallet extension.";
        } else if (errorMessage.includes("not installed") || errorMessage.includes("detected")) {
          errorMessage = "Wallet extension not detected or not properly installed. Please install the wallet and refresh."; 
        }
        
        setConnectorError(errorMessage);
        
        // Check for specific non-Solana wallet errors with improved messaging
        if (error.message.includes('install a Solana wallet') || 
            error.message.includes('not found') ||
            error.message.includes('not installed') ||
            error.message.includes('No wallet adapter')) {
          toast({
            variant: "destructive",
            title: "Wallet Not Detected",
            description: "Please install the wallet extension and refresh the page",
          });
        } else if (error.message.includes('Solana-compatible') || 
                  error.message.includes('wrong network')) {
          toast({
            variant: "destructive",
            title: "Wallet Network Error",
            description: "Please switch your wallet to the Solana devnet network and try again",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Wallet Connection Error",
            description: errorMessage,
          });
        }
      } else {
        setConnectorError("Unknown error occurred");
        toast({
          variant: "destructive",
          title: "Wallet Connection Error",
          description: "Failed to connect to wallet. Please try again.",
        });
      }
    }
  };

  return (
    <Dialog open={showWalletSelector} onOpenChange={setShowWalletSelector}>
      <DialogContent className="bg-white border-0 rounded-xl p-0 shadow-2xl max-w-md mx-auto">
        {/* Close Button (X) in absolute position */}
        <button 
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          onClick={() => setShowWalletSelector(false)}
        >
          <X className="h-5 w-5" />
        </button>
        
        <div className="p-6">
          <h2 className="text-xl font-bold text-black mb-1">Connect Wallet</h2>
          <p className="text-gray-600 text-sm mb-4">
            Select a wallet to connect to YOT Swap
          </p>
          
          {/* Display detected wallet information */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm">
            <div className="font-semibold text-blue-700 mb-1">Wallet Detection</div>
            <div className="text-blue-600">
              {installedWallets.length > 0 ? (
                <div>Detected wallets: {installedWallets.join(', ')}</div>
              ) : (
                <div>No Solana wallets detected. Make sure you have a wallet extension installed.</div>
              )}
            </div>
          </div>
          
          {/* Display error if one occurred */}
          {connectorError && (
            <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">
              <div className="font-semibold text-red-700 mb-1">Connection Error</div>
              <div>{connectorError}</div>
            </div>
          )}
          
          <div className="space-y-2">
            {/* Phantom Wallet */}
            <button
              onClick={() => handleConnect('Phantom')}
              disabled={connecting}
              className={`w-full flex items-center justify-between p-4 ${
                installedWallets.includes('Phantom') 
                  ? 'bg-green-50 hover:bg-green-100' 
                  : 'bg-gray-50 hover:bg-gray-100'
              } rounded-lg transition`}
            >
              <div className="flex items-center">
                <div className="bg-purple-500 h-10 w-10 rounded-full flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="h-6 w-6 text-white">
                    <path fill="white" d="M18.44 8.7C16.76 8.7 15.26 7.5 14.74 5.76C14.74 5.76 14.74 5.76 14.74 5.76C14.46 4.78 14.64 3.68 15.18 2.82C15.72 1.96 16.66 1.42 17.7 1.34C18.38 1.28 19.06 1.46 19.6 1.84C18.58 0.7 17.14 0 15.58 0C13.08 0 10.94 1.72 10.36 4.12C10.3 4.4 10.26 4.68 10.26 4.98C10.26 5.28 10.3 5.56 10.36 5.84C10.94 8.22 13.08 9.94 15.58 9.94C16.54 9.94 17.44 9.7 18.22 9.26C18.44 8.7 18.44 8.7 18.44 8.7Z"/>
                    <path fill="white" d="M22.12 9.94C21.42 9.94 20.76 10.18 20.24 10.58C19.66 11.04 19.26 11.72 19.14 12.5C19.14 12.5 19.14 12.5 19.14 12.5C18.92 13.9 19.86 15.2 21.26 15.44C21.46 15.48 21.64 15.5 21.82 15.5C21.98 15.5 22.12 15.48 22.28 15.44C22.12 15.8 21.9 16.12 21.62 16.4C21.08 16.94 20.38 17.24 19.62 17.24H13.38C13.14 17.24 12.9 17.28 12.66 17.34C11.7 17.62 10.94 18.38 10.66 19.34C10.38 20.34 10.6 21.36 11.22 22.08C11.66 22.62 12.26 22.96 12.92 23.08C13.04 23.1 13.18 23.12 13.32 23.12H19.32C22.34 23.12 24.98 20.92 25.58 17.68C26.18 14.44 24.12 11.34 21.06 10.32C21.42 10.1 21.78 9.94 22.12 9.94Z"/>
                    <path fill="white" d="M2.76 10.9C2.3 9.52 2.76 8 3.84 7.08C4.54 6.48 5.48 6.16 6.46 6.34C7.34 6.5 8.08 7.08 8.48 7.84C8.48 7.84 8.48 7.84 8.48 7.84C9.06 8.9 9.02 10.14 8.44 11.16C8.36 11.28 8.26 11.4 8.16 11.5C8.04 11.62 7.92 11.72 7.78 11.82C6.84 12.44 5.62 12.5 4.62 11.98C4.44 11.86 4.26 11.74 4.12 11.58L4.1 11.56C3.58 11.08 3.22 10.46 3.08 9.76L4.9 10.7C5.26 10.88 5.72 10.72 5.88 10.36C6.04 10 5.9 9.54 5.54 9.38L2.76 10.9Z"/>
                    <path fill="white" d="M8.60001 11.7C8.36001 12.02 8.06001 12.28 7.74001 12.5C7.26001 12.8 6.70001 12.98 6.12001 13.02C5.54001 13.06 4.96001 12.96 4.42001 12.7C3.02001 12.06 2.24001 10.6 2.34001 9.14001C2.36001 8.86001 2.42001 8.58001 2.52001 8.32001C2.00001 8.38001 1.50001 8.56001 1.08001 8.86001C0.38001 9.36001 -0.0399902 10.14 0.00001 10.98C0.04001 11.82 0.54001 12.54 1.28001 12.96L6.14001 15.72C6.44001 15.88 6.64001 16.2 6.64001 16.54V20.5C6.64001 21.04 7.08001 21.5 7.64001 21.5C8.20001 21.5 8.64001 21.06 8.64001 20.5V16.54C8.64001 15.5 8.04001 14.56 7.14001 14.06L4.42001 12.56C4.94001 12.76 5.52001 12.82 6.08001 12.68C6.76001 12.52 7.36001 12.12 7.78001 11.54C7.88001 11.42 7.96001 11.28 8.04001 11.14C8.30001 10.66 8.44001 10.12 8.46001 9.58001C8.68001 10.4 8.78001 11.04 8.60001 11.7Z"/>
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-black">Phantom</span>
                  {installedWallets.includes('Phantom') ? (
                    <span className="text-xs text-green-600">Detected</span>
                  ) : (
                    <span className="text-xs text-gray-500">Not detected</span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
            
            {/* Solflare Wallet */}
            <button
              onClick={() => handleConnect('Solflare')}
              disabled={connecting}
              className={`w-full flex items-center justify-between p-4 ${
                installedWallets.includes('Solflare') 
                  ? 'bg-green-50 hover:bg-green-100' 
                  : 'bg-gray-50 hover:bg-gray-100'
              } rounded-lg transition`}
            >
              <div className="flex items-center">
                <div className="bg-blue-500 h-10 w-10 rounded-full flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 35 35" className="h-6 w-6">
                    <path fill="white" d="M17.5 0C7.8 0 0 7.8 0 17.5S7.8 35 17.5 35 35 27.2 35 17.5 27.2 0 17.5 0zm0 29.5c-6.6 0-12-5.4-12-12s5.4-12 12-12 12 5.4 12 12-5.4 12-12 12z"/>
                    <path fill="white" d="M17.5 27c-5.2 0-9.5-4.3-9.5-9.5S12.3 8 17.5 8s9.5 4.3 9.5 9.5-4.3 9.5-9.5 9.5z"/>
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-black">Solflare</span>
                  {installedWallets.includes('Solflare') ? (
                    <span className="text-xs text-green-600">Detected</span>
                  ) : (
                    <span className="text-xs text-gray-500">Not detected</span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
            
            {/* Other Wallets Option */}
            <button
              onClick={() => handleConnect('OtherWallets')}
              disabled={connecting}
              className={`w-full flex items-center justify-between p-4 ${
                installedWallets.includes('OtherWallets') 
                  ? 'bg-green-50 hover:bg-green-100' 
                  : 'bg-gray-50 hover:bg-gray-100'
              } rounded-lg transition`}
            >
              <div className="flex items-center">
                <div className="bg-gray-400 h-10 w-10 rounded-full flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-black">Other Wallets</span>
                  {installedWallets.includes('OtherWallets') ? (
                    <span className="text-xs text-green-600">Detected</span>
                  ) : (
                    <span className="text-xs text-gray-500">Not detected</span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
          </div>
          
          {connecting && (
            <div className="mt-4 flex items-center justify-center text-blue-600">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Connecting...
            </div>
          )}
        </div>
        
        {installedWallets.length === 0 && (
          <div className="border-t border-gray-200 p-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">No wallets detected</h3>
            <p className="text-xs text-gray-600 mb-2">Please install a Solana wallet extension:</p>
            <div className="flex flex-col gap-2 mt-2">
              <a 
                href="https://phantom.app/download" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs flex items-center text-blue-600 hover:text-blue-800"
              >
                <svg className="h-4 w-4 mr-1" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="128" height="128" rx="64" fill="#AB9FF2"/>
                  <path d="M110.584 64.9142H99.142C99.142 41.8371 80.214 23.0371 57.142 23.0371C36.1938 23.0371 18.453 38.3542 15.004 58.4599C14.4354 61.7113 14.143 65.0456 14.143 68.4628C14.143 94.0456 35.0724 114.965 60.5709 114.965C76.0995 114.965 89.6995 107.246 97.8523 95.2085C102.348 88.557 105.134 80.807 105.773 72.4628H110.584C111.348 72.4628 112 71.8113 112 71.0456V66.3314C112 65.5656 111.348 64.9142 110.584 64.9142ZM57.142 85.8113C47.2278 85.8113 39.1995 77.7828 39.1995 67.8685C39.1995 58.0371 47.2278 49.9257 57.142 49.9257C67.0563 49.9257 75.0847 57.9542 75.0847 67.8685C75.0847 77.7828 67.0563 85.8113 57.142 85.8113Z" fill="white"/>
                </svg>
                Install Phantom Wallet
              </a>
              <a 
                href="https://solflare.com/download" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs flex items-center text-blue-600 hover:text-blue-800"
              >
                <svg className="h-4 w-4 mr-1" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="16" r="16" fill="#FC9D00"/>
                  <path d="M16 5C9.925 5 5 9.925 5 16C5 22.075 9.925 27 16 27C22.075 27 27 22.075 27 16C27 9.925 22.075 5 16 5ZM16 23.5C11.8578 23.5 8.5 20.1422 8.5 16C8.5 11.8578 11.8578 8.5 16 8.5C20.1422 8.5 23.5 11.8578 23.5 16C23.5 20.1422 20.1422 23.5 16 23.5Z" fill="white"/>
                  <path d="M16 12C13.7912 12 12 13.7912 12 16C12 18.2088 13.7912 20 16 20C18.2088 20 20 18.2088 20 16C20 13.7912 18.2088 12 16 12Z" fill="white"/>
                </svg>
                Install Solflare Wallet
              </a>
            </div>
          </div>
        )}
      
        <div className="border-t border-gray-200 p-4 text-xs text-center text-gray-500">
          By connecting, you agree to YOT Swap's Terms of Service and Privacy Policy
        </div>
      </DialogContent>
    </Dialog>
  );
}