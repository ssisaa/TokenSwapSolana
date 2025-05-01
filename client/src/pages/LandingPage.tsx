import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useWallet } from '@/hooks/useSolanaWallet';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { useState, useEffect } from 'react';
import { 
  ArrowRightLeft, 
  ChevronRight, 
  BarChart3, 
  Gem, 
  Globe, 
  Sparkles, 
  Zap, 
  Shield, 
  Share2, 
  Download, 
  ArrowRight,
  ExternalLink
} from 'lucide-react';

export default function LandingPage() {
  const { connected } = useWallet();
  const { connect } = useMultiWallet();
  const { toast } = useToast();
  const [isScrolled, setIsScrolled] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const handleConnectWallet = async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast({
        title: "Connection failed",
        description: "Could not connect to wallet. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="min-h-screen bg-[#080c16] text-white">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-[#0a0f1a]/95 backdrop-blur-sm shadow-md' : 'bg-transparent'
      }`}>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-gradient-to-br from-primary to-[#7043f9] p-2 rounded-lg">
              <ArrowRightLeft className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">YOT Swap</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-300 hover:text-white">Features</a>
            <a href="#ecosystem" className="text-gray-300 hover:text-white">Ecosystem</a>
            <a href="#staking" className="text-gray-300 hover:text-white">Staking</a>
            <a href="#roadmap" className="text-gray-300 hover:text-white">Roadmap</a>
          </div>
          
          <div className="flex items-center space-x-3">
            {connected ? (
              <Link href="/dashboard">
                <Button className="bg-gradient-to-r from-primary to-[#7043f9] text-white">
                  Launch App
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button 
                onClick={handleConnectWallet} 
                className="bg-gradient-to-r from-primary to-[#7043f9] text-white"
              >
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </nav>
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://via.placeholder.com/1920x1080/080c16/080c16')] opacity-10 bg-fixed"></div>
        
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 -left-28 w-96 h-96 bg-primary/20 rounded-full filter blur-[100px]"></div>
        <div className="absolute bottom-1/4 -right-28 w-96 h-96 bg-[#7043f9]/20 rounded-full filter blur-[100px]"></div>
        
        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-primary to-[#7043f9]">
              Next-Generation Multi-Hub Token Swap
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Experience seamless token swaps with enhanced liquidity routing, automatic YOT-SOL pool contributions, and 
              exclusive YOS rewards on the Solana blockchain.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              {connected ? (
                <>
                  <Link href="/dashboard">
                    <Button className="bg-gradient-to-r from-primary to-[#7043f9] text-white text-lg px-8 py-6">
                      Dashboard
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/swap">
                    <Button className="bg-gradient-to-r from-[#1e2a45] to-[#252f4a] text-white text-lg px-8 py-6">
                      Classic Swap
                      <ArrowRightLeft className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/multi-hub-swap">
                    <Button className="bg-gradient-to-r from-[#1e2a45] to-[#252f4a] text-white text-lg px-8 py-6">
                      Multi-Hub Swap
                      <Zap className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Button 
                    onClick={handleConnectWallet} 
                    className="bg-gradient-to-r from-primary to-[#7043f9] text-white text-lg px-8 py-6"
                  >
                    Connect Wallet
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button 
                    className="bg-gradient-to-r from-[#1e2a45] to-[#252f4a] text-white text-lg px-8 py-6"
                    onClick={() => window.open('https://explorer.solana.com/address/2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF', '_blank')}
                  >
                    YOT Token
                    <ExternalLink className="ml-2 h-5 w-5" />
                  </Button>
                </>
              )}
            </div>
          </div>
          
          <div className="relative mx-auto mt-16 max-w-4xl">
            <div className="bg-gradient-to-r from-primary/20 to-[#7043f9]/20 rounded-xl p-1">
              <div className="bg-[#0f1421]/90 rounded-lg overflow-hidden shadow-2xl">
                <img 
                  src="https://via.placeholder.com/1200x600/141c2f/1e2a45" 
                  alt="YOT Swap Interface" 
                  className="w-full h-auto rounded-t-lg opacity-80 hover:opacity-100 transition-opacity" 
                />
                {/* Stats overlay */}
                <div className="grid grid-cols-3 divide-x divide-[#1e2a45] bg-[#0f1421]">
                  <div className="p-4 text-center">
                    <div className="text-xl font-bold text-white">100%</div>
                    <div className="text-sm text-gray-400">Staking APR</div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="text-xl font-bold text-white">20%</div>
                    <div className="text-sm text-gray-400">Liquidity Contribution</div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="text-xl font-bold text-white">YOS</div>
                    <div className="text-sm text-gray-400">Rewards Token</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Key Features Section */}
      <section id="features" className="py-20 bg-[#0a0f1a]">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Advanced Swap Features</h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Our platform offers unique capabilities beyond standard token swaps
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Globe,
                title: "Multi-Hub Routing",
                description: "Automatically routes transactions through multiple liquidity sources for best execution price and higher success rates"
              },
              {
                icon: Gem,
                title: "Automatic Liquidity Contribution",
                description: "20% of each swap automatically contributes to the SOL-YOT liquidity pool with a 50/50 split, strengthening the ecosystem"
              },
              {
                icon: Sparkles,
                title: "YOS Cashback Rewards",
                description: "Earn YOS tokens as cashback on every transaction, which can be staked for additional passive income"
              },
              {
                icon: Shield,
                title: "Solana Smart Contracts",
                description: "All critical operations secured by Solana blockchain smart contracts for maximum security and efficiency"
              },
              {
                icon: Share2,
                title: "Affiliate Program",
                description: "Share your referral link and earn rewards when others use the platform through your invitation"
              },
              {
                icon: BarChart3,
                title: "Real-time Analytics",
                description: "Comprehensive dashboard with trading volume, liquidity statistics, and personal portfolio tracking"
              }
            ].map((feature, index) => (
              <Card key={index} className="bg-[#0f1421] border-[#1e2a45] shadow-xl overflow-hidden">
                <CardContent className="p-6">
                  <div className="bg-gradient-to-br from-primary/20 to-[#7043f9]/20 p-3 rounded-full w-fit mb-4">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      
      {/* Ecosystem Section */}
      <section id="ecosystem" className="py-20 bg-[#080c16] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://via.placeholder.com/1920x1080/080c16/080c16')] opacity-10 bg-fixed"></div>
        
        {/* Gradient Orbs */}
        <div className="absolute top-1/3 -right-28 w-96 h-96 bg-primary/20 rounded-full filter blur-[100px]"></div>
        <div className="absolute bottom-1/3 -left-28 w-96 h-96 bg-[#7043f9]/20 rounded-full filter blur-[100px]"></div>
        
        <div className="container mx-auto px-4 max-w-6xl relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">YOT Ecosystem</h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              A comprehensive ecosystem designed for sustainable growth and user rewards
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="bg-[#0f1421] border border-[#1e2a45] rounded-xl p-6 space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-3">YOT Token</h3>
                  <p className="text-gray-400 mb-4">
                    The primary token of the ecosystem with multi-utility functions across trading, staking and governance.
                  </p>
                  <div className="flex items-center space-x-6 text-sm">
                    <div>
                      <div className="text-gray-400">Token Address</div>
                      <div className="text-primary font-medium">2EmUMo6...5GPF</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Supply</div>
                      <div className="text-white font-medium">1,000,000,000</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Type</div>
                      <div className="text-white font-medium">SPL</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-2xl font-bold text-white mb-3">YOS Token</h3>
                  <p className="text-gray-400 mb-4">
                    The reward token earned through swaps, staking, and affiliate activities, providing passive income.
                  </p>
                  <div className="flex items-center space-x-6 text-sm">
                    <div>
                      <div className="text-gray-400">Token Address</div>
                      <div className="text-primary font-medium">GcsjAVW...M8n</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Supply</div>
                      <div className="text-white font-medium">500,000,000</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Type</div>
                      <div className="text-white font-medium">SPL</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-2xl font-bold text-white mb-3">Liquidity Pool</h3>
                  <p className="text-gray-400 mb-4">
                    The YOT-SOL liquidity pool automatically receives 20% of all swap volumes, creating a sustainable ecosystem.
                  </p>
                  <Button 
                    className="bg-gradient-to-r from-[#1e2a45] to-[#252f4a] text-white"
                    onClick={() => window.open('https://explorer.solana.com/address/7m7RAFhzGXr4eYUWUdQ8U6ZAuZx6qRG8ZCSvr6cHKpfK', '_blank')}
                  >
                    View on Explorer
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="w-full h-96 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-[#7043f9]/30 rounded-xl"></div>
                <div className="absolute inset-4 bg-[#0f1421]/90 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-6">Ecosystem Architecture</h3>
                    <div className="w-64 h-64 mx-auto bg-[#141c2f] rounded-full border-4 border-[#1e2a45] relative flex items-center justify-center">
                      <div className="absolute inset-4 bg-[#0a0f1a] rounded-full flex items-center justify-center">
                        <div className="bg-gradient-to-br from-primary to-[#7043f9] p-4 rounded-full">
                          <ArrowRightLeft className="h-8 w-8 text-white" />
                        </div>
                      </div>
                      
                      {/* Orbit items */}
                      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
                        <div 
                          key={i}
                          className="absolute w-12 h-12 bg-[#141c2f] rounded-full flex items-center justify-center border-2 border-[#1e2a45]"
                          style={{
                            transform: `rotate(${deg}deg) translateX(120px) rotate(-${deg}deg)`
                          }}
                        >
                          {i === 0 && <span className="text-xs font-medium text-white">Swap</span>}
                          {i === 1 && <span className="text-xs font-medium text-white">Stake</span>}
                          {i === 2 && <span className="text-xs font-medium text-white">Pool</span>}
                          {i === 3 && <span className="text-xs font-medium text-white">YOT</span>}
                          {i === 4 && <span className="text-xs font-medium text-white">YOS</span>}
                          {i === 5 && <span className="text-xs font-medium text-white">NFT</span>}
                          {i === 6 && <span className="text-xs font-medium text-white">Refer</span>}
                          {i === 7 && <span className="text-xs font-medium text-white">Earn</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Staking Section */}
      <section id="staking" className="py-20 bg-[#0a0f1a]">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Staking Rewards</h2>
              <p className="text-xl text-gray-400 mb-8">
                Stake your YOT tokens to earn 100% APR rewards paid in YOS tokens. Weekly distributions 
                provide a steady stream of passive income.
              </p>
              
              <div className="space-y-4 mb-8">
                {[
                  {
                    title: "Flexible Staking",
                    description: "No lock-up period required - stake and unstake at any time"
                  },
                  {
                    title: "100% APR",
                    description: "Earn substantial rewards through weekly YOS token distributions"
                  },
                  {
                    title: "Compounding Rewards",
                    description: "Reinvest your YOS rewards for exponential growth"
                  },
                  {
                    title: "NFT Boost",
                    description: "Stake NFTs to boost your staking rewards even further"
                  }
                ].map((feature, index) => (
                  <div key={index} className="flex">
                    <div className="bg-gradient-to-br from-primary/20 to-[#7043f9]/20 p-2 rounded-full h-fit mt-1 mr-4">
                      <ChevronRight className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{feature.title}</h3>
                      <p className="text-gray-400">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <Link href="/staking">
                <Button className="bg-gradient-to-r from-primary to-[#7043f9] text-white px-8 py-6 text-lg">
                  Start Staking Now
                  <Sparkles className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
            
            <div>
              <Card className="bg-[#0f1421] border-[#1e2a45] shadow-xl overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-gradient-to-r from-[#252f4a] to-[#1e2a45] p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold text-white">Staking Calculator</h3>
                      <div className="bg-gradient-to-br from-primary to-[#7043f9] p-2 rounded-full">
                        <BarChart3 className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <div className="text-white mb-2">YOT Amount Staked</div>
                        <div className="w-full h-12 bg-[#0f1421] rounded border border-[#1e2a45] p-3 text-white">
                          10,000 YOT
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-[#0f1421]/80 p-4 rounded-lg border border-[#1e2a45]">
                          <div className="text-sm text-gray-400">Daily Rewards</div>
                          <div className="text-xl font-bold text-white">27.39 YOS</div>
                        </div>
                        <div className="bg-[#0f1421]/80 p-4 rounded-lg border border-[#1e2a45]">
                          <div className="text-sm text-gray-400">Weekly Rewards</div>
                          <div className="text-xl font-bold text-white">191.78 YOS</div>
                        </div>
                        <div className="bg-[#0f1421]/80 p-4 rounded-lg border border-[#1e2a45]">
                          <div className="text-sm text-gray-400">Annual Rewards</div>
                          <div className="text-xl font-bold text-white">10,000 YOS</div>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-green-900/30 to-green-800/30 p-4 rounded-lg border border-green-700/30">
                        <div className="flex items-center text-green-400 mb-2">
                          <Sparkles className="h-4 w-4 mr-2" />
                          <span className="font-medium">Current Staking Stats</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-gray-400">Total Staked</div>
                            <div className="text-white">5,347,892 YOT</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Total Stakers</div>
                            <div className="text-white">1,249 users</div>
                          </div>
                          <div>
                            <div className="text-gray-400">APR</div>
                            <div className="text-white">100%</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Next Distribution</div>
                            <div className="text-white">3d 14h 22m</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
      
      {/* Roadmap Section */}
      <section id="roadmap" className="py-20 bg-[#080c16] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://via.placeholder.com/1920x1080/080c16/080c16')] opacity-10 bg-fixed"></div>
        
        {/* Gradient Orbs */}
        <div className="absolute bottom-1/4 -left-28 w-96 h-96 bg-primary/20 rounded-full filter blur-[100px]"></div>
        <div className="absolute top-1/4 -right-28 w-96 h-96 bg-[#7043f9]/20 rounded-full filter blur-[100px]"></div>
        
        <div className="container mx-auto px-4 max-w-6xl relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Development Roadmap</h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Our vision for the future of YOT Swap
            </p>
          </div>
          
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-[#7043f9] rounded-full"></div>
            
            <div className="space-y-24 relative">
              {[
                {
                  title: "Q2 2023 - Launch Phase",
                  completed: true,
                  items: [
                    "Initial YOT and YOS token launch",
                    "Basic swap functionality",
                    "SOL-YOT liquidity pool establishment",
                    "Community building initiatives"
                  ]
                },
                {
                  title: "Q4 2023 - Expansion Phase",
                  completed: true,
                  items: [
                    "Multi-hub swap implementation",
                    "Staking program with 100% APR",
                    "Advanced trading analytics",
                    "Affiliate program launch"
                  ]
                },
                {
                  title: "Q2 2024 - Growth Phase",
                  completed: false,
                  items: [
                    "NFT meme marketplace integration",
                    "Cross-chain bridge development",
                    "Enhanced governance mechanisms",
                    "Mobile application release"
                  ]
                },
                {
                  title: "Q4 2024 - Scaling Phase",
                  completed: false,
                  items: [
                    "Enterprise partnership program",
                    "AI-powered trading suggestions",
                    "On-chain derivatives platform",
                    "YOT ecosystem expansion"
                  ]
                }
              ].map((phase, index) => (
                <div key={index} className={`relative flex ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
                  {/* Center dot */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 w-6 h-6 bg-gradient-to-br from-primary to-[#7043f9] rounded-full z-10"></div>
                  
                  {/* Content */}
                  <div className={`w-1/2 ${index % 2 === 0 ? 'pr-12' : 'pl-12'}`}>
                    <Card className={`bg-[#0f1421] border-[#1e2a45] shadow-xl overflow-hidden ${phase.completed ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-blue-500'}`}>
                      <CardContent className="p-6">
                        <h3 className="text-2xl font-bold text-white mb-4">{phase.title}</h3>
                        <ul className="space-y-2">
                          {phase.items.map((item, i) => (
                            <li key={i} className="flex items-start">
                              <div className={`mt-1 mr-3 h-4 w-4 rounded-full flex items-center justify-center ${phase.completed ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                {phase.completed ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                ) : (
                                  <div className="h-2 w-2 rounded-full bg-current"></div>
                                )}
                              </div>
                              <span className="text-gray-300">{item}</span>
                            </li>
                          ))}
                        </ul>
                        <div className={`mt-4 text-sm ${phase.completed ? 'text-green-400' : 'text-blue-400'}`}>
                          {phase.completed ? 'Completed' : 'In Progress'}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Empty space for the other half */}
                  <div className="w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      
      {/* Call to Action */}
      <section className="py-20 bg-gradient-to-br from-[#141c2f] to-[#0f1421]">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Experience YOT Swap?</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Join thousands of users already trading with enhanced liquidity, automatic pool contributions, 
              and exclusive YOS rewards.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              {connected ? (
                <>
                  <Link href="/dashboard">
                    <Button className="bg-gradient-to-r from-primary to-[#7043f9] text-white text-lg px-8 py-6">
                      Launch Dashboard
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Button 
                    onClick={handleConnectWallet} 
                    className="bg-gradient-to-r from-primary to-[#7043f9] text-white text-lg px-8 py-6"
                  >
                    Connect Wallet
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </>
              )}
              <Button className="bg-gradient-to-r from-[#1e2a45] to-[#252f4a] text-white text-lg px-8 py-6">
                <Download className="mr-2 h-5 w-5" />
                Download Whitepaper
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-8 border-t border-[#1e2a45]">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">100%</div>
              <div className="text-gray-400">Staking APR</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">5,347,892</div>
              <div className="text-gray-400">YOT Staked</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">1,249</div>
              <div className="text-gray-400">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">143,582</div>
              <div className="text-gray-400">Transactions</div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-12 bg-[#080c16] border-t border-[#1e2a45]">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="bg-gradient-to-br from-primary to-[#7043f9] p-2 rounded-lg">
                  <ArrowRightLeft className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">YOT Swap</span>
              </div>
              <p className="text-gray-400 mb-4">
                Next-generation multi-hub token swap platform on Solana with enhanced liquidity routing and exclusive rewards.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                    <rect x="2" y="9" width="4" height="12"></rect>
                    <circle cx="4" cy="4" r="2"></circle>
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
                    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
                  </svg>
                </a>
              </div>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li><Link href="/dashboard" className="text-gray-400 hover:text-white">Dashboard</Link></li>
                <li><Link href="/swap" className="text-gray-400 hover:text-white">Classic Swap</Link></li>
                <li><Link href="/multi-hub-swap" className="text-gray-400 hover:text-white">Multi-Hub Swap</Link></li>
                <li><Link href="/staking" className="text-gray-400 hover:text-white">Staking</Link></li>
                <li><Link href="/memes" className="text-gray-400 hover:text-white">NFT Memes</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white">Documentation</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Whitepaper</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">GitHub</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Blog</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">FAQ</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white">Terms of Service</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Disclaimer</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Risk Disclosure</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Contact Us</a></li>
              </ul>
            </div>
          </div>
          
          <div className="text-center pt-8 border-t border-[#1e2a45]">
            <p className="text-gray-400">&copy; {new Date().getFullYear()} YOT Swap. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}