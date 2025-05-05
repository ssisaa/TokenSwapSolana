import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { checkTokenBalances, TEST_TOKENS } from '@/lib/test-token-transfer';

export default function TokenBalanceMonitor() {
  const { publicKey, connected } = useWallet();
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const fetchBalances = async () => {
    if (!connected || !publicKey) {
      return;
    }
    
    setIsLoading(true);
    try {
      const tokenBalances = await checkTokenBalances(
        publicKey.toString(),
        Object.keys(TEST_TOKENS) as any[]
      );
      setBalances(tokenBalances);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching token balances:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch balances when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      fetchBalances();
    }
  }, [connected, publicKey]);
  
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Your Token Balances</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchBalances}
          disabled={isLoading || !connected}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {!connected ? (
          <div className="text-sm text-muted-foreground py-2">
            Connect your wallet to view token balances
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {Object.entries(TEST_TOKENS).map(([symbol]) => (
                <div 
                  key={symbol} 
                  className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-800"
                >
                  <span className="font-medium">{symbol}</span>
                  <span className={isLoading ? "opacity-50" : ""}>
                    {isLoading ? (
                      <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-5 w-16 rounded"></div>
                    ) : (
                      balances[symbol] !== undefined ? 
                        balances[symbol]?.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 
                        '0'
                    )}
                  </span>
                </div>
              ))}
            </div>
            
            {lastUpdated && (
              <div className="text-xs text-muted-foreground mt-4">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}