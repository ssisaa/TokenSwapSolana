import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRaydiumPools } from '@/lib/raydium-pools';
import { getJupiterRoutes } from '@/lib/jupiter-routes';
import { TEST_TOKENS } from '@/lib/test-token-transfer';
import { Loader2, AlertCircle, Check } from 'lucide-react';

interface PoolStatus {
  isLoading: boolean;
  error: string | null;
  raydiumPools: any[];
  jupiterRoutes: any[];
  tokenPairStatus: Record<string, {
    hasDirectRoute: boolean;
    hasMultiHopRoute: boolean;
    platforms: string[];
  }>;
}

export default function LiquidityPoolsChecker() {
  const [poolStatus, setPoolStatus] = useState<PoolStatus>({
    isLoading: false,
    error: null,
    raydiumPools: [],
    jupiterRoutes: [],
    tokenPairStatus: {}
  });
  
  // Check all pools and routes
  const checkPools = async () => {
    setPoolStatus(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Fetch Raydium pools and Jupiter routes
      const raydiumPools = await getRaydiumPools();
      const jupiterRoutes = await getJupiterRoutes();
      
      // Create a list of token pairs to check
      // We want to check all test tokens against the target tokens (YOT and SOL)
      const targetTokens = ['YOT', 'SOL'];
      const tokenPairStatus: Record<string, {
        hasDirectRoute: boolean;
        hasMultiHopRoute: boolean;
        platforms: string[];
      }> = {};
      
      // Check each test token against target tokens
      for (const testToken of Object.keys(TEST_TOKENS)) {
        for (const targetToken of targetTokens) {
          const pairName = `${testToken} → ${targetToken}`;
          
          // Check Raydium direct routes
          const hasRaydiumDirectRoute = raydiumPools.some(pool => 
            (pool.inputSymbol === testToken && pool.outputSymbol === targetToken) || 
            (pool.inputSymbol === targetToken && pool.outputSymbol === testToken)
          );
          
          // Check Jupiter direct routes
          const hasJupiterDirectRoute = jupiterRoutes.some(route => 
            (route.inputSymbol === testToken && route.outputSymbol === targetToken) || 
            (route.inputSymbol === targetToken && route.outputSymbol === testToken)
          );
          
          // Check multi-hop through SOL for Raydium
          const hasRaydiumSolRoute = 
            targetToken !== 'SOL' &&
            raydiumPools.some(pool => 
              (pool.inputSymbol === testToken && pool.outputSymbol === 'SOL')
            ) && 
            raydiumPools.some(pool => 
              (pool.inputSymbol === 'SOL' && pool.outputSymbol === targetToken)
            );
          
          // Check multi-hop through SOL for Jupiter
          const hasJupiterSolRoute = 
            targetToken !== 'SOL' &&
            jupiterRoutes.some(route => 
              (route.inputSymbol === testToken && route.outputSymbol === 'SOL')
            ) && 
            jupiterRoutes.some(route => 
              (route.inputSymbol === 'SOL' && route.outputSymbol === targetToken)
            );
          
          // Determine which platforms are available for this pair
          const platforms = [];
          if (hasRaydiumDirectRoute || hasRaydiumSolRoute) platforms.push('Raydium');
          if (hasJupiterDirectRoute || hasJupiterSolRoute) platforms.push('Jupiter');
          
          tokenPairStatus[pairName] = {
            hasDirectRoute: hasRaydiumDirectRoute || hasJupiterDirectRoute,
            hasMultiHopRoute: hasRaydiumSolRoute || hasJupiterSolRoute,
            platforms
          };
        }
      }
      
      setPoolStatus({
        isLoading: false,
        error: null,
        raydiumPools,
        jupiterRoutes,
        tokenPairStatus
      });
      
    } catch (error: any) {
      setPoolStatus(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error.message || 'Failed to check liquidity pools' 
      }));
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Liquidity Pools Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button 
            onClick={checkPools}
            disabled={poolStatus.isLoading}
            className="mb-4"
          >
            {poolStatus.isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking Pools...
              </>
            ) : 'Check Liquidity Pools'}
          </Button>
          
          {poolStatus.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {poolStatus.error}
              </AlertDescription>
            </Alert>
          )}
          
          {!poolStatus.isLoading && !poolStatus.error && Object.keys(poolStatus.tokenPairStatus).length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Raydium Pools</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">
                      Found {poolStatus.raydiumPools.length} pool(s)
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Jupiter Routes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">
                      Found {poolStatus.jupiterRoutes.length} route(s)
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <Table>
                <TableCaption>Status of swap routes between test tokens and target tokens</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Token Pair</TableHead>
                    <TableHead>Direct Route</TableHead>
                    <TableHead>Multi-Hop Route</TableHead>
                    <TableHead>Available On</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(poolStatus.tokenPairStatus).map(([pairName, status]) => (
                    <TableRow key={pairName}>
                      <TableCell className="font-medium">{pairName}</TableCell>
                      <TableCell>
                        {status.hasDirectRoute ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        {status.hasMultiHopRoute ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        {status.platforms.length > 0 ? 
                          status.platforms.join(', ') : 
                          <span className="text-red-500">None</span>
                        }
                      </TableCell>
                      <TableCell>
                        {(status.hasDirectRoute || status.hasMultiHopRoute) ? (
                          <span className="text-green-500 font-medium">Ready</span>
                        ) : (
                          <span className="text-red-500 font-medium">Missing</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}