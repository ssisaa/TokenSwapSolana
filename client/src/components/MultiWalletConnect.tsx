import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMultiWallet } from '@/context/MultiWalletContext';
import WalletSelectorModal from '@/components/WalletSelectorModal';
import { shortenAddress } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronDown, CopyIcon, ExternalLink, LogOut, Wallet } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { CLUSTER, EXPLORER_URL } from '@/lib/constants';

export default function MultiWalletConnect() {
  const { connected, connecting, disconnect, publicKey, selectedWallet, setShowWalletSelector } = useMultiWallet();
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyAddress = async () => {
    if (publicKey) {
      try {
        await copyToClipboard(publicKey.toString());
        setIsCopied(true);
        
        toast({
          title: "Address Copied",
          description: "Wallet address copied to clipboard",
          variant: "default",
        });
        
        setTimeout(() => setIsCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy address', error);
        toast({
          title: "Copy Failed",
          description: "Could not copy address to clipboard",
          variant: "destructive",
        });
      }
    }
  };

  const handleOpenExplorer = () => {
    if (publicKey) {
      window.open(`${EXPLORER_URL}/address/${publicKey.toString()}?cluster=${CLUSTER}`, '_blank');
    }
  };

  const handleConnectWallet = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setShowWalletSelector(true);
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected",
        variant: "default",
      });
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect wallet",
        variant: "destructive",
      });
    }
  };

  if (!connected) {
    return (
      <>
        <Button
          className="bg-gradient-to-r from-primary-600 to-blue-700 hover:from-primary-700 hover:to-blue-800 text-white font-medium"
          onClick={handleConnectWallet}
          disabled={connecting}
        >
          {connecting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="h-4 w-4 mr-2" />
              Connect Wallet
            </>
          )}
        </Button>
        <WalletSelectorModal />
      </>
    );
  }

  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-transparent hover:bg-zinc-800 text-white">
            <div className="flex items-center">
              {selectedWallet && connected && (
                <img
                  src={selectedWallet.icon}
                  alt={`${selectedWallet.name} icon`}
                  className="w-4 h-4 mr-2"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjEgMThWMTlDMjEgMjAuMTA0NiAyMC4xMDQ2IDIxIDE5IDIxSDVDMy44OTU0MyAyMSAzIDIwLjEwNDYgMyAxOVY1QzMgMy44OTU0MyAzLjg5NTQzIDMgNSAzSDE5QzIwLjEwNDYgMyAyMSAzLjg5NTQzIDIxIDVWNk0yMSAxMlYxMk0yMSA2VjYiIHN0cm9rZT0iIzk5OTk5OSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4=';
                  }}
                />
              )}
              {!connected && "Connect Wallet"}
              {connected && <ChevronDown className="ml-1 h-4 w-4" />}
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-dark-300 border-dark-500 text-white">
          <DropdownMenuItem 
            onSelect={() => handleCopyAddress()}
          >
            <div className="flex items-center">
              {isCopied ? (
                <Check className="mr-2 h-4 w-4 text-green-500" />
              ) : (
                <CopyIcon className="mr-2 h-4 w-4" />
              )}
              <span>Copy Address</span>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onSelect={() => handleOpenExplorer()}
          >
            <div className="flex items-center">
              <ExternalLink className="mr-2 h-4 w-4" />
              <span>View on Explorer</span>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onSelect={() => setShowWalletSelector(true)}
          >
            <div className="flex items-center">
              <Wallet className="mr-2 h-4 w-4" />
              <span>Change Wallet</span>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            className="text-red-400"
            onSelect={() => handleDisconnect()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Disconnect</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <WalletSelectorModal />
    </div>
  );
}