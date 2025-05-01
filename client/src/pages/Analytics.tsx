import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWallet } from '@/hooks/useSolanaWallet';
import { useState } from 'react';
import { format } from 'date-fns';

export default function Analytics() {
  const { connected } = useWallet();
  const [timeRange, setTimeRange] = useState('7d');
  
  // Placeholder data for the analytics
  const statsData = {
    volume: {
      day: '$24,567',
      week: '$152,389',
      month: '$589,742',
      year: '$2,134,890'
    },
    transactions: {
      day: '345',
      week: '2,198',
      month: '8,763',
      year: '34,521'
    },
    users: {
      day: '125',
      week: '782',
      month: '2,467',
      year: '9,834'
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Analytics</h1>
        <div className="text-sm text-gray-400">
          Data updated: {format(new Date(), 'MMM dd, yyyy HH:mm')}
        </div>
      </div>
      
      <Tabs defaultValue={timeRange} onValueChange={setTimeRange} className="w-full">
        <TabsList className="grid grid-cols-4 w-64 mb-6 bg-[#1a2338]">
          <TabsTrigger 
            value="24h" 
            className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
          >
            24h
          </TabsTrigger>
          <TabsTrigger 
            value="7d" 
            className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
          >
            7d
          </TabsTrigger>
          <TabsTrigger 
            value="30d" 
            className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
          >
            30d
          </TabsTrigger>
          <TabsTrigger 
            value="1y" 
            className="data-[state=active]:bg-[#252f4a] data-[state=active]:text-white"
          >
            1y
          </TabsTrigger>
        </TabsList>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
            <CardHeader>
              <CardTitle className="text-white">Trading Volume</CardTitle>
              <CardDescription className="text-[#a3accd]">
                Total trading volume
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {timeRange === '24h' && statsData.volume.day}
                {timeRange === '7d' && statsData.volume.week}
                {timeRange === '30d' && statsData.volume.month}
                {timeRange === '1y' && statsData.volume.year}
              </div>
              <div className="text-sm mt-2 text-green-400">+5.2% from previous period</div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
            <CardHeader>
              <CardTitle className="text-white">Transactions</CardTitle>
              <CardDescription className="text-[#a3accd]">
                Number of transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {timeRange === '24h' && statsData.transactions.day}
                {timeRange === '7d' && statsData.transactions.week}
                {timeRange === '30d' && statsData.transactions.month}
                {timeRange === '1y' && statsData.transactions.year}
              </div>
              <div className="text-sm mt-2 text-green-400">+3.8% from previous period</div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
            <CardHeader>
              <CardTitle className="text-white">Active Users</CardTitle>
              <CardDescription className="text-[#a3accd]">
                Unique users interacting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {timeRange === '24h' && statsData.users.day}
                {timeRange === '7d' && statsData.users.week}
                {timeRange === '30d' && statsData.users.month}
                {timeRange === '1y' && statsData.users.year}
              </div>
              <div className="text-sm mt-2 text-green-400">+7.1% from previous period</div>
            </CardContent>
          </Card>
        </div>
        
        <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45] mb-8">
          <CardHeader>
            <CardTitle className="text-white">Token Price Performance</CardTitle>
            <CardDescription className="text-[#a3accd]">
              Comparative performance of YOT, YOS and SOL
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <div className="text-gray-500">
                Price chart visualization will appear here
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
            <CardHeader>
              <CardTitle className="text-white">Top Swappers</CardTitle>
              <CardDescription className="text-[#a3accd]">
                Most active traders by volume
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[#141c2f] rounded-md border border-[#1e2a45]">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3e63dd] to-[#6f42c1] flex items-center justify-center text-white font-bold">
                        {i}
                      </div>
                      <div className="ml-3">
                        <div className="text-white font-medium">Wallet {i}</div>
                        <div className="text-xs text-gray-400">0x{Math.random().toString(16).substring(2, 10)}...</div>
                      </div>
                    </div>
                    <div className="text-white font-medium">${Math.floor(Math.random() * 100000)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
            <CardHeader>
              <CardTitle className="text-white">Most Popular Pairs</CardTitle>
              <CardDescription className="text-[#a3accd]">
                Trading pairs by volume
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: 'SOL/YOT', volume: '$156,432', change: '+4.2%' },
                  { name: 'YOT/YOS', volume: '$98,245', change: '+2.8%' },
                  { name: 'SOL/USDC', volume: '$87,654', change: '+1.5%' },
                  { name: 'YOS/USDC', volume: '$45,321', change: '+0.7%' },
                  { name: 'YOT/BTC', volume: '$21,456', change: '-0.2%' }
                ].map((pair, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[#141c2f] rounded-md border border-[#1e2a45]">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3e63dd] to-[#6f42c1] flex items-center justify-center text-white font-bold">
                        {i+1}
                      </div>
                      <div className="ml-3">
                        <div className="text-white font-medium">{pair.name}</div>
                        <div className="text-xs text-gray-400">Trading Pair</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium">{pair.volume}</div>
                      <div className={`text-xs ${pair.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                        {pair.change}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </Tabs>
    </div>
  );
}