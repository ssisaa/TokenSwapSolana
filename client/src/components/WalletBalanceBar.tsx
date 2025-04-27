import React, { useEffect, useState } from 'react';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { getTokenBalance, getSolBalance } from '@/lib/solana';
import { formatCurrency } from '@/lib/utils';
import { YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS } from '@/lib/constants';
import { RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface TokenBalances {
  sol: number;
  yot: number;
  yos: number;
}

export default function WalletBalanceBar() {
  const { connected, publicKey, selectedWallet } = useMultiWallet();
  const [balances, setBalances] = useState<TokenBalances>({
    sol: 0,
    yot: 0,
    yos: 0
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalances = async () => {
    if (!connected || !publicKey) return;
    
    setIsLoading(true);
    try {
      // Get SOL balance
      const solBalance = await getSolBalance(publicKey);
      
      // Get YOT token balance
      const yotBalance = await getTokenBalance(
        YOT_TOKEN_ADDRESS,
        publicKey
      );
      
      // Get YOS token balance
      const yosBalance = await getTokenBalance(
        YOS_TOKEN_ADDRESS,
        publicKey
      );
      
      setBalances({
        sol: solBalance,
        yot: yotBalance,
        yos: yosBalance
      });
    } catch (error) {
      console.error('Error fetching token balances:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch token balances whenever the wallet connection state changes
  useEffect(() => {
    fetchBalances();
    
    // Set up a refresh interval (every 30 seconds)
    const intervalId = setInterval(fetchBalances, 30000);
    
    return () => clearInterval(intervalId);
  }, [connected, publicKey]);

  if (!connected || !publicKey) {
    return null;
  }

  return (
    <Card className="mb-8 bg-dark-200 border-dark-400 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {selectedWallet && (
            <>
              <img 
                src={selectedWallet.icon} 
                alt={selectedWallet.name}
                className="w-5 h-5 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjEgMThWMTlDMjEgMjAuMTA0NiAyMC4xMDQ2IDIxIDE5IDIxSDVDMy44OTU0MyAyMSAzIDIwLjEwNDYgMyAxOVY1QzMgMy44OTU0MyAzLjg5NTQzIDMgNSAzSDE5QzIwLjEwNDYgMyAyMSAzLjg5NTQzIDIxIDVWNk0yMSAxMlYxMk0yMSA2VjYiIHN0cm9rZT0iIzk5OTk5OSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4=';
                }}
              />
              <span className="font-mono text-sm text-gray-300">
                {publicKey.toString().substring(0, 4)}...{publicKey.toString().substring(publicKey.toString().length - 4)}
              </span>
            </>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="font-mono text-sm text-purple-300">{formatCurrency(balances.yot)}</span>
            <span className="text-xs text-gray-400">YOT</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="font-mono text-sm text-blue-300">{formatCurrency(balances.yos)}</span>
            <span className="text-xs text-gray-400">YOS</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="font-mono text-sm text-green-300">{formatCurrency(balances.sol)}</span>
            <span className="text-xs text-gray-400">SOL</span>
          </div>
          
          <button 
            onClick={fetchBalances} 
            className="text-gray-400 hover:text-white p-1 rounded-full transition-colors"
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
    </Card>
  );
}