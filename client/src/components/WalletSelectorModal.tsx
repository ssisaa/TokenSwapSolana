import React from 'react';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function WalletSelectorModal() {
  const {
    wallets,
    showWalletSelector,
    setShowWalletSelector,
    connect,
    connecting
  } = useMultiWallet();

  const handleConnect = async (walletName: string) => {
    try {
      await connect(walletName);
      setShowWalletSelector(false);
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  return (
    <Dialog open={showWalletSelector} onOpenChange={setShowWalletSelector}>
      <DialogContent className="bg-dark-200 border-dark-100 text-white sm:max-w-md">
        <DialogTitle className="text-xl font-semibold text-white">Connect Wallet</DialogTitle>
        <DialogDescription className="text-gray-400">
          Connect your Solana wallet to interact with the token swap application.
        </DialogDescription>
        
        <div className="space-y-3 mt-4">
          {wallets.length === 0 ? (
            <div className="text-center py-4">
              <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-2" />
              <p className="text-white">No compatible wallets detected.</p>
              <p className="text-gray-400 text-sm mt-2">
                Please install a Solana-compatible wallet like Phantom.
              </p>
              <Button 
                className="mt-4 bg-gradient-to-r from-primary-600 to-blue-700"
                onClick={() => window.open('https://phantom.app/', '_blank')}
              >
                Get Phantom Wallet
              </Button>
            </div>
          ) : (
            wallets.map(wallet => (
              <Button
                key={wallet.name}
                onClick={() => handleConnect(wallet.name)}
                disabled={connecting || !wallet.installed}
                className={`w-full flex items-center justify-between p-4 h-auto ${
                  wallet.installed 
                    ? 'bg-dark-300 hover:bg-dark-400 text-white' 
                    : 'bg-dark-400 text-gray-500 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center">
                  <img 
                    src={wallet.icon} 
                    alt={`${wallet.name} logo`} 
                    className="w-8 h-8 mr-3"
                    onError={(e) => {
                      // If image loading fails, replace with a generic icon
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjEgMThWMTlDMjEgMjAuMTA0NiAyMC4xMDQ2IDIxIDE5IDIxSDVDMy44OTU0MyAyMSAzIDIwLjEwNDYgMyAxOVY1QzMgMy44OTU0MyAzLjg5NTQzIDMgNSAzSDE5QzIwLjEwNDYgMyAyMSAzLjg5NTQzIDIxIDVWNk0yMSAxMlYxMk0yMSA2VjYiIHN0cm9rZT0iIzk5OTk5OSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4=';
                    }}
                  />
                  <span className="font-medium">{wallet.name}</span>
                </div>
                
                {!wallet.installed && (
                  <span className="text-xs bg-dark-500 rounded px-2 py-1">
                    Not Installed
                  </span>
                )}
              </Button>
            ))
          )}
        </div>
        
        <div className="mt-5 text-xs text-gray-400">
          <p>By connecting your wallet, you agree to the terms of service and our privacy policy.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}