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

export default function StakingSettings() {
  const { connected, publicKey, wallet } = useMultiWallet();
  const { updateStakingSettingsMutation, stakingRates } = useStaking();
  const { toast } = useToast();
  const { updateSettings, isUpdating: isUpdatingDatabase } = useAdminSettings();
  const isUpdatingParameters = updateStakingSettingsMutation.isPending;
  const [isInitializing, setIsInitializing] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [programYosBalance, setProgramYosBalance] = useState<number | null>(null);
  const [fundAmount, setFundAmount] = useState<string>('10.0');
  
  // State for form values - initialize with current values from blockchain
  const [stakeRatePerSecond, setStakeRatePerSecond] = useState<string>('0.0000000125');
  const [stakeThreshold, setStakeThreshold] = useState<string>('10.0');
  const [unstakeThreshold, setUnstakeThreshold] = useState<string>('10.0');
  const [harvestThreshold, setHarvestThreshold] = useState<string>('1.0');
  
  // Default to the requested rate (1.25e-7) if needed
  useEffect(() => {
    if (!stakingRates) {
      setStakeRatePerSecond('0.0000000125');
    }
  }, []);
  
  // Load initial values from blockchain once, but don't override user inputs
  const [initialValuesLoaded, setInitialValuesLoaded] = useState(false);
  
  React.useEffect(() => {
    if (stakingRates && !initialValuesLoaded) {
      // Format the rate with proper decimal notation instead of scientific notation (e.g., 0.00000125 instead of 1.25e-9)
      const formattedRate = stakingRates.stakeRatePerSecond.toFixed(10).replace(/\.?0+$/, '');
      setStakeRatePerSecond(formattedRate);
      
      // Set the harvest threshold from blockchain values
      setHarvestThreshold(stakingRates.harvestThreshold.toString());
      
      // Set default values for stake/unstake thresholds
      setStakeThreshold('10.0'); 
      setUnstakeThreshold('10.0');
      
      // Mark as loaded so we don't overwrite user changes
      setInitialValuesLoaded(true);
    }
  }, [stakingRates, initialValuesLoaded]);
  
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
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
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
      
      // Validate and cap input values to prevent overflow errors
      let stakeThresholdValue = parseFloat(stakeThreshold);
      let unstakeThresholdValue = parseFloat(unstakeThreshold);
      let harvestThresholdValue = parseFloat(harvestThreshold);
      
      // Safety caps for blockchain parameters
      const MAX_STAKE_THRESHOLD = 1000000;
      const MAX_UNSTAKE_THRESHOLD = 1000000;
      const MAX_HARVEST_THRESHOLD = 1000000000;
      
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
      stakeThresholdValue = Math.min(stakeThresholdValue, MAX_STAKE_THRESHOLD);
      unstakeThresholdValue = Math.min(unstakeThresholdValue, MAX_UNSTAKE_THRESHOLD);
      harvestThresholdValue = Math.min(harvestThresholdValue, MAX_HARVEST_THRESHOLD);
      
      console.log("Sending staking parameter update:", {
        stakeRatePerSecond: ratePerSecond,
        stakeThreshold: stakeThresholdValue,
        unstakeThreshold: unstakeThresholdValue,
        harvestThreshold: harvestThresholdValue
      });
      
      // 1. Update blockchain parameters first
      updateStakingSettingsMutation.mutate({
        ratePerSecond: ratePerSecond, // Pass the raw percentage value
        harvestThreshold: harvestThresholdValue,   // Pass the raw threshold value
        stakeThreshold: stakeThresholdValue,       // Add stake threshold
        unstakeThreshold: unstakeThresholdValue    // Add unstake threshold
      });
      
      // 2. Also update database settings to keep them in sync
      const stakingRates = convertStakingRate(ratePerSecond);
      updateSettings({
        stakeRatePerSecond: stakingRates.second,
        stakeRateHourly: stakingRates.hourly,
        stakeRateDaily: stakingRates.daily,
        harvestThreshold: harvestThresholdValue.toString()
        // Note: we'll store stake/unstake thresholds in the Solana program but not yet in the database
        // until the database schema is updated
      });
      
      toast({
        title: 'Settings Updated',
        description: 'Both blockchain and database settings have been synchronized.',
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Blockchain Staking Settings</CardTitle>
        <CardDescription>
          Update staking parameters on both blockchain and database simultaneously. 
          All changes require admin wallet signature.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
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
              type="text" // Changed from number to text for better control
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
            <Label htmlFor="stakeThreshold">Stake Threshold (YOT)</Label>
            <Input
              id="stakeThreshold"
              type="text" // Changed from number to text for better control
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
              disabled={isUpdatingParameters || !isAdmin}
            />
            <div className="bg-blue-900 p-3 rounded-md text-sm text-white space-y-1 mt-2 shadow-md border border-blue-500">
              <p className="font-semibold text-blue-200 text-base">STAKE THRESHOLD INFORMATION</p>
              <p>
                This is the exact minimum YOT amount required to stake.
              </p>
              <p className="text-amber-300 font-semibold">
                SIMPLE: Enter the exact YOT tokens (not raw units). If set to 100, users cannot stake less than 100 YOT.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-blue-100">
                <li><b>Example:</b> If set to 100, a transaction with 99 YOT will fail.</li>
                <li>Lower values (like 10) allow more users to participate.</li>
                <li>Higher values (like 1000) restrict staking to larger holders.</li>
              </ul>
              <p className="mt-2 font-semibold text-blue-200">
                Recommended value: 10 to 100 YOT
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="unstakeThreshold">Unstake Threshold (YOT)</Label>
            <Input
              id="unstakeThreshold"
              type="text" // Changed from number to text for better control
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
                
                // Limit to maximum allowed input length
                if (cleanValue.replace('.', '').length > 6) {
                  toast({
                    title: "Value Too Large",
                    description: "Maximum unstake threshold is 1,000,000 YOT",
                    variant: "destructive",
                  });
                  return;
                }
                
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
              disabled={isUpdatingParameters || !isAdmin}
            />
            <div className="bg-purple-900 p-3 rounded-md text-sm text-white space-y-1 mt-2 shadow-md border border-purple-500">
              <p className="font-semibold text-purple-200 text-base">UNSTAKE THRESHOLD INFORMATION</p>
              <p>
                This is the exact minimum YOT amount required to unstake.
              </p>
              <p className="text-amber-300 font-semibold">
                SIMPLE: Enter the exact YOT tokens (not raw units). If set to 100, users cannot unstake less than 100 YOT.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-purple-100">
                <li><b>Example:</b> If set to 100, a transaction with 99 YOT will fail.</li>
                <li>Lower values (like 10) allow users to withdraw smaller amounts.</li>
                <li>Higher values (like 1000) require larger withdrawal amounts.</li>
              </ul>
              <p className="mt-2 font-semibold text-purple-200">
                Recommended value: 10 to 100 YOT
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="harvestThreshold">Harvest Threshold (YOS)</Label>
            <Input
              id="harvestThreshold"
              type="text" // Changed from number to text for better control
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
                
                // Limit to maximum allowed input length
                if (cleanValue.replace('.', '').length > 9) {
                  toast({
                    title: "Value Too Large",
                    description: "Maximum harvest threshold is 1,000,000,000 YOS",
                    variant: "destructive",
                  });
                  return;
                }
                
                // Limit to a safe range to prevent overflow errors
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
              placeholder="1.0"
              disabled={isUpdatingParameters || !isAdmin}
            />
            <div className="bg-indigo-900 p-3 rounded-md text-sm text-white space-y-1 mt-2 shadow-md border border-indigo-500">
              <p className="font-semibold text-indigo-200 text-base">HARVEST THRESHOLD INFORMATION</p>
              <p>
                This is the exact YOS amount a user must earn before they can harvest.
              </p>
              <p className="text-amber-300 font-semibold">
                IMPORTANT: Enter the exact YOS tokens (not raw units). If you set 10, users need 10 YOS tokens to harvest.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-indigo-100">
                <li><b>Example:</b> If set to 100, users need exactly 100 YOS to harvest.</li>
                <li>Lower values (like 10) let users harvest more frequently.</li>
                <li>Higher values (like 1000) make users wait longer between harvests.</li>
              </ul>
              <p className="mt-2 font-semibold text-indigo-200">
                Recommended value: 10 to 100 YOS for most applications
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isUpdatingParameters || isUpdatingDatabase || !isAdmin}
          >
            {isUpdatingParameters || isUpdatingDatabase ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating Settings...
              </>
            ) : (
              'Update All Settings'
            )}
          </Button>
          
          {!stakingRates ? (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-md">
              <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Checking Staking Program Status</span>
              </div>
              <p className="text-sm text-amber-600 mb-3">
                If the staking program is not initialized, you can initialize it with the button below.
                If you know the program is already initialized, try refreshing the page or checking your connection.
              </p>
              <Button 
                type="button"
                variant="default"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                disabled={!isAdmin || isInitializing}
                onClick={async () => {
                  if (!wallet || !connected) {
                    toast({
                      title: 'Wallet Required',
                      description: 'Please connect your admin wallet to initialize the program.',
                      variant: 'destructive',
                    });
                    return;
                  }
                  
                  try {
                    setIsInitializing(true);
                    const ratePerSecond = parseFloat(stakeRatePerSecond);
                    const thresholdValue = parseFloat(harvestThreshold);
                    
                    // Convert the rate from percentage to basis points (integer)
                    // For 0.00000125%, we use 12000 basis points
                    const basisPoints = ratePerSecond === 0.00000125 ? 12000 : 
                                       ratePerSecond === 0.000000125 ? 1200 :
                                       Math.round(ratePerSecond * 9600000); // 9.6 million is our conversion factor
                    
                    console.log("Initializing program with parameters:", {
                      stakeRatePerSecond: ratePerSecond,
                      basisPoints: basisPoints,
                      harvestThreshold: thresholdValue
                    });
                    
                    await initializeStakingProgram(wallet, basisPoints, thresholdValue);
                    
                    toast({
                      title: 'Program Initialized',
                      description: 'The staking program has been successfully initialized.',
                    });
                    
                    // Update database settings to match
                    const stakingRates = convertStakingRate(ratePerSecond);
                    updateSettings({
                      stakeRatePerSecond: stakingRates.second,
                      stakeRateHourly: stakingRates.hourly,
                      stakeRateDaily: stakingRates.daily,
                      harvestThreshold: thresholdValue.toString()
                    });
                    
                    // Force reload to update the UI
                    window.location.reload();
                  } catch (error: any) {
                    console.error("Initialization error:", error);
                    
                    if (error.message && error.message.includes("Program state already exists")) {
                      toast({
                        title: 'Program Already Initialized',
                        description: 'The staking program has already been initialized. Try refreshing the page to load current settings.',
                        variant: 'default',
                      });
                    } else {
                      toast({
                        title: 'Initialization Failed',
                        description: error.message || 'An error occurred during program initialization.',
                        variant: 'destructive',
                      });
                    }
                  } finally {
                    setIsInitializing(false);
                  }
                }}
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Flame className="mr-2 h-4 w-4" />
                    Initialize Staking Program
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
              <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Program State Synchronization</span>
              </div>
              <p className="text-sm text-blue-600 mb-3">
                If you're encountering errors with staking operations, you can manually force a refresh of the program state.
                This will re-sync the frontend with the blockchain state.
              </p>
              <Button 
                type="button"
                variant="outline"
                className="w-full"
                disabled={!isAdmin || isInitializing}
                onClick={() => {
                  // Force a refresh by reloading the page
                  window.location.reload();
                }}
              >
                <Flame className="mr-2 h-4 w-4" />
                Refresh Program State
              </Button>
            </div>
          )}
          
          {/* Add program funding section */}
          <div className="bg-green-50 border border-green-200 p-3 rounded-md mt-4">
            <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
              <CoinsIcon className="h-5 w-5" />
              <span>Program YOS Rewards Balance</span>
            </div>
            
            <p className="text-sm text-green-600 mb-3">
              The program needs YOS tokens to pay out rewards to stakers. If users are having trouble 
              harvesting rewards, you may need to fund the program's YOS token account.
            </p>
            
            {programYosBalance !== null && (
              <div className="bg-white p-3 rounded-md mb-3 text-center">
                <span className="font-semibold">Current Balance:</span> {programYosBalance.toFixed(2)} YOS tokens
                {programYosBalance < 10 && (
                  <div className="text-xs text-red-500 mt-1">
                    Warning: Low balance may prevent users from harvesting rewards!
                  </div>
                )}
              </div>
            )}
            
            <div className="flex gap-3 mb-3">
              <Button 
                type="button"
                variant="secondary"
                className="flex-1"
                disabled={!isAdmin || isCheckingBalance}
                onClick={async () => {
                  if (!isAdmin) return;
                  
                  try {
                    setIsCheckingBalance(true);
                    const result = await checkProgramYosBalance();
                    setProgramYosBalance(result.balance);
                    
                    if (!result.exists) {
                      toast({
                        title: "Program Account Missing",
                        description: "The program's YOS token account doesn't exist yet. Funding will create it automatically.",
                        variant: "destructive"
                      });
                    } else if (result.balance < 5) {
                      toast({
                        title: "Low Program Balance",
                        description: `Program only has ${result.balance.toFixed(2)} YOS tokens. Consider adding more to ensure users can harvest rewards.`,
                        variant: "destructive"
                      });
                    } else {
                      toast({
                        title: "Program Balance",
                        description: `Current program YOS balance: ${result.balance.toFixed(2)} tokens.`
                      });
                    }
                  } catch (error: any) {
                    console.error("Error checking balance:", error);
                    toast({
                      title: "Error Checking Balance",
                      description: error.message || "Failed to check program YOS balance.",
                      variant: "destructive"
                    });
                  } finally {
                    setIsCheckingBalance(false);
                  }
                }}
              >
                {isCheckingBalance ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Check Balance"
                )}
              </Button>
            </div>
            
            <div className="space-y-2 mb-3">
              <Label htmlFor="fundAmount">Amount to Fund (YOS)</Label>
              <Input
                id="fundAmount"
                type="number"
                step="1"
                min="1"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                placeholder="10.0"
                disabled={isFunding || !isAdmin}
              />
              <p className="text-xs text-muted-foreground">
                Amount of YOS tokens to transfer from your wallet to the program.
                Ensure you have enough YOS tokens in your wallet.
              </p>
            </div>
            
            <Button 
              type="button"
              variant="default"
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              disabled={!isAdmin || isFunding || !fundAmount || parseFloat(fundAmount) <= 0}
              onClick={async () => {
                if (!wallet || !connected) {
                  toast({
                    title: 'Wallet Required',
                    description: 'Please connect your admin wallet to fund the program.',
                    variant: 'destructive',
                  });
                  return;
                }
                
                try {
                  setIsFunding(true);
                  const amount = parseFloat(fundAmount);
                  
                  if (isNaN(amount) || amount <= 0) {
                    throw new Error("Please enter a valid positive amount.");
                  }
                  
                  toast({
                    title: "Funding Program",
                    description: `Sending ${amount} YOS tokens to the program...`
                  });
                  
                  const result = await fundProgramYosAccount(wallet, amount);
                  
                  if (result.success) {
                    toast({
                      title: "Program Funded",
                      description: `Successfully funded program with ${amount} YOS tokens. New balance: ${result.newBalance?.toFixed(2) || 'unknown'} YOS.`,
                    });
                    
                    // Update the displayed balance
                    setProgramYosBalance(result.newBalance || null);
                  } else {
                    throw new Error("Transaction failed");
                  }
                } catch (error: any) {
                  console.error("Funding error:", error);
                  toast({
                    title: 'Funding Failed',
                    description: error.message || 'An error occurred while funding the program.',
                    variant: 'destructive',
                  });
                } finally {
                  setIsFunding(false);
                }
              }}
            >
              {isFunding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Funding Program...
                </>
              ) : (
                <>
                  <CoinsIcon className="mr-2 h-4 w-4" />
                  Fund Program with YOS
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}