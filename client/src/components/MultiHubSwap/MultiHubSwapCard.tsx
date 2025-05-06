import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import {
  ArrowDownUp,
  CircleDollarSign,
  CoinsIcon,
  Droplet,
  LineChart,
  Repeat,
  Wallet,
  RefreshCw,
  ArrowDown,
  Shield,
  Info,
  AlertCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PublicKey } from "@solana/web3.js";

// Swap functionality imports - all consolidated in multi-hub-swap-contract.ts
import {
  distributeWeeklyYosReward,
  getLiquidityContributionInfo,
  withdrawLiquidityContribution,
  executeSwap, 
  getExpectedOutput, 
  getTokenBalance, 
  isSwapSupported,
  getSupportedTokens,
  buyAndDistribute
} from "@/lib/multi-hub-swap-contract";
// Import getExchangeRate from solana.ts for blockchain-based AMM calculations
import { getExchangeRate } from "@/lib/solana";
import { 
  FORMATTED_RATES,
  SOL_TOKEN_ADDRESS,
  YOT_TOKEN_ADDRESS,
  YOS_TOKEN_ADDRESS,
  USDC_DEVNET_ADDRESS,
  DEFAULT_DISTRIBUTION_RATES 
} from "@/lib/config";

// Token type definition
interface Token {
  symbol: string;
  name: string;
  logoUrl: string;
  address: string;
}

// Tokens using addresses from centralized configuration in app.config.json
// This ensures consistency across the application
const tokens: Token[] = [
  {
    symbol: "SOL",
    name: "Solana",
    logoUrl: "https://cryptologos.cc/logos/solana-sol-logo.png",
    address: SOL_TOKEN_ADDRESS, // Using the constant from config.ts
  },
  {
    symbol: "YOT",
    name: "YOT Token",
    logoUrl: "https://place-hold.it/32x32/37c/fff?text=YOT",
    address: YOT_TOKEN_ADDRESS, // Using the constant from config.ts
  },
  {
    symbol: "YOS",
    name: "YOS Token",
    logoUrl: "https://place-hold.it/32x32/f77/fff?text=YOS",
    address: YOS_TOKEN_ADDRESS, // Using the constant from config.ts
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    logoUrl: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
    address: USDC_DEVNET_ADDRESS, // Using the constant from config.ts
  },
];

interface MultiHubSwapCardProps {
  wallet: any;
}

