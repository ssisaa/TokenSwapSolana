import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Settings, AlertCircle, CheckCircle2, RefreshCw, Zap } from "lucide-react";
import { useWallet } from "@/hooks/useSolanaWallet";
import { 
  initializeDevSwapPool, 
  fundPoolAuthority, 
  createPoolTokenAccounts,
  poolAuthorityKeypair
} from "@/lib/tokenSwapSetup";
import { YOT_TOKEN_ADDRESS } from "@/lib/constants";
import { formatCurrency, shortenAddress } from "@/lib/utils";
import { PublicKey } from "@solana/web3.js";
import { connection } from "@/lib/solana";

export default function SwapTestSetup() {
  const { wallet, connected } = useWallet();
  const [isInitializing, setIsInitializing] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isCreatingAccounts, setIsCreatingAccounts] = useState(false);
  const [poolAuthority, setPoolAuthority] = useState<string | null>(null);
  const [poolBalances, setPoolBalances] = useState({
    sol: 0,
    yot: 0
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState<'init' | 'fund' | 'accounts' | 'complete'>('init');

  // Check if pool is already initialized
  useEffect(() => {
    if (poolAuthorityKeypair) {
      setPoolAuthority(poolAuthorityKeypair.publicKey.toString());
      setSetupStep(prevStep => prevStep === 'init' ? 'fund' : prevStep);
    }
  }, []);

  // Update pool balances
  const updatePoolBalances = async () => {
    if (!poolAuthority) return;

    try {
      // Get SOL balance
      const solBalance = await connection.getBalance(new PublicKey(poolAuthority));
      const solBalanceInSol = solBalance / 1000000000; // Convert lamports to SOL
      
      // Get YOT balance (to be implemented)
      // For now, we'll just set it to 0
      const yotBalance = 0;
      
      setPoolBalances({
        sol: solBalanceInSol,
        yot: yotBalance
      });
    } catch (error) {
      console.error("Error updating pool balances:", error);
    }
  };

  // Initialize pool
  const handleInitializePool = async () => {
    setIsInitializing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      const authorityPublicKey = await initializeDevSwapPool();
      setPoolAuthority(authorityPublicKey.toString());
      setSuccessMessage("Pool authority initialized successfully!");
      setSetupStep('fund');
      
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error("Error initializing pool:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to initialize pool");
    } finally {
      setIsInitializing(false);
    }
  };

  // Fund pool authority
  const handleFundAuthority = async () => {
    if (!connected || !wallet) {
      setErrorMessage("Wallet not connected");
      return;
    }
    
    setIsFunding(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      await fundPoolAuthority(wallet);
      setSuccessMessage("Pool authority funded successfully!");
      setSetupStep('accounts');
      
      // Update balances
      await updatePoolBalances();
      
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error("Error funding pool authority:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to fund pool authority");
    } finally {
      setIsFunding(false);
    }
  };

  // Create token accounts
  const handleCreateTokenAccounts = async () => {
    setIsCreatingAccounts(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      const tokenAccount = await createPoolTokenAccounts(YOT_TOKEN_ADDRESS);
      setSuccessMessage(`Token account created: ${tokenAccount.toString()}`);
      setSetupStep('complete');
      
      // Update balances
      await updatePoolBalances();
      
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error("Error creating token accounts:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to create token accounts");
    } finally {
      setIsCreatingAccounts(false);
    }
  };

  return (
    <Card className="bg-dark-100 rounded-xl p-6 shadow-lg overflow-hidden mb-6">
      <div className="flex items-center mb-4">
        <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center mr-3">
          <Settings className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Swap Pool Test Setup</h2>
          <p className="text-sm text-gray-400">Configure a test pool to try complete swaps on devnet</p>
        </div>
        
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-primary-400 hover:text-primary-300"
          disabled={!poolAuthority}
          onClick={updatePoolBalances}
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>
      
      <Separator className="bg-dark-400 my-4" />
      
      {errorMessage && (
        <Alert className="bg-red-900/30 border-red-800 text-red-200 mb-4">
          <AlertCircle className="h-4 w-4 mr-2" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      
      {successMessage && (
        <Alert className="bg-green-900/30 border-green-800 text-green-200 mb-4">
          <CheckCircle2 className="h-4 w-4 mr-2" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}
      
      {/* Pool Info */}
      {poolAuthority && (
        <div className="bg-dark-300 rounded-lg p-4 mb-4">
          <h3 className="text-white font-medium mb-3">Pool Authority Details</h3>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="text-gray-400">Public Key:</div>
            <div className="text-white font-medium col-span-2">{shortenAddress(poolAuthority, 8)}</div>
            
            <div className="text-gray-400">SOL Balance:</div>
            <div className="text-white font-medium col-span-2">{formatCurrency(poolBalances.sol)} SOL</div>
            
            <div className="text-gray-400">YOT Balance:</div>
            <div className="text-white font-medium col-span-2">{formatCurrency(poolBalances.yot)} YOT</div>
          </div>
        </div>
      )}
      
      {/* Setup Steps */}
      <div className="space-y-4">
        {/* Step 1: Initialize */}
        <div className={`bg-dark-300 rounded-lg p-4 ${setupStep !== 'init' ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium">Step 1: Initialize Pool Authority</h3>
              <p className="text-sm text-gray-400 mt-1">Create a new keypair for the test pool</p>
            </div>
            <Button
              variant={setupStep === 'init' ? "default" : "outline"}
              size="sm"
              disabled={isInitializing || setupStep !== 'init'}
              onClick={handleInitializePool}
              className={setupStep === 'init' ? "bg-purple-600 hover:bg-purple-700" : ""}
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Initializing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Initialize
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Step 2: Fund */}
        <div className={`bg-dark-300 rounded-lg p-4 ${setupStep !== 'fund' ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium">Step 2: Fund Pool Authority</h3>
              <p className="text-sm text-gray-400 mt-1">Send SOL to the pool authority for account creation</p>
            </div>
            <Button
              variant={setupStep === 'fund' ? "default" : "outline"}
              size="sm"
              disabled={isFunding || setupStep !== 'fund' || !connected}
              onClick={handleFundAuthority}
              className={setupStep === 'fund' ? "bg-purple-600 hover:bg-purple-700" : ""}
            >
              {isFunding ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Funding...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Send SOL
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Step 3: Create Token Accounts */}
        <div className={`bg-dark-300 rounded-lg p-4 ${setupStep !== 'accounts' ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium">Step 3: Create Token Accounts</h3>
              <p className="text-sm text-gray-400 mt-1">Create token accounts for the pool authority</p>
            </div>
            <Button
              variant={setupStep === 'accounts' ? "default" : "outline"}
              size="sm"
              disabled={isCreatingAccounts || setupStep !== 'accounts'}
              onClick={handleCreateTokenAccounts}
              className={setupStep === 'accounts' ? "bg-purple-600 hover:bg-purple-700" : ""}
            >
              {isCreatingAccounts ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Create Accounts
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Setup Complete */}
      {setupStep === 'complete' && (
        <Alert className="bg-green-900/30 border-green-800 text-green-200 mt-4">
          <CheckCircle2 className="h-4 w-4 mr-2" />
          <AlertTitle>Setup Complete</AlertTitle>
          <AlertDescription>
            Your test pool is now configured! You can now test the complete swap functionality.
          </AlertDescription>
        </Alert>
      )}
    </Card>
  );
}