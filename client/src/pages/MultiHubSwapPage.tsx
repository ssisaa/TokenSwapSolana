import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MultiHubSwapDemo from '@/components/MultiHubSwap/MultiHubSwapDemo';
import { TokenPriceChart } from '@/components/MultiHubSwap/TokenPriceChart';
import TokenPoolDetails from '@/components/MultiHubSwap/TokenPoolDetails';
import SwapTestPanel from '@/components/MultiHubSwap/SwapTestPanel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
      
      {/* Smart Contract Integration Notice */}
      <Alert className="bg-blue-950 border-blue-800 mb-6">
        <AlertTriangle className="h-5 w-5 text-blue-400" />
        <AlertTitle className="text-blue-200">Smart Contract Integration Status</AlertTitle>
        <AlertDescription className="text-blue-300">
          The XAR → SOL → YOT swap functionality is implemented with a Solana smart contract that handles the 20% liquidity pool contribution and 3% YOS cashback rewards. Use the test panel below to verify the swap flow.
        </AlertDescription>
      </Alert>
      
      {/* Test Swap Panel */}
      <div className="mb-6">
        <SwapTestPanel />
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
                    View liquidity pool details for test tokens
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="pools">
                    <TabsList className="mb-4 bg-[#1a2338]">
                      <TabsTrigger 
                        value="pools" 
                        className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
                      >
                        Pools
                      </TabsTrigger>
                      <TabsTrigger 
                        value="routes" 
                        className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
                      >
                        Routes
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="pools">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-[#141c2f] rounded-md p-3 border border-[#1e2a45]">
                            <p className="text-sm text-[#7d8ab1]">MTA/SOL Pool</p>
                            <p className="text-lg font-medium text-white mt-1">1M MTA + 20 SOL</p>
                          </div>
                          <div className="bg-[#141c2f] rounded-md p-3 border border-[#1e2a45]">
                            <p className="text-sm text-[#7d8ab1]">SAMX/USDC Pool</p>
                            <p className="text-lg font-medium text-white mt-1">500K SAMX + 50K USDC</p>
                          </div>
                          <div className="bg-[#141c2f] rounded-md p-3 border border-[#1e2a45]">
                            <p className="text-sm text-[#7d8ab1]">XAR/SOL Pool</p>
                            <p className="text-lg font-medium text-white mt-1">800K XAR + 15 SOL</p>
                          </div>
                          <div className="bg-[#141c2f] rounded-md p-3 border border-[#1e2a45]">
                            <p className="text-sm text-[#7d8ab1]">RAMX/USDC Pool</p>
                            <p className="text-lg font-medium text-white mt-1">750K RAMX + 40K USDC</p>
                          </div>
                        </div>
                        <p className="text-sm text-[#7d8ab1] mt-4">
                          These pools provide the liquidity for the multi-hop routes used in the token swaps.
                          Each pool maintains sufficient reserves to handle test swaps.
                        </p>
                        <div className="mt-4">
                          <TokenPoolDetails />
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="routes">
                      <div className="space-y-4">
                        <div className="bg-[#141c2f] rounded-md p-4 border border-[#1e2a45]">
                          <h3 className="font-medium text-white">Direct Routes</h3>
                          <ul className="mt-2 space-y-1">
                            <li className="text-[#a3accd]">• SOL ↔ YOT via Raydium</li>
                            <li className="text-[#a3accd]">• MTA ↔ SOL via Raydium</li>
                            <li className="text-[#a3accd]">• SAMX ↔ USDC via Jupiter</li>
                            <li className="text-[#a3accd]">• USDC ↔ SOL via Jupiter</li>
                          </ul>
                        </div>
                        <div className="bg-[#141c2f] rounded-md p-4 border border-[#1e2a45]">
                          <h3 className="font-medium text-white">Multi-Hop Routes</h3>
                          <ul className="mt-2 space-y-1">
                            <li className="text-[#a3accd]">• MTA → SOL → YOT via Raydium</li>
                            <li className="text-[#a3accd]">• SAMX → USDC → SOL → YOT via Jupiter + Raydium</li>
                            <li className="text-[#a3accd]">• XAR → SOL → YOT via Custom Route</li>
                            <li className="text-[#a3accd]">• YOT → SOL → USDC → RAMX via Multiple DEXs</li>
                          </ul>
                        </div>
                        <Button variant="outline" className="mt-2 w-full text-primary border-primary hover:bg-primary/10">
                          Check Route Status
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}