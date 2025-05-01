import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWallet } from '@/hooks/useSolanaWallet';
import { useToast } from '@/hooks/use-toast';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { useState } from 'react';
import { formatCurrency, shortenAddress } from '@/lib/utils';
import { 
  Plus, 
  Image, 
  Sparkles, 
  Gem, 
  ThumbsUp, 
  MessageSquare, 
  Share2, 
  Trophy, 
  BarChart2,
  Upload,
  ArrowUp,
  Clock
} from 'lucide-react';

export default function Memes() {
  const { toast } = useToast();
  const { connected, wallet, publicKey } = useWallet();
  const { connect } = useMultiWallet();
  const [selectedTab, setSelectedTab] = useState('browse');
  const [stakedNFTs, setStakedNFTs] = useState([]);
  
  // Placeholder NFT collections (in a real app, these would be fetched from blockchain)
  const nftCollections = [
    {
      id: 'yot-memes',
      name: 'YOT Memes Collection',
      items: 1000,
      floorPrice: 0.5,
      volume24h: 128,
      totalStaked: 458,
      apyRange: '45-70%',
      featured: true,
      verified: true,
      banner: 'https://via.placeholder.com/800x200/3d2645/ffffff?text=YOT+Memes'
    },
    {
      id: 'yos-funny',
      name: 'YOS Funny Moments',
      items: 500,
      floorPrice: 0.35,
      volume24h: 89,
      totalStaked: 245,
      apyRange: '30-52%',
      featured: false,
      verified: true,
      banner: 'https://via.placeholder.com/800x200/453a94/ffffff?text=YOS+Funny+Moments'
    },
    {
      id: 'crypto-lols',
      name: 'Crypto LOLs',
      items: 2500,
      floorPrice: 0.22,
      volume24h: 205,
      totalStaked: 1130,
      apyRange: '25-40%',
      featured: false,
      verified: true,
      banner: 'https://via.placeholder.com/800x200/104547/ffffff?text=Crypto+LOLs'
    }
  ];
  
  // Placeholder memes/NFTs (in a real app, these would be fetched)
  const nfts = [
    {
      id: 1,
      title: 'Diamond Hands',
      description: 'HODL no matter what!',
      image: 'https://via.placeholder.com/400/3d2645/ffffff?text=Diamond+Hands',
      creator: '0x7m7R...hT6',
      price: 0.8,
      likes: 258,
      comments: 47,
      isStaked: false,
      rewards: 0.012
    },
    {
      id: 2,
      title: 'To The Moon',
      description: 'When YOT hits 10x',
      image: 'https://via.placeholder.com/400/453a94/ffffff?text=To+The+Moon',
      creator: '0x8JzQ...Ybh',
      price: 0.5,
      likes: 189,
      comments: 32,
      isStaked: true,
      rewards: 0.008
    },
    {
      id: 3,
      title: 'Wen Lambo',
      description: 'Soon™',
      image: 'https://via.placeholder.com/400/104547/ffffff?text=Wen+Lambo',
      creator: '0xAasQ...z7C',
      price: 0.3,
      likes: 142,
      comments: 18,
      isStaked: false,
      rewards: 0.005
    },
    {
      id: 4,
      title: 'Dip Buyer',
      description: 'Buy the dip, then it dips more',
      image: 'https://via.placeholder.com/400/2a4858/ffffff?text=Dip+Buyer',
      creator: '0x9aBq...p3F',
      price: 0.45,
      likes: 203,
      comments: 35,
      isStaked: false,
      rewards: 0.007
    },
    {
      id: 5,
      title: 'Solana Speed',
      description: 'Fast as lightning',
      image: 'https://via.placeholder.com/400/5a3546/ffffff?text=Solana+Speed',
      creator: '0x3ZtY...h1G',
      price: 0.65,
      likes: 275,
      comments: 52,
      isStaked: true,
      rewards: 0.01
    },
    {
      id: 6,
      title: 'NFT Collector',
      description: 'Gotta catch them all',
      image: 'https://via.placeholder.com/400/464775/ffffff?text=NFT+Collector',
      creator: '0x2KlM...q9T',
      price: 0.4,
      likes: 167,
      comments: 29,
      isStaked: false,
      rewards: 0.006
    }
  ];
  
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
  
  const handleCreateMeme = () => {
    toast({
      title: "Meme Creation",
      description: "Opening meme creation studio...",
    });
    // In a real app, this would navigate to a meme creation page or open a modal
  };
  
  const handleStakeNFT = (nftId) => {
    toast({
      title: "NFT Staked",
      description: "Your NFT has been staked successfully!",
    });
    // In a real app, this would call a blockchain transaction
  };
  
  const handleUnstakeNFT = (nftId) => {
    toast({
      title: "NFT Unstaked",
      description: "Your NFT has been unstaked successfully!",
    });
    // In a real app, this would call a blockchain transaction
  };
  
  const handleLike = (nftId) => {
    toast({
      title: "Liked!",
      description: "You liked this meme NFT.",
    });
    // In a real app, this would update like count in the database
  };
  
  const handleShare = (nftId) => {
    toast({
      title: "Share",
      description: "Share options opened",
    });
    // In a real app, this would open share options
  };
  
  const handleClaimRewards = () => {
    toast({
      title: "Rewards Claimed",
      description: "Your staking rewards have been claimed successfully!",
    });
    // In a real app, this would call a blockchain transaction
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">YOT Memes NFT</h1>
          <p className="text-gray-400 mt-1">Create, collect, and stake meme NFTs</p>
        </div>
        
        {connected ? (
          <Button 
            onClick={handleCreateMeme}
            className="bg-gradient-to-r from-primary to-[#7043f9] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Meme NFT
          </Button>
        ) : (
          <Button 
            onClick={handleConnectWallet}
            className="bg-gradient-to-r from-primary to-[#7043f9] text-white"
          >
            Connect Wallet
          </Button>
        )}
      </div>
      
      <Tabs defaultValue={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full sm:w-[500px] mb-6 bg-[#1a2338]">
          <TabsTrigger 
            value="browse" 
            className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
          >
            Browse
          </TabsTrigger>
          <TabsTrigger 
            value="collections" 
            className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
          >
            Collections
          </TabsTrigger>
          <TabsTrigger 
            value="staking" 
            className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
          >
            Staking
          </TabsTrigger>
          <TabsTrigger 
            value="my-nfts" 
            className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
          >
            My NFTs
          </TabsTrigger>
        </TabsList>
        
        {/* Browse Tab */}
        <TabsContent value="browse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {nfts.map((nft) => (
              <Card key={nft.id} className="bg-[#0f1421] shadow-xl border-[#1e2a45] overflow-hidden">
                <div className="relative">
                  <div className="aspect-square bg-[#141c2f] overflow-hidden">
                    <div className="w-full h-full bg-[#1e2a45] flex items-center justify-center">
                      <img src={nft.image} alt={nft.title} className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 flex space-x-2">
                    {nft.isStaked && (
                      <div className="bg-green-600 text-white text-xs px-2 py-1 rounded-full flex items-center">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Staked
                      </div>
                    )}
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-white font-semibold">{nft.title}</h3>
                      <p className="text-xs text-gray-400">{nft.description}</p>
                    </div>
                    <div className="bg-[#1e2a45] px-2 py-1 rounded">
                      <span className="text-white text-sm font-medium">{nft.price} SOL</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-400 mb-4">
                    <div>By {nft.creator}</div>
                    {nft.isStaked && <div className="text-green-400">+{nft.rewards} YOS/day</div>}
                  </div>
                  <div className="flex justify-between">
                    <div className="flex space-x-3">
                      <button onClick={() => handleLike(nft.id)} className="flex items-center text-gray-400 hover:text-white">
                        <ThumbsUp className="h-4 w-4 mr-1" />
                        <span>{nft.likes}</span>
                      </button>
                      <button className="flex items-center text-gray-400 hover:text-white">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        <span>{nft.comments}</span>
                      </button>
                      <button onClick={() => handleShare(nft.id)} className="flex items-center text-gray-400 hover:text-white">
                        <Share2 className="h-4 w-4" />
                      </button>
                    </div>
                    {connected && (
                      <div>
                        {nft.isStaked ? (
                          <Button variant="outline" size="sm" className="border-[#1e2a45] bg-[#141c2f] text-white" onClick={() => handleUnstakeNFT(nft.id)}>
                            Unstake
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="border-green-800 bg-green-900/30 text-green-400" onClick={() => handleStakeNFT(nft.id)}>
                            Stake NFT
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        {/* Collections Tab */}
        <TabsContent value="collections">
          <div className="space-y-6">
            {nftCollections.map((collection) => (
              <Card key={collection.id} className="bg-[#0f1421] shadow-xl border-[#1e2a45] overflow-hidden">
                <div className="h-40 bg-[#141c2f] overflow-hidden">
                  <img src={collection.banner} alt={collection.name} className="w-full h-full object-cover" />
                </div>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center">
                        <h3 className="text-xl text-white font-semibold">{collection.name}</h3>
                        {collection.verified && (
                          <div className="ml-2 bg-blue-600 text-white p-1 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{collection.items} items • {collection.totalStaked} staked</p>
                    </div>
                    <Button className="bg-gradient-to-r from-primary to-[#7043f9] text-white">
                      View Collection
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#141c2f] rounded-md p-3 border border-[#1e2a45]">
                      <p className="text-xs text-[#7d8ab1]">Floor Price</p>
                      <p className="text-lg font-medium text-white">{collection.floorPrice} SOL</p>
                    </div>
                    <div className="bg-[#141c2f] rounded-md p-3 border border-[#1e2a45]">
                      <p className="text-xs text-[#7d8ab1]">24h Volume</p>
                      <p className="text-lg font-medium text-white">{collection.volume24h} SOL</p>
                    </div>
                    <div className="bg-[#141c2f] rounded-md p-3 border border-[#1e2a45]">
                      <p className="text-xs text-[#7d8ab1]">Staking APY</p>
                      <p className="text-lg font-medium text-green-400">{collection.apyRange}</p>
                    </div>
                    <div className="bg-[#141c2f] rounded-md p-3 border border-[#1e2a45]">
                      <p className="text-xs text-[#7d8ab1]">Staked</p>
                      <p className="text-lg font-medium text-white">{Math.round((collection.totalStaked / collection.items) * 100)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        {/* Staking Tab */}
        <TabsContent value="staking">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45] mb-6">
                <CardHeader>
                  <CardTitle className="text-white">NFT Staking</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Stake your YOT and YOS meme NFTs to earn daily rewards
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-[#141c2f] rounded-md p-4 border border-[#1e2a45]">
                      <div className="flex items-center mb-2">
                        <Gem className="h-5 w-5 text-primary mr-2" />
                        <h3 className="text-white font-medium">NFTs Staked</h3>
                      </div>
                      <div className="text-2xl font-bold text-white">2</div>
                      <div className="text-xs text-gray-400 mt-1">Out of 5 owned</div>
                    </div>
                    <div className="bg-[#141c2f] rounded-md p-4 border border-[#1e2a45]">
                      <div className="flex items-center mb-2">
                        <BarChart2 className="h-5 w-5 text-green-400 mr-2" />
                        <h3 className="text-white font-medium">Staking APY</h3>
                      </div>
                      <div className="text-2xl font-bold text-green-400">52.5%</div>
                      <div className="text-xs text-gray-400 mt-1">Average for all NFTs</div>
                    </div>
                    <div className="bg-[#141c2f] rounded-md p-4 border border-[#1e2a45]">
                      <div className="flex items-center mb-2">
                        <Trophy className="h-5 w-5 text-amber-400 mr-2" />
                        <h3 className="text-white font-medium">Total Rewards</h3>
                      </div>
                      <div className="text-2xl font-bold text-white">0.18 YOS</div>
                      <div className="text-xs text-gray-400 mt-1">≈ $0.36</div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-[#252f4a]/80 to-[#1e2a45]/80 rounded-lg p-4 border border-[#3d4a6a] mb-6">
                    <div className="flex items-start">
                      <div className="p-2 rounded-full bg-green-900/50 border border-green-700/50 mr-3">
                        <Clock className="h-5 w-5 text-green-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-medium mb-1">Pending Rewards</h3>
                        <div className="text-2xl font-bold text-green-400">0.0056 YOS / day</div>
                        <div className="text-sm text-gray-300 mt-2">Next claim available in 2d 16h</div>
                      </div>
                      <div className="ml-auto">
                        <Button disabled={!connected} className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                          <ArrowUp className="h-4 w-4 mr-2" />
                          Claim Rewards
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <div className="text-white font-medium">Staking Benefits</div>
                    <ul className="list-disc list-inside text-gray-400 space-y-1 pl-2">
                      <li>Earn passive income through daily YOS token rewards</li>
                      <li>Receive exclusive access to premium meme templates</li>
                      <li>Participate in governance votes for the YOT ecosystem</li>
                      <li>Get priority for new NFT collection mints</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
                <CardHeader>
                  <CardTitle className="text-white">Staked NFTs</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Your currently staked meme NFTs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {nfts.filter(nft => nft.isStaked).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {nfts.filter(nft => nft.isStaked).map((nft) => (
                        <div key={nft.id} className="flex bg-[#141c2f] rounded-lg border border-[#1e2a45] overflow-hidden">
                          <div className="w-24 h-24 bg-[#1e2a45] shrink-0">
                            <img src={nft.image} alt={nft.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="p-3 flex-1">
                            <div className="flex justify-between">
                              <h4 className="text-white font-medium">{nft.title}</h4>
                              <div className="text-green-400 text-sm">+{nft.rewards} YOS/day</div>
                            </div>
                            <div className="text-xs text-gray-400 mb-2">Staked for 7 days</div>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full border-[#1e2a45] bg-[#141c2f] text-white hover:bg-red-900/30 hover:border-red-800"
                              onClick={() => handleUnstakeNFT(nft.id)}
                            >
                              Unstake
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="p-4 rounded-full bg-[#1e2a45]">
                        <Gem className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="text-white font-medium mt-4">No Staked NFTs</h3>
                      <p className="text-gray-400 text-sm mt-1 max-w-md text-center">
                        You don't have any staked NFTs yet. Stake your meme NFTs to earn YOS rewards!
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            <div>
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45] sticky top-6">
                <CardHeader>
                  <CardTitle className="text-white">Staking Rewards</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Current reward rates for NFT staking
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-gradient-to-br from-[#252f4a] to-[#1e2a45] border border-[#3d4a6a]">
                      <div className="text-white font-medium mb-2">YOT Memes Collection</div>
                      <div className="flex justify-between items-center">
                        <div className="text-3xl font-bold text-green-400">45-70%</div>
                        <div className="text-sm text-gray-300">APY</div>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Varies by NFT rarity</div>
                      <div className="w-full h-1.5 bg-[#141c2f] rounded-full mt-3">
                        <div className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full" style={{ width: '75%' }}></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Capacity: 75%</span>
                        <span>458/600 staked</span>
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-gradient-to-br from-[#252f4a] to-[#1e2a45] border border-[#3d4a6a]">
                      <div className="text-white font-medium mb-2">YOS Funny Moments</div>
                      <div className="flex justify-between items-center">
                        <div className="text-3xl font-bold text-green-400">30-52%</div>
                        <div className="text-sm text-gray-300">APY</div>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Varies by NFT rarity</div>
                      <div className="w-full h-1.5 bg-[#141c2f] rounded-full mt-3">
                        <div className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full" style={{ width: '45%' }}></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Capacity: 45%</span>
                        <span>245/550 staked</span>
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-gradient-to-br from-[#252f4a] to-[#1e2a45] border border-[#3d4a6a]">
                      <div className="text-white font-medium mb-2">Crypto LOLs</div>
                      <div className="flex justify-between items-center">
                        <div className="text-3xl font-bold text-green-400">25-40%</div>
                        <div className="text-sm text-gray-300">APY</div>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Varies by NFT rarity</div>
                      <div className="w-full h-1.5 bg-[#141c2f] rounded-full mt-3">
                        <div className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full" style={{ width: '95%' }}></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Capacity: 95%</span>
                        <span>1130/1200 staked</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-[#1e2a45] pt-4">
                  <Button 
                    onClick={handleCreateMeme} 
                    disabled={!connected}
                    className="w-full bg-gradient-to-r from-primary to-[#7043f9] text-white"
                  >
                    <div className="flex items-center">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your Own Meme NFT
                    </div>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        {/* My NFTs Tab */}
        <TabsContent value="my-nfts">
          {connected ? (
            <div className="space-y-6">
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
                <CardHeader>
                  <CardTitle className="text-white">My Meme NFT Collection</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Manage your owned meme NFTs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {nfts.slice(0, 3).map((nft) => (
                      <div key={nft.id} className="relative bg-[#141c2f] rounded-lg border border-[#1e2a45] overflow-hidden">
                        <div className="aspect-video bg-[#1e2a45]">
                          <img src={nft.image} alt={nft.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute top-2 right-2">
                          {nft.isStaked && (
                            <div className="bg-green-600 text-white text-xs px-2 py-1 rounded-full flex items-center">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Staked
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-white font-medium">{nft.title}</h4>
                              <div className="text-xs text-gray-400">{nft.price} SOL</div>
                            </div>
                            {nft.isStaked ? (
                              <Button variant="outline" size="sm" className="border-[#1e2a45] bg-[#141c2f] text-white hover:bg-red-900/30 hover:border-red-800">
                                Unstake
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" className="border-green-800 bg-green-900/30 text-green-400">
                                Stake
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
                <CardHeader>
                  <CardTitle className="text-white">Create a New Meme NFT</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Upload your meme and mint it as an NFT
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-[#1e2a45] rounded-lg p-8 flex flex-col items-center justify-center">
                    <div className="p-4 rounded-full bg-[#1e2a45] mb-4">
                      <Upload className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-white font-medium">Upload Meme Image</h3>
                    <p className="text-gray-400 text-sm mt-1 max-w-md text-center">
                      Drag and drop your meme image here, or click to browse
                    </p>
                    <p className="text-gray-500 text-xs mt-3">
                      Supported formats: PNG, JPG, GIF, WebP (max 10MB)
                    </p>
                    <Button className="mt-4 bg-gradient-to-r from-primary to-[#7043f9] text-white">
                      <Image className="h-4 w-4 mr-2" />
                      Choose Image
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-6 rounded-full bg-[#1e2a45]">
                <Wallet className="h-12 w-12 text-gray-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mt-6">Connect Your Wallet</h2>
              <p className="text-gray-400 text-center max-w-md mt-2">
                Connect your wallet to view your NFT collection and create new meme NFTs.
              </p>
              <Button 
                onClick={handleConnectWallet}
                className="mt-6 bg-gradient-to-r from-primary to-[#7043f9] text-white"
              >
                Connect Wallet
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}