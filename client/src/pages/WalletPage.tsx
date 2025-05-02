import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/useSolanaWallet';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { useToast } from '@/hooks/use-toast';
import { useTokenData } from '@/hooks/useTokenData';
import { useWalletAssets } from '@/hooks/useWalletAssets';
import { Copy, ExternalLink, Plus, RefreshCw, Send, Loader2 } from 'lucide-react';
import { formatCurrency, shortenAddress } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { EXPLORER_URL } from '@/lib/constants';

export default function WalletPage() {
  const { toast } = useToast();
  const { connected, wallet } = useWallet();
  const { connect, publicKey } = useMultiWallet();
  const [selectedTab, setSelectedTab] = useState('tokens');
  
  // Use our new wallet assets hook
  const { 
    tokens, 
    nfts, 
    transactions, 
    isLoading, 
    transactionsLoading, 
    refreshWalletData 
  } = useWalletAssets();
  
  // Calculate total balance in USD
  const totalUsdBalance = tokens.reduce((total, token) => {
    return total + token.usdValue;
  }, 0);
  
  // Find SOL and YOT tokens
  const solToken = tokens.find(token => token.symbol === 'SOL');
  const yotToken = tokens.find(token => token.symbol === 'YOT');
  
  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toString());
      toast({
        title: "Address copied",
        description: "Wallet address copied to clipboard",
      });
    }
  };
  
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
  
  const handleRefresh = () => {
    refreshWalletData();
    toast({
      title: "Refreshing data",
      description: "Fetching latest wallet information",
    });
  };
  
  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Card className="w-full max-w-md bg-[#0f1421] shadow-xl border-[#1e2a45]">
          <CardHeader>
            <CardTitle className="text-white text-center">Connect Your Wallet</CardTitle>
            <CardDescription className="text-center text-[#a3accd]">
              Please connect a wallet to view your assets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleConnectWallet}
              className="w-full bg-gradient-to-r from-primary to-[#7043f9] text-white"
            >
              Connect Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Wallet</h1>
        <div className="mt-4 md:mt-0">
          <Button variant="outline" size="sm" className="border-[#1e2a45] bg-[#141c2f] text-white mr-2" onClick={copyAddress}>
            {publicKey && shortenAddress(publicKey.toString())}
            <Copy className="h-4 w-4 ml-2" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-[#1e2a45] bg-[#141c2f] text-white"
            onClick={() => {
              if (publicKey) {
                window.open(`https://explorer.solana.com/address/${publicKey.toString()}?cluster=devnet`, '_blank');
              }
            }}
          >
            Explorer
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
          <CardHeader className="pb-3">
            <CardTitle className="text-gray-400 text-sm">Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {isLoading ? 
                <div className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </div> :
                `$${formatCurrency(totalUsdBalance)}`
              }
            </div>
            <div className="text-xs text-gray-400 mt-1">Across all tokens</div>
          </CardContent>
        </Card>
        
        <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
          <CardHeader className="pb-3">
            <CardTitle className="text-gray-400 text-sm">SOL Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {isLoading ? 
                <div className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </div> : 
                `${solToken?.balance || 0} SOL`
              }
            </div>
            <div className="text-xs text-gray-400 mt-1">
              ≈ ${formatCurrency(solToken?.usdValue || 0)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
          <CardHeader className="pb-3">
            <CardTitle className="text-gray-400 text-sm">YOT Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {isLoading ? 
                <div className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </div> : 
                `${formatCurrency(yotToken?.balance || 0)} YOT`
              }
            </div>
            <div className="text-xs text-gray-400 mt-1">
              ≈ ${formatCurrency(yotToken?.usdValue || 0)}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex justify-between items-center mb-4">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="bg-[#1a2338]">
            <TabsTrigger 
              value="tokens" 
              className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
            >
              Tokens
            </TabsTrigger>
            <TabsTrigger 
              value="nfts" 
              className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
            >
              NFTs
            </TabsTrigger>
            <TabsTrigger 
              value="transactions" 
              className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
            >
              Transactions
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-6">
            <TabsContent value="tokens">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Your Tokens</h2>
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-[#1e2a45] bg-[#141c2f] text-white"
                    onClick={handleRefresh}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Refresh
                  </Button>
                  <Button size="sm" variant="outline" className="border-[#1e2a45] bg-[#141c2f] text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Token
                  </Button>
                </div>
              </div>
              
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-8 flex justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : tokens.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      No tokens found in this wallet
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1e2a45]">
                      {tokens.map((token, index) => (
                        <div key={index} className="flex items-center justify-between p-4">
                          <div className="flex items-center">
                            <div className={`w-10 h-10 rounded-full ${token.iconClass || 'bg-gray-700'} flex items-center justify-center text-white font-bold`}>
                              {token.symbol.substring(0, 1)}
                            </div>
                            <div className="ml-3">
                              <div className="text-white font-semibold">{token.symbol}</div>
                              <div className="text-xs text-gray-400">{token.name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-semibold">
                              {formatCurrency(token.balance)} {token.symbol}
                            </div>
                            <div className="text-xs text-gray-400">
                              ${formatCurrency(token.usdValue)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="nfts">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Your NFTs</h2>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-[#1e2a45] bg-[#141c2f] text-white"
                  onClick={handleRefresh}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>
              
              {isLoading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : nfts.length === 0 ? (
                <div className="p-8 text-center bg-[#0f1421] shadow-xl border-[#1e2a45] rounded-lg text-gray-400">
                  No NFTs found in this wallet
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {nfts.map((nft, index) => (
                    <Card key={index} className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
                      <div className="aspect-square bg-[#141c2f] rounded-t-lg overflow-hidden">
                        <img 
                          src={nft.imageUrl} 
                          alt={nft.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=NFT';
                          }}
                        />
                      </div>
                      <CardContent className="p-4">
                        <h3 className="text-white font-semibold">{nft.name}</h3>
                        <p className="text-xs text-gray-400">{nft.collection}</p>
                        {nft.floor && (
                          <div className="mt-2 text-sm text-gray-300">
                            Floor: {nft.floor} SOL
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="transactions">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Recent Transactions</h2>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-[#1e2a45] bg-[#141c2f] text-white"
                  onClick={handleRefresh}
                  disabled={transactionsLoading}
                >
                  {transactionsLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>
              
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
                <CardContent className="p-0">
                  {transactionsLoading ? (
                    <div className="p-8 flex justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      No transactions found for this wallet
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1e2a45]">
                      {transactions.map((tx, index) => (
                        <div key={index} className="flex items-center justify-between p-4">
                          <div className="flex items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                              tx.type === 'send' ? 'bg-amber-600' : 
                              tx.type === 'receive' ? 'bg-green-600' : 'bg-blue-600'
                            }`}>
                              {tx.type === 'send' ? <Send className="h-5 w-5" /> : 
                               tx.type === 'receive' ? <Send className="h-5 w-5 transform rotate-180" /> : 
                               <RefreshCw className="h-5 w-5" />}
                            </div>
                            <div className="ml-3">
                              <div className="text-white font-semibold capitalize">{tx.type}</div>
                              <div className="text-xs text-gray-400">
                                {tx.type === 'swap' ? 
                                  `${tx.amountFrom} ${tx.tokenFrom} → ${tx.amountTo} ${tx.tokenTo}` : 
                                  `${tx.amount} ${tx.token}`}
                              </div>
                              {tx.to && <div className="text-xs text-gray-500">To: {tx.to}</div>}
                              {tx.from && <div className="text-xs text-gray-500">From: {tx.from}</div>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-white text-sm">{tx.date}</div>
                            <div className="text-xs text-green-400 capitalize">{tx.status}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}