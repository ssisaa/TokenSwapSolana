import React from 'react';
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

  const { toast } = useToast();
  
  const handleConnect = async (walletName: string) => {
    try {
      await connect(walletName);
      setShowWalletSelector(false);
    } catch (error) {
      console.error('Failed to connect:', error);
      
      // Show user-friendly error message
      if (error instanceof Error) {
        // Check for specific non-Solana wallet errors
        if (error.message.includes('Solana-compatible') || 
            error.message.includes('wrong network')) {
          toast({
            variant: "destructive",
            title: "Wallet Connection Error",
            description: "Please connect to a Solana-compatible wallet on the correct network",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Wallet Connection Error",
            description: error.message,
          });
        }
      } else {
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
          <p className="text-gray-600 text-sm mb-6">
            Select a wallet to connect to YOT Swap
          </p>
          
          <div className="space-y-2">
            {/* Phantom Wallet */}
            <button
              onClick={() => handleConnect('Phantom')}
              disabled={connecting}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
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
                <span className="font-medium text-black">Phantom</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
            
            {/* Solflare Wallet */}
            <button
              onClick={() => handleConnect('Solflare')}
              disabled={connecting}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
            >
              <div className="flex items-center">
                <div className="bg-blue-500 h-10 w-10 rounded-full flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 35 35" className="h-6 w-6">
                    <path fill="white" d="M17.5 0C7.8 0 0 7.8 0 17.5S7.8 35 17.5 35 35 27.2 35 17.5 27.2 0 17.5 0zm0 29.5c-6.6 0-12-5.4-12-12s5.4-12 12-12 12 5.4 12 12-5.4 12-12 12z"/>
                    <path fill="white" d="M17.5 27c-5.2 0-9.5-4.3-9.5-9.5S12.3 8 17.5 8s9.5 4.3 9.5 9.5-4.3 9.5-9.5 9.5z"/>
                  </svg>
                </div>
                <span className="font-medium text-black">Solflare</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
            
            {/* Other Wallets Option */}
            <button
              onClick={() => handleConnect('OtherWallets')}
              disabled={connecting}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
            >
              <div className="flex items-center">
                <div className="bg-gray-400 h-10 w-10 rounded-full flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </div>
                <span className="font-medium text-black">Other Wallets</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>
        
        <div className="border-t border-gray-200 p-4 text-xs text-center text-gray-500">
          By connecting, you agree to YOT Swap's Terms of Service and Privacy Policy
        </div>
      </DialogContent>
    </Dialog>
  );
}