import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Wallet,
  MoreVertical,
  Copy,
  ExternalLink,
  LogOut,
  ChevronDown,
  Loader2
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
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as token from '@solana/spl-token';
import { SOLANA_CLUSTER } from '@/lib/constants';
import { YOT_TOKEN_MINT, YOS_TOKEN_MINT } from '@/lib/multihub-contract-v3';

export default function Header() {
  const { toast } = useToast();
  const { connected, publicKey, connect, disconnect } = useMultiWallet();
  const [solBalance, setSolBalance] = useState<number>(0);
  const [yotBalance, setYotBalance] = useState<number>(0);
  const [yosBalance, setYosBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Fetch balances when wallet is connected
  useEffect(() => {
    const fetchBalances = async () => {
      if (!connected || !publicKey) return;
      
      setIsLoading(true);
      try {
        // Create connection
        const connection = new Connection(
          process.env.SOLANA_RPC_URL || 
          `https://api.${SOLANA_CLUSTER}.solana.com`,
          'confirmed'
        );
        
        // Fetch SOL balance
        const solBalance = await connection.getBalance(publicKey);
        setSolBalance(solBalance / LAMPORTS_PER_SOL);
        
        // Fetch YOT balance
        try {
          const yotMint = new PublicKey(YOT_TOKEN_MINT);
          const yotTokenAccount = await token.getAssociatedTokenAddress(
            yotMint,
            publicKey
          );
          
          try {
            const yotAccount = await token.getAccount(connection, yotTokenAccount);
            setYotBalance(Number(yotAccount.amount) / Math.pow(10, 9)); // Assuming 9 decimals
          } catch (e) {
            console.log('YOT token account might not exist yet');
          }
        } catch (e) {
          console.error('Error fetching YOT balance:', e);
        }
        
        // Fetch YOS balance
        try {
          const yosMint = new PublicKey(YOS_TOKEN_MINT);
          const yosTokenAccount = await token.getAssociatedTokenAddress(
            yosMint,
            publicKey
          );
          
          try {
            const yosAccount = await token.getAccount(connection, yosTokenAccount);
            setYosBalance(Number(yosAccount.amount) / Math.pow(10, 9)); // Assuming 9 decimals
          } catch (e) {
            console.log('YOS token account might not exist yet');
          }
        } catch (e) {
          console.error('Error fetching YOS balance:', e);
        }
      } catch (e) {
        console.error('Error fetching balances:', e);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBalances();
    
    // Set up refresh interval when wallet is connected
    const intervalId = setInterval(fetchBalances, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [connected, publicKey]);
  
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
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="text-sm">{formatTokenAmount(solBalance || 0)} SOL</span>
                    )}
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
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="text-sm">{formatTokenAmount(yotBalance || 0)} YOT</span>
                    )}
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
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="text-sm">{formatTokenAmount(yosBalance || 0)} YOS</span>
                    )}
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