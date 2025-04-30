import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RaydiumPoolConfig, getSOLPools, getSwappableTokens } from '@/lib/raydium-pools';
import { SOL_TOKEN_ADDRESS } from '@/lib/constants';
import { TokenInfo } from '@/lib/token-search-api';

export default function PoolExplorer() {
  const [solPools, setSolPools] = useState<RaydiumPoolConfig[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>(SOL_TOKEN_ADDRESS);
  const [swappablePairs, setSwappablePairs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingPairs, setLoadingPairs] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Fetch SOL pools on component mount
  useEffect(() => {
    async function fetchPools() {
      try {
        setLoading(true);
        const pools = await getSOLPools();
        setSolPools(pools);
      } catch (error) {
        console.error('Error fetching SOL pools:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchPools();
  }, []);
  
  // Get swappable pairs when a token is selected
  useEffect(() => {
    async function fetchPairs() {
      if (!selectedToken) return;
      
      try {
        setLoadingPairs(true);
        const pairs = await getSwappableTokens(selectedToken);
        setSwappablePairs(pairs);
      } catch (error) {
        console.error('Error fetching swappable pairs:', error);
      } finally {
        setLoadingPairs(false);
      }
    }
    
    fetchPairs();
  }, [selectedToken]);
  
  // Filter pools based on search query
  const filteredPools = solPools.filter(pool => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      pool.baseSymbol.toLowerCase().includes(query) ||
      pool.quoteSymbol.toLowerCase().includes(query) ||
      pool.name.toLowerCase().includes(query) ||
      pool.baseMint.toLowerCase().includes(query) ||
      pool.quoteMint.toLowerCase().includes(query)
    );
  });
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Raydium Pool Explorer</CardTitle>
        <CardDescription>
          Explore Raydium liquidity pools on devnet for multi-hop swaps
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="solPools">
          <TabsList className="mb-4">
            <TabsTrigger value="solPools">SOL Pools</TabsTrigger>
            <TabsTrigger value="pairRoutes">Swap Routes</TabsTrigger>
          </TabsList>
          
          <TabsContent value="solPools">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by token symbol, name, or address"
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPools.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pools found matching your search criteria
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pool</TableHead>
                        <TableHead>Base Token</TableHead>
                        <TableHead>Quote Token</TableHead>
                        <TableHead>LP Mint</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPools.map((pool) => (
                        <TableRow key={pool.id}>
                          <TableCell>
                            <div className="font-medium">{pool.name}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {pool.baseSymbol}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {pool.baseMint.slice(0, 4)}...{pool.baseMint.slice(-4)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {pool.quoteSymbol}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {pool.quoteMint.slice(0, 4)}...{pool.quoteMint.slice(-4)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs">
                              {pool.lpMint.slice(0, 4)}...{pool.lpMint.slice(-4)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setSelectedToken(pool.baseMint === SOL_TOKEN_ADDRESS ? pool.quoteMint : pool.baseMint)}
                              >
                                View Routes
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                asChild
                              >
                                <a
                                  href={`https://explorer.solana.com/address/${pool.lpMint}?cluster=devnet`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="pairRoutes">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="font-medium">Selected Token:</div>
                {selectedToken === SOL_TOKEN_ADDRESS ? (
                  <Badge>SOL</Badge>
                ) : (
                  <>
                    <Badge variant="outline">
                      {solPools.find(p => p.baseMint === selectedToken || p.quoteMint === selectedToken)?.baseMint === selectedToken
                        ? solPools.find(p => p.baseMint === selectedToken || p.quoteMint === selectedToken)?.baseSymbol
                        : solPools.find(p => p.baseMint === selectedToken || p.quoteMint === selectedToken)?.quoteSymbol
                      }
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {selectedToken.slice(0, 6)}...{selectedToken.slice(-6)}
                    </span>
                  </>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedToken(SOL_TOKEN_ADDRESS)}
                  className="ml-auto"
                >
                  Reset to SOL
                </Button>
              </div>
              
              {loadingPairs ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : swappablePairs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No swappable pairs found for this token
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Token</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Hops</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {swappablePairs.map((pair, index) => (
                        <TableRow key={pair.mint + index}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {pair.symbol}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {pair.mint.slice(0, 4)}...{pair.mint.slice(-4)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center flex-wrap gap-1">
                              {pair.route.map((pool: RaydiumPoolConfig, i: number) => (
                                <div key={i} className="flex items-center">
                                  {i > 0 && <span className="mx-1">→</span>}
                                  <Badge variant="secondary" className="text-xs">
                                    {pool.name}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={pair.route.length > 1 ? "destructive" : "default"}>
                              {pair.route.length}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setSelectedToken(pair.mint)}
                              >
                                View Routes
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                asChild
                              >
                                <a
                                  href={`https://explorer.solana.com/address/${pair.mint}?cluster=devnet`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}