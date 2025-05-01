import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { checkTokenBalances, TEST_TOKENS } from '@/lib/test-token-transfer';
import { Loader2, RefreshCw } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

// Default wallet addresses to monitor
const DEFAULT_WALLETS = [
  'AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ',
  'AZqjcFDjZRTHwsSmEtGtP4dKrCyusLb9BYXzq34BaPrn'
];

interface TokenBalance {
  tokenSymbol: string;
  address: string;
  balance: number;
  lastUpdated: number;
}

export default function TokenBalanceMonitor() {
  const [walletAddresses, setWalletAddresses] = useState<string[]>(DEFAULT_WALLETS);
  const [newWalletAddress, setNewWalletAddress] = useState<string>('');
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load token balances on initial render
  useEffect(() => {
    refreshBalances();
  }, []);
  
  // Add a new wallet address to monitor
  const addWalletAddress = () => {
    if (!newWalletAddress) return;
    
    try {
      // Validate the address - basic check for length
      if (newWalletAddress.length !== 44) {
        setError('Invalid wallet address. Solana addresses are 44 characters long.');
        return;
      }
      
      // Check if already in the list
      if (walletAddresses.includes(newWalletAddress)) {
        setError('This wallet address is already being monitored.');
        return;
      }
      
      // Add the new address and clear the input
      setWalletAddresses([...walletAddresses, newWalletAddress]);
      setNewWalletAddress('');
      setError(null);
      
      // Refresh balances to include the new wallet
      refreshBalances([...walletAddresses, newWalletAddress]);
    } catch (error) {
      setError('Invalid wallet address format.');
    }
  };
  
  // Remove a wallet address from monitoring
  const removeWalletAddress = (addressToRemove: string) => {
    const updatedAddresses = walletAddresses.filter(addr => addr !== addressToRemove);
    setWalletAddresses(updatedAddresses);
    
    // Update balances list to remove entries for this address
    const updatedBalances = tokenBalances.filter(balance => balance.address !== addressToRemove);
    setTokenBalances(updatedBalances);
  };
  
  // Refresh token balances for all monitored wallets
  const refreshBalances = async (addressesToCheck = walletAddresses) => {
    if (addressesToCheck.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const tokenSymbols = Object.keys(TEST_TOKENS) as any[];
      const now = Date.now();
      const newBalances: TokenBalance[] = [];
      
      // Check each wallet
      for (const address of addressesToCheck) {
        const balances = await checkTokenBalances(address, tokenSymbols);
        
        // Create balance entries for each token
        for (const [tokenSymbol, balance] of Object.entries(balances)) {
          newBalances.push({
            tokenSymbol,
            address,
            balance,
            lastUpdated: now
          });
        }
      }
      
      setTokenBalances(newBalances);
    } catch (error: any) {
      setError(`Error checking token balances: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format the balance with appropriate decimals
  const formatBalance = (balance: number): string => {
    if (balance === 0) return "0";
    if (balance < 0.001) return "<0.001";
    return balance.toLocaleString(undefined, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    });
  };
  
  // Format the last updated time
  const formatLastUpdated = (timestamp: number): string => {
    const now = Date.now();
    const secondsAgo = Math.floor((now - timestamp) / 1000);
    
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    return `${Math.floor(secondsAgo / 3600)}h ago`;
  };
  
  // Shorten wallet address for display
  const shortenAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Token Balance Monitor</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refreshBalances()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Add new wallet address */}
          <div className="flex space-x-2">
            <Input
              placeholder="Enter Solana wallet address"
              value={newWalletAddress}
              onChange={(e) => setNewWalletAddress(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={addWalletAddress}
              disabled={!newWalletAddress || isLoading}
            >
              Add Wallet
            </Button>
          </div>
          
          {error && (
            <div className="text-red-500 text-sm mt-2">
              {error}
            </div>
          )}
          
          {/* Monitored wallets list */}
          <div className="flex flex-wrap gap-2">
            {walletAddresses.map(address => (
              <Badge 
                key={address} 
                variant="outline"
                className="pl-2 py-1 rounded-md flex items-center"
              >
                {shortenAddress(address)}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 ml-1 hover:bg-red-100 hover:text-red-500"
                  onClick={() => removeWalletAddress(address)}
                >
                  ×
                </Button>
              </Badge>
            ))}
          </div>
          
          {/* Token balances table */}
          {tokenBalances.length > 0 ? (
            <Table>
              <TableCaption>
                Token balances for monitored wallets
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokenBalances.map((balance, index) => (
                  <TableRow key={`${balance.address}-${balance.tokenSymbol}`}>
                    <TableCell className="font-medium">
                      {shortenAddress(balance.address)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {balance.tokenSymbol}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatBalance(balance.balance)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatLastUpdated(balance.lastUpdated)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              No token balances to display. Click Refresh to check wallet balances.
            </div>
          )}
          
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}