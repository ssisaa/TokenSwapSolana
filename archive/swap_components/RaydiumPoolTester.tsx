import React, { useState, useEffect, useCallback } from 'react';
import { Connection } from '@solana/web3.js';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  fetchRaydiumPoolData, 
  KNOWN_TOKENS 
} from '@/lib/raydium-swap';
import { ENDPOINT } from '@/lib/constants';
import { Loader2 } from 'lucide-react';

/**
 * RaydiumPoolTester Component
 * 
 * This component tests and displays the real-time pool data from Raydium DEX
 * on Solana devnet. It fetches both SOL-XMR and SOL-XAR pools.
 */
export default function RaydiumPoolTester() {
  const [loading, setLoading] = useState(false);
  const [poolData, setPoolData] = useState<{
    solXmr: Record<string, number> | null;
    solXar: Record<string, number> | null;
    lastUpdated: Date | null;
  }>({
    solXmr: null,
    solXar: null,
    lastUpdated: null
  });
  const [error, setError] = useState<string | null>(null);

  const fetchPoolData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const connection = new Connection(ENDPOINT, 'confirmed');
      
      // Fetch SOL-XMR pool data
      console.log('Fetching SOL-XMR pool data from Raydium...');
      const solXmrData = await fetchRaydiumPoolData(
        connection,
        KNOWN_TOKENS.SOL,
        KNOWN_TOKENS.XMR
      );

      // Fetch SOL-XAR pool data
      console.log('Fetching SOL-XAR pool data from Raydium...');
      const solXarData = await fetchRaydiumPoolData(
        connection,
        KNOWN_TOKENS.SOL,
        KNOWN_TOKENS.XAR
      );

      setPoolData({
        solXmr: solXmrData,
        solXar: solXarData,
        lastUpdated: new Date()
      });

      if (!solXmrData && !solXarData) {
        setError('No pools found on Raydium devnet');
      }
    } catch (err) {
      console.error('Error fetching Raydium pool data:', err);
      setError(`Failed to fetch pool data: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on component mount
  useEffect(() => {
    fetchPoolData();
  }, [fetchPoolData]);

  // Format pool data for display
  const formatPoolData = (data: Record<string, number> | null, tokenA: string, tokenB: string) => {
    if (!data) return 'No pool data available';
    
    const reserveA = data[tokenA];
    const reserveB = data[tokenB];
    
    if (!reserveA || !reserveB) return 'Invalid pool data structure';
    
    // Calculate exchange rate using AMM constant product formula
    // for a 1.0 unit swap (considering 0.3% fee)
    const inputAmount = 1.0;
    const amountAfterFee = inputAmount * 0.997; // 0.3% fee
    
    // Calculate out amount using constant product formula x * y = k
    const numerator = reserveA * reserveB;
    const denominator = reserveA + amountAfterFee;
    const outputAmount = reserveB - (numerator / denominator);
    
    // Calculate reverse rate
    const reverseNumerator = reserveA * reserveB;
    const reverseDenominator = reserveB + amountAfterFee;
    const reverseOutputAmount = reserveA - (reverseNumerator / reverseDenominator);
    
    const tokenASymbol = Object.entries(KNOWN_TOKENS)
      .find(([_, address]) => address === tokenA)?.[0] || 'Token A';
    const tokenBSymbol = Object.entries(KNOWN_TOKENS)
      .find(([_, address]) => address === tokenB)?.[0] || 'Token B';
    
    return (
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{tokenASymbol} Reserve:</span>
          <span className="font-medium">{reserveA.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{tokenBSymbol} Reserve:</span>
          <span className="font-medium">{reserveB.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Effective Exchange Rate:</span>
          <span className="font-medium">1 {tokenASymbol} ≈ {outputAmount.toLocaleString(undefined, {maximumFractionDigits: 8})} {tokenBSymbol}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Reverse Rate:</span>
          <span className="font-medium">1 {tokenBSymbol} ≈ {reverseOutputAmount.toLocaleString(undefined, {maximumFractionDigits: 8})} {tokenASymbol}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          *Rates include 0.3% AMM fee and use the constant product formula (x*y=k)
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-xl mx-auto">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Raydium Pool Data (Devnet)</span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchPoolData}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Refresh
          </Button>
        </CardTitle>
        {poolData.lastUpdated && (
          <div className="text-xs text-muted-foreground">
            Last updated: {poolData.lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">SOL-XMR Pool</h3>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              formatPoolData(poolData.solXmr, KNOWN_TOKENS.SOL, KNOWN_TOKENS.XMR)
            )}
          </div>
          
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-2">SOL-XAR Pool</h3>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              formatPoolData(poolData.solXar, KNOWN_TOKENS.SOL, KNOWN_TOKENS.XAR)
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}