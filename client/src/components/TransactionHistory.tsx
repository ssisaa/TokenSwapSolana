import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ClipboardIcon } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useWallet } from "@/hooks/useSolanaWallet";
import { formatCurrency, formatTransactionTime } from "@/lib/utils";
import { EXPLORER_URL, CLUSTER } from "@/lib/constants";

export default function TransactionHistory() {
  const { connected, wallet } = useWallet();
  const { transactions, loading, error, fetchTransactions } = useTransactions();

  useEffect(() => {
    if (connected && wallet?.publicKey) {
      fetchTransactions(wallet.publicKey.toString());
    }
  }, [connected, wallet, fetchTransactions]);

  return (
    <Card className="bg-dark-100 rounded-xl p-6 shadow-lg">
      <h2 className="text-xl font-semibold mb-4 text-white flex items-center">
        <ClipboardIcon className="h-5 w-5 mr-2 text-primary-400" />
        Transaction History
      </h2>
      
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
        {!loading && !error && transactions.length === 0 && (
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
        {!loading && !error && transactions.map((tx) => (
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
              <div className="mt-3 pt-3 border-t border-dark-100 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-gray-400">From</div>
                  <div className="font-medium">
                    {tx.fromAmount ? `${formatCurrency(tx.fromAmount)} ${tx.fromToken}` : 'Unknown'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">To</div>
                  <div className="font-medium">
                    {tx.toAmount ? `${formatCurrency(tx.toAmount)} ${tx.toToken}` : 'Unknown'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Fee</div>
                  <div className="font-medium">
                    {tx.fee ? `${formatCurrency(tx.fee, 6)} SOL` : 'Unknown'}
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
