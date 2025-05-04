import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { ClipboardIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTransactions } from "@/hooks/useTransactions";
import { useWallet } from "@/hooks/useSolanaWallet";
import { formatCurrency, formatTransactionTime } from "@/lib/utils";
import { EXPLORER_URL, CLUSTER } from "@/lib/constants";

interface ProcessedTransaction {
  signature: string;
  timestamp: number;
  status: string;
  isSwap: boolean;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  fee: number;
  relatedSignatures?: string[];
  isGroup?: boolean;
}

export default function TransactionHistory() {
  const { connected, wallet } = useWallet();
  const { transactions, loading, error, fetchTransactions } = useTransactions();
  
  // Add refreshing state to show when we're auto-refreshing
  const [refreshing, setRefreshing] = useState(false);

  // Function to manually refresh transactions
  const refreshTransactions = async () => {
    if (!connected || !wallet?.publicKey) return;
    
    setRefreshing(true);
    try {
      await fetchTransactions(wallet.publicKey.toString());
    } catch (e) {
      console.error("Failed to refresh transactions:", e);
    } finally {
      // Reset refreshing state after a short delay for better UX
      setTimeout(() => setRefreshing(false), 1000);
    }
  };

  useEffect(() => {
    if (connected && wallet?.publicKey) {
      fetchTransactions(wallet.publicKey.toString());
      
      // Set up interval to refresh transactions
      const interval = setInterval(() => {
        fetchTransactions(wallet.publicKey.toString());
      }, 20000); // Refresh every 20 seconds
      
      return () => clearInterval(interval);
    }
  }, [connected, wallet, fetchTransactions]);
  
  // Process transactions to group YOT to SOL swaps
  const processedTransactions = useMemo(() => {
    if (!transactions.length) return [];

    // First pass to find YOT to SOL transactions and group them by time
    const yotToSolGroups = new Map<number, string[]>();
    const txMap = new Map<string, any>();
    
    // Map all transactions for easy lookup
    transactions.forEach(tx => {
      txMap.set(tx.signature, tx);
      
      // Find YOT to SOL transactions 
      if (tx.fromToken === 'YOT' && tx.toToken === 'SOL') {
        // Group by rounding to closest 2 seconds to catch related txs
        const timeGroup = Math.floor(tx.timestamp / 2) * 2;
        if (!yotToSolGroups.has(timeGroup)) {
          yotToSolGroups.set(timeGroup, []);
        }
        yotToSolGroups.get(timeGroup)?.push(tx.signature);
      }
    });
    
    // Create filtered transaction list
    const filteredTransactions: ProcessedTransaction[] = [];
    const processedSignatures = new Set<string>();
    
    // Process all transactions
    transactions.forEach(tx => {
      // Skip if already processed
      if (processedSignatures.has(tx.signature)) return;
      
      // Check if this is a YOT to SOL transaction
      if (tx.fromToken === 'YOT' && tx.toToken === 'SOL') {
        // Find which time group it belongs to
        const timeGroup = Math.floor(tx.timestamp / 2) * 2;
        const signatures = yotToSolGroups.get(timeGroup) || [];
        
        // If this is part of a multi-transaction group (2+ transactions)
        if (signatures.length > 1) {
          // Mark all signatures in this group as processed
          signatures.forEach(sig => processedSignatures.add(sig));
          
          // Add a combined transaction
          filteredTransactions.push({
            ...tx,
            signature: signatures[0], // Use first signature for the ID
            isSwap: true,
            relatedSignatures: signatures,
            isGroup: true
          });
        } else {
          // Single transaction, add normally
          processedSignatures.add(tx.signature);
          filteredTransactions.push(tx);
        }
      } else {
        // Regular transaction, add normally
        processedSignatures.add(tx.signature);
        filteredTransactions.push(tx);
      }
    });
    
    // Sort by timestamp (newest first)
    return filteredTransactions.sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions]);

  return (
    <Card className="bg-dark-100 rounded-xl p-6 shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center">
          <ClipboardIcon className="h-5 w-5 mr-2 text-primary-400" />
          Transaction History
        </h2>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={refreshTransactions}
          disabled={loading || refreshing || !connected}
          className="text-gray-400 hover:text-white"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="text-xs">Refresh</span>
        </Button>
      </div>
      
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {/* Show loading indicator */}
        {loading && (
          <div className="flex justify-center py-4">
            <svg className="animate-spin h-6 w-6 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
        
        {/* Show error message */}
        {error && (
          <div className="text-center py-4 text-red-500">
            <p>Error loading transactions: {error.message}</p>
          </div>
        )}
        
        {/* Show no transactions message */}
        {!loading && !error && processedTransactions.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No transactions found</p>
            <p className="text-sm">Recent transactions made with your wallet will appear here</p>
            
            <div className="mt-4 py-2 px-3 bg-dark-300 rounded-lg text-xs">
              <p className="font-medium text-primary-400">Transaction Info</p>
              <p className="mt-1 text-gray-400">
                Your transactions to the pool may take a moment to appear here. The application 
                performs real transfers on the Solana devnet blockchain, but a complete swap 
                would require a deployed token-swap program to handle both sides of the exchange.
              </p>
              <p className="mt-1 text-gray-400">
                You can view your recent transactions directly on 
                <a 
                  href={`${EXPLORER_URL}/address/${wallet?.publicKey?.toString()}?cluster=${CLUSTER}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:underline ml-1"
                >
                  Solana Explorer
                </a>.
              </p>
            </div>
          </div>
        )}
        
        {/* Show transactions */}
        {!loading && !error && processedTransactions.map((tx) => (
          <div key={tx.signature} className="bg-dark-300 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center">
                  <div className={`${tx.status === 'finalized' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'} rounded-full p-1 mr-2`}>
                    {tx.status === 'finalized' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-white">
                    {tx.isSwap 
                      ? `Swap ${tx.fromToken} for ${tx.toToken}` 
                      : `Transaction ${tx.signature.slice(0, 8)}...`}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {tx.timestamp ? formatTransactionTime(tx.timestamp) : 'Unknown time'}
                </div>
              </div>
              <a 
                href={`${EXPLORER_URL}/tx/${tx.signature}?cluster=${CLUSTER}`} 
                className="text-primary-400 text-xs hover:underline" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                View on Explorer
              </a>
            </div>
            
            {tx.isSwap && (
              <div className="mt-3 pt-3 border-t border-dark-100 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-400">Type</div>
                  <div className="font-medium px-2 py-0.5 bg-primary-500/10 text-primary-400 rounded-full text-xs">
                    {tx.isGroup ? 'Multi-Transaction Swap' : 'Token Swap'}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 bg-dark-200 rounded-lg p-2 mb-2">
                  <div>
                    <div className="text-gray-400 text-xs">From</div>
                    <div className="font-medium text-white">
                      {tx.fromAmount ? `${formatCurrency(tx.fromAmount)} ${tx.fromToken}` : 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">To</div>
                    <div className="font-medium text-white">
                      {tx.toAmount ? `${formatCurrency(tx.toAmount)} ${tx.toToken}` : 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Fee</div>
                    <div className="font-medium text-white">
                      {tx.fee ? `${formatCurrency(tx.fee)} ${tx.fromToken}` : '-'}
                    </div>
                  </div>
                </div>
                
                {tx.isGroup && tx.relatedSignatures && tx.relatedSignatures.length > 1 && (
                  <div className="mt-2 text-xs text-gray-400">
                    <span className="font-medium">Related transactions:</span> {tx.relatedSignatures.length}
                  </div>
                )}
                
                <div className="mt-2 text-xs text-gray-400 flex justify-between">
                  <div>
                    <span className="font-medium">Exchange rate:</span> 
                    {tx.fromAmount && tx.toAmount 
                      ? ` 1 ${tx.fromToken} ≈ ${formatCurrency(tx.toAmount / tx.fromAmount)} ${tx.toToken}`
                      : ' Unknown'}
                  </div>
                  <div>
                    <span className="font-medium">Network:</span> Solana Devnet
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