const MultiHubSwapCard: React.FC<MultiHubSwapCardProps> = ({ wallet }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("swap");
  const [fromToken, setFromToken] = useState(tokens[0]);
  const [toToken, setToToken] = useState(tokens[1]);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [swapLoading, setSwapLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [slippage, setSlippage] = useState("1.0");
  const [exchangeRateDisplay, setExchangeRateDisplay] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(false);

  // Liquidity contribution state
  const [contributionInfo, setContributionInfo] = useState<{
    contributedAmount: number;
    totalClaimedYos: number;
    canClaimReward: boolean;
    nextClaimAvailable: string | null;
    estimatedWeeklyReward: number;
  }>({
    contributedAmount: 0,
    totalClaimedYos: 0,
    canClaimReward: false,
    nextClaimAvailable: null,
    estimatedWeeklyReward: 0,
  });

  // Get contribution info when wallet changes
  useEffect(() => {
    const fetchContributionInfo = async () => {
      if (wallet && wallet.publicKey) {
        try {
          const info = await getLiquidityContributionInfo(wallet.publicKey.toString());
          setContributionInfo(info);
        } catch (error) {
          console.error("Error fetching contribution info:", error);
        }
      }
    };

    fetchContributionInfo();
    // Set up interval to refresh every 30 seconds
    const intervalId = setInterval(fetchContributionInfo, 30000);

    return () => clearInterval(intervalId);
  }, [wallet]);

  // Exchange rate state
  const [exchangeRates, setExchangeRates] = useState({
    solToYot: 0,
    yotToSol: 0,
    usdcToYot: 0,
    yotToUsdc: 0
  });
  
  // Fetch real exchange rates from blockchain
  useEffect(() => {
    const fetchRealExchangeRates = async () => {
      try {
        // Get real exchange rates directly from AMM pool balances
        const rates = await getExchangeRate();
        
        // Set the rates based on blockchain data only
        setExchangeRates({
          solToYot: rates.solToYot,
          yotToSol: rates.yotToSol,
          // For now, we don't have USDC pools implemented, so set to 0
          // These will show as errors to the user rather than using fallbacks
          usdcToYot: 0,
          yotToUsdc: 0
        });
        
        console.log(`Fetched real exchange rates from blockchain: 1 SOL = ${rates.solToYot} YOT, 1 YOT = ${rates.yotToSol} SOL`);
      } catch (error) {
        console.error("Failed to fetch exchange rates from blockchain:", error);
        // Don't set fallbacks, force error display
        setExchangeRates({
          solToYot: 0,
          yotToSol: 0,
          usdcToYot: 0,
          yotToUsdc: 0
        });
      }
    };
    
    fetchRealExchangeRates();
    const intervalId = setInterval(fetchRealExchangeRates, 15000); // Refresh every 15 seconds
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Calculate exchange rate using real AMM data
  const estimateExchangeRate = () => {
    // Only use real blockchain rates - no fallbacks
    if (fromToken.symbol === "SOL" && toToken.symbol === "YOT") {
      const rate = exchangeRates.solToYot;
      if (!rate || rate <= 0) throw new Error("Cannot get SOL-YOT exchange rate from blockchain");
      return rate;
    } else if (fromToken.symbol === "YOT" && toToken.symbol === "SOL") {
      const rate = exchangeRates.yotToSol;
      if (!rate || rate <= 0) throw new Error("Cannot get YOT-SOL exchange rate from blockchain");
      return rate;
    } else if (fromToken.symbol === "USDC" && toToken.symbol === "YOT") {
      const rate = exchangeRates.usdcToYot;
      if (!rate || rate <= 0) throw new Error("Cannot get USDC-YOT exchange rate from blockchain");
      return rate;
    } else if (fromToken.symbol === "YOT" && toToken.symbol === "USDC") {
      const rate = exchangeRates.yotToUsdc;
      if (!rate || rate <= 0) throw new Error("Cannot get YOT-USDC exchange rate from blockchain");
      return rate;
    }
    throw new Error(`Swap pair not supported: ${fromToken.symbol} to ${toToken.symbol}`);
  };

  // Old rate estimation, now replaced by fetchExchangeRate function

  // Swap tokens function
  const swapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount(toAmount);
    // toAmount will be updated by the useEffect
  };

  // Fetch exchange rate with real blockchain data
  const fetchExchangeRate = async () => {
    if (wallet && wallet.publicKey && fromToken && toToken) {
      try {
        console.log("Fetching exchange rate with wallet:", wallet.publicKey.toString());
        console.log(`Getting rate for ${fromToken.symbol} to ${toToken.symbol}`);
        
        // Currently our AMM only supports SOL-YOT pairs directly
        // So we need to check if we're dealing with that pair
        if ((fromToken.symbol === "SOL" && toToken.symbol === "YOT") || 
            (fromToken.symbol === "YOT" && toToken.symbol === "SOL")) {
          
          // Get the exchange rates directly from blockchain AMM data
          const rates = await getExchangeRate();
          
          // Calculate the specific rate for this token pair
          let rate = 0;
          if (fromToken.symbol === "SOL" && toToken.symbol === "YOT") {
            rate = rates.solToYot;
          } else if (fromToken.symbol === "YOT" && toToken.symbol === "SOL") {
            rate = rates.yotToSol;
          }
          
          // Check for zero rate which would indicate an error
          if (rate <= 0) {
            throw new Error("Invalid exchange rate: Rate must be greater than zero");
          }
          
          console.log(`Real AMM exchange rate from blockchain: 1 ${fromToken.symbol} = ${rate} ${toToken.symbol}`);
          
          // Update display text for the rate - use the exact AMM rate from blockchain, no rounding
          let rateDisplay = `1 ${fromToken.symbol} = ${rate} ${toToken.symbol} (AMM)`;
          setExchangeRateDisplay(rateDisplay);
          
          // Update the to amount based on real exchange rate
          if (fromAmount && parseFloat(fromAmount) > 0) {
            const calculated = parseFloat(fromAmount) * rate;
            console.log(`Calculated output: ${parseFloat(fromAmount)} ${fromToken.symbol} * ${rate} = ${calculated} ${toToken.symbol}`);
            setToAmount(calculated.toFixed(calculated < 0.1 ? 6 : 2));
          } else {
            setToAmount("");
          }
        } else {
          // For unsupported pairs, throw an error - no fallbacks
          throw new Error(`Swap pair not supported: ${fromToken.symbol} to ${toToken.symbol}`);
        }
      } catch (error) {
        console.error("Error fetching exchange rate:", error);
        // No fallbacks - show error to user
        setExchangeRateDisplay(`Error: Cannot get rate from blockchain`);
        setToAmount("");
        
        // Display toast alert about the issue
        toast({
          title: "Exchange Rate Error",
          description: error instanceof Error ? error.message : "Failed to fetch exchange rates from blockchain",
          variant: "destructive",
          duration: 5000
        });
      }
    } else {
      console.warn("Cannot fetch exchange rate: wallet not connected or tokens not selected", 
        { wallet: !!wallet, publicKey: !!wallet?.publicKey, fromToken: !!fromToken, toToken: !!toToken });
      setToAmount("");
    }
  };

  // Update exchange rate when tokens change
  useEffect(() => {
    fetchExchangeRate();
  }, [fromToken, toToken, wallet]);
  
  // Update to amount when from amount changes
  useEffect(() => {
    if (fromAmount && parseFloat(fromAmount) > 0) {
      fetchExchangeRate();
    } else {
      setToAmount("");
    }
  }, [fromAmount, fromToken, toToken]);
  
  // Function to refresh token balances
  const refreshBalances = async () => {
    if (!wallet || !wallet.publicKey) return;
    
    try {
      // Refresh balances for tokens the user is interested in
      await Promise.all([
        getTokenBalance(wallet, fromToken.address),
        getTokenBalance(wallet, toToken.address),
        getTokenBalance(wallet, YOT_TOKEN_ADDRESS)
      ]);
      
      // Force UI update by changing state
      setRefreshTrigger(prev => !prev);
    } catch (error) {
      console.error("Error refreshing balances:", error);
    }
  };

  // Execute the swap transaction
  const performSwap = async () => {
    if (!wallet || !wallet.publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to perform this action",
        variant: "destructive",
      });
      return;
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount to swap",
        variant: "destructive",
      });
      return;
    }

    // Check if swap is supported
    if (!isSwapSupported(fromToken.address, toToken.address)) {
      toast({
        title: "Unsupported swap pair",
        description: `Swapping from ${fromToken.symbol} to ${toToken.symbol} is not currently supported`,
        variant: "destructive",
      });
      return;
    }

    // Check wallet balance
    const balance = await getTokenBalance(wallet, fromToken.address);
    if (balance < parseFloat(fromAmount)) {
      toast({
        title: "Insufficient balance",
        description: `You only have ${balance.toFixed(4)} ${fromToken.symbol} available`,
        variant: "destructive",
      });
      return;
    }

    setSwapLoading(true);
    try {
      console.log("🔄 Starting swap process...");
      console.log(`🔍 From: ${parseFloat(fromAmount)} ${fromToken.symbol} (${fromToken.address})`);
      console.log(`🔍 To: ${toToken.symbol} (${toToken.address})`);
      console.log(`🔍 Slippage: ${parseFloat(slippage)}%`);
      
      // Get expected output (for debug purposes)
      const { getExpectedOutput } = await import('@/lib/multi-hub-swap-contract');
      const expectation = await getExpectedOutput(
        fromToken.address,
        toToken.address,
        parseFloat(fromAmount),
        parseFloat(slippage)
      );
      console.log(`📈 Exchange rate: 1 ${fromToken.symbol} = ${expectation.exchangeRate} ${toToken.symbol}`);
      console.log(`📊 Expected output: ${expectation.outputAmount} ${toToken.symbol}`);
      
      // Execute the swap using our swap router
      const result = await executeSwap(
        wallet,
        fromToken.address,
        toToken.address,
        parseFloat(fromAmount),
        parseFloat(slippage)
      );

      // Display success message with distribution details
      if (result.distributionDetails) {
        toast({
          title: "Swap successful!",
          description: (
            <div className="flex flex-col gap-1">
              <p>Transaction ID: {result.signature.slice(0, 8)}...{result.signature.slice(-8)}</p>
              <p>
                Received: {result.distributionDetails.userReceived.toFixed(2)} {toToken.symbol} ({DEFAULT_DISTRIBUTION_RATES.userDistribution}%)
              </p>
              <p>
                LP Contribution: {result.distributionDetails.liquidityContribution.toFixed(2)} {toToken.symbol} ({DEFAULT_DISTRIBUTION_RATES.lpContribution}%)
              </p>
              <p>
                YOS Cashback: {result.distributionDetails.yosCashback.toFixed(2)} YOS ({DEFAULT_DISTRIBUTION_RATES.yosCashback}%)
              </p>
              <a 
                href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                View on Explorer
              </a>
            </div>
          ),
        });

        // Refresh contribution info after successful swap
        try {
          const info = await getLiquidityContributionInfo(wallet.publicKey.toString());
          setContributionInfo(info);
        } catch (err) {
          console.error("Error refreshing contribution info:", err);
          // Continue without refreshing - don't break the UI on this error
        }
      } else {
        toast({
          title: "Swap successful!",
          description: (
            <div className="flex flex-col gap-1">
              <p>Transaction ID: {result.signature.slice(0, 8)}...{result.signature.slice(-8)}</p>
              <p>
                Received: {result.outputAmount.toFixed(4)} {toToken.symbol}
              </p>
              <a 
                href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                View on Explorer
              </a>
            </div>
          ),
        });
      }
      
      // Refresh token balances after successful swap
      try {
        await refreshBalances();
      } catch (err) {
        console.error("Error refreshing balances after swap:", err);
        // Continue without refreshing - don't break the UI on this error
      }
    } catch (error: any) {
      toast({
        title: "Swap failed",
        description: error.message || "An error occurred during the swap",
        variant: "destructive",
      });
      console.error("Swap error:", error);
    } finally {
      setSwapLoading(false);
    }
  };

  // Claim rewards function
  const claimRewards = async () => {
    if (!wallet || !wallet.publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to perform this action",
        variant: "destructive",
      });
      return;
    }

    setClaimLoading(true);
    try {
      // Use distributeWeeklyYosReward to automatically send rewards
      const result = await distributeWeeklyYosReward(
        wallet, 
        wallet.publicKey.toString()
      );

      toast({
        title: "Rewards claimed successfully!",
        description: (
          <div className="flex flex-col gap-1">
            <p>Received {result.distributedAmount.toFixed(4)} YOS</p>
            <a 
              href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              View on Explorer
            </a>
          </div>
        ),
      });

      // Refresh contribution info after claiming
      const info = await getLiquidityContributionInfo(wallet.publicKey.toString());
      setContributionInfo(info);
    } catch (error: any) {
      toast({
        title: "Failed to claim rewards",
        description: error.message || "An error occurred while claiming rewards",
        variant: "destructive",
      });
    } finally {
      setClaimLoading(false);
    }
  };

  // Withdraw liquidity function
  const withdrawLiquidity = async () => {
    if (!wallet || !wallet.publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to perform this action",
        variant: "destructive",
      });
      return;
    }

    if (contributionInfo.contributedAmount <= 0) {
      toast({
        title: "No liquidity to withdraw",
        description: "You don't have any liquidity contributions to withdraw",
        variant: "destructive",
      });
      return;
    }

    setWithdrawLoading(true);
    try {
      const result = await withdrawLiquidityContribution(wallet);

      toast({
        title: "Liquidity withdrawn successfully!",
        description: (
          <div className="flex flex-col gap-1">
            <p>Withdrawn {result.withdrawnAmount.toFixed(4)} YOT</p>
            <a 
              href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              View on Explorer
            </a>
          </div>
        ),
      });

      // Refresh contribution info after withdrawing
      const info = await getLiquidityContributionInfo(wallet.publicKey.toString());
      setContributionInfo(info);
    } catch (error: any) {
      toast({
        title: "Failed to withdraw liquidity",
        description: error.message || "An error occurred while withdrawing liquidity",
        variant: "destructive",
      });
    } finally {
      setWithdrawLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-[450px] bg-card shadow-lg border-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Multi-Hub Swap
          </div>
          <div className="flex gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => {
                      const fetchRates = async () => {
                        try {
                          // Fetch fresh rates from blockchain
                          const rates = await getExchangeRate();
                          setExchangeRates({
                            solToYot: rates.solToYot,
                            yotToSol: rates.yotToSol,
                            usdcToYot: 0,
                            yotToUsdc: 0
                          });
                          setExchangeRateDisplay(`1 ${fromToken.symbol} = ${
                            fromToken.symbol === "SOL" && toToken.symbol === "YOT" ? rates.solToYot :
                            fromToken.symbol === "YOT" && toToken.symbol === "SOL" ? rates.yotToSol : 0
                          } ${toToken.symbol} (updated)`);
                          
                          toast({
                            title: "Rates Updated",
                            description: "Exchange rates refreshed from blockchain",
                          });
                        } catch (error) {
                          console.error("Failed to refresh rates:", error);
                          setExchangeRateDisplay("Error: Failed to update rates from blockchain");
                          
                          toast({
                            title: "Error Refreshing Rates",
                            description: error instanceof Error ? error.message : "Failed to fetch current exchange rates",
                            variant: "destructive"
                          });
                        }
                      };
                      
                      fetchRates();
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh Exchange Rates from Blockchain</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Shield className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Smart Contract Protected</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardTitle>
        <CardDescription>
          Swap any token with SOL, YOT and more. Earn YOS rewards.
        </CardDescription>
      </CardHeader>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-2 mx-6">
          <TabsTrigger value="swap">
            <ArrowDownUp className="h-4 w-4 mr-2" />
            Swap
          </TabsTrigger>
          <TabsTrigger value="liquidity">
            <Droplet className="h-4 w-4 mr-2" />
            Liquidity
          </TabsTrigger>
          <TabsTrigger value="rewards">
            <CircleDollarSign className="h-4 w-4 mr-2" />
            Rewards
          </TabsTrigger>
        </TabsList>

        {/* SWAP TAB */}
        <TabsContent value="swap" className="pt-2">
          <CardContent>
            <div className="space-y-4">
              {/* From token */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="from-amount">From</Label>
                  {wallet?.publicKey && (
                    <BalanceDisplay 
                      wallet={wallet} 
                      tokenAddress={fromToken.address} 
                      symbol={fromToken.symbol} 
                      refreshTrigger={refreshTrigger} 
                    />
                  )}
                </div>

                <div className="flex space-x-2">
                  <div className="relative flex-grow">
                    <Input
                      id="from-amount"
                      placeholder="0.00"
                      className="pr-20"
                      type="number"
                      min="0"
                      step="0.01"
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                    />
                    <div className="absolute right-2 top-2.5">
                      <MaxBalanceButton 
                        wallet={wallet} 
                        tokenAddress={fromToken.address} 
                        setAmount={setFromAmount} 
                      />
                    </div>
                  </div>

                  <Select
                    value={fromToken.symbol}
                    onValueChange={(value) => {
                      const token = tokens.find((t) => t.symbol === value);
                      if (token) setFromToken(token);
                    }}
                  >
                    <SelectTrigger className="w-[110px]">
                      <SelectValue placeholder="Token" />
                    </SelectTrigger>
                    <SelectContent>
                      {tokens
                        .filter((t) => t.symbol !== toToken.symbol)
                        .map((token) => (
                          <SelectItem key={token.symbol} value={token.symbol}>
                            <div className="flex items-center">
                              <img
                                src={token.logoUrl}
                                alt={token.symbol}
                                className="h-5 w-5 mr-2 rounded-full"
                              />
                              {token.symbol}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Swap button */}
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20"
                  onClick={swapTokens}
                >
                  <ArrowDown className="h-5 w-5 text-primary" />
                </Button>
              </div>

              {/* To token */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="to-amount">To (estimated)</Label>
                  {toToken.symbol === "YOT" && (
                    <div className="flex items-center space-x-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded px-2 py-0.5">
                      <CircleDollarSign className="h-3 w-3" />
                      <span>+5% YOS Cashback</span>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <div className="relative flex-grow">
                    <Input
                      id="to-amount"
                      placeholder="0.00"
                      className={`${
                        toToken.symbol === "YOT" ? "border-primary" : ""
                      }`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={toAmount}
                      readOnly
                    />
                    {toToken.symbol === "YOT" && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="absolute right-2 top-2 h-5 text-xs px-1.5 bg-primary/10 hover:bg-primary/20 border-primary/20"
                            >
                              +LP
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>20% added to liquidity pool</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>

                  <Select
                    value={toToken.symbol}
                    onValueChange={(value) => {
                      const token = tokens.find((t) => t.symbol === value);
                      if (token) setToToken(token);
                    }}
                  >
                    <SelectTrigger className="w-[110px]">
                      <SelectValue placeholder="Token" />
                    </SelectTrigger>
                    <SelectContent>
                      {tokens
                        .filter((t) => t.symbol !== fromToken.symbol)
                        .map((token) => (
                          <SelectItem key={token.symbol} value={token.symbol}>
                            <div className="flex items-center">
                              <img
                                src={token.logoUrl}
                                alt={token.symbol}
                                className="h-5 w-5 mr-2 rounded-full"
                              />
                              {token.symbol}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Exchange rate info with improved error display */}
              <div className="text-sm text-muted-foreground flex justify-between">
                {(() => {
                  // If we have an explicit rate display, use it
                  if (exchangeRateDisplay) {
                    return exchangeRateDisplay.includes('Error') ? (
                      <span className="text-red-500 flex items-center">
                        <AlertCircle className="h-3.5 w-3.5 mr-1" />
                        {exchangeRateDisplay}
                      </span>
                    ) : (
                      <span>{exchangeRateDisplay}</span>
                    );
                  }
                  
                  // Otherwise try to calculate it, but catch errors
                  try {
                    const rate = estimateExchangeRate();
                    return <span>1 {fromToken.symbol} = {rate} {toToken.symbol}</span>;
                  } catch (error) {
                    return (
                      <span className="text-red-500 flex items-center">
                        <AlertCircle className="h-3.5 w-3.5 mr-1" />
                        Error: Rate unavailable
                      </span>
                    );
                  }
                })()}
                <span>
                  Slippage:{" "}
                  <span className="font-medium text-foreground">{slippage}%</span>
                </span>
              </div>

              {/* Swap benefits info */}
              {toToken.symbol === "YOT" && (
                <div className="bg-secondary/30 rounded-lg p-3 text-sm">
                  <div className="font-medium mb-1">Smart Contract Benefits:</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center p-2 bg-white/5 rounded-md">
                      <span className="text-xs text-muted-foreground">You Get</span>
                      <span className="font-medium text-primary">75%</span>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-white/5 rounded-md">
                      <span className="text-xs text-muted-foreground">To Liquidity</span>
                      <span className="font-medium text-blue-500">20%</span>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-white/5 rounded-md">
                      <span className="text-xs text-muted-foreground">YOS Cashback</span>
                      <span className="font-medium text-green-500">5%</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Button
                  className="w-full"
                  disabled={!fromAmount || parseFloat(fromAmount) <= 0 || swapLoading || !wallet?.publicKey}
                  onClick={(e) => {
                    e.preventDefault();
                    performSwap();
                  }}
                >
                  {swapLoading ? (
                    <div className="flex items-center">
                      <span className="animate-spin mr-2">
                        <Repeat className="h-4 w-4" />
                      </span>
                      Swapping...
                    </div>
                  ) : !wallet?.publicKey ? (
                    "Connect Wallet"
                  ) : (
                    "Swap"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </TabsContent>

        {/* LIQUIDITY TAB */}
        <TabsContent value="liquidity" className="pt-2">
          <CardContent>
            <div className="space-y-4">
              <div className="bg-primary/5 p-4 rounded-lg">
                <h3 className="font-medium text-lg mb-3">Your Liquidity Contribution</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Contributed</span>
                    <span className="font-medium text-lg">{contributionInfo.contributedAmount.toFixed(4)} YOT</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">YOS Rewards Claimed</span>
                    <span className="font-medium">{contributionInfo.totalClaimedYos.toFixed(4)} YOS</span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Annual APR</span>
                    <span className="font-medium text-green-500">100%</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Weekly Reward Rate</span>
                    <span className="font-medium">1.92% (52 weeks)</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Next Reward</span>
                    <span className="font-medium">
                      {contributionInfo.estimatedWeeklyReward.toFixed(4)} YOS
                    </span>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Label className="text-muted-foreground">Time until next reward</Label>
                    {contributionInfo.canClaimReward ? (
                      <div className="text-green-500 font-medium">Ready to claim!</div>
                    ) : contributionInfo.nextClaimAvailable ? (
                      <div className="space-y-1">
                        <Progress value={getTimeProgressValue(contributionInfo.nextClaimAvailable)} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          {getTimeRemaining(contributionInfo.nextClaimAvailable)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">N/A</div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    disabled={contributionInfo.contributedAmount <= 0 || withdrawLoading || !wallet?.publicKey}
                    onClick={withdrawLiquidity}
                  >
                    {withdrawLoading ? (
                      <span className="animate-spin mr-2">
                        <Repeat className="h-4 w-4" />
                      </span>
                    ) : (
                      <Wallet className="h-4 w-4 mr-2" />
                    )}
                    Withdraw
                  </Button>
                  
                  <Button 
                    disabled={!contributionInfo.canClaimReward || claimLoading || !wallet?.publicKey}
                    onClick={claimRewards}
                  >
                    {claimLoading ? (
                      <span className="animate-spin mr-2">
                        <Repeat className="h-4 w-4" />
                      </span>
                    ) : (
                      <CoinsIcon className="h-4 w-4 mr-2" />
                    )}
                    Claim Rewards
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-lg border mt-2">
                <h3 className="font-medium text-base mb-2">How Liquidity Contributions Work</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span>20% of every YOT swap is automatically added to the liquidity pool.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span>You earn 100% APR on your contribution, paid weekly in YOS tokens.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span>Rewards are automatically sent to your wallet every 7 days.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span>You can withdraw your full contribution at any time.</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </TabsContent>

        {/* REWARDS TAB */}
        <TabsContent value="rewards" className="pt-2">
          <CardContent>
            <div className="space-y-4">
              <div className="bg-primary/5 p-4 rounded-lg">
                <h3 className="font-medium text-lg mb-3">YOS Rewards</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Weekly Rate</span>
                    <span className="font-medium">1.92%</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Annual APR</span>
                    <span className="font-medium text-green-500">100%</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Next Reward</span>
                    <span className="font-medium">
                      {contributionInfo.estimatedWeeklyReward.toFixed(4)} YOS
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">YOS Earned (Total)</span>
                    <span className="font-medium">{contributionInfo.totalClaimedYos.toFixed(4)} YOS</span>
                  </div>

                  <Separator />

                  <div className="flex flex-col space-y-2">
                    <Label className="text-muted-foreground">Time until next reward</Label>
                    {contributionInfo.canClaimReward ? (
                      <div className="text-green-500 font-medium">Ready to claim!</div>
                    ) : contributionInfo.nextClaimAvailable ? (
                      <div className="space-y-1">
                        <Progress value={getTimeProgressValue(contributionInfo.nextClaimAvailable)} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          {getTimeRemaining(contributionInfo.nextClaimAvailable)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">N/A</div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t">
                  <Button 
                    className="w-full"
                    disabled={!contributionInfo.canClaimReward || claimLoading || !wallet?.publicKey}
                    onClick={claimRewards}
                  >
                    {claimLoading ? (
                      <div className="flex items-center">
                        <span className="animate-spin mr-2">
                          <Repeat className="h-4 w-4" />
                        </span>
                        Processing...
                      </div>
                    ) : !wallet?.publicKey ? (
                      "Connect Wallet"
                    ) : !contributionInfo.canClaimReward ? (
                      "Next Reward Pending"
                    ) : (
                      "Claim YOS Rewards"
                    )}
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-lg border mt-2">
                <h3 className="font-medium text-base mb-2">Dual Rewards System</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    <span>5% YOS cashback on every YOT swap transaction</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    <span>100% APR on liquidity contributions paid in YOS</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    <span>Auto-distribution to your wallet every 7 days</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    <span>Rewards are calculated and tracked by smart contract</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </TabsContent>
      </Tabs>

      <CardFooter className="flex flex-col pt-1 pb-4">
        <div className="w-full text-xs text-muted-foreground flex justify-between">
          <span>
            Auto YOS distribution | 100% APR
          </span>
          <span>
            Powered by Smart Contract
          </span>
        </div>
      </CardFooter>
    </Card>
  );
};

// Helper function to calculate progress value for time progress bar
function getTimeProgressValue(nextClaimTimeISO: string): number {
  const nextClaimTime = new Date(nextClaimTimeISO).getTime();
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const lastClaimTime = nextClaimTime - sevenDaysMs;
  const progress = ((now - lastClaimTime) / sevenDaysMs) * 100;
  return Math.min(Math.max(progress, 0), 100);
}

// Helper function to format time remaining until next claim
function getTimeRemaining(nextClaimTimeISO: string): string {
  const nextClaimTime = new Date(nextClaimTimeISO).getTime();
  const now = Date.now();
  const diffMs = nextClaimTime - now;
  
  if (diffMs <= 0) return "Available now";
  
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
  
  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else {
    return `${minutes}m remaining`;
  }
}

// MAX button component that sets the input to the user's maximum balance
const MaxBalanceButton = ({ 
  wallet, 
  tokenAddress, 
  setAmount 
}: { 
  wallet: any, 
  tokenAddress: string, 
  setAmount: (amount: string) => void 
}) => {
  const [loading, setLoading] = useState(false);

  const handleMaxClick = async () => {
    if (!wallet || !wallet.publicKey) return;
    
    try {
      setLoading(true);
      const balance = await getTokenBalance(wallet, tokenAddress);
      
      // If it's SOL, leave some for gas fees
      let maxAmount = balance;
      if (tokenAddress === SOL_TOKEN_ADDRESS && balance > 0.01) {
        maxAmount = balance - 0.01; // Reserve 0.01 SOL for transaction fees
      }
      
      setAmount(maxAmount.toString());
    } catch (error) {
      console.error("Error fetching max balance:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-5 text-xs px-1.5"
      onClick={handleMaxClick}
      disabled={loading}
    >
      {loading ? <span className="animate-pulse">...</span> : "MAX"}
    </Button>
  );
};

// Component to display real-time token balance from blockchain
const BalanceDisplay = ({ 
  wallet, 
  tokenAddress, 
  symbol, 
  refreshTrigger 
}: { 
  wallet: any, 
  tokenAddress: string, 
  symbol: string, 
  refreshTrigger?: boolean 
}) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true); // Reset loading state when wallet or token changes
    setBalance(null);  // Reset balance when wallet or token changes
    
    const fetchBalance = async () => {
      if (wallet && wallet.publicKey) {
        try {
          console.log(`Fetching balance for ${symbol} (${tokenAddress.slice(0, 4)}...${tokenAddress.slice(-4)})`);
          const tokenBalance = await getTokenBalance(wallet, tokenAddress);
          console.log(`Balance for ${symbol}: ${tokenBalance}`);
          setBalance(tokenBalance);
        } catch (error) {
          console.error(`Error fetching ${symbol} balance:`, error);
        } finally {
          setLoading(false);
        }
      } else {
        console.log("Cannot fetch balance: wallet not connected");
        setLoading(false);
      }
    };

    fetchBalance();
    // Set up an interval to refresh the balance every 15 seconds
    const intervalId = setInterval(fetchBalance, 15000);
    
    return () => clearInterval(intervalId);
  }, [wallet, tokenAddress, symbol, refreshTrigger]);

  return (
    <Label className="text-xs text-muted-foreground">
      Balance: {loading ? (
        <span className="animate-pulse">...</span>
      ) : balance !== null ? (
        `${balance.toFixed(balance < 0.01 ? 6 : 4)} ${symbol}`
      ) : (
        "Error"
      )}
    </Label>
  );
};

export default MultiHubSwapCard;