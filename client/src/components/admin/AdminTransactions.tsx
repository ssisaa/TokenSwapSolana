import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

// Define the transaction interface for type safety
interface Transaction {
  signature: string;
  timestamp: number;
  txType: string;
  userAddress: string;
  amount: number;
  status: string;
}
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  RefreshCw, 
  ArrowUpDown, 
  Search, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock
} from "lucide-react";
import { connection } from "@/lib/solana";
import { PublicKey } from "@solana/web3.js";
import { STAKING_PROGRAM_ID, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

// Time formatter helper
function formatTime(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  return format(date, "MMM dd, yyyy HH:mm");
}

// Shorten address helper
function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function AdminTransactions() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [transactionType, setTransactionType] = useState("all");
  // Type for sort keys to ensure we only sort by valid properties
  type SortableKey = keyof Transaction;
  
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: 'asc' | 'desc' }>({
    key: 'timestamp',
    direction: 'desc'
  });
  
  // Fetch program transactions
  const {
    data: transactions,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['stakingTransactions', refreshTrigger],
    queryFn: async () => {
      try {
        // Get program signatures
        const signatures = await connection.getSignaturesForAddress(
          new PublicKey(STAKING_PROGRAM_ID),
          { limit: 100 }
        );
        
        if (signatures.length === 0) {
          return [];
        }
        
        // Get transaction details
        const transactionDetails = await Promise.all(
          signatures.map(async (sig) => {
            try {
              const tx = await connection.getParsedTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0,
              });
              
              if (!tx || !tx.meta) {
                return null;
              }
              
              // Determine transaction type based on accounts or instruction data
              let txType = "unknown";
              let amount = 0;
              
              // Parse log messages to identify transaction type
              const logMessages = tx.meta.logMessages || [];
              const programLogs = logMessages.filter(log => 
                log.includes("Program log:") && !log.includes("Program return:")
              );
              
              if (programLogs.some(log => log.includes("initialized successfully"))) {
                txType = "initialize";
              } else if (programLogs.some(log => log.includes("Stake"))) {
                txType = "stake";
                // Try to extract amount from logs
                const amountLog = programLogs.find(log => log.includes("amount:"));
                if (amountLog) {
                  const match = amountLog.match(/amount: (\d+)/);
                  if (match && match[1]) {
                    // Convert from YOT raw amount (9 decimals)
                    amount = parseInt(match[1]) / Math.pow(10, 9); 
                    console.log("Parsed stake amount:", amount, "from log:", amountLog);
                  }
                }
              } else if (programLogs.some(log => log.includes("Unstake"))) {
                txType = "unstake";
                const amountLog = programLogs.find(log => log.includes("amount:"));
                if (amountLog) {
                  const match = amountLog.match(/amount: (\d+)/);
                  if (match && match[1]) {
                    // Convert from YOT raw amount (9 decimals)
                    amount = parseInt(match[1]) / Math.pow(10, 9);
                    console.log("Parsed unstake amount:", amount, "from log:", amountLog);
                  }
                }
              } else if (programLogs.some(log => log.includes("Harvest"))) {
                txType = "harvest";
                const amountLog = programLogs.find(log => log.includes("rewards:"));
                if (amountLog) {
                  const match = amountLog.match(/rewards: (\d+)/);
                  if (match && match[1]) {
                    // Convert from YOS raw amount (9 decimals)
                    amount = parseInt(match[1]) / Math.pow(10, 9);
                    console.log("Parsed harvest amount:", amount, "from log:", amountLog);
                  }
                }
              } else if (programLogs.some(log => log.includes("Update parameters"))) {
                txType = "update";
              }
              
              // Get signer/user address
              const userAddress = tx.transaction.message.accountKeys.find(
                key => key.signer
              )?.pubkey.toString() || "";
              
              return {
                signature: sig.signature,
                timestamp: sig.blockTime || 0,
                txType,
                userAddress,
                amount,
                status: tx.meta.err ? "failed" : "confirmed"
              };
            } catch (error) {
              console.error(`Error fetching transaction details for ${sig.signature}:`, error);
              return null;
            }
          })
        );
        
        // Filter out null results
        return transactionDetails.filter(tx => tx !== null);
      } catch (error) {
        console.error("Error fetching program transactions:", error);
        toast({
          title: "Error Fetching Transactions",
          description: "Could not retrieve transaction history. Please try again.",
          variant: "destructive"
        });
        return [];
      }
    },
    retry: 1,
    refetchOnWindowFocus: false
  });
  
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    refetch();
  };
  
  // Filter and sort transactions
  const filteredTransactions = transactions 
    ? transactions.filter(tx => {
        // Apply search filter
        const matchesSearch = !searchQuery || 
          tx.signature.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.userAddress.toLowerCase().includes(searchQuery.toLowerCase());
          
        // Apply transaction type filter
        const matchesType = transactionType === 'all' || tx.txType === transactionType;
        
        return matchesSearch && matchesType;
      })
    : [];
    
  // Sort transactions
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    // Get the key and direction from the sort config
    const { key, direction } = sortConfig;
    
    // Handle numeric properties
    if (key === 'timestamp' || key === 'amount') {
      // Safety check if properties exist
      if (a[key as SortableKey] === undefined || b[key as SortableKey] === undefined) {
        return 0;
      }
      
      // Sort numbers
      const aValue = a[key as 'timestamp' | 'amount'];
      const bValue = b[key as 'timestamp' | 'amount'];
      
      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    // Handle string properties
    if (key === 'signature' || key === 'txType' || key === 'userAddress' || key === 'status') {
      // Safety check if properties exist
      if (a[key as SortableKey] === undefined || b[key as SortableKey] === undefined) {
        return 0;
      }
      
      // Sort strings
      const aValue = a[key as 'signature' | 'txType' | 'userAddress' | 'status'];
      const bValue = b[key as 'signature' | 'txType' | 'userAddress' | 'status'];
      
      return direction === 'asc' 
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    }
    
    return 0;
  });
  
  // Handle sort click with type-safe key
  const handleSort = (key: SortableKey) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };
  
  // Transaction type badge helper
  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'initialize':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Initialize</Badge>;
      case 'stake':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Stake</Badge>;
      case 'unstake':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Unstake</Badge>;
      case 'harvest':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Harvest</Badge>;
      case 'update':
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Update</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };
  
  // Status badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Confirmed</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100">Failed</Badge>;
      default:
        return <Badge variant="outline">Processing</Badge>;
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Transaction History</h2>
        <Button 
          onClick={handleRefresh} 
          variant="outline"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh Data
        </Button>
      </div>
      
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by signature or address..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select 
              value={transactionType} 
              onValueChange={setTransactionType}
            >
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Transaction Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transactions</SelectItem>
                <SelectItem value="initialize">Initialize</SelectItem>
                <SelectItem value="stake">Stake</SelectItem>
                <SelectItem value="unstake">Unstake</SelectItem>
                <SelectItem value="harvest">Harvest</SelectItem>
                <SelectItem value="update">Update Parameters</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500">Error loading transactions</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          ) : sortedTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery || transactionType !== 'all' ? 
                "No transactions match your filters" : 
                "No transactions found for the staking program"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">
                      <div 
                        className="flex items-center cursor-pointer" 
                        onClick={() => handleSort('timestamp')}
                      >
                        Time
                        <ArrowUpDown className="h-4 w-4 ml-1" />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div 
                        className="flex items-center cursor-pointer" 
                        onClick={() => handleSort('txType')}
                      >
                        Type
                        <ArrowUpDown className="h-4 w-4 ml-1" />
                      </div>
                    </TableHead>
                    <TableHead>Signature</TableHead>
                    <TableHead>User Address</TableHead>
                    <TableHead className="text-right">
                      <div 
                        className="flex items-center justify-end cursor-pointer" 
                        onClick={() => handleSort('amount')}
                      >
                        Amount
                        <ArrowUpDown className="h-4 w-4 ml-1" />
                      </div>
                    </TableHead>
                    <TableHead className="w-[100px]">
                      <div 
                        className="flex items-center cursor-pointer" 
                        onClick={() => handleSort('status')}
                      >
                        Status
                        <ArrowUpDown className="h-4 w-4 ml-1" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTransactions.map((tx) => (
                    <TableRow key={tx.signature}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                          <span>{tx.timestamp ? formatTime(tx.timestamp) : "Unknown"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getTransactionBadge(tx.txType)}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="link" 
                          className="p-0 h-auto font-mono text-xs"
                          onClick={() => window.open(`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`, '_blank')}
                        >
                          {shortenAddress(tx.signature)}
                          <ArrowUpRight className="h-3 w-3 ml-1" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="link" 
                          className="p-0 h-auto font-mono text-xs"
                          onClick={() => window.open(`https://explorer.solana.com/address/${tx.userAddress}?cluster=devnet`, '_blank')}
                        >
                          {shortenAddress(tx.userAddress)}
                          <ArrowUpRight className="h-3 w-3 ml-1" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        {tx.txType === 'stake' ? (
                          <div className="flex items-center justify-end">
                            <ArrowUpRight className="h-4 w-4 mr-1 text-green-500" />
                            <span>{tx.amount.toLocaleString()} YOT</span>
                          </div>
                        ) : tx.txType === 'unstake' ? (
                          <div className="flex items-center justify-end">
                            <ArrowDownRight className="h-4 w-4 mr-1 text-amber-500" />
                            <span>{tx.amount.toLocaleString()} YOT</span>
                          </div>
                        ) : tx.txType === 'harvest' ? (
                          <div className="flex items-center justify-end">
                            <ArrowDownRight className="h-4 w-4 mr-1 text-purple-500" />
                            <span>{tx.amount.toLocaleString()} YOS</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(tx.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between py-4 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {sortedTransactions.length} transactions
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}