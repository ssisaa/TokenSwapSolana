import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { useStaking } from '@/hooks/useStaking';
import { Loader2, AlertTriangle, Flame, CoinsIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdminSettings } from '@/hooks/use-admin-settings';
import { initializeStakingProgram } from '@/lib/solana-staking';
import { fundProgramYosAccount, checkProgramYosBalance } from '@/lib/helpers/fund-program';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function StakingSettings() {
  const { connected, publicKey, wallet } = useMultiWallet();
  const { updateStakingSettingsMutation, stakingRates } = useStaking();
  const { toast } = useToast();
  const { updateSettings, isUpdating: isUpdatingDatabase, settings } = useAdminSettings();
  const isUpdatingParameters = updateStakingSettingsMutation.isPending;
  const [isInitializing, setIsInitializing] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [programYosBalance, setProgramYosBalance] = useState<number | null>(null);
  const [fundAmount, setFundAmount] = useState<string>('10.0');
  
  // State for form values - initialize with current values
  const [stakeRatePerSecond, setStakeRatePerSecond] = useState<string>('0.0000000125');
  const [stakeThreshold, setStakeThreshold] = useState<string>('10.0');
  const [unstakeThreshold, setUnstakeThreshold] = useState<string>('10.0');
  const [harvestThreshold, setHarvestThreshold] = useState<string>('1.0');
  
  // Default to the requested rate (1.25e-7) if needed and log what we're doing
  useEffect(() => {
    if (!stakingRates) {
      console.log('No staking rates available yet, using default rate: 0.0000000125');
      setStakeRatePerSecond('0.0000000125');
    } else {
      console.log('Staking rates available:', stakingRates);
    }
  }, [stakingRates]);
  
  // Track if staking rates have changed
  const [lastRatesSnapshot, setLastRatesSnapshot] = useState<string>('');
  
  React.useEffect(() => {
    if (stakingRates) {
      // Create a snapshot of current rates to detect changes
      const currentSnapshot = JSON.stringify({
        rate: stakingRates.stakeRatePerSecond,
        harvest: stakingRates.harvestThreshold
      });
      
      // If rates have changed from blockchain, update form values
      if (currentSnapshot !== lastRatesSnapshot) {
        console.log('Staking rates changed, updating form values:', stakingRates);
        
        // Format the rate with proper decimal notation instead of scientific notation
        const formattedRate = stakingRates.stakeRatePerSecond.toFixed(10).replace(/\.?0+$/, '');
        setStakeRatePerSecond(formattedRate);
        
        // Set the harvest threshold from blockchain values
        setHarvestThreshold(stakingRates.harvestThreshold.toString());
        
        // Update snapshot so we don't repeatedly update for same values
        setLastRatesSnapshot(currentSnapshot);
      }
    }
  }, [stakingRates, lastRatesSnapshot]);

  // Load stake and unstake thresholds from database
  React.useEffect(() => {
    if (settings) {
      if (settings.stakeThreshold !== undefined) {
        setStakeThreshold(settings.stakeThreshold.toString());
        console.log(`Setting stake threshold from database: ${settings.stakeThreshold}`);
      }
      
      if (settings.unstakeThreshold !== undefined) {
        setUnstakeThreshold(settings.unstakeThreshold.toString());
        console.log(`Setting unstake threshold from database: ${settings.unstakeThreshold}`);
      }
    }
  }, [settings]);
  
  // Validate admin status
  // In a real implementation, we would verify the admin's public key
  const isAdmin = connected && publicKey;
  
  // Convert staking rate from percentage per second to other formats
  const convertStakingRate = (ratePerSecond: number) => {
    const second = ratePerSecond;
    const hourly = second * 3600;
    const daily = hourly * 24;
    const yearly = daily * 365;
    
    return {
      second: second.toString(),
      hourly: hourly.toString(),
      daily: daily.toString(),
      yearly: yearly.toString()
    };
  };
  
  // Handle form submission for blockchain settings
  const handleBlockchainSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast({
        title: 'Authentication Required',
        description: 'You need to connect an admin wallet to update settings.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // We need to pass the raw percentage value, not basis points
      // Our Solana library will handle the conversion to basis points correctly
      const ratePerSecond = parseFloat(stakeRatePerSecond);
      let harvestThresholdValue = parseFloat(harvestThreshold);
      
      // Safety caps for blockchain parameters
      const MAX_HARVEST_THRESHOLD = 1000000000;
      
      // Apply caps and validate
      if (isNaN(harvestThresholdValue) || harvestThresholdValue <= 0) {
        toast({
          title: "Invalid Harvest Threshold",
          description: "Harvest threshold must be a positive number",
          variant: "destructive",
        });
        return;
      } else if (harvestThresholdValue > MAX_HARVEST_THRESHOLD) {
        toast({
          title: "Harvest Threshold Too Large",
          description: `Maximum allowed value is ${MAX_HARVEST_THRESHOLD}`,
          variant: "destructive",
        });
        return;
      }
      
      // Cap the values for safety
      harvestThresholdValue = Math.min(harvestThresholdValue, MAX_HARVEST_THRESHOLD);
      
      console.log("Sending blockchain parameter update:", {
        stakeRatePerSecond: ratePerSecond,
        harvestThreshold: harvestThresholdValue
      });
      
      // Update blockchain parameters only
      updateStakingSettingsMutation.mutate({
        ratePerSecond: ratePerSecond, // Pass the raw percentage value
        harvestThreshold: harvestThresholdValue // Pass the raw threshold value
      });
      
      // Also update database settings to keep them in sync
      const stakingRates = convertStakingRate(ratePerSecond);
      updateSettings({
        stakeRatePerSecond: stakingRates.second,
        stakeRateHourly: stakingRates.hourly,
        stakeRateDaily: stakingRates.daily,
        harvestThreshold: harvestThresholdValue.toString()
      });
      
      toast({
        title: 'Blockchain Settings Updated',
        description: 'The staking parameters on the blockchain have been updated.',
      });
    } catch (error) {
      toast({
        title: 'Invalid Input',
        description: 'Please check your inputs and try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle form submission for database settings
  const handleDatabaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast({
        title: 'Authentication Required',
        description: 'You need to connect an admin wallet to update settings.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Validate and cap input values to prevent overflow errors
      let stakeThresholdValue = parseFloat(stakeThreshold);
      let unstakeThresholdValue = parseFloat(unstakeThreshold);
      
      // Safety caps for database parameters
      const MAX_STAKE_THRESHOLD = 1000000;
      const MAX_UNSTAKE_THRESHOLD = 1000000;
      
      // Apply caps and validate
      if (isNaN(stakeThresholdValue) || stakeThresholdValue <= 0) {
        toast({
          title: "Invalid Stake Threshold",
          description: "Stake threshold must be a positive number",
          variant: "destructive",
        });
        return;
      } else if (stakeThresholdValue > MAX_STAKE_THRESHOLD) {
        toast({
          title: "Stake Threshold Too Large",
          description: `Maximum allowed value is ${MAX_STAKE_THRESHOLD}`,
          variant: "destructive",
        });
        return;
      }
      
      if (isNaN(unstakeThresholdValue) || unstakeThresholdValue <= 0) {
        toast({
          title: "Invalid Unstake Threshold",
          description: "Unstake threshold must be a positive number",
          variant: "destructive",
        });
        return;
      } else if (unstakeThresholdValue > MAX_UNSTAKE_THRESHOLD) {
        toast({
          title: "Unstake Threshold Too Large",
          description: `Maximum allowed value is ${MAX_UNSTAKE_THRESHOLD}`,
          variant: "destructive",
        });
        return;
      }
      
      // Cap the values for safety
      stakeThresholdValue = Math.min(stakeThresholdValue, MAX_STAKE_THRESHOLD);
      unstakeThresholdValue = Math.min(unstakeThresholdValue, MAX_UNSTAKE_THRESHOLD);
      
      console.log("Saving database thresholds:", {
        stakeThreshold: stakeThresholdValue,
        unstakeThreshold: unstakeThresholdValue
      });
      
      // Update database settings with stake/unstake thresholds
      updateSettings({
        stakeThreshold: stakeThresholdValue.toString(),
        unstakeThreshold: unstakeThresholdValue.toString()
      });
      
      toast({
        title: 'Database Settings Updated',
        description: 'The minimum stake and unstake thresholds have been updated.',
      });
    } catch (error) {
      toast({
        title: 'Invalid Input',
        description: 'Please check your inputs and try again.',
        variant: 'destructive',
      });
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Database Settings Card */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Database Staking Settings</CardTitle>
          <CardDescription>
            Update minimum threshold values for staking and unstaking. 
            These values are stored in the database and enforced by the application.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleDatabaseSubmit}>
          <CardContent className="space-y-4">
            {!isAdmin && (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md flex items-start space-x-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-700">
                  Connect your admin wallet to update settings.
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="stakeThreshold">Minimum Stake Threshold (YOT)</Label>
              <Input
                id="stakeThreshold"
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                value={stakeThreshold}
                onKeyDown={(e) => {
                  // Allow only numbers, decimal point, backspace, delete, and arrow keys
                  const allowedKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
                  if (!allowedKeys.includes(e.key)) {
                    e.preventDefault();
                  }
                  
                  // Allow only one decimal point
                  if (e.key === '.' && stakeThreshold.includes('.')) {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  // Remove any non-numeric characters except decimal point
                  const sanitizedValue = e.target.value.replace(/[^0-9.]/g, '');
                  
                  // Limit to just one decimal point
                  const parts = sanitizedValue.split('.');
                  const cleanValue = parts[0] + (parts.length > 1 ? '.' + parts[1] : '');
                  
                  // Limit to maximum allowed input length
                  if (cleanValue.replace('.', '').length > 6) {
                    toast({
                      title: "Value Too Large",
                      description: "Maximum stake threshold is 1,000,000 YOT",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Limit to a safe range
                  const value = parseFloat(cleanValue);
                  if (!isNaN(value) && value > 1000000) {
                    setStakeThreshold("1000000");
                    toast({
                      title: "Value Too Large",
                      description: "Maximum stake threshold is 1,000,000 YOT",
                      variant: "destructive",
                    });
                  } else {
                    setStakeThreshold(cleanValue);
                  }
                }}
                placeholder="10.0"
                disabled={isUpdatingDatabase || !isAdmin}
              />
              <p className="text-sm text-muted-foreground">
                Users must stake at least this amount of YOT tokens.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="unstakeThreshold">Minimum Unstake Threshold (YOT)</Label>
              <Input
                id="unstakeThreshold"
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                value={unstakeThreshold}
                onKeyDown={(e) => {
                  // Allow only numbers, decimal point, backspace, delete, and arrow keys
                  const allowedKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
                  if (!allowedKeys.includes(e.key)) {
                    e.preventDefault();
                  }
                  
                  // Allow only one decimal point
                  if (e.key === '.' && unstakeThreshold.includes('.')) {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  // Remove any non-numeric characters except decimal point
                  const sanitizedValue = e.target.value.replace(/[^0-9.]/g, '');
                  
                  // Limit to just one decimal point
                  const parts = sanitizedValue.split('.');
                  const cleanValue = parts[0] + (parts.length > 1 ? '.' + parts[1] : '');
                  
                  // Limit to a safe range
                  const value = parseFloat(cleanValue);
                  if (!isNaN(value) && value > 1000000) {
                    setUnstakeThreshold("1000000");
                    toast({
                      title: "Value Too Large",
                      description: "Maximum unstake threshold is 1,000,000 YOT",
                      variant: "destructive",
                    });
                  } else {
                    setUnstakeThreshold(cleanValue);
                  }
                }}
                placeholder="10.0"
                disabled={isUpdatingDatabase || !isAdmin}
              />
              <p className="text-sm text-muted-foreground">
                Users must unstake at least this amount of YOT tokens.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              disabled={isUpdatingDatabase || !isAdmin}
              className="w-full"
            >
              {isUpdatingDatabase ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Database Settings'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      {/* Blockchain Settings Card */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Blockchain Staking Settings</CardTitle>
          <CardDescription>
            Update staking parameters on the blockchain. 
            This requires an admin wallet signature.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleBlockchainSubmit}>
          <CardContent className="space-y-4">
            {!isAdmin && (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md flex items-start space-x-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-700">
                  Connect your admin wallet to update settings. All changes will be recorded on the blockchain and require your signature.
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="stakeRate">Stake Rate (% per second)</Label>
              <Input
                id="stakeRate"
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                value={stakeRatePerSecond}
                onKeyDown={(e) => {
                  // Allow only numbers, decimal point, backspace, delete, and arrow keys
                  const allowedKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
                  if (!allowedKeys.includes(e.key)) {
                    e.preventDefault();
                  }
                  
                  // Allow only one decimal point
                  if (e.key === '.' && stakeRatePerSecond.includes('.')) {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  // Remove any non-numeric characters except decimal point
                  const sanitizedValue = e.target.value.replace(/[^0-9.]/g, '');
                  
                  // Limit to just one decimal point
                  const parts = sanitizedValue.split('.');
                  const cleanValue = parts[0] + (parts.length > 1 ? '.' + parts[1] : '');
                  
                  // Limit the stake rate to a reasonable value
                  const value = parseFloat(cleanValue);
                  if (!isNaN(value) && value > 1) {
                    toast({
                      title: "Value Too Large",
                      description: "Stake rate should be a small value (less than 1%)",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  setStakeRatePerSecond(cleanValue);
                }}
                placeholder="0.00000125"
                disabled={isUpdatingParameters || !isAdmin}
              />
              <div className="bg-amber-900 p-3 rounded-md text-sm text-white space-y-1 mt-2 shadow-md border border-amber-500">
                <p className="font-semibold text-amber-200 text-base">IMPORTANT INFO ABOUT STAKING REWARDS</p>
                <p>
                  The Solana program multiplies rewards by 10,000x as a scaling factor.
                  A rate of 0.00000125% per second actually produces:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-amber-100">
                  <li>Base rate: 0.108% per day (0.00000125% × 86,400 seconds)</li>
                  <li>With 10,000x scaling: 1,080% per day in realized rewards</li>
                  <li>This is why users see thousands of YOS as rewards</li>
                </ul>
                <p className="mt-2 font-semibold text-amber-200">
                  Suggested values: 0.00000125% (standard) or 0.000000125% (1/10th) 
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="harvestThreshold">Minimum harvest amount (YOS)</Label>
              <Input
                id="harvestThreshold"
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                value={harvestThreshold}
                onKeyDown={(e) => {
                  // Allow only numbers, decimal point, backspace, delete, and arrow keys
                  const allowedKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
                  if (!allowedKeys.includes(e.key)) {
                    e.preventDefault();
                  }
                  
                  // Allow only one decimal point
                  if (e.key === '.' && harvestThreshold.includes('.')) {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  // Remove any non-numeric characters except decimal point
                  const sanitizedValue = e.target.value.replace(/[^0-9.]/g, '');
                  
                  // Limit to just one decimal point
                  const parts = sanitizedValue.split('.');
                  const cleanValue = parts[0] + (parts.length > 1 ? '.' + parts[1] : '');
                  
                  // Limit to a safe range
                  const value = parseFloat(cleanValue);
                  if (!isNaN(value) && value > 1000000000) {
                    setHarvestThreshold("1000000000");
                    toast({
                      title: "Value Too Large",
                      description: "Maximum harvest threshold is 1,000,000,000 YOS",
                      variant: "destructive",
                    });
                  } else {
                    setHarvestThreshold(cleanValue);
                  }
                }}
                placeholder="100.0"
                disabled={isUpdatingParameters || !isAdmin}
              />
              <p className="text-sm text-muted-foreground">
                Users must accumulate at least this amount of YOS rewards before harvesting.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              disabled={isUpdatingParameters || !isAdmin}
              className="w-full"
            >
              {isUpdatingParameters ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Blockchain...
                </>
              ) : (
                'Update Blockchain Settings'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      {/* Advanced Operations (Hidden by default) */}
      <Accordion type="single" collapsible>
        <AccordionItem value="advanced">
          <AccordionTrigger className="text-lg text-amber-600 font-semibold">
            Advanced Operations (Admin Only)
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 p-4 bg-amber-50 rounded-lg">
              <div className="space-y-2">
                <h3 className="text-md font-semibold">Fund Program YOS Account</h3>
                <p className="text-sm text-muted-foreground">
                  Add YOS tokens to the program's token account to be used for rewards.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    id="fundAmount"
                    type="text"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    placeholder="10.0"
                    disabled={isFunding || !isAdmin}
                  />
                  <Button 
                    type="button" 
                    disabled={isFunding || !isAdmin || !connected}
                    onClick={async () => {
                      try {
                        setIsFunding(true);
                        if (!wallet) throw new Error('Wallet not connected');
                        
                        const result = await fundProgramYosAccount(wallet, parseFloat(fundAmount));
                        toast({
                          title: 'Program Funded',
                          description: `Successfully sent ${fundAmount} YOS to program account.`,
                        });
                      } catch (error) {
                        console.error('Failed to fund program:', error);
                        toast({
                          title: 'Funding Failed',
                          description: error instanceof Error ? error.message : 'Unknown error',
                          variant: 'destructive',
                        });
                      } finally {
                        setIsFunding(false);
                      }
                    }}
                    variant="outline"
                  >
                    {isFunding ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Flame className="mr-2 h-4 w-4" />
                        Fund Program
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-md font-semibold">Program YOS Balance</h3>
                  <p className="text-sm text-muted-foreground">
                    Check how many YOS tokens are available for rewards.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {programYosBalance !== null && (
                    <span className="text-lg font-mono">{programYosBalance.toLocaleString()} YOS</span>
                  )}
                  <Button 
                    type="button" 
                    disabled={isCheckingBalance}
                    onClick={async () => {
                      try {
                        setIsCheckingBalance(true);
                        const result = await checkProgramYosBalance();
                        setProgramYosBalance(result.balance);
                      } catch (error) {
                        console.error('Failed to check program balance:', error);
                        toast({
                          title: 'Balance Check Failed',
                          description: error instanceof Error ? error.message : 'Unknown error',
                          variant: 'destructive',
                        });
                      } finally {
                        setIsCheckingBalance(false);
                      }
                    }}
                    variant="outline"
                    size="sm"
                  >
                    {isCheckingBalance ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CoinsIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}