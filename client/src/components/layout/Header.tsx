import React, { useState } from 'react';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { Button } from '@/components/ui/button';
import { Loader2, Wallet, ChevronDown, RefreshCw, LogOut } from 'lucide-react';
import { formatTokenAmount } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Header() {
  const { wallet, publicKey, connected, connecting, disconnect, wallets, connect, setShowWalletSelector, showWalletSelector } = useMultiWallet();
  const [yotBalance, setYotBalance] = useState<number | null>(null);
  const [yosBalance, setYosBalance] = useState<number | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  
  // Placeholder for actual balance fetching - we'll use this from the wallet logs
  React.useEffect(() => {
    if (connected && publicKey) {
      // This is just for the UI preview - in reality these would be fetched
      const consoleYotBalance = 151198847.47;
      const consoleYosBalance = 437056995.76;
      const consoleSolBalance = 7.494;
      
      setYotBalance(consoleYotBalance);
      setYosBalance(consoleYosBalance);
      setSolBalance(consoleSolBalance);
    } else {
      setYotBalance(null);
      setYosBalance(null);
      setSolBalance(null);
    }
  }, [connected, publicKey]);

  const handleConnect = () => {
    setShowWalletSelector(true);
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  const handleSelectWallet = (walletName: string) => {
    connect(walletName);
  };

  return (
    <header className="h-16 border-b border-[#1e2a45] bg-[#0f1421] px-4 flex items-center justify-end">
      {connected && publicKey ? (
        <div className="flex items-center space-x-4">
          {/* Token Balances */}
          <div className="hidden md:flex items-center space-x-4">
            {yotBalance !== null && (
              <div className="text-sm text-white">
                <span className="font-medium">{formatTokenAmount(yotBalance)}</span> YOT
              </div>
            )}
            
            {yosBalance !== null && (
              <div className="text-sm text-white">
                <span className="font-medium">{formatTokenAmount(yosBalance)}</span> YOS
              </div>
            )}
            
            {solBalance !== null && (
              <div className="text-sm text-white">
                <span className="font-medium">{formatTokenAmount(solBalance)}</span> SOL
              </div>
            )}
          </div>
          
          {/* Wallet */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-[#1e2a45] bg-[#1a2236] hover:bg-[#232e47] text-white">
                <div className="flex items-center">
                  <div className="mr-2 h-5 w-5 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center">
                    <Wallet className="h-3 w-3 text-white" />
                  </div>
                  <span className="hidden md:inline">
                    {publicKey.toString().slice(0, 5)}...{publicKey.toString().slice(-3)}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[#1a2236] border-[#1e2a45] text-white">
              <DropdownMenuItem
                className="flex cursor-pointer items-center hover:bg-[#232e47]"
                onClick={handleConnect}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Switch Wallet
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex cursor-pointer items-center text-red-400 hover:bg-[#232e47] hover:text-red-400"
                onClick={handleDisconnect}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <Button 
          onClick={handleConnect}
          className="bg-gradient-to-r from-primary to-[#7043f9] text-white"
          disabled={connecting}
        >
          {connecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </>
          )}
        </Button>
      )}
      
      {/* Wallet Selector Modal */}
      {showWalletSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#0f1421] rounded-lg border border-[#1e2a45] p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Connect a wallet</h3>
            <div className="space-y-2">
              {wallets.map((walletInfo) => (
                <Button
                  key={walletInfo.name}
                  onClick={() => handleSelectWallet(walletInfo.name)}
                  className="w-full bg-[#1a2236] hover:bg-[#232e47] justify-start text-white border border-[#1e2a45]"
                  variant="outline"
                >
                  <img 
                    src={walletInfo.icon} 
                    alt={walletInfo.name} 
                    className="w-5 h-5 mr-3" 
                  />
                  {walletInfo.name}
                  {!walletInfo.installed && (
                    <span className="ml-auto text-xs text-gray-400">(Install)</span>
                  )}
                </Button>
              ))}
            </div>
            <Button
              onClick={() => setShowWalletSelector(false)}
              className="mt-4 w-full bg-[#1a2236] hover:bg-[#232e47] text-white border border-[#1e2a45]"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}