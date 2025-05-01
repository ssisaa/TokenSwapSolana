import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchRaydiumPools } from '@/lib/raydium-pools';
import { getJupiterRoutes } from '@/lib/jupiter-routes';
import { TEST_TOKENS } from '@/lib/test-token-transfer';
import { Loader2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

interface TokenPoolInfo {
  tokenA: string;
  tokenB: string;
  provider: string;
  liquidity: {
    tokenAAmount: number;
    tokenBAmount: number;
    usdValue: number;
  };
  volume24h?: number;
  fee?: number;
}

export default function PoolLiquidityTable() {
  const [pools, setPools] = useState<TokenPoolInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const loadPoolData = async () => {
    setIsLoading(true);
    
    try {
      // Load Raydium pools
      const raydiumPools = await fetchRaydiumPools();
      const raydiumPoolInfo: TokenPoolInfo[] = raydiumPools
        .filter(pool => {
          // Check if either the input or output token is in our test tokens
          const inputTokenIsTest = Object.keys(TEST_TOKENS).includes(pool.inputSymbol);
          const outputTokenIsTest = Object.keys(TEST_TOKENS).includes(pool.outputSymbol);
          const isYOTPool = pool.inputSymbol === 'YOT' || pool.outputSymbol === 'YOT';
          const isSOLPool = pool.inputSymbol === 'SOL' || pool.outputSymbol === 'SOL';
          
          // Keep pool if it contains a test token or is a SOL or YOT pool
          return inputTokenIsTest || outputTokenIsTest || isYOTPool || isSOLPool;
        })
        .map(pool => {
          // Calculate liquidity in USD
          // Use reserve amounts if available, otherwise use default values
          const tokenAAmount = pool.reserves?.inputTokenAmount || 100000;
          const tokenBAmount = pool.reserves?.outputTokenAmount || 100000;
          
          // Estimate USD value - this is a basic estimation
          // In a real app, we would get token prices
          const usdValue = (tokenAAmount * 0.1) + (tokenBAmount * 0.1);
          
          return {
            tokenA: pool.inputSymbol,
            tokenB: pool.outputSymbol,
            provider: 'Raydium',
            liquidity: {
              tokenAAmount,
              tokenBAmount,
              usdValue
            },
            fee: pool.fee || 0.003
          };
        });
      
      // Load Jupiter routes
      const jupiterRoutes = await getJupiterRoutes();
      const jupiterPoolInfo: TokenPoolInfo[] = jupiterRoutes
        .filter(route => {
          // Only include routes with direct markets (not multi-hop)
          if (!route.marketIds || route.marketIds.length === 0) return false;
          
          // Check if either the input or output token is in our test tokens
          const inputTokenIsTest = Object.keys(TEST_TOKENS).includes(route.inputSymbol);
          const outputTokenIsTest = Object.keys(TEST_TOKENS).includes(route.outputSymbol);
          const isYOTRoute = route.inputSymbol === 'YOT' || route.outputSymbol === 'YOT';
          const isSOLRoute = route.inputSymbol === 'SOL' || route.outputSymbol === 'SOL';
          
          // Keep route if it contains a test token or is a SOL or YOT route
          return inputTokenIsTest || outputTokenIsTest || isYOTRoute || isSOLRoute;
        })
        .map(route => {
          // Estimate liquidity values since Jupiter doesn't provide reserve data the same way
          const tokenAAmount = 100000; // Placeholder
          const tokenBAmount = 100000; // Placeholder
          const usdValue = 10000;      // Placeholder
          
          return {
            tokenA: route.inputSymbol,
            tokenB: route.outputSymbol,
            provider: 'Jupiter',
            liquidity: {
              tokenAAmount,
              tokenBAmount,
              usdValue
            },
            fee: route.fee || 0.003
          };
        });
      
      // Combine pools from both providers
      setPools([...raydiumPoolInfo, ...jupiterPoolInfo]);
    } catch (error) {
      console.error('Error loading pool data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format number with commas and fixed decimal places
  const formatNumber = (num: number, decimals = 2): string => {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };
  
  // Format USD value
  const formatUSD = (value: number): string => {
    return '$' + formatNumber(value);
  };
  
  // Get CSS class for token name
  const getTokenClass = (token: string): string => {
    if (token === 'SOL') return 'text-blue-500 font-bold';
    if (token === 'YOT') return 'text-purple-500 font-bold';
    if (Object.keys(TEST_TOKENS).includes(token)) return 'text-emerald-600 font-medium';
    return '';
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Liquidity Pool Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={loadPoolData} 
          disabled={isLoading}
          className="mb-4"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : 'Show Liquidity Pools'}
        </Button>
        
        {pools.length > 0 && (
          <Table>
            <TableCaption>Liquidity pool data for test tokens, YOT, and SOL</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Token Pair</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Token A Supply</TableHead>
                <TableHead className="text-right">Token B Supply</TableHead>
                <TableHead className="text-right">Total Liquidity</TableHead>
                <TableHead className="text-right">Fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pools.map((pool, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    <span className={getTokenClass(pool.tokenA)}>{pool.tokenA}</span> / <span className={getTokenClass(pool.tokenB)}>{pool.tokenB}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={pool.provider === 'Raydium' ? 'default' : 'secondary'}>
                      {pool.provider}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(pool.liquidity.tokenAAmount)}</TableCell>
                  <TableCell className="text-right">{formatNumber(pool.liquidity.tokenBAmount)}</TableCell>
                  <TableCell className="text-right font-medium">{formatUSD(pool.liquidity.usdValue)}</TableCell>
                  <TableCell className="text-right">{(pool.fee * 100).toFixed(2)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}