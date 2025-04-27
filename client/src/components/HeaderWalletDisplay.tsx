import React, { useEffect, useState } from 'react';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { getTokenBalance, getSolBalance } from '@/lib/solana';
import { YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

interface TokenBalances {
  sol: number;
  yot: number;
  yos: number;
}

export default function HeaderWalletDisplay() {
  const { connected, publicKey } = useMultiWallet();
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
    <div className="flex items-center justify-between px-4 py-2 w-full bg-zinc-900 border-b border-zinc-800">
      <div className="flex items-center">
        <div className="font-mono text-xs text-gray-400 truncate max-w-[150px]">
          {publicKey.toString().substring(0, 8)}...{publicKey.toString().substring(publicKey.toString().length - 4)}
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="font-mono text-sm text-right">
          <span className="text-purple-300">{formatCurrency(balances.yot, 2)}</span>
          <span className="text-gray-400 ml-1 text-xs">YOT</span>
        </div>
        
        <div className="font-mono text-sm text-right">
          <span className="text-green-300">{formatCurrency(balances.yos, 2)}</span>
          <span className="text-gray-400 ml-1 text-xs">YOS</span>
        </div>
        
        <div className="font-mono text-sm text-right">
          <span className="text-amber-300">{formatCurrency(balances.sol, 6)}</span>
          <span className="text-gray-400 ml-1 text-xs">SOL</span>
        </div>
        
        <button 
          onClick={fetchBalances} 
          disabled={isLoading}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}