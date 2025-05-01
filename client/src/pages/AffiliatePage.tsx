import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useWallet } from '@/hooks/useSolanaWallet';
import { useToast } from '@/hooks/use-toast';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { 
  Copy, 
  Share2, 
  Users, 
  TrendingUp, 
  BarChart3, 
  DollarSign, 
  ExternalLink, 
  ChevronRight,
  ArrowRight,
  Globe,
  Send,
  Link,
  FileText
} from 'lucide-react';

export default function AffiliatePage() {
  const { toast } = useToast();
  const { connected, wallet } = useWallet();
  const { connect } = useMultiWallet();
  const [currentTab, setCurrentTab] = useState('overview');
  
  // Placeholder affiliate data - in a real application, this would be fetched from backend
  const affiliateStats = {
    uniqueReferrals: 24,
    activeReferrals: 18,
    totalEarnings: 127.5,
    pendingEarnings: 42.3,
    conversionRate: 12.5,
    commissionRate: 15,
    referralLink: 'https://yotswap.com/ref/ABCDEF',
    level: 'Gold',
    nextLevelThreshold: 50,
    payoutThreshold: 50,
    recentPayouts: [
      { date: '2023-04-15', amount: 85.2, status: 'Completed' },
      { date: '2023-03-15', amount: 67.8, status: 'Completed' },
      { date: '2023-02-15', amount: 52.5, status: 'Completed' },
    ],
    activityHistory: [
      { date: '2023-04-28', user: '0x7m7R...hT6', action: 'Signed Up', reward: 5 },
      { date: '2023-04-27', user: '0x8JzQ...Ybh', action: 'First Trade', reward: 10 },
      { date: '2023-04-25', user: '0xAasQ...z7C', action: 'Staked YOT', reward: 15 },
      { date: '2023-04-23', user: '0x9aBq...p3F', action: 'Added Liquidity', reward: 25 },
      { date: '2023-04-20', user: '0x3ZtY...h1G', action: 'Signed Up', reward: 5 },
    ]
  };
  
  // Placeholder marketing materials - in a real application, this would be fetched from backend
  const marketingMaterials = [
    { 
      id: 1, 
      title: 'YOT Swap Overview', 
      type: 'Banner', 
      size: '728x90', 
      format: 'JPG', 
      thumbnail: 'https://via.placeholder.com/300x50/3e63dd/ffffff?text=YOT+Swap+Banner',
      downloads: 78
    },
    { 
      id: 2, 
      title: 'Staking Benefits', 
      type: 'Banner', 
      size: '300x250', 
      format: 'PNG', 
      thumbnail: 'https://via.placeholder.com/150x125/6f42c1/ffffff?text=Staking+Benefits',
      downloads: 56
    },
    { 
      id: 3, 
      title: 'YOT Ecosystem', 
      type: 'Infographic', 
      size: '1200x800', 
      format: 'PNG', 
      thumbnail: 'https://via.placeholder.com/200x133/10B981/ffffff?text=YOT+Ecosystem',
      downloads: 42
    },
    { 
      id: 4, 
      title: 'Meme NFT Platform', 
      type: 'Social Media', 
      size: '1080x1080', 
      format: 'PNG', 
      thumbnail: 'https://via.placeholder.com/150x150/f59e0b/ffffff?text=Meme+NFTs',
      downloads: 63
    },
    { 
      id: 5, 
      title: 'Multi-Hub Swap Guide', 
      type: 'PDF Guide', 
      size: '8.5x11"', 
      format: 'PDF', 
      thumbnail: 'https://via.placeholder.com/150x200/ef4444/ffffff?text=Swap+Guide+PDF',
      downloads: 124
    },
    { 
      id: 6, 
      title: 'YOT Tokenomics', 
      type: 'Presentation', 
      size: '16:9', 
      format: 'PDF', 
      thumbnail: 'https://via.placeholder.com/160x90/7c3aed/ffffff?text=Tokenomics',
      downloads: 97
    }
  ];
  
  // Tier information for affiliate program
  const tiers = [
    {
      name: 'Bronze',
      referrals: '0-9',
      commission: '10%',
      benefits: [
        'Base referral commission',
        'Access to marketing materials',
        'Monthly newsletter'
      ],
      current: false
    },
    {
      name: 'Silver',
      referrals: '10-24',
      commission: '15%',
      benefits: [
        'Higher referral commission',
        'Priority support',
        'Custom referral links',
        'Quarterly rewards'
      ],
      current: false
    },
    {
      name: 'Gold',
      referrals: '25-49',
      commission: '20%',
      benefits: [
        'Premium referral commission',
        'Early access to new features',
        'Monthly performance reports',
        'Special promotional events',
        'Exclusive community access'
      ],
      current: true
    },
    {
      name: 'Platinum',
      referrals: '50+',
      commission: '25%',
      benefits: [
        'Maximum referral commission',
        'One-on-one strategic meetings',
        'Co-marketing opportunities',
        'Ambassador program eligibility',
        'Custom marketing materials',
        'VIP event invitations'
      ],
      current: false
    }
  ];
  
  const copyReferralLink = () => {
    navigator.clipboard.writeText(affiliateStats.referralLink);
    toast({
      title: "Link copied",
      description: "Referral link has been copied to clipboard",
    });
  };
  
  const downloadMaterial = (id: number) => {
    toast({
      title: "Download started",
      description: `The marketing material is being downloaded`,
    });
    // In a real application, this would initiate a download
  };
  
  const shareMaterial = (id: number) => {
    toast({
      title: "Share options",
      description: "Sharing options opened",
    });
    // In a real application, this would open share options
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
            <CardTitle className="text-white text-center">Join Our Affiliate Program</CardTitle>
            <CardDescription className="text-center text-[#a3accd]">
              Connect your wallet to access the affiliate program and start earning rewards
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center p-4 bg-[#141c2f] rounded-lg border border-[#1e2a45]">
                <DollarSign className="h-8 w-8 text-green-400 mb-2" />
                <p className="text-white font-medium">Earn Rewards</p>
                <p className="text-gray-400 text-xs text-center mt-1">Up to 25% commission on referrals</p>
              </div>
              <div className="flex flex-col items-center p-4 bg-[#141c2f] rounded-lg border border-[#1e2a45]">
                <Users className="h-8 w-8 text-blue-400 mb-2" />
                <p className="text-white font-medium">Grow Community</p>
                <p className="text-gray-400 text-xs text-center mt-1">Help expand the YOT ecosystem</p>
              </div>
            </div>
            
            <Button 
              onClick={handleConnectWallet}
              className="w-full bg-gradient-to-r from-primary to-[#7043f9] text-white"
            >
              Connect Wallet to Join
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">YOT Affiliate Program</h1>
          <p className="text-gray-400 mt-1">Earn rewards by referring users to the YOT ecosystem</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex">
          <Button
            variant="outline"
            onClick={copyReferralLink}
            className="border-[#1e2a45] bg-[#141c2f] text-white mr-2"
          >
            <Link className="h-4 w-4 mr-2" />
            Copy Referral Link
          </Button>
          <Button className="bg-gradient-to-r from-primary to-[#7043f9] text-white">
            <Share2 className="h-4 w-4 mr-2" />
            Share Program
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue={currentTab} onValueChange={setCurrentTab} className="w-full">
        <TabsList className="bg-[#1a2338]">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="marketing" 
            className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
          >
            Marketing Materials
          </TabsTrigger>
          <TabsTrigger 
            value="earnings" 
            className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
          >
            Earnings & Payouts
          </TabsTrigger>
          <TabsTrigger 
            value="resources" 
            className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
          >
            Resources
          </TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-400 flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  Your Referrals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-white">{affiliateStats.uniqueReferrals}</div>
                  <div className="text-xs text-gray-400">{affiliateStats.activeReferrals} active</div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-400 flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Total Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-white">{affiliateStats.totalEarnings} YOS</div>
                  <div className="text-xs text-gray-400">Lifetime earnings</div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-400 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Conversion Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-white">{affiliateStats.conversionRate}%</div>
                  <div className="text-xs text-gray-400">Click to signup</div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-400 flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Commission Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-white">{affiliateStats.commissionRate}%</div>
                  <div className="text-xs text-gray-400">Current tier: {affiliateStats.level}</div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45] mb-6">
                <CardHeader>
                  <CardTitle className="text-white">Your Affiliate Dashboard</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Track your referrals and earnings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="bg-[#141c2f] p-4 rounded-lg border border-[#1e2a45]">
                      <div className="flex items-center mb-3">
                        <Link className="h-5 w-5 text-blue-400 mr-2" />
                        <h3 className="text-white font-medium">Your Referral Link</h3>
                      </div>
                      <div className="flex">
                        <Input 
                          value={affiliateStats.referralLink}
                          readOnly
                          className="bg-[#0a0f1a] border-[#1e2a45] text-gray-300"
                        />
                        <Button 
                          onClick={copyReferralLink}
                          className="ml-2 bg-[#1e2a45] hover:bg-[#252f4a] text-white"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="text-white font-medium">Recent Referral Activity</h3>
                      <div className="bg-[#141c2f] rounded-lg border border-[#1e2a45] divide-y divide-[#1e2a45]">
                        {affiliateStats.activityHistory.map((activity, index) => (
                          <div key={index} className="p-3 flex justify-between items-center">
                            <div>
                              <div className="text-white font-medium">{activity.user}</div>
                              <div className="text-xs text-gray-400">{activity.date}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-gray-300">{activity.action}</div>
                              <div className="text-green-400 text-sm font-medium">+{activity.reward} YOS</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="text-white font-medium">Program Status</h3>
                      <div className="bg-[#141c2f] p-4 rounded-lg border border-[#1e2a45]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-gray-300">Current Tier</div>
                          <div className="text-white font-medium">{affiliateStats.level}</div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Progress to Platinum</span>
                            <span className="text-gray-300">{affiliateStats.uniqueReferrals} / {affiliateStats.nextLevelThreshold} referrals</span>
                          </div>
                          <div className="w-full h-2 bg-[#0a0f1a] rounded-full">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" 
                              style={{ width: `${(affiliateStats.uniqueReferrals / affiliateStats.nextLevelThreshold) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <div className="mt-4 text-gray-400 text-sm">
                          Need {affiliateStats.nextLevelThreshold - affiliateStats.uniqueReferrals} more referrals to reach Platinum tier and unlock 25% commission!
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
                <CardHeader>
                  <CardTitle className="text-white">Referral Rewards Distribution</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    How rewards are calculated and distributed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-[#141c2f] rounded-lg border border-[#1e2a45]">
                      <h3 className="text-white font-medium mb-2">Reward Structure</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <div className="text-gray-300">User Registration</div>
                          <div className="text-green-400 font-medium">5 YOS</div>
                        </div>
                        <div className="flex justify-between">
                          <div className="text-gray-300">First Trade</div>
                          <div className="text-green-400 font-medium">10 YOS</div>
                        </div>
                        <div className="flex justify-between">
                          <div className="text-gray-300">YOT Staking</div>
                          <div className="text-green-400 font-medium">15 YOS</div>
                        </div>
                        <div className="flex justify-between">
                          <div className="text-gray-300">Liquidity Provision</div>
                          <div className="text-green-400 font-medium">25 YOS</div>
                        </div>
                        <div className="flex justify-between">
                          <div className="text-gray-300">NFT Purchase</div>
                          <div className="text-green-400 font-medium">20 YOS</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-[#141c2f] rounded-lg border border-[#1e2a45]">
                      <h3 className="text-white font-medium mb-2">Trading Commission</h3>
                      <p className="text-gray-300 text-sm">
                        In addition to fixed rewards, you earn {affiliateStats.commissionRate}% of all trading fees generated by your referrals for the lifetime of their account.
                      </p>
                    </div>
                    
                    <div className="p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg border border-blue-800/30">
                      <h3 className="text-white font-medium mb-2">Payout Information</h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <div className="text-gray-300">Payout Threshold</div>
                          <div className="text-white">{affiliateStats.payoutThreshold} YOS</div>
                        </div>
                        <div className="flex justify-between">
                          <div className="text-gray-300">Payout Frequency</div>
                          <div className="text-white">Monthly (15th)</div>
                        </div>
                        <div className="flex justify-between">
                          <div className="text-gray-300">Current Balance</div>
                          <div className="text-green-400 font-medium">{affiliateStats.pendingEarnings} YOS</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div>
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45] sticky top-6">
                <CardHeader>
                  <CardTitle className="text-white">Affiliate Program Tiers</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Benefits increase as you refer more users
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {tiers.map((tier) => (
                      <div 
                        key={tier.name} 
                        className={`p-4 rounded-lg border ${
                          tier.current 
                            ? 'bg-gradient-to-br from-[#252f4a] to-[#1e2a45] border-blue-500' 
                            : 'bg-[#141c2f] border-[#1e2a45]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-white font-medium">{tier.name} Tier</h3>
                          {tier.current && (
                            <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                              Current
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-3 mb-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Required Referrals</span>
                            <span className="text-white">{tier.referrals}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Commission Rate</span>
                            <span className="text-green-400 font-medium">{tier.commission}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="text-sm text-gray-300">Benefits:</div>
                          <ul className="text-xs text-gray-400 space-y-1">
                            {tier.benefits.map((benefit, index) => (
                              <li key={index} className="flex items-center">
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mr-2"></div>
                                {benefit}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="border-t border-[#1e2a45] pt-4">
                  <Button className="w-full bg-gradient-to-r from-primary to-[#7043f9] text-white">
                    <Share2 className="h-4 w-4 mr-2" />
                    Invite Friends Now
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        {/* Marketing Materials Tab */}
        <TabsContent value="marketing">
          <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45] mb-6">
            <CardHeader>
              <CardTitle className="text-white">Marketing Materials</CardTitle>
              <CardDescription className="text-[#a3accd]">
                Promotional materials to help you promote YOT Swap
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {marketingMaterials.map((material) => (
                  <div key={material.id} className="bg-[#141c2f] rounded-lg border border-[#1e2a45] overflow-hidden">
                    <div className="aspect-video bg-[#1e2a45] flex items-center justify-center overflow-hidden">
                      <img src={material.thumbnail} alt={material.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-4">
                      <h3 className="text-white font-medium mb-1">{material.title}</h3>
                      <div className="flex text-xs text-gray-400 mb-3">
                        <div>{material.type}</div>
                        <div className="mx-2">•</div>
                        <div>{material.size}</div>
                        <div className="mx-2">•</div>
                        <div>{material.format}</div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-400">{material.downloads} downloads</div>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => shareMaterial(material.id)}
                            className="border-[#1e2a45] bg-[#0a0f1a] text-white h-8 w-8 p-0"
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => downloadMaterial(material.id)}
                            className="border-[#1e2a45] bg-[#0a0f1a] text-white"
                          >
                            Download
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
              <CardHeader>
                <CardTitle className="text-white">Promotion Guidelines</CardTitle>
                <CardDescription className="text-[#a3accd]">
                  Follow these guidelines when promoting YOT Swap
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-[#141c2f] rounded-lg border border-[#1e2a45]">
                  <h3 className="text-white font-medium mb-2">Do's</h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex">
                      <div className="h-5 w-5 bg-green-600/20 text-green-400 rounded-full flex items-center justify-center shrink-0 mr-2">✓</div>
                      <span>Highlight the features and benefits of YOT Swap</span>
                    </li>
                    <li className="flex">
                      <div className="h-5 w-5 bg-green-600/20 text-green-400 rounded-full flex items-center justify-center shrink-0 mr-2">✓</div>
                      <span>Use provided marketing materials and brand assets</span>
                    </li>
                    <li className="flex">
                      <div className="h-5 w-5 bg-green-600/20 text-green-400 rounded-full flex items-center justify-center shrink-0 mr-2">✓</div>
                      <span>Be transparent about referral relationship</span>
                    </li>
                    <li className="flex">
                      <div className="h-5 w-5 bg-green-600/20 text-green-400 rounded-full flex items-center justify-center shrink-0 mr-2">✓</div>
                      <span>Focus on the value proposition and utility</span>
                    </li>
                  </ul>
                </div>
                
                <div className="p-4 bg-[#141c2f] rounded-lg border border-[#1e2a45]">
                  <h3 className="text-white font-medium mb-2">Don'ts</h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex">
                      <div className="h-5 w-5 bg-red-600/20 text-red-400 rounded-full flex items-center justify-center shrink-0 mr-2">✗</div>
                      <span>Make guarantees about investment returns or profit</span>
                    </li>
                    <li className="flex">
                      <div className="h-5 w-5 bg-red-600/20 text-red-400 rounded-full flex items-center justify-center shrink-0 mr-2">✗</div>
                      <span>Use misleading information or false statements</span>
                    </li>
                    <li className="flex">
                      <div className="h-5 w-5 bg-red-600/20 text-red-400 rounded-full flex items-center justify-center shrink-0 mr-2">✗</div>
                      <span>Modify YOT Swap logos or branding materials</span>
                    </li>
                    <li className="flex">
                      <div className="h-5 w-5 bg-red-600/20 text-red-400 rounded-full flex items-center justify-center shrink-0 mr-2">✗</div>
                      <span>Spam or use aggressive marketing tactics</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
              <CardHeader>
                <CardTitle className="text-white">Promotional Channels</CardTitle>
                <CardDescription className="text-[#a3accd]">
                  Effective ways to share your referral link
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-[#141c2f] rounded-lg border border-[#1e2a45] divide-y divide-[#1e2a45]">
                  <div className="p-4">
                    <div className="flex items-center mb-2">
                      <Globe className="h-5 w-5 text-blue-400 mr-2" />
                      <h3 className="text-white font-medium">Website & Blog</h3>
                    </div>
                    <p className="text-sm text-gray-300">
                      Add banners or write detailed reviews about YOT Swap on your website or blog to attract interested users.
                    </p>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-400 mr-2">
                        <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
                      </svg>
                      <h3 className="text-white font-medium">Social Media</h3>
                    </div>
                    <p className="text-sm text-gray-300">
                      Share your experiences, tips, and referral link on Twitter, Telegram groups, Discord servers, and other crypto communities.
                    </p>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center mb-2">
                      <FileText className="h-5 w-5 text-blue-400 mr-2" />
                      <h3 className="text-white font-medium">Content Creation</h3>
                    </div>
                    <p className="text-sm text-gray-300">
                      Create tutorials, reviews, or educational content about YOT Swap on YouTube, Medium, or other platforms to establish authority.
                    </p>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center mb-2">
                      <Send className="h-5 w-5 text-blue-400 mr-2" />
                      <h3 className="text-white font-medium">Email Marketing</h3>
                    </div>
                    <p className="text-sm text-gray-300">
                      Include your referral link in newsletters to your subscribers who might be interested in crypto projects.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Earnings & Payouts Tab */}
        <TabsContent value="earnings">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45] mb-6">
                <CardHeader>
                  <CardTitle className="text-white">Earnings Overview</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Summary of your affiliate earnings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-[#141c2f] rounded-md p-4 border border-[#1e2a45]">
                      <div className="flex items-center mb-2">
                        <DollarSign className="h-5 w-5 text-green-400 mr-2" />
                        <h3 className="text-white font-medium">Total Earned</h3>
                      </div>
                      <div className="text-2xl font-bold text-white">{affiliateStats.totalEarnings} YOS</div>
                      <div className="text-xs text-gray-400 mt-1">Lifetime earnings</div>
                    </div>
                    <div className="bg-[#141c2f] rounded-md p-4 border border-[#1e2a45]">
                      <div className="flex items-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-amber-400 mr-2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <h3 className="text-white font-medium">Pending</h3>
                      </div>
                      <div className="text-2xl font-bold text-white">{affiliateStats.pendingEarnings} YOS</div>
                      <div className="text-xs text-gray-400 mt-1">Available for withdrawal</div>
                    </div>
                    <div className="bg-[#141c2f] rounded-md p-4 border border-[#1e2a45]">
                      <div className="flex items-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-green-400 mr-2">
                          <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                          <line x1="2" y1="10" x2="22" y2="10"></line>
                        </svg>
                        <h3 className="text-white font-medium">Next Payout</h3>
                      </div>
                      <div className="text-2xl font-bold text-white">Apr 15, 2023</div>
                      <div className="text-xs text-gray-400 mt-1">If threshold is reached</div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-white font-medium">Payout History</h3>
                    <div className="bg-[#141c2f] rounded-lg border border-[#1e2a45]">
                      <div className="grid grid-cols-3 text-xs font-medium text-gray-400 border-b border-[#1e2a45] p-3">
                        <div>Date</div>
                        <div className="text-center">Amount</div>
                        <div className="text-right">Status</div>
                      </div>
                      {affiliateStats.recentPayouts.length > 0 ? (
                        <div className="divide-y divide-[#1e2a45]">
                          {affiliateStats.recentPayouts.map((payout, index) => (
                            <div key={index} className="grid grid-cols-3 p-3 text-sm">
                              <div className="text-gray-300">{payout.date}</div>
                              <div className="text-white text-center">{payout.amount} YOS</div>
                              <div className="text-green-400 text-right">{payout.status}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-gray-400">
                          No payout history yet
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
                <CardHeader>
                  <CardTitle className="text-white">Referral Performance</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Detailed breakdown of your referral activity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-[#141c2f] rounded-lg border border-[#1e2a45]">
                      <h3 className="text-white font-medium mb-3">Earnings by Action</h3>
                      
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-300">Sign-ups</span>
                            <span className="text-white">35 YOS</span>
                          </div>
                          <div className="w-full h-2 bg-[#0a0f1a] rounded-full">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: '30%' }}></div>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-300">Trading Fees</span>
                            <span className="text-white">52.5 YOS</span>
                          </div>
                          <div className="w-full h-2 bg-[#0a0f1a] rounded-full">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: '45%' }}></div>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-300">Staking</span>
                            <span className="text-white">25 YOS</span>
                          </div>
                          <div className="w-full h-2 bg-[#0a0f1a] rounded-full">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: '20%' }}></div>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-300">Liquidity</span>
                            <span className="text-white">15 YOS</span>
                          </div>
                          <div className="w-full h-2 bg-[#0a0f1a] rounded-full">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: '5%' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-white font-medium mb-3">Top Referring URLs</h3>
                      <div className="bg-[#141c2f] rounded-lg border border-[#1e2a45] divide-y divide-[#1e2a45]">
                        <div className="p-3 flex justify-between items-center">
                          <div className="text-gray-300 text-sm">twitter.com</div>
                          <div className="text-white">12 referrals</div>
                        </div>
                        <div className="p-3 flex justify-between items-center">
                          <div className="text-gray-300 text-sm">yourwebsite.com/blog</div>
                          <div className="text-white">8 referrals</div>
                        </div>
                        <div className="p-3 flex justify-between items-center">
                          <div className="text-gray-300 text-sm">t.me/cryptochat</div>
                          <div className="text-white">4 referrals</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div>
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45] sticky top-6">
                <CardHeader>
                  <CardTitle className="text-white">Payout Settings</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Manage your payout preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-[#141c2f] rounded-lg border border-[#1e2a45]">
                    <h3 className="text-white font-medium mb-3">Payout Status</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Current Balance</span>
                        <span className="text-green-400 font-medium">{affiliateStats.pendingEarnings} YOS</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Payout Threshold</span>
                        <span className="text-white">{affiliateStats.payoutThreshold} YOS</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Progress to next payout</span>
                          <span className="text-gray-300">{Math.round((affiliateStats.pendingEarnings / affiliateStats.payoutThreshold) * 100)}%</span>
                        </div>
                        <div className="w-full h-2 bg-[#0a0f1a] rounded-full">
                          <div 
                            className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full" 
                            style={{ width: `${(affiliateStats.pendingEarnings / affiliateStats.payoutThreshold) * 100}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-400">
                          Need {Math.max(0, affiliateStats.payoutThreshold - affiliateStats.pendingEarnings).toFixed(1)} more YOS to reach threshold
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-[#141c2f] rounded-lg border border-[#1e2a45]">
                    <h3 className="text-white font-medium mb-3">Payout Method</h3>
                    <div className="flex items-center justify-between mb-3 p-2 bg-[#0f1421] rounded border border-[#252f4a]">
                      <div className="flex items-center">
                        <div className="bg-blue-500/20 p-2 rounded-full mr-3">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-blue-400">
                            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>
                            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
                          </svg>
                        </div>
                        <div>
                          <div className="text-white text-sm">YOS Token Wallet</div>
                          <div className="text-xs text-gray-400">Direct to connected wallet</div>
                        </div>
                      </div>
                      <div className="text-xs text-green-400">
                        Default
                      </div>
                    </div>
                    <div className="text-xs text-center text-gray-400">Additional payout methods coming soon</div>
                  </div>
                  
                  <div className="space-y-3">
                    <Button 
                      disabled={affiliateStats.pendingEarnings < affiliateStats.payoutThreshold}
                      className="w-full bg-gradient-to-r from-blue-600 to-[#7043f9] text-white"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Request Manual Payout
                    </Button>
                    <div className="text-xs text-center text-gray-400">
                      {affiliateStats.pendingEarnings < affiliateStats.payoutThreshold 
                        ? `Minimum payout threshold is ${affiliateStats.payoutThreshold} YOS` 
                        : 'Manual payouts are processed within 48 hours'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        {/* Resources Tab */}
        <TabsContent value="resources">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45] mb-6">
                <CardHeader>
                  <CardTitle className="text-white">Program Resources</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Helpful resources for affiliates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      {
                        title: 'Affiliate Program Guide',
                        description: 'Comprehensive overview of the YOT Swap affiliate program',
                        icon: FileText,
                        link: '#',
                      },
                      {
                        title: 'Marketing Best Practices',
                        description: 'Tips for effectively promoting YOT Swap',
                        icon: TrendingUp,
                        link: '#',
                      },
                      {
                        title: 'YOT Ecosystem Overview',
                        description: 'Learn about YOT, YOS tokens and the overall ecosystem',
                        icon: Globe,
                        link: '#',
                      },
                      {
                        title: 'Promotional Templates',
                        description: 'Ready-to-use content for social media and websites',
                        icon: FileText,
                        link: '#',
                      },
                    ].map((resource, index) => (
                      <div key={index} className="bg-[#141c2f] rounded-lg border border-[#1e2a45] p-5">
                        <div className="flex items-start">
                          <div className="bg-blue-500/20 p-2 rounded-full mr-3">
                            <resource.icon className="h-5 w-5 text-blue-400" />
                          </div>
                          <div>
                            <h3 className="text-white font-medium mb-1">{resource.title}</h3>
                            <p className="text-sm text-gray-400 mb-3">{resource.description}</p>
                            <Button 
                              variant="outline"
                              className="border-[#1e2a45] bg-[#0a0f1a] text-white text-sm"
                              onClick={() => window.open(resource.link, '_blank')}
                            >
                              View Resource
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
                <CardHeader>
                  <CardTitle className="text-white">Frequently Asked Questions</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Common questions about the affiliate program
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    {
                      question: 'How do I start earning referral rewards?',
                      answer: 'Simply share your unique referral link with others. When someone signs up using your link and starts using YOT Swap, you will earn rewards for their activity.'
                    },
                    {
                      question: 'How are affiliate commissions calculated?',
                      answer: 'You earn fixed rewards for specific actions (sign-ups, trades, etc.) plus a percentage of trading fees generated by your referrals. Commission rates increase as you reach higher tier levels.'
                    },
                    {
                      question: 'When are referral rewards paid out?',
                      answer: 'Rewards are automatically paid out on the 15th of each month if you have reached the minimum payout threshold of 50 YOS. You can also request a manual payout if you have reached the threshold.'
                    },
                    {
                      question: 'Can I promote YOT Swap on multiple platforms?',
                      answer: 'Yes! You can promote YOT Swap on any platform where it is appropriate and follows our guidelines. Each promotion should use your unique referral link to track conversions.'
                    },
                    {
                      question: 'How long does the referral relationship last?',
                      answer: 'The referral relationship is permanent. You will continue to earn a percentage of trading fees from your referrals for as long as they remain active users.'
                    }
                  ].map((faq, index) => (
                    <div key={index} className="bg-[#141c2f] rounded-lg border border-[#1e2a45] p-4">
                      <h3 className="text-white font-medium mb-2">{faq.question}</h3>
                      <p className="text-sm text-gray-300">{faq.answer}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            
            <div>
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45] sticky top-6">
                <CardHeader>
                  <CardTitle className="text-white">Support & Contact</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Get help with the affiliate program
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-[#141c2f] rounded-lg border border-[#1e2a45] divide-y divide-[#1e2a45]">
                    {[
                      {
                        title: 'Affiliate Support',
                        description: 'Get help with your affiliate account',
                        link: 'mailto:affiliates@yotswap.com',
                        iconComponent: Send,
                        linkText: 'Email Support'
                      },
                      {
                        title: 'Discord Community',
                        description: 'Join our affiliate channel',
                        link: 'https://discord.gg/yotswap',
                        iconComponent: () => (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-[#5865F2]">
                            <path d="M18 7c-2.51 0-4 1.5-4 1.5s-1.49-1.5-4-1.5-4 3-4 3v7c0 1 .5 2 2 2h2c1 0 1-.5 1-1v-2h2v2c0 .5 0 1 1 1h2c1.5 0 2-1 2-2v-7s-1.5-3-4-3z"></path>
                            <path d="M9 13a2 2 0 0 1-2-2"></path>
                            <path d="M15 13a2 2 0 0 0 2-2"></path>
                          </svg>
                        ),
                        linkText: 'Join Discord'
                      },
                      {
                        title: 'Telegram Group',
                        description: 'Connect with other affiliates',
                        link: 'https://t.me/yotswap_affiliates',
                        iconComponent: () => (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-[#0088cc]">
                            <path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-8.609 3.33c-2.068.8-4.133 1.598-5.724 2.21a405.15 405.15 0 0 1-2.849 1.09c-.42.147-.99.332-1.473.901-.728.968.193 1.798.919 2.286 1.61.516 3.275 1.009 4.654 1.472.8 1.917 1.874 5.543 2.202 6.638.125.65.77 1.15 1.355 1.15.35 0 .68-.143.926-.375a2.08 2.08 0 0 0 .388-.406c.253-.375 2.614-2.556 3.771-3.707l5.125 3.59a1.334 1.334 0 0 0 .728.215 1.51 1.51 0 0 0 1.072-.477 1.585 1.585 0 0 0 .254-.258c.254-.382.873-3.586.873-3.586l-8.293-5.638 3.467-1.12a1.502 1.502 0 0 0 .322-2.721z" />
                          </svg>
                        ),
                        linkText: 'Join Telegram'
                      }
                    ].map((contact, index) => (
                      <div key={index} className="p-4">
                        <div className="flex items-center mb-2">
                          {typeof contact.iconComponent === 'function' ? (
                            <contact.iconComponent />
                          ) : (
                            <contact.iconComponent className="h-5 w-5 text-blue-400 mr-2" />
                          )}
                          <h3 className="text-white font-medium">{contact.title}</h3>
                        </div>
                        <p className="text-sm text-gray-300 mb-3">{contact.description}</p>
                        <Button 
                          variant="outline"
                          className="w-full border-[#1e2a45] bg-[#0a0f1a] text-white text-sm"
                          onClick={() => window.open(contact.link, '_blank')}
                        >
                          {contact.linkText}
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-4 bg-gradient-to-br from-[#252f4a] to-[#1e2a45] rounded-lg border border-[#3d4a6a]">
                    <h3 className="text-white font-medium mb-2">Affiliate Newsletter</h3>
                    <p className="text-sm text-gray-300 mb-3">
                      Subscribe to receive updates, tips, and exclusive affiliate promotions.
                    </p>
                    <div className="flex">
                      <Input 
                        placeholder="Your email address"
                        className="bg-[#0a0f1a] border-[#0a0f1a] text-white"
                      />
                      <Button className="ml-2 bg-blue-600 hover:bg-blue-700 text-white">
                        Subscribe
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}