import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Wallet,
  MoreVertical,
  Copy,
  ExternalLink,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { copyToClipboard, formatTokenAmount } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Header() {
  const { toast } = useToast();
  const { connected, publicKey, connect, disconnect } = useMultiWallet();
  const yotBalance = 0;
  const yosBalance = 0;
  const solBalance = 0;
  
  const handleConnectWallet = async () => {
    if (typeof connect === 'function') {
      try {
        await connect();
      } catch (error: any) {
        toast({
          title: 'Wallet Connection Failed',
          description: error.message || 'Could not connect to wallet',
          variant: 'destructive',
        });
      }
    }
  };
  
  const handleCopyAddress = () => {
    if (publicKey) {
      const addressString = publicKey.toString();
      const copied = copyToClipboard(addressString);
      if (copied) {
        toast({
          title: 'Address Copied',
          description: 'Wallet address copied to clipboard',
        });
      }
    }
  };
  
  const handleDisconnect = () => {
    if (typeof disconnect === 'function') {
      disconnect();
      toast({
        title: 'Wallet Disconnected',
        description: 'Your wallet has been disconnected',
      });
    }
  };
  
  const handleOpenExplorer = () => {
    if (publicKey) {
      window.open(`https://explorer.solana.com/address/${publicKey}?cluster=devnet`, '_blank');
    }
  };
  
  const formatWalletAddress = (address: string | null | undefined) => {
    if (!address || typeof address !== 'string') return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };
  
  return (
    <header className="h-16 border-b border-[#1e2a45] bg-[#0f1421] px-6 flex items-center justify-between">
      <div>
        {/* Left side content if needed */}
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Balances (only show when connected) */}
        {connected && (
          <div className="hidden md:flex items-center space-x-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-[#1e2a45] rounded-md px-3 py-1.5 flex items-center space-x-2">
                    <div className="h-4 w-4 rounded-full bg-gradient-to-br from-[#f6c549] to-[#f8de7d]" />
                    <span className="text-sm">{formatTokenAmount(solBalance || 0)} SOL</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>SOL Balance</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-[#1e2a45] rounded-md px-3 py-1.5 flex items-center space-x-2">
                    <div className="h-4 w-4 rounded-full bg-gradient-to-br from-[#7388ea] to-[#8e4af0]" />
                    <span className="text-sm">{formatTokenAmount(yotBalance || 0)} YOT</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>YOT Token Balance</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-[#1e2a45] rounded-md px-3 py-1.5 flex items-center space-x-2">
                    <div className="h-4 w-4 rounded-full bg-gradient-to-br from-[#5ce6a8] to-[#42c286]" />
                    <span className="text-sm">{formatTokenAmount(yosBalance || 0)} YOS</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>YOS Token Balance</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        
        {/* Wallet Button or Connected Status */}
        {!connected ? (
          <Button 
            className="bg-gradient-to-r from-primary to-[#7043f9] text-white"
            onClick={handleConnectWallet}
          >
            <Wallet className="h-4 w-4 mr-2" />
            Connect Wallet
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-[#2e3c58] bg-[#1e2a45]">
                <div className="h-4 w-4 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 mr-2" />
                <span className="mr-1">{publicKey ? formatWalletAddress(publicKey.toString()) : ''}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-[240px]">
              <DropdownMenuLabel>My Wallet</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCopyAddress}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Address
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleOpenExplorer}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Explorer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDisconnect}>
                <LogOut className="h-4 w-4 mr-2" />
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}