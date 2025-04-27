import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { InfoIcon, RefreshCw } from "lucide-react";
import { useTokenData } from "@/hooks/useTokenData";
import { 
  YOT_TOKEN_ADDRESS, 
  YOT_TOKEN_ACCOUNT, 
  YOS_TOKEN_ADDRESS, 
  YOS_TOKEN_ACCOUNT,
  POOL_AUTHORITY,
  POOL_SOL_ACCOUNT
} from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function TokenInfo() {
  const { tokenData, poolData, fetchTokenInfo, loading } = useTokenData();
  const { toast } = useToast();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  
  // Fetch token info when component mounts
  useEffect(() => {
    fetchTokenInfo();
    // Set up interval to refresh data every minute
    const intervalId = setInterval(() => {
      fetchTokenInfo();
    }, 60000); // 60 seconds
    
    return () => clearInterval(intervalId);
  }, [fetchTokenInfo]);

  const handleCopyAddress = async (address: string, label: string) => {
    try {
      await copyToClipboard(address);
      setCopiedAddress(address);
      
      toast({
        title: "Copied to clipboard",
        description: `${label} address copied to clipboard.`,
        variant: "default",
      });
      
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Failed to copy address to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="mt-8 bg-dark-100 rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center">
          <InfoIcon className="h-5 w-5 mr-2 text-primary-400" />
          Token Information
        </h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchTokenInfo()}
          disabled={loading}
          className="text-primary-400 hover:text-primary-300"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* YOT Token Info */}
        <div>
          <h3 className="font-medium text-lg text-primary-400 mb-3">YOT Token</h3>
          <div className="space-y-2">
            <div className="flex flex-col">
              <span className="text-sm text-gray-400">SPL Token Address</span>
              <code className="text-sm bg-dark-300 p-2 rounded mt-1 flex items-center justify-between">
                <span className="overflow-hidden text-ellipsis">{YOT_TOKEN_ADDRESS}</span>
                <button 
                  className="text-primary-400 hover:text-primary-300 ml-2" 
                  title="Copy address"
                  onClick={() => handleCopyAddress(YOT_TOKEN_ADDRESS, "YOT Token")}
                >
                  {copiedAddress === YOT_TOKEN_ADDRESS ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  )}
                </button>
              </code>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-400">YOT Token Account</span>
              <code className="text-sm bg-dark-300 p-2 rounded mt-1 flex items-center justify-between">
                <span className="overflow-hidden text-ellipsis">{YOT_TOKEN_ACCOUNT}</span>
                <button 
                  className="text-primary-400 hover:text-primary-300 ml-2" 
                  title="Copy address"
                  onClick={() => handleCopyAddress(YOT_TOKEN_ACCOUNT, "YOT Token Account")}
                >
                  {copiedAddress === YOT_TOKEN_ACCOUNT ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  )}
                </button>
              </code>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-400">Supply</span>
              <span className="text-sm font-medium">
                {tokenData.yot ? tokenData.yot.supply.toLocaleString() : "Fetching..."}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-400">Decimals</span>
              <span className="text-sm font-medium">
                {tokenData.yot ? tokenData.yot.decimals : "Fetching..."}
              </span>
            </div>
          </div>
        </div>
        
        {/* YOS Token Info */}
        <div>
          <h3 className="font-medium text-lg text-green-400 mb-3">YOS Token (Staking Reward)</h3>
          <div className="space-y-2">
            <div className="flex flex-col">
              <span className="text-sm text-gray-400">SPL Token Address</span>
              <code className="text-sm bg-dark-300 p-2 rounded mt-1 flex items-center justify-between">
                <span className="overflow-hidden text-ellipsis">{YOS_TOKEN_ADDRESS}</span>
                <button 
                  className="text-primary-400 hover:text-primary-300 ml-2" 
                  title="Copy address"
                  onClick={() => handleCopyAddress(YOS_TOKEN_ADDRESS, "YOS Token")}
                >
                  {copiedAddress === YOS_TOKEN_ADDRESS ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  )}
                </button>
              </code>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-400">YOS Token Account</span>
              <code className="text-sm bg-dark-300 p-2 rounded mt-1 flex items-center justify-between">
                <span className="overflow-hidden text-ellipsis">{YOS_TOKEN_ACCOUNT}</span>
                <button 
                  className="text-primary-400 hover:text-primary-300 ml-2" 
                  title="Copy address"
                  onClick={() => handleCopyAddress(YOS_TOKEN_ACCOUNT, "YOS Token Account")}
                >
                  {copiedAddress === YOS_TOKEN_ACCOUNT ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  )}
                </button>
              </code>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-400">Supply</span>
              <span className="text-sm font-medium">
                {tokenData.yos ? tokenData.yos.supply.toLocaleString() : "Fetching..."}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-400">Decimals</span>
              <span className="text-sm font-medium">
                {tokenData.yos ? tokenData.yos.decimals : "Fetching..."}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Liquidity Pool Info */}
      <div className="mt-6">
        <h3 className="font-medium text-lg text-orange-400 mb-3">Liquidity Pool Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col">
            <span className="text-sm text-gray-400">Pool Authority</span>
            <code className="text-sm bg-dark-300 p-2 rounded mt-1 flex items-center justify-between">
              <span className="overflow-hidden text-ellipsis">{POOL_AUTHORITY}</span>
              <button 
                className="text-primary-400 hover:text-primary-300 ml-2" 
                title="Copy address"
                onClick={() => handleCopyAddress(POOL_AUTHORITY, "Pool Authority")}
              >
                {copiedAddress === POOL_AUTHORITY ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                )}
              </button>
            </code>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-gray-400">SOL Token Account</span>
            <code className="text-sm bg-dark-300 p-2 rounded mt-1 flex items-center justify-between">
              <span className="overflow-hidden text-ellipsis">{POOL_SOL_ACCOUNT}</span>
              <button 
                className="text-primary-400 hover:text-primary-300 ml-2" 
                title="Copy address"
                onClick={() => handleCopyAddress(POOL_SOL_ACCOUNT, "Pool SOL Account")}
              >
                {copiedAddress === POOL_SOL_ACCOUNT ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                )}
              </button>
            </code>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-gray-400">Pool Liquidity</span>
            <div className="flex items-center mt-1">
              <span className="text-sm font-medium mr-3">
                {poolData.solBalance !== null ? `${poolData.solBalance.toFixed(4)} SOL` : "Fetching..."}
              </span>
              <span className="text-sm font-medium">
                {poolData.yotBalance !== null ? `${poolData.yotBalance.toFixed(2)} YOT` : "Fetching..."}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Information */}
      <div className="mt-8 border-t border-dark-300 pt-4">
        <div className="bg-dark-300 p-4 rounded-lg">
          <h3 className="font-medium text-lg text-gray-300 mb-2">About This Application</h3>
          <div className="text-sm text-gray-400 space-y-2">
            <p>This application provides a Solana token swap interface that connects to real Solana devnet addresses and fetches actual blockchain data. It displays real-time token information and wallet balances from the blockchain.</p>
            <p>The implementation features a complete token swap functionality using two-step transactions, sending tokens to the pool and receiving tokens back. This uses real blockchain transactions on Solana devnet.</p>
            <p>For production environments, we recommend using the official Solana token-swap program for atomic swaps in a single transaction.</p>
            <p>All addresses shown are real and can be viewed on the <a href="https://explorer.solana.com/?cluster=devnet" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">Solana Explorer (devnet)</a>.</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
