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
  const { updateParameters, isUpdatingParameters, stakingRates } = useStaking();
  const { toast } = useToast();
  const { updateSettings, isUpdating: isUpdatingDatabase } = useAdminSettings();
  const [isInitializing, setIsInitializing] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [programYosBalance, setProgramYosBalance] = useState<number | null>(null);
  const [fundAmount, setFundAmount] = useState<string>('10.0');
  
  // State for form values - initialize with current values from blockchain
  const [stakeRatePerSecond, setStakeRatePerSecond] = useState<string>('0.0000000125');
  const [harvestThreshold, setHarvestThreshold] = useState<string>('1.0');
  
  // Default to the requested rate (1.25e-7) if needed
  useEffect(() => {
    if (!stakingRates) {
      setStakeRatePerSecond('0.0000000125');
    }
  }, []);
  
  React.useEffect(() => {
    if (stakingRates) {
      setStakeRatePerSecond(stakingRates.stakeRatePerSecond.toString());
      setHarvestThreshold(stakingRates.harvestThreshold.toString());
    }
  }, [stakingRates]);
  
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
      const thresholdValue = parseFloat(harvestThreshold);
      
      console.log("Sending staking parameter update:", {
        stakeRatePerSecond: ratePerSecond,
        harvestThreshold: thresholdValue
      });
      
      // 1. Update blockchain parameters first
      updateParameters({
        stakeRatePerSecond: ratePerSecond, // Pass the raw percentage value
        harvestThreshold: thresholdValue    // Pass the raw threshold value
      });
      
      // 2. Also update database settings to keep them in sync
      const stakingRates = convertStakingRate(ratePerSecond);
      updateSettings({
        stakeRatePerSecond: stakingRates.second,
        stakeRateHourly: stakingRates.hourly,
        stakeRateDaily: stakingRates.daily,
        harvestThreshold: thresholdValue.toString()
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
              type="number"
              step="0.00001"
              value={stakeRatePerSecond}
              onChange={(e) => setStakeRatePerSecond(e.target.value)}
              placeholder="0.00125"
              disabled={isUpdatingParameters || !isAdmin}
            />
            <p className="text-xs text-muted-foreground">
              This is the percentage of staked tokens earned as rewards per second.
              Example: 0.00125% per second = 108% per day
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="harvestThreshold">Harvest Threshold (YOS)</Label>
            <Input
              id="harvestThreshold"
              type="number"
              step="0.1"
              value={harvestThreshold}
              onChange={(e) => setHarvestThreshold(e.target.value)}
              placeholder="1.0"
              disabled={isUpdatingParameters || !isAdmin}
            />
            <p className="text-xs text-muted-foreground">
              Minimum amount of YOS rewards required before harvesting is allowed.
            </p>
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
                    
                    console.log("Initializing program with parameters:", {
                      stakeRatePerSecond: ratePerSecond,
                      harvestThreshold: thresholdValue
                    });
                    
                    await initializeStakingProgram(wallet, ratePerSecond, thresholdValue);
                    
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