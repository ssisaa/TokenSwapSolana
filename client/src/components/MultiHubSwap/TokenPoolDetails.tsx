import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { checkXarXmpPools } from '@/lib/raydium-pools';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

/**
 * Component for showing detailed pool information for XAR and XMP tokens paired with SOL
 * This provides information about Raydium pool accounts and balances 
 */
export default function TokenPoolDetails() {
  const [isLoading, setIsLoading] = useState(false);
  const [poolDetails, setPoolDetails] = useState<Awaited<ReturnType<typeof checkXarXmpPools>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkPools = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const details = await checkXarXmpPools();
      setPoolDetails(details);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pool details');
    } finally {
      setIsLoading(false);
    }
  };

  // For testing environment - checks if address is a valid Solana address
  // (Addresses starting with placeholder names aren't valid on-chain)
  const isValidAddress = (address: string): boolean => {
    return address.length === 44 && !address.includes('XMP') && !address.includes('XAR');
  };
  
  const getExplorerUrl = (address: string) => {
    // Only generate URLs for valid addresses
    if (isValidAddress(address)) {
      return `https://explorer.solana.com/address/${address}?cluster=devnet`;
    }
    return '#'; // Return placeholder for invalid test addresses
  };
  
  const renderPoolInfo = (
    tokenSymbol: string, 
    poolInfo: any
  ) => {
    if (!poolInfo) return null;
    
    return (
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{tokenSymbol}-SOL Pool</h3>
          <Badge variant={poolInfo.poolExists ? "default" : "destructive"}>
            {poolInfo.poolExists ? 'Active' : 'Not Found'}
          </Badge>
        </div>
        
        {poolInfo.poolExists ? (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Pool Authority</p>
                <div className="flex items-center mt-1">
                  <p className="truncate font-mono text-xs">{poolInfo.poolAuthority}</p>
                  <a
                    href={getExplorerUrl(poolInfo.poolAuthority!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-500 hover:text-blue-600"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
              
              <div>
                <p className="text-muted-foreground">LP Token Mint</p>
                <div className="flex items-center mt-1">
                  <p className="truncate font-mono text-xs">{poolInfo.lpToken.mintAddress}</p>
                  <a
                    href={getExplorerUrl(poolInfo.lpToken.mintAddress!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-500 hover:text-blue-600"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{tokenSymbol} Token Account</p>
                <div className="flex items-center mt-1">
                  <p className="truncate font-mono text-xs">{poolInfo.tokenAccounts.tokenAAccount}</p>
                  <a
                    href={getExplorerUrl(poolInfo.tokenAccounts.tokenAAccount!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-500 hover:text-blue-600"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
              
              <div>
                <p className="text-muted-foreground">SOL Token Account</p>
                <div className="flex items-center mt-1">
                  <p className="truncate font-mono text-xs">{poolInfo.tokenAccounts.tokenBAccount}</p>
                  <a
                    href={getExplorerUrl(poolInfo.tokenAccounts.tokenBAccount!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-500 hover:text-blue-600"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{tokenSymbol} Reserve</p>
                <p className="font-medium">{poolInfo.reserves.tokenAReserve?.toLocaleString() || 0} {tokenSymbol}</p>
              </div>
              
              <div>
                <p className="text-muted-foreground">SOL Reserve</p>
                <p className="font-medium">{poolInfo.reserves.tokenBReserve?.toLocaleString() || 0} SOL</p>
              </div>
            </div>
            
            <div className="text-sm">
              <p className="text-muted-foreground">LP Token Supply</p>
              <p className="font-medium">{poolInfo.lpToken.totalSupply?.toLocaleString() || 0} LP Tokens</p>
            </div>
          </>
        ) : (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No {tokenSymbol}-SOL pool found. You may need to create this liquidity pool first.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>XAR & XMP Pool Details</CardTitle>
        <CardDescription>
          View detailed information about XAR-SOL and XMP-SOL liquidity pools, including pool accounts and reserves.
          <div className="mt-2 p-2 bg-blue-950 rounded-md text-xs border border-blue-900">
            <p>Note: In this development environment, we're using placeholder test addresses that won't be found on the blockchain explorer. 
            In a production environment, these would be replaced with actual on-chain pool addresses.</p>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={checkPools}
          disabled={isLoading}
          className="mb-4"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking Pools...
            </>
          ) : 'Check Pool Details'}
        </Button>
        
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}
        
        {poolDetails && !error && (
          <div className="space-y-6">
            {renderPoolInfo('XAR', poolDetails.xarSolPool)}
            <div className="my-4 border-t border-border" />
            {renderPoolInfo('XMP', poolDetails.xmpSolPool)}
            
            {poolDetails.bothPoolsExist ? (
              <Alert className="mt-4">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Both pools are active and ready for use in multi-hub swap.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  One or both pools are not active. Create missing liquidity pools to enable swapping.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}