import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MultiHubSwapDemo from '@/components/MultiHubSwap/MultiHubSwapDemo';
import { TokenPriceChart } from '@/components/MultiHubSwap/TokenPriceChart';
import useMultiHubSwap from '@/hooks/useMultiHubSwap';
import { formatNumber, shortenAddress } from '@/lib/utils';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { useState } from 'react';
import { defaultTokens } from '@/lib/token-search-api';

export default function MultiHubSwapPage() {
  const { wallet, connected: walletConnected, publicKey, connect } = useMultiWallet();
  const { toast } = useToast();
  const {
    userSwapInfo,
    userSwapInfoLoading,
    globalSwapStats,
    globalSwapStatsLoading,
    claimRewards,
    isClaimingRewards
  } = useMultiHubSwap();
  
  // Set default tokens for the price chart
  const [selectedFromToken, setSelectedFromToken] = useState(defaultTokens[0]);
  const [selectedToToken, setSelectedToToken] = useState(defaultTokens[1]);
  
  // Open wallet selector modal to connect
  const handleConnectWallet = () => {
    try {
      connect();
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast({
        title: 'Wallet connection failed',
        description: error instanceof Error ? error.message : 'Please install a Solana wallet extension to continue',
        variant: 'destructive'
      });
    }
  };
  
  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Multi-Hub Swap</h1>
          {!walletConnected && (
            <Button 
              onClick={handleConnectWallet}
              className="bg-gradient-to-r from-primary to-[#7043f9] text-white"
            >
              Connect Wallet
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Swap Panel */}
          <div>
            <MultiHubSwapDemo 
              onTokenChange={(fromToken, toToken) => {
                setSelectedFromToken(fromToken);
                setSelectedToToken(toToken);
              }}
            />
          </div>
          
          {/* Chart Panel */}
          <div className="space-y-6">
            <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
              <CardHeader className="bg-gradient-to-br from-[#1e2a45] to-[#0f1421] border-b border-[#1e2a45] pb-4">
                <CardTitle className="text-2xl font-bold text-white">
                  {selectedFromToken?.symbol}/{selectedToToken?.symbol} Exchange Rate
                </CardTitle>
                <CardDescription className="text-[#a3accd]">
                  14-day price history
                </CardDescription>
              </CardHeader>
              <CardContent className="py-4">
                <TokenPriceChart 
                  fromToken={selectedFromToken} 
                  toToken={selectedToToken}
                />
              </CardContent>
            </Card>
            
            <Tabs defaultValue="stats" className="w-full">
              <TabsList className="grid grid-cols-2 mb-4 bg-[#1a2338]">
                <TabsTrigger 
                  value="stats" 
                  className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
                >
                  Stats
                </TabsTrigger>
                <TabsTrigger 
                  value="pool" 
                  className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
                >
                  Liquidity Pool
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="stats">
                <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
                  <CardHeader>
                    <CardTitle className="text-white">Market Stats</CardTitle>
                    <CardDescription className="text-[#a3accd]">
                      Key metrics for {selectedFromToken?.symbol}/{selectedToToken?.symbol} pair
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#141c2f] rounded-md p-3 border border-[#1e2a45]">
                        <p className="text-sm text-[#7d8ab1]">24h Volume</p>
                        <p className="text-lg font-medium text-white mt-1">$483,245</p>
                      </div>
                      <div className="bg-[#141c2f] rounded-md p-3 border border-[#1e2a45]">
                        <p className="text-sm text-[#7d8ab1]">Liquidity</p>
                        <p className="text-lg font-medium text-white mt-1">$2.3M</p>
                      </div>
                      <div className="bg-[#141c2f] rounded-md p-3 border border-[#1e2a45]">
                        <p className="text-sm text-[#7d8ab1]">24h Change</p>
                        <p className="text-lg font-medium text-green-400 mt-1">+4.2%</p>
                      </div>
                      <div className="bg-[#141c2f] rounded-md p-3 border border-[#1e2a45]">
                        <p className="text-sm text-[#7d8ab1]">Transactions</p>
                        <p className="text-lg font-medium text-white mt-1">1,452</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="pool">
                <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
                  <CardHeader>
                    <CardTitle className="text-white">Liquidity Pool</CardTitle>
                    <CardDescription className="text-[#a3accd]">
                      View and manage your liquidity contributions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-center py-8 text-[#7d8ab1]">
                      Liquidity pool management coming soon
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}