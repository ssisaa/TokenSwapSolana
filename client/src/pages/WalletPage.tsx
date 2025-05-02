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
  const { connected, wallet, publicKey } = useWallet();
  const { connect } = useMultiWallet();
  const { balances, loading, fetchBalances } = useTokenData();
  const [selectedTab, setSelectedTab] = useState('tokens');
  
  useEffect(() => {
    if (connected && publicKey) {
      fetchBalances(publicKey.toString());
    }
  }, [connected, publicKey, fetchBalances]);
  
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
  
  const tokensList = [
    { symbol: 'SOL', name: 'Solana', balance: balances?.sol || 0, price: 148.35, iconClass: 'bg-[#9945FF]' },
    { symbol: 'YOT', name: 'Your Own Token', balance: balances?.yot || 0, price: 0.00000200, iconClass: 'bg-[#3e63dd]' },
    { symbol: 'YOS', name: 'Your Own Story', balance: balances?.yos || 0, price: 0.00002000, iconClass: 'bg-[#10B981]' },
  ];
  
  const nftsList = [
    { name: 'YOT NFT #123', collection: 'YOT Collection', floor: 1.5, imageUrl: 'https://via.placeholder.com/100' },
    { name: 'YOS NFT #456', collection: 'YOS Collection', floor: 0.8, imageUrl: 'https://via.placeholder.com/100' },
  ];
  
  const transactionsList = [
    { 
      type: 'send', 
      token: 'SOL', 
      amount: 0.5, 
      date: '2023-04-28', 
      status: 'confirmed',
      to: '8JzqAnf...'
    },
    { 
      type: 'receive', 
      token: 'YOT', 
      amount: 1000, 
      date: '2023-04-27', 
      status: 'confirmed',
      from: '7m7RAFh...'
    },
    { 
      type: 'swap', 
      tokenFrom: 'SOL', 
      amountFrom: 0.2, 
      tokenTo: 'YOT', 
      amountTo: 500, 
      date: '2023-04-25', 
      status: 'confirmed'
    },
  ];
  
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
              {loading ? 
                "Loading..." :
                `$${formatCurrency(
                  (balances?.sol || 0) * 148.35 +
                  (balances?.yot || 0) * 0.00000200 +
                  (balances?.yos || 0) * 0.00002000
                )}`
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
              {loading ? "Loading..." : `${balances?.sol || 0} SOL`}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              ≈ ${formatCurrency((balances?.sol || 0) * 148.35)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
          <CardHeader className="pb-3">
            <CardTitle className="text-gray-400 text-sm">YOT Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {loading ? "Loading..." : `${formatCurrency(balances?.yot || 0)} YOT`}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              ≈ ${formatCurrency((balances?.yot || 0) * 0.00000200)}
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
                  <Button size="sm" variant="outline" className="border-[#1e2a45] bg-[#141c2f] text-white">
                    <RefreshCw className="h-4 w-4 mr-2" />
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
                  <div className="divide-y divide-[#1e2a45]">
                    {tokensList.map((token, index) => (
                      <div key={index} className="flex items-center justify-between p-4">
                        <div className="flex items-center">
                          <div className={`w-10 h-10 rounded-full ${token.iconClass} flex items-center justify-center text-white font-bold`}>
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
                            ${formatCurrency(token.balance * token.price)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="nfts">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Your NFTs</h2>
                <Button size="sm" variant="outline" className="border-[#1e2a45] bg-[#141c2f] text-white">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {nftsList.map((nft, index) => (
                  <Card key={index} className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
                    <div className="aspect-square bg-[#141c2f] rounded-t-lg overflow-hidden">
                      <div className="w-full h-full bg-[#1e2a45] flex items-center justify-center text-gray-400">
                        NFT Image
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="text-white font-semibold">{nft.name}</h3>
                      <p className="text-xs text-gray-400">{nft.collection}</p>
                      <div className="mt-2 text-sm text-gray-300">
                        Floor: {nft.floor} SOL
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="transactions">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Recent Transactions</h2>
                <Button size="sm" variant="outline" className="border-[#1e2a45] bg-[#141c2f] text-white">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
              
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
                <CardContent className="p-0">
                  <div className="divide-y divide-[#1e2a45]">
                    {transactionsList.map((tx, index) => (
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
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}