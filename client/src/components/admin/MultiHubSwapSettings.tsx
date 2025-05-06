import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Cog, 
  PercentIcon, 
  RefreshCw, 
  Key, 
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Settings,
  Save,
  ExternalLink,
  Copy,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PublicKey } from "@solana/web3.js";
import { 
  getMultiHubSwapStats, 
  updateMultiHubSwapParameters,
  initializeMultiHubSwap
} from "@/lib/multi-hub-swap-contract";
import { 
  solanaConfig,
  MULTI_HUB_SWAP_PROGRAM_ID,
  YOT_TOKEN_ADDRESS,
  YOS_TOKEN_ADDRESS,
  MULTI_HUB_SWAP_ADMIN
} from "@/lib/config";

interface MultiHubSwapSettingsProps {
  wallet: any;
  isAdmin: boolean;
}

const MultiHubSwapSettings: React.FC<MultiHubSwapSettingsProps> = ({ 
  wallet,
  isAdmin 
}) => {
  const { toast } = useToast();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("parameters");
  
  // Parameter states
  const [lpContributionRate, setLpContributionRate] = useState<number>(20);
  const [adminFeeRate, setAdminFeeRate] = useState<number>(0.1);
  const [yosCashbackRate, setYosCashbackRate] = useState<number>(5);
  const [swapFeeRate, setSwapFeeRate] = useState<number>(0.3);
  const [referralRate, setReferralRate] = useState<number>(0.5);
  
  // Liquidity threshold settings
  const [liquidityThreshold, setLiquidityThreshold] = useState<number>(0.1);
  const [isUpdatingThreshold, setIsUpdatingThreshold] = useState<boolean>(false);
  
  // Fetch contract info on component mount and when wallet changes
  useEffect(() => {
    if (wallet) {
      fetchContractInfo();
    }
  }, [wallet]);
  
  // Fetch admin settings on load
  useEffect(() => {
    fetchAdminSettings();
  }, []);
  
  // Fetch admin settings from the server
  const fetchAdminSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings');
      if (response.ok) {
        const settings = await response.json();
        // Set liquidity threshold from admin settings
        if (settings.liquidityThreshold) {
          setLiquidityThreshold(settings.liquidityThreshold);
        }
      }
    } catch (error) {
      console.error("Error fetching admin settings:", error);
    }
  };

  // Initialize the Multi-Hub Swap contract
  const initializeContract = async () => {
    if (!wallet || !wallet.publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to initialize the contract",
        variant: "destructive",
      });
      return;
    }

    if (!isAdmin) {
      toast({
        title: "Unauthorized",
        description: "Only admin users can initialize the contract",
        variant: "destructive",
      });
      return;
    }

    setIsInitializing(true);
    try {
      // Enhanced logging for debugging
      console.log("================ CONTRACT INITIALIZATION ================");
      console.log("Admin wallet address:", wallet.publicKey.toString());
      console.log("Expected admin address:", solanaConfig.multiHubSwap.admin);
      console.log("Program ID:", solanaConfig.multiHubSwap.programId);
      
      const yotMint = new PublicKey(solanaConfig.tokens.yot.address);
      const yosMint = new PublicKey(solanaConfig.tokens.yos.address);
      console.log("YOT mint address:", yotMint.toString());
      console.log("YOS mint address:", yosMint.toString());
      
      // PDA verification - use findProgramStateAddress helper function
      const [programStateAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("state")],
        new PublicKey(solanaConfig.multiHubSwap.programId)
      );
      console.log("Program state PDA:", programStateAddress.toString());
      console.log("Expected program state from config:", solanaConfig.multiHubSwap.programState);
      
      // Use rates directly from config
      const lpRate = solanaConfig.multiHubSwap.rates.lpContributionRate / 100;
      const adminRate = solanaConfig.multiHubSwap.rates.adminFeeRate / 100;
      const cashbackRate = solanaConfig.multiHubSwap.rates.yosCashbackRate / 100;
      const swapRate = solanaConfig.multiHubSwap.rates.swapFeeRate / 100;
      const refRate = solanaConfig.multiHubSwap.rates.referralRate / 100;
      
      // Display parameters
      console.log("Initialization parameters:");
      console.log(`- LP Contribution Rate: ${lpRate * 100}%`);
      console.log(`- Admin Fee Rate: ${adminRate * 100}%`);
      console.log(`- YOS Cashback Rate: ${cashbackRate * 100}%`);
      console.log(`- Swap Fee Rate: ${swapRate * 100}%`);
      console.log(`- Referral Rate: ${refRate * 100}%`);
      console.log("==================================================");
      
      // Get the common wallet address from config
      const commonWalletAddress = new PublicKey(solanaConfig.multiHubSwap.commonWallet.wallet);
      const liquidityThreshold = solanaConfig.multiHubSwap.commonWallet.threshold;
      
      console.log(`- Common Wallet Address: ${commonWalletAddress.toString()}`);
      console.log(`- Liquidity Threshold: ${liquidityThreshold} SOL`);
      console.log("==================================================");
      
      // Call the initialization function with all required parameters
      // This includes the common wallet address and threshold which are required by the Rust program
      await initializeMultiHubSwap(
        wallet,
        yotMint,
        yosMint,
        lpRate,
        adminRate,
        cashbackRate,
        swapRate,
        refRate,
        commonWalletAddress,
        liquidityThreshold
      );

      toast({
        title: "Contract initialized successfully",
        description: "The Multi-Hub Swap contract has been initialized on the blockchain",
      });

      // Refresh contract info
      await fetchContractInfo();
    } catch (error: any) {
      console.error("Contract initialization failed:", error);
      toast({
        title: "Failed to initialize contract",
        description: error.message || "An error occurred while initializing the contract",
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const fetchContractInfo = async () => {
    setIsLoading(true);
    try {
      console.log("Fetching MultiHubSwap contract info...");
      
      let localProgramState: any = null;
      
      try {
        // Try to get actual stats from blockchain
        const fetchedState = await getMultiHubSwapStats();
        console.log("MultiHubSwap programState received:", fetchedState);
        localProgramState = fetchedState;
        setStats(fetchedState);
        
        // Check if program is initialized
        // If the program returned an explicit initialization flag, use that
        // If the program didn't have an explicit flag, check if we successfully got program data with addresses
        const isInit = fetchedState && 
          (fetchedState.initialized !== undefined ? 
           fetchedState.initialized : !!fetchedState.yotMint);
          
        console.log("Is MultiHubSwap initialized?", isInit, 
          "yotMint:", fetchedState?.yotMint,
          "expected YOT:", solanaConfig.tokens.yot.address,
          "explicit initialized flag:", fetchedState?.initialized);
          
        setIsInitialized(!!isInit);
      } catch (error) {
        // If we can't get stats from blockchain, assume not initialized
        console.error("Error fetching program state, assuming not initialized:", error);
        const defaultState = {
          admin: solanaConfig.multiHubSwap.admin,
          yotMint: null,
          yosMint: solanaConfig.tokens.yos.address,
          lpContributionRate: solanaConfig.multiHubSwap.rates.lpContributionRate / 100,
          adminFeeRate: solanaConfig.multiHubSwap.rates.adminFeeRate / 100,
          yosCashbackRate: solanaConfig.multiHubSwap.rates.yosCashbackRate / 100,
          swapFeeRate: solanaConfig.multiHubSwap.rates.swapFeeRate / 100,
          referralRate: solanaConfig.multiHubSwap.rates.referralRate / 100
        };
        setStats(defaultState);
        localProgramState = defaultState;
        setIsInitialized(false);
      }
      
      // Update state with current parameters
      if (localProgramState) {
        setLpContributionRate(localProgramState.lpContributionRate);
        setAdminFeeRate(localProgramState.adminFeeRate);
        setYosCashbackRate(localProgramState.yosCashbackRate);
        setSwapFeeRate(localProgramState.swapFeeRate);
        setReferralRate(localProgramState.referralRate);
      }
    } catch (error) {
      console.error("Error fetching contract info:", error);
      // We need to set isInitialized to false in case of error
      setIsInitialized(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Save parameter changes
  const saveParameters = async () => {
    if (!wallet || !wallet.publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to update parameters",
        variant: "destructive",
      });
      return;
    }

    if (!isAdmin) {
      toast({
        title: "Unauthorized",
        description: "Only admin users can update parameters",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Validate parameters
      if (lpContributionRate < 0 || lpContributionRate > 90) {
        throw new Error("LP contribution rate must be between 0% and 90%");
      }
      
      if (yosCashbackRate < 0 || yosCashbackRate > 20) {
        throw new Error("YOS cashback rate must be between 0% and 20%");
      }
      
      if (adminFeeRate < 0 || adminFeeRate > 5) {
        throw new Error("Admin fee rate must be between 0% and 5%");
      }
      
      if (swapFeeRate < 0 || swapFeeRate > 3) {
        throw new Error("Swap fee rate must be between 0% and 3%");
      }
      
      if (referralRate < 0 || referralRate > 5) {
        throw new Error("Referral rate must be between 0% and 5%");
      }
      
      if (lpContributionRate + yosCashbackRate > 95) {
        throw new Error("Combined LP contribution and YOS cashback cannot exceed 95%");
      }

      // Verify user distribution percentage
      const userDistributionPercent = 100 - lpContributionRate - yosCashbackRate;
      if (userDistributionPercent < 5) {
        throw new Error("User must receive at least 5% of the swap amount");
      }

      // Call the update function
      await updateMultiHubSwapParameters(
        wallet,
        lpContributionRate,
        adminFeeRate,
        yosCashbackRate,
        swapFeeRate,
        referralRate
      );

      toast({
        title: "Parameters updated successfully",
        description: "The new parameters have been saved to the blockchain",
      });

      // Refresh contract info
      await fetchContractInfo();
    } catch (error: any) {
      toast({
        title: "Failed to update parameters",
        description: error.message || "An error occurred while updating parameters",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            Multi-Hub Swap Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading contract information...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            Multi-Hub Swap Settings
          </CardTitle>
          <CardDescription>
            Configure parameters for the Multi-Hub Swap contract
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              This section is restricted to admin users only.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="mr-2 h-5 w-5" />
          Multi-Hub Swap Administration
        </CardTitle>
        <CardDescription>
          Configure parameters and settings for the Multi-Hub Swap contract
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="parameters">
              <PercentIcon className="mr-2 h-4 w-4" />
              Parameters
            </TabsTrigger>
            <TabsTrigger value="liquidity">
              <Upload className="mr-2 h-4 w-4" />
              Liquidity
            </TabsTrigger>
            <TabsTrigger value="info">
              <Key className="mr-2 h-4 w-4" />
              Contract Info
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parameters" className="space-y-4">
            <div className="space-y-1">
              <h3 className="font-medium text-base">Distribution Parameters</h3>
              <p className="text-sm text-muted-foreground">
                Configure how tokens are distributed during swaps
              </p>
            </div>
            
            <Alert 
              className={isInitialized 
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/30 mb-4" 
                : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30 mb-4"}
            >
              {isInitialized 
                ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                : <Upload className="h-4 w-4 text-blue-600 dark:text-blue-500" />
              }
              <AlertTitle>
                {isInitialized 
                  ? "Contract Status: Initialized" 
                  : "Contract Initialization Required"}
              </AlertTitle>
              <AlertDescription className={isInitialized 
                ? "text-green-800 dark:text-green-400" 
                : "text-blue-800 dark:text-blue-400"}
              >
                <p className="mb-4">
                  {isInitialized 
                    ? "The Multi-Hub Swap contract is initialized and ready for use. You can re-initialize the contract if needed, such as when deploying to mainnet."
                    : "The Multi-Hub Swap contract needs to be initialized before you can configure parameters. Initialization will set up the token addresses and initial parameters."}
                </p>
                <div className="flex justify-end">
                  <Button 
                    onClick={initializeContract}
                    disabled={isInitializing || !wallet?.publicKey}
                    className={isInitialized 
                      ? "bg-green-600 hover:bg-green-700" 
                      : "bg-blue-600 hover:bg-blue-700"}
                  >
                    {isInitializing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Initializing...
                      </>
                    ) : (
                      <>
                        {isInitialized 
                          ? <RefreshCw className="mr-2 h-4 w-4" />
                          : <Upload className="mr-2 h-4 w-4" />
                        }
                        {isInitialized ? "Re-Initialize Contract" : "Initialize Contract"}
                      </>
                    )}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
            
            {isInitialized && (
              <>
                <Alert variant="default" className="bg-primary/5 border-primary/20">
                  <div className="flex justify-between items-center w-full">
                    <div>
                      <AlertTitle>Current Distribution</AlertTitle>
                      <AlertDescription>
                        User: <strong>{100 - lpContributionRate - yosCashbackRate}%</strong>,
                        LP: <strong>{lpContributionRate}%</strong>,
                        YOS Cashback: <strong>{yosCashbackRate}%</strong>
                      </AlertDescription>
                    </div>
                    <Progress 
                      value={100} 
                      className="h-3 w-40" 
                      style={{
                        background: `linear-gradient(to right, 
                          #3b82f6 0%, 
                          #3b82f6 ${100 - lpContributionRate - yosCashbackRate}%, 
                          #10b981 ${100 - lpContributionRate - yosCashbackRate}%, 
                          #10b981 ${100 - yosCashbackRate}%, 
                          #f97316 ${100 - yosCashbackRate}%, 
                          #f97316 100%)`
                      }}
                    />
                  </div>
                </Alert>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="lpContributionRate">
                      LP Contribution Rate (%)
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">?</span>
                          </TooltipTrigger>
                          <TooltipContent className="w-80">
                            <p>Percentage of the transaction amount that goes to the liquidity pool. Default: 20%</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="lpContributionRate"
                      type="number"
                      min="0"
                      max="90"
                      step="0.1"
                      value={lpContributionRate}
                      onChange={(e) => setLpContributionRate(parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="yosCashbackRate">
                      YOS Cashback Rate (%)
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">?</span>
                          </TooltipTrigger>
                          <TooltipContent className="w-80">
                            <p>Percentage of the transaction amount that gets minted as YOS tokens for cashback. Default: 5%</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="yosCashbackRate"
                      type="number"
                      min="0"
                      max="20"
                      step="0.1"
                      value={yosCashbackRate}
                      onChange={(e) => setYosCashbackRate(parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-1">
                  <h3 className="font-medium text-base">Fee Parameters</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure swap fees and referral rewards
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="swapFeeRate">
                      Swap Fee Rate (%)
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">?</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Fee charged on each swap. Default: 0.3%</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="swapFeeRate"
                      type="number"
                      min="0"
                      max="3"
                      step="0.01"
                      value={swapFeeRate}
                      onChange={(e) => setSwapFeeRate(parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminFeeRate">
                      Admin Fee Rate (%)
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">?</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Fee sent to admin wallet. Default: 0.1%</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="adminFeeRate"
                      type="number"
                      min="0"
                      max="5"
                      step="0.01"
                      value={adminFeeRate}
                      onChange={(e) => setAdminFeeRate(parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="referralRate">
                      Referral Rate (%)
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">?</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Percentage paid to referrers. Default: 0.5%</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="referralRate"
                      type="number"
                      min="0"
                      max="5"
                      step="0.01"
                      value={referralRate}
                      onChange={(e) => setReferralRate(parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Alert variant="default" className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-900/30">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                    <AlertTitle>Important Note</AlertTitle>
                    <AlertDescription className="text-yellow-800 dark:text-yellow-400">
                      The sum of LP Contribution Rate and YOS Cashback Rate cannot exceed 95%. 
                      Users must receive at least 5% of the swap amount.
                    </AlertDescription>
                  </Alert>
                </div>

                <div className="pt-4 flex justify-end">
                  <div className="space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={fetchContractInfo}
                      disabled={isSaving}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    <Button
                      onClick={saveParameters}
                      disabled={isSaving || !isInitialized || !wallet?.publicKey}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Parameters
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="info" className="space-y-4">
            <div className="space-y-1 mb-4">
              <h3 className="font-medium text-base">Contract Information</h3>
              <p className="text-sm text-muted-foreground">
                View technical information about the Multi-Hub Swap contract on the blockchain
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="flex flex-col space-y-2">
                  <Label>Program ID:</Label>
                  <div className="flex items-center">
                    <Input 
                      value={solanaConfig.multiHubSwap.programId} 
                      readOnly 
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2 h-8 w-8"
                      onClick={() => {
                        navigator.clipboard.writeText(solanaConfig.multiHubSwap.programId);
                        toast({
                          title: "Copied to clipboard",
                          description: "Program ID copied to clipboard",
                          duration: 3000,
                        });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-1 h-8 w-8"
                      onClick={() => {
                        window.open(
                          `${solanaConfig.explorerUrl}?cluster=${solanaConfig.network}&address=${solanaConfig.multiHubSwap.programId}`,
                          "_blank"
                        );
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-2">
                  <Label>Admin:</Label>
                  <div className="flex items-center">
                    <Input
                      value={stats?.admin || solanaConfig.multiHubSwap.admin}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2 h-8 w-8"
                      onClick={() => {
                        navigator.clipboard.writeText(stats?.admin || solanaConfig.multiHubSwap.admin);
                        toast({
                          title: "Copied to clipboard",
                          description: "Admin address copied to clipboard",
                          duration: 3000,
                        });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-1 h-8 w-8"
                      onClick={() => {
                        window.open(
                          `${solanaConfig.explorerUrl}?cluster=${solanaConfig.network}&address=${stats?.admin || solanaConfig.multiHubSwap.admin}`,
                          "_blank"
                        );
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-2">
                  <Label>YOT Mint:</Label>
                  <div className="flex items-center">
                    <Input
                      value={stats?.yotMint || solanaConfig.tokens.yot.address}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2 h-8 w-8"
                      onClick={() => {
                        navigator.clipboard.writeText(stats?.yotMint || solanaConfig.tokens.yot.address);
                        toast({
                          title: "Copied to clipboard",
                          description: "YOT mint address copied to clipboard",
                          duration: 3000,
                        });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-1 h-8 w-8"
                      onClick={() => {
                        window.open(
                          `${solanaConfig.explorerUrl}?cluster=${solanaConfig.network}&address=${stats?.yotMint || solanaConfig.tokens.yot.address}`,
                          "_blank"
                        );
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-2">
                  <Label>YOS Mint:</Label>
                  <div className="flex items-center">
                    <Input
                      value={stats?.yosMint || solanaConfig.tokens.yos.address}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2 h-8 w-8"
                      onClick={() => {
                        navigator.clipboard.writeText(stats?.yosMint || solanaConfig.tokens.yos.address);
                        toast({
                          title: "Copied to clipboard",
                          description: "YOS mint address copied to clipboard",
                          duration: 3000,
                        });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-1 h-8 w-8"
                      onClick={() => {
                        window.open(
                          `${solanaConfig.explorerUrl}?cluster=${solanaConfig.network}&address=${stats?.yosMint || solanaConfig.tokens.yos.address}`,
                          "_blank"
                        );
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-2">
                  <Label>Status:</Label>
                  <div className="flex items-center">
                    {isInitialized ? (
                      <div className="flex items-center text-green-600 dark:text-green-500">
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        <span>Initialized</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-amber-600 dark:text-amber-500">
                        <AlertCircle className="mr-2 h-4 w-4" />
                        <span>Not Initialized</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end mt-8">
                <Button 
                  variant="outline" 
                  onClick={fetchContractInfo}
                  disabled={isLoading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Contract Info
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="liquidity" className="space-y-4">
            <div className="space-y-1">
              <h3 className="font-medium text-base">Liquidity Management</h3>
              <p className="text-sm text-muted-foreground">
                Configure automatic liquidity addition from the central wallet
              </p>
            </div>
            
            <Alert 
              className={isInitialized 
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/30 mb-4" 
                : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30 mb-4"}
            >
              {isInitialized 
                ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                : <Upload className="h-4 w-4 text-blue-600 dark:text-blue-500" />
              }
              <AlertTitle>
                {isInitialized 
                  ? "Contract Status: Initialized" 
                  : "Contract Initialization Required"}
              </AlertTitle>
              <AlertDescription className={isInitialized 
                ? "text-green-800 dark:text-green-400" 
                : "text-blue-800 dark:text-blue-400"}
              >
                <p className="mb-4">
                  {isInitialized 
                    ? "The Multi-Hub Swap contract is initialized and liquidity management is available."
                    : "The Multi-Hub Swap contract needs to be initialized before you can manage liquidity."}
                </p>
                <div className="flex justify-end">
                  <Button 
                    onClick={initializeContract}
                    disabled={isInitializing || !wallet?.publicKey}
                    className={isInitialized 
                      ? "bg-green-600 hover:bg-green-700" 
                      : "bg-blue-600 hover:bg-blue-700"}
                  >
                    {isInitializing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Initializing...
                      </>
                    ) : (
                      <>
                        {isInitialized 
                          ? <RefreshCw className="mr-2 h-4 w-4" />
                          : <Upload className="mr-2 h-4 w-4" />
                        }
                        {isInitialized ? "Re-Initialize Contract" : "Initialize Contract"}
                      </>
                    )}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
            
            {isInitialized && (
              <div className="bg-secondary/30 p-4 rounded-lg space-y-3">
                <h4 className="font-medium text-sm">Liquidity Threshold Setting</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  When this amount of value accumulates in the central wallet, it will 
                  automatically be added to the liquidity pool (split 50/50 between SOL and YOT).
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label htmlFor="liquidityThreshold" className="text-sm">Threshold (SOL)</Label>
                    <div className="flex mt-1.5 space-x-2">
                      <Input 
                        id="liquidityThreshold"
                        type="number" 
                        min="0.01"
                        step="0.01"
                        value={liquidityThreshold} 
                        onChange={(e) => setLiquidityThreshold(parseFloat(e.target.value))}
                        className="flex-1"
                      />
                      <Button 
                        size="sm"
                        disabled={!isAdmin}
                        onClick={async () => {
                          setIsUpdatingThreshold(true);
                          try {
                            if (!isAdmin) {
                              throw new Error("Only admin can update liquidity threshold");
                            }
                            
                            // Call the API to update the threshold in the database
                            const response = await fetch('/api/admin/settings', {
                              method: 'PATCH',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({ 
                                liquidityThreshold: liquidityThreshold
                              }),
                            });
                            
                            if (!response.ok) {
                              const errorData = await response.json();
                              throw new Error(errorData.message || 'Failed to update threshold');
                            }
                            
                            toast({
                              title: "Threshold updated successfully",
                              description: `The liquidity threshold is now ${liquidityThreshold} SOL`,
                            });
                          } catch (error: any) {
                            console.error("Failed to update threshold:", error);
                            toast({
                              title: "Failed to update threshold",
                              description: error.message || "An error occurred",
                              variant: "destructive",
                            });
                          } finally {
                            setIsUpdatingThreshold(false);
                          }
                        }}
                      >
                        {isUpdatingThreshold ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          "Update Threshold"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="border-t pt-6 flex flex-col items-start">
        <p className="text-sm text-muted-foreground">
          Changes to swap parameters are immediately reflected in the smart contract. 
          User swap distribution, liquidity contribution, and YOS cashback rates must add up to 100%.
        </p>
      </CardFooter>
    </Card>
  );
};

export default MultiHubSwapSettings;