import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { useStaking } from '@/hooks/useStaking';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function StakingSettings() {
  const { connected, publicKey } = useMultiWallet();
  const { updateParameters, isUpdatingParameters, stakingRates } = useStaking();
  const { toast } = useToast();
  
  // State for form values - initialize with current values from blockchain
  const [stakeRatePerSecond, setStakeRatePerSecond] = useState<string>('0.00000125');
  const [harvestThreshold, setHarvestThreshold] = useState<string>('1.0');
  
  React.useEffect(() => {
    if (stakingRates) {
      setStakeRatePerSecond(stakingRates.stakeRatePerSecond.toString());
      setHarvestThreshold(stakingRates.harvestThreshold.toString());
    }
  }, [stakingRates]);
  
  // Validate admin status
  // In a real implementation, we would verify the admin's public key
  const isAdmin = connected && publicKey;
  
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
      
      updateParameters({
        stakeRatePerSecond: ratePerSecond, // Pass the raw percentage value
        harvestThreshold: thresholdValue    // Pass the raw threshold value
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
        <CardTitle>Staking Settings</CardTitle>
        <CardDescription>
          Update staking parameters directly on the blockchain. All changes require admin wallet signature.
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
        <CardFooter>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isUpdatingParameters || !isAdmin}
          >
            {isUpdatingParameters ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating On Blockchain...
              </>
            ) : (
              'Update Parameters'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}