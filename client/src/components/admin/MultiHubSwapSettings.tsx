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
  ExternalLink
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
import { PublicKey } from '@solana/web3.js';
import { 
  getMultiHubSwapStats, 
  updateMultiHubSwapParameters,
  initializeMultiHubSwap,
  addLiquidityFromCentralWallet
} from "@/lib/multi-hub-swap-contract";
import {
  MULTI_HUB_SWAP_PROGRAM_ID,
  YOT_TOKEN_ADDRESS,
  YOS_TOKEN_ADDRESS
} from "@/lib/config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

  // Fetch contract info and admin settings on component mount
  useEffect(() => {
    fetchContractInfo();
    fetchAdminSettings();
  }, [wallet]);
  
  // Fetch admin settings including liquidity threshold
  const fetchAdminSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings');
      if (response.ok) {
        const settings = await response.json();
        if (settings && settings.liquidityThreshold) {
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
      console.log("MULTI_HUB_SWAP_PROGRAM_ID:", MULTI_HUB_SWAP_PROGRAM_ID);
      
      const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
      const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
      console.log("YOT mint address:", yotMint.toString());
      console.log("YOS mint address:", yosMint.toString());
      
      // PDA verification
      const [programStateAddress, stateBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("state")],
        new PublicKey(MULTI_HUB_SWAP_PROGRAM_ID)
      );
      console.log("Program state PDA:", programStateAddress.toString(), "with bump:", stateBump);
      
      // Display parameters
      console.log("Initialization parameters:");
      console.log(`- LP Contribution Rate: ${lpContributionRate}%`);
      console.log(`- Admin Fee Rate: ${adminFeeRate}%`);
      console.log(`- YOS Cashback Rate: ${yosCashbackRate}%`);
      console.log(`- Swap Fee Rate: ${swapFeeRate}%`);
      console.log(`- Referral Rate: ${referralRate}%`);
      console.log("==================================================");
      
      // Call the initialization function with YOT and YOS token addresses
      await initializeMultiHubSwap(
        wallet,
        yotMint,
        yosMint,
        lpContributionRate / 100, // Convert from percentage to decimal
        adminFeeRate / 100,
        yosCashbackRate / 100,
        swapFeeRate / 100,
        referralRate / 100
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
      const programState = await getMultiHubSwapStats();
      setStats(programState);
      
      // Check if program is initialized
      setIsInitialized(programState && !!programState.yotMint);
      
      // Update state with current parameters
      if (programState) {
        setLpContributionRate(programState.lpContributionRate);
        setAdminFeeRate(programState.adminFeeRate);
        setYosCashbackRate(programState.yosCashbackRate);
        setSwapFeeRate(programState.swapFeeRate);
        setReferralRate(programState.referralRate);
      }
    } catch (error) {
      console.error("Error fetching contract info:", error);
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
            
            {!isInitialized ? (
              <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30">
                <Upload className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                <AlertTitle>Contract Initialization Required</AlertTitle>
                <AlertDescription className="text-blue-800 dark:text-blue-400">
                  <p className="mb-4">
                    The Multi-Hub Swap contract needs to be initialized before you can configure parameters. 
                    Initialization will set up the token addresses and initial parameters.
                  </p>
                  <div className="flex justify-end">
                    <Button 
                      onClick={initializeContract}
                      disabled={isInitializing || !wallet?.publicKey}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isInitializing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Initializing...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Initialize Contract
                        </>
                      )}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
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

          <TabsContent value="liquidity" className="space-y-4">
            <div className="space-y-1">
              <h3 className="font-medium text-base">Centralized Liquidity Management</h3>
              <p className="text-sm text-muted-foreground">
                Manage the central liquidity wallet and pool contributions
              </p>
            </div>

            {!isInitialized ? (
              <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30">
                <Upload className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                <AlertTitle>Contract Initialization Required</AlertTitle>
                <AlertDescription className="text-blue-800 dark:text-blue-400">
                  <p className="mb-4">
                    The Multi-Hub Swap contract needs to be initialized before you can manage liquidity. 
                    Initialization will set up the token addresses and initial parameters.
                  </p>
                  <div className="flex justify-end">
                    <Button 
                      onClick={initializeContract}
                      disabled={isInitializing || !wallet?.publicKey}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isInitializing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Initializing...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Initialize Contract
                        </>
                      )}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="bg-secondary/30 p-4 rounded-lg space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-sm">Centralized Liquidity System</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        When users buy YOT, {lpContributionRate}% is sent to the central liquidity wallet.
                        Once sufficient balance is accumulated, it is automatically added to the liquidity pool.
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">Current Model:</span>
                      <div className="text-primary font-semibold">Central Liquidity</div>
                    </div>
                  </div>
                </div>

                <div className="bg-secondary/30 p-4 rounded-lg space-y-3 mb-4">
                  <h4 className="font-medium text-sm">Liquidity Threshold Setting</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="liquidityThreshold">
                        Auto-Add Threshold (in SOL)
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">?</span>
                            </TooltipTrigger>
                            <TooltipContent className="w-80">
                              <p>When this amount of SOL worth of YOT is accumulated in the central wallet, the system will automatically add liquidity to the pool.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="liquidityThreshold"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={liquidityThreshold}
                          onChange={(e) => setLiquidityThreshold(parseFloat(e.target.value))}
                          className="flex-grow"
                        />
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="whitespace-nowrap"
                          disabled={isUpdatingThreshold || !wallet?.publicKey}
                          onClick={async () => {
                            try {
                              setIsUpdatingThreshold(true);
                              
                              if (!wallet || !wallet.publicKey) {
                                throw new Error("Wallet not connected");
                              }
                              
                              if (!isAdmin) {
                                throw new Error("Only admin can update liquidity threshold");
                              }
                              
                              // Validate threshold value
                              if (liquidityThreshold < 0.01) {
                                throw new Error("Threshold must be at least 0.01 SOL");
                              }
                              
                              if (liquidityThreshold > 10) {
                                throw new Error("Threshold cannot exceed 10 SOL");
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
                      <p className="text-xs text-muted-foreground">
                        Current threshold: {liquidityThreshold} SOL worth of YOT
                      </p>
                    </div>
                  </div>
                </div>

                <Alert variant="default" className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30">
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="font-medium">Automatic Liquidity Addition</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={fetchContractInfo}
                      >
                        <RefreshCw className="mr-2 h-3.5 w-3.5" />
                        Refresh Status
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Current Threshold:</div>
                        <div className="text-sm font-medium">{liquidityThreshold} SOL worth of YOT</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Current Balance:</div>
                        <div className="text-sm font-medium">Fetching...</div>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mt-2">
                      When the central wallet balance exceeds the threshold (currently {liquidityThreshold} SOL), 
                      the system automatically adds liquidity to the pool using 50% SOL and 50% YOT.
                      This process happens automatically during swap operations.
                    </p>
                  </div>
                </Alert>

                <div className="pt-4">
                  <Alert variant="default" className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/30">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                    <AlertTitle>Important Information</AlertTitle>
                    <AlertDescription className="text-amber-800 dark:text-amber-400">
                      The central liquidity system aggregates {lpContributionRate}% of all YOT purchases into a single wallet.
                      When the wallet balance exceeds the threshold, the system automatically adds this liquidity to the pool
                      to improve market depth and trading capabilities.
                    </AlertDescription>
                  </Alert>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="info">
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-base mb-2">Contract Information</h3>
                <div className="bg-secondary/30 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-sm text-muted-foreground">Program ID:</div>
                    <div className="col-span-2 text-sm font-mono break-all flex items-center gap-1">
                      {MULTI_HUB_SWAP_PROGRAM_ID}
                      <a 
                        href={`https://explorer.solana.com/address/${MULTI_HUB_SWAP_PROGRAM_ID}?cluster=devnet`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-sm text-muted-foreground">Admin:</div>
                    <div className="col-span-2 text-sm font-mono break-all flex items-center gap-1">
                      {stats?.admin || "Not initialized"}
                      {stats?.admin && (
                        <a 
                          href={`https://explorer.solana.com/address/${stats.admin}?cluster=devnet`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-sm text-muted-foreground">YOT Mint:</div>
                    <div className="col-span-2 text-sm font-mono break-all flex items-center gap-1">
                      {stats?.yotMint || "Not initialized"}
                      {stats?.yotMint && (
                        <a 
                          href={`https://explorer.solana.com/address/${stats.yotMint}?cluster=devnet`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-sm text-muted-foreground">YOS Mint:</div>
                    <div className="col-span-2 text-sm font-mono break-all flex items-center gap-1">
                      {stats?.yosMint || "Not initialized"}
                      {stats?.yosMint && (
                        <a 
                          href={`https://explorer.solana.com/address/${stats.yosMint}?cluster=devnet`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-sm text-muted-foreground">Status:</div>
                    <div className="col-span-2">
                      {isInitialized ? (
                        <span className="flex items-center text-green-600">
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Initialized
                        </span>
                      ) : (
                        <span className="flex items-center text-amber-600">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Not Initialized
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {!isInitialized && (
                <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30">
                  <Upload className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                  <AlertTitle>Contract Initialization Required</AlertTitle>
                  <AlertDescription className="text-blue-800 dark:text-blue-400">
                    <p className="mb-4">
                      The Multi-Hub Swap contract needs to be initialized before it can be used. 
                      Initialization will set up the token addresses and initial parameters.
                    </p>
                    <div className="flex justify-end">
                      <Button 
                        onClick={initializeContract}
                        disabled={isInitializing || !wallet?.publicKey}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isInitializing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Initializing...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Initialize Contract
                          </>
                        )}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <h3 className="font-medium text-base mb-2">Current Parameters</h3>
                <div className="bg-secondary/30 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">LP Contribution:</span>
                      <span className="font-medium">{lpContributionRate}%</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">YOS Cashback:</span>
                      <span className="font-medium">{yosCashbackRate}%</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">User Receives:</span>
                      <span className="font-medium">{100 - lpContributionRate - yosCashbackRate}%</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Admin Fee:</span>
                      <span className="font-medium">{adminFeeRate}%</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Swap Fee:</span>
                      <span className="font-medium">{swapFeeRate}%</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Referral Rate:</span>
                      <span className="font-medium">{referralRate}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  variant="outline"
                  onClick={fetchContractInfo}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Contract Info
                </Button>
              </div>
            </div>
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