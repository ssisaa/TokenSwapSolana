import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet } from "@/hooks/useSolanaWallet";
import { useSwap } from "@/hooks/useSwap";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, ArrowRightLeft, Key, Percent, Route, Settings, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { ADMIN_WALLET_ADDRESS, SOL_SYMBOL, YOT_SYMBOL } from "@/lib/constants";
import { PublicKey } from "@solana/web3.js";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useLocation } from "wouter";
import { initializeMultiHubSwapProgram, isMultiHubSwapProgramInitialized } from "@/lib/multihub-client-simplified";

export default function CashbackSwapPage() {
  const { connected, connect, wallet } = useWallet();
  const swap = useSwap();
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  
  // Local state for UI enhancements
  const [isCashbackTooltipOpen, setIsCashbackTooltipOpen] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState(false);
  const [cashbackAmount, setCashbackAmount] = useState("0");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isProgramInitialized, setIsProgramInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  // Calculate cashback amount (5% of transaction)
  useEffect(() => {
    if (swap.toAmount && typeof swap.toAmount === 'number') {
      const cashback = swap.toAmount * 0.05; // 5% cashback
      setCashbackAmount(cashback.toFixed(6));
    } else {
      setCashbackAmount("0");
    }
  }, [swap.toAmount]);
  
  // Check if the connected wallet is the admin
  useEffect(() => {
    if (wallet && wallet.publicKey) {
      const adminPubkey = new PublicKey(ADMIN_WALLET_ADDRESS);
      setIsAdmin(wallet.publicKey.toString() === adminPubkey.toString());
      
      // Check if program is initialized
      const checkInitialization = async () => {
        try {
          const isInitialized = await isMultiHubSwapProgramInitialized();
          setIsProgramInitialized(isInitialized);
        } catch (error) {
          console.error("Error checking program initialization:", error);
          setIsProgramInitialized(false);
        }
      };
      
      checkInitialization();
    } else {
      setIsAdmin(false);
    }
  }, [wallet]);
  
  // Handle program initialization
  const handleInitializeProgram = async () => {
    if (!wallet || !wallet.publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to initialize the program.",
        variant: "destructive"
      });
      return;
    }
    
    // Check if wallet is admin
    const adminPubkey = new PublicKey(ADMIN_WALLET_ADDRESS);
    if (wallet.publicKey.toString() !== adminPubkey.toString()) {
      toast({
        title: "Permission Denied",
        description: "Only the admin wallet can initialize the program.",
        variant: "destructive"
      });
      return;
    }
    
    setIsInitializing(true);
    
    try {
      toast({
        title: "Initializing Program",
        description: "Please approve the transaction to initialize the MultiHub Swap program.",
      });
      
      const signature = await initializeMultiHubSwapProgram(wallet);
      
      toast({
        title: "Simplified Mode Activated",
        description: (
          <div>
            <p>The MultiHub Swap is now running in simplified mode, bypassing on-chain program initialization.</p>
            <p className="mt-2 text-green-600 font-semibold">You can now use the swap functionality without waiting for program initialization!</p>
          </div>
        ),
        variant: "default"
      });
      
      setIsProgramInitialized(true);
    } catch (error) {
      console.error("Error initializing program:", error);
      toast({
        title: "Initialization Failed",
        description: String(error).includes("Program already initialized") 
          ? "Program is already initialized." 
          : `Failed to initialize the program: ${String(error)}`,
        variant: "destructive"
      });
    } finally {
      setIsInitializing(false);
    }
  };
  
  const [swapError, setSwapError] = useState<Error | null>(null);

  const handleExecuteSwap = async () => {
    try {
      setSwapSuccess(false);
      setSwapError(null);
      
      // Import our simplified swap implementation
      const { swapTokenToYOT, swapYOTToToken } = await import('@/lib/multihub-client-simplified');
      const { PublicKey } = await import('@solana/web3.js');
      
      console.log("Using simplified swap implementation - no program validation required");
      
      // Since we're using the simplified implementation, we don't need to validate
      // program initialization or verify complex account structures
      
      const amount = parseFloat(String(swap.fromAmount));
      
      // Create our token addresses as PublicKey objects for better compatibility
      const SOL_TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112');
      const YOT_TOKEN_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
      const YOS_TOKEN_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');
      
      // Set up the token info objects with PublicKey objects
      const fromTokenInfo = {
        symbol: swap.fromToken,
        name: swap.fromToken,
        address: swap.fromToken === SOL_SYMBOL 
          ? SOL_TOKEN_MINT.toString()
          : YOT_TOKEN_MINT.toString(),
        mint: swap.fromToken === SOL_SYMBOL 
          ? SOL_TOKEN_MINT
          : YOT_TOKEN_MINT,
        decimals: 9, // Both SOL and YOT have 9 decimals
        logoURI: swap.fromToken === SOL_SYMBOL 
          ? 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
          : 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF/logo.png',
        chainId: 101 // Mainnet, 103 would be devnet
      };
      
      const toTokenInfo = {
        symbol: swap.toToken,
        name: swap.toToken,
        address: swap.toToken === SOL_SYMBOL 
          ? SOL_TOKEN_MINT.toString()
          : YOT_TOKEN_MINT.toString(),
        mint: swap.toToken === SOL_SYMBOL 
          ? SOL_TOKEN_MINT
          : YOT_TOKEN_MINT,
        decimals: 9, // Both SOL and YOT have 9 decimals
        logoURI: swap.toToken === SOL_SYMBOL 
          ? 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
          : 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF/logo.png',
        chainId: 101 // Mainnet, 103 would be devnet
      };
      
      // Ensure token accounts exist for both input and output tokens
      // We'll need to make sure the YOS token account exists as well for cashback
      if (!wallet.publicKey) {
        throw new Error("Wallet not connected");
      }
      
      // The simplified implementation takes care of YOS token account creation
      // so we don't need to check for it explicitly here
      console.log("Using simplified implementation that handles token account creation automatically");
      
      // Calculate minimum amount out with 1% slippage
      const minAmountOut = parseFloat(String(swap.toAmount)) * 0.99;
      
      console.log(`Executing cashback swap with smart contract: ${amount} ${swap.fromToken} to ${swap.toToken}`);
      console.log(`This includes 20% liquidity contribution and 5% YOS cashback rewards`);
      console.log(`Input token mint: ${fromTokenInfo.mint.toString()}`);
      console.log(`Output token mint: ${toTokenInfo.mint.toString()}`);
      
      // Execute the swap using our corrected final implementation that properly handles transaction errors
      try {
        console.log("Using corrected final implementation for swap transaction");
        
        // Display processing state on UI
        toast({
          title: "Processing Transaction",
          description: "Your swap is being processed. Please approve the transaction in your wallet.",
          variant: "default"
        });
        
        // Convert from token info to actual PublicKey instances
        const fromAddress = fromTokenInfo.mint; // Use the mint field which is already a PublicKey
          
        // Convert to token info to PublicKey  
        const toAddress = toTokenInfo.mint; // Use the mint field which is already a PublicKey
          
        console.log(`Swapping from ${fromTokenInfo.symbol} (${fromAddress.toString()}) to ${toTokenInfo.symbol} (${toAddress.toString()})`);
        
        // Use our simplified implementation based on swap direction
        let signature;
        if (swap.fromToken === YOT_SYMBOL) {
          // Swap from YOT to another token
          signature = await swapYOTToToken(
            wallet,
            toAddress.toString(),
            parseFloat(amount.toString()),
            9, // Both SOL and YOT use 9 decimals
            undefined // No referrer for now
          );
        } else {
          // Swap from another token to YOT
          signature = await swapTokenToYOT(
            wallet,
            fromAddress.toString(),
            parseFloat(amount.toString()),
            9, // Both SOL and YOT use 9 decimals
            undefined // No referrer for now
          );
        }
        
        const result = { signature, success: true };
        
        console.log("Swap completed with transaction signature:", result.signature);
        
        // Show success message with signature
        toast({
          title: "Swap Successful!",
          description: (
            <div>
              <p>Swap completed successfully.</p>
              <a 
                href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                View on Solana Explorer
              </a>
            </div>
          ),
          variant: "default"
        });
        
        setSwapSuccess(true);
      } catch (swapError) {
        console.error("Swap transaction failed:", swapError);
        
        // Check if the error is related to account validation or simulation
        const errorMessage = String(swapError);
        let errorTitle = "Transaction Failed";
        let errorDescription = errorMessage;
        
        // Provide more user-friendly error messages
        if (errorMessage.includes("Simulation failed")) {
          console.error("Transaction simulation failed, this usually means account mismatch or insufficient balance");
          
          errorTitle = "Transaction Simulation Failed";
          
          // Log detailed error information
          if (errorMessage.includes("missing or invalid accounts")) {
            errorDescription = "Transaction accounts could not be validated. This may be due to a mismatch between the client and program expectations.";
          } else if (errorMessage.includes("insufficient funds")) {
            errorDescription = "Insufficient funds for this transaction. Please check your balances.";
          } else if (errorMessage.includes("invalid program id")) {
            errorDescription = "The program ID is not valid or not deployed to this network.";
          } else {
            errorDescription = "The transaction could not be processed by the network. Please try again.";
          }
        } else if (errorMessage.includes("Unexpected error")) {
          errorTitle = "Wallet Connection Error";
          errorDescription = "There was an issue connecting to your wallet. Please disconnect and reconnect your wallet, then try again.";
        } else if (errorMessage.includes("User rejected")) {
          errorTitle = "Transaction Rejected";
          errorDescription = "You rejected the transaction. Please approve it to complete the swap.";
        } else if (errorMessage.includes("blockhash")) {
          errorTitle = "Transaction Timeout";
          errorDescription = "The transaction timed out. Please try again.";
        }
        
        // Show toast with detailed error information
        toast({
          title: errorTitle,
          description: errorDescription,
          variant: "destructive",
        });
        
        // Don't report success when transaction fails
        console.log("Transaction failed - showing error to user");
        setSwapError(swapError as Error);
      }
      
      // Reset success message after 5 seconds
      setTimeout(() => {
        setSwapSuccess(false);
      }, 5000);
    } catch (error) {
      console.error("Swap failed:", error);
      
      // Provide more descriptive error messages based on common failure scenarios
      const errorObj = error as Error;
      let errorMsg = errorObj?.message || "Unknown error";
      
      if (errorMsg.includes("Program not initialized") || errorMsg.includes("state account not found")) {
        // We'll create an error message with an inline button for better UX
        errorMsg = "The MultiHub Swap program needs to be initialized first.";
        
        if (isAdmin) {
          toast({
            title: "Program Not Initialized",
            description: "The MultiHub Swap program must be initialized before swaps can be executed.",
            variant: "destructive",
            action: (
              <ToastAction altText="Initialize Program" onClick={handleInitializeProgram}>
                Initialize
              </ToastAction>
            ),
          });
        } else {
          toast({
            title: "Program Not Initialized",
            description: "The MultiHub Swap program must be initialized by an admin before swaps can be executed.",
            variant: "destructive",
          });
        }
      } else if (errorMsg.includes("insufficient funds")) {
        errorMsg = "Insufficient funds for this swap. Please check your wallet balance.";
      } else if (errorMsg.includes("User rejected")) {
        errorMsg = "Transaction was rejected by the wallet. Please try again.";
      } else if (errorMsg.includes("Simulation failed")) {
        errorMsg = "Transaction simulation failed. This could be due to incorrect accounts or insufficient funds.";
        
        toast({
          title: "Transaction Failed",
          description: "The swap transaction simulation failed. This is often due to account mismatch between initialization and swap execution.",
          variant: "destructive",
        });
      }
      
      setSwapError(new Error(errorMsg));
    }
  };
  
  return (
    <div className="container max-w-4xl mx-auto py-8">
      {/* Program Not Initialized Warning - displayed at the top of the page */}
      {swapError && swapError.message.includes("needs to be initialized") && (
        <Alert variant="destructive" className="mb-6 bg-destructive/10 border-destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="font-semibold">Program Initialization Required</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>The MultiHub Swap program needs to be initialized before you can perform swaps.</p>
            {isAdmin && (
              <div>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={handleInitializeProgram}
                  disabled={isInitializing}
                  className="mt-2"
                >
                  <Key className="h-4 w-4 mr-2" />
                  {isInitializing ? "Initializing..." : "Initialize Program"}
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
              Cashback Swap
            </h1>
            <p className="text-muted-foreground mt-2">
              Swap tokens with 5% cashback in YOS tokens
            </p>
          </div>
          
          {isAdmin && (
            <div className="flex items-center">
              <Button 
                variant={isProgramInitialized ? "outline" : "default"}
                onClick={handleInitializeProgram}
                disabled={isInitializing || isProgramInitialized}
                className="flex items-center gap-2"
                size="sm"
              >
                <Key className="h-4 w-4" />
                {isInitializing 
                  ? "Initializing..." 
                  : isProgramInitialized 
                    ? "Program Initialized" 
                    : "Initialize Program"
                }
              </Button>
            </div>
          )}
        </div>
        
        {/* Add program status notification */}
        {!isProgramInitialized && (
          <Alert className="mt-4 bg-orange-500/10 text-orange-500 border-orange-500/20">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Program Not Initialized</AlertTitle>
            <AlertDescription>
              The Multi-Hub Swap program needs to be initialized before use. 
              {isAdmin 
                ? " Click the 'Initialize Program' button above to set up the program."
                : " Please contact the admin to initialize the program."}
            </AlertDescription>
          </Alert>
        )}
      </div>
      
      <Card className="border-2 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center">
            <ArrowRightLeft className="h-5 w-5 mr-2" />
            <span>Swap with Cashback</span>
            <Badge variant="secondary" className="ml-auto flex items-center gap-1">
              <Percent className="h-3 w-3" />
              5% YOS Cashback
            </Badge>
          </CardTitle>
          <CardDescription>
            Get instant 5% cashback in YOS tokens on all your swaps
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!connected ? (
            <div className="flex flex-col items-center justify-center p-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-center mb-4">Connect your wallet to start swapping with cashback</p>
              <Button onClick={() => connect()} size="lg">
                Connect Wallet
              </Button>
            </div>
          ) : (
            <>
              {/* From Token Section */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span>From</span>
                  <span>
                    Balance: {typeof swap.fromBalance === 'number' && swap.fromBalance > 0 
                      ? formatCurrency(swap.fromBalance, swap.fromToken, 4) 
                      : "0"} {swap.fromToken}
                  </span>
                </div>
                
                <div className="flex space-x-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={swap.fromAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        swap.setFromAmount(value);
                        if (value && !isNaN(parseFloat(value))) {
                          swap.calculateToAmount(parseFloat(value));
                        } else {
                          swap.setToAmount("");
                        }
                      }}
                      className="text-right text-lg"
                    />
                  </div>
                  
                  <Select
                    value={swap.fromToken}
                    onValueChange={(value) => {
                      swap.setFromToken(value);
                      if (swap.toToken === value) {
                        swap.setToToken(swap.fromToken);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Select token" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SOL_SYMBOL}>SOL</SelectItem>
                      <SelectItem value={YOT_SYMBOL}>YOT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Switch Button */}
              <div className="flex justify-center my-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={swap.switchTokens}
                  className="rounded-full h-8 w-8 bg-muted"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>
              </div>
              
              {/* To Token Section */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span>To</span>
                  <span>
                    Balance: {typeof swap.toBalance === 'number' && swap.toBalance > 0 
                      ? formatCurrency(swap.toBalance, swap.toToken, 4) 
                      : "0"} {swap.toToken}
                  </span>
                </div>
                
                <div className="flex space-x-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={swap.toAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        swap.setToAmount(value);
                        if (value && !isNaN(parseFloat(value))) {
                          swap.calculateFromAmount(parseFloat(value));
                        } else {
                          swap.setFromAmount("");
                        }
                      }}
                      className="text-right text-lg"
                    />
                  </div>
                  
                  <Select
                    value={swap.toToken}
                    onValueChange={(value) => {
                      swap.setToToken(value);
                      if (swap.fromToken === value) {
                        swap.setFromToken(swap.toToken);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Select token" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SOL_SYMBOL}>SOL</SelectItem>
                      <SelectItem value={YOT_SYMBOL}>YOT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Exchange Rate Display */}
              <div className="text-sm text-muted-foreground mt-2 mb-4">
                Rate: {swap.exchangeRate}
              </div>
              
              <Separator className="my-4" />
              
              {/* Cashback Information */}
              <div className="bg-secondary/30 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <Percent className="h-4 w-4 mr-2 text-primary" />
                    <span className="font-medium">Cashback Reward</span>
                  </div>
                  <span className="text-primary font-medium">{cashbackAmount} YOS</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  5% of your swap amount will be automatically sent to your wallet as YOS tokens
                </p>
              </div>
              
              {/* Success Message */}
              {swapSuccess && (
                <Alert className="mb-4 bg-green-500/10 text-green-500 border-green-500/20">
                  <AlertDescription className="flex items-center">
                    Swap completed successfully! Cashback has been sent to your wallet.
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Swap Button */}
              <Button 
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                size="lg"
                disabled={!swap.fromAmount || swap.isPending || parseFloat(String(swap.fromAmount)) <= 0}
                onClick={handleExecuteSwap}
              >
                {swap.isPending ? "Processing..." : "Swap with 5% Cashback"}
              </Button>
              
              {/* Error Display */}
              {swapError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>{swapError.message}</span>
                    {swapError.message.includes("needs to be initialized") && isAdmin && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="ml-4 bg-destructive/20 hover:bg-destructive/30 text-white border-destructive/50"
                        onClick={handleInitializeProgram}
                        disabled={isInitializing}
                      >
                        {isInitializing ? "Initializing..." : "Initialize"}
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}