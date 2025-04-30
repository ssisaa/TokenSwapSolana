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
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Multi-Hub Swap</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Swap Card */}
        <div className="md:col-span-2">
          <div className="space-y-6">
            <Tabs defaultValue="swap" className="w-full">
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="swap">Swap</TabsTrigger>
                <TabsTrigger value="pool">Liquidity Pool</TabsTrigger>
              </TabsList>
              
              <TabsContent value="swap" className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="w-full md:w-1/2">
                    <MultiHubSwapDemo 
                      onTokenChange={(fromToken, toToken) => {
                        setSelectedFromToken(fromToken);
                        setSelectedToToken(toToken);
                      }}
                    />
                  </div>
                  
                  <div className="w-full md:w-1/2">
                    <TokenPriceChart 
                      fromToken={selectedFromToken} 
                      toToken={selectedToToken}
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="pool">
                <Card>
                  <CardHeader>
                    <CardTitle>Liquidity Pool</CardTitle>
                    <CardDescription>
                      View and manage your liquidity contributions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-center py-8 text-muted-foreground">
                      Liquidity pool management coming soon
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
        {/* User Stats Card */}
        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Your Stats</CardTitle>
              <CardDescription>
                {walletConnected 
                  ? `Connected: ${shortenAddress(publicKey?.toString() || '')}`
                  : 'Connect wallet to view stats'
                }
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {!walletConnected ? (
                <div className="flex justify-center p-4">
                  <Button onClick={handleConnectWallet}>
                    Connect Wallet
                  </Button>
                </div>
              ) : userSwapInfoLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Swapped</span>
                      <span className="font-medium">{formatNumber(userSwapInfo?.totalSwapped || 0)} SOL</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Contributed</span>
                      <span className="font-medium">{formatNumber(userSwapInfo?.totalContributed || 0)} SOL</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pending Rewards</span>
                      <span className="font-medium">{formatNumber(userSwapInfo?.pendingRewards || 0)} YOS</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Rewards Claimed</span>
                      <span className="font-medium">{formatNumber(userSwapInfo?.totalRewardsClaimed || 0)} YOS</span>
                    </div>
                  </div>
                  
                  {(userSwapInfo?.pendingRewards || 0) > 0 && (
                    <Button 
                      onClick={() => claimRewards()} 
                      disabled={isClaimingRewards} 
                      className="w-full"
                    >
                      {isClaimingRewards ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Claiming...
                        </>
                      ) : (
                        `Claim ${formatNumber(userSwapInfo?.pendingRewards || 0)} YOS`
                      )}
                    </Button>
                  )}
                </>
              )}
              
              <div className="border-t pt-4 mt-6">
                <h3 className="font-medium mb-3">Global Stats</h3>
                
                {globalSwapStatsLoading ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Volume</span>
                      <span>{formatNumber(globalSwapStats?.totalSwapVolume || 0)} SOL</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Liquidity Contributed</span>
                      <span>{formatNumber(globalSwapStats?.totalLiquidityContributed || 0)} SOL</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rewards Distributed</span>
                      <span>{formatNumber(globalSwapStats?.totalRewardsDistributed || 0)} YOS</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unique Users</span>
                      <span>{globalSwapStats?.uniqueUsers || 0}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}