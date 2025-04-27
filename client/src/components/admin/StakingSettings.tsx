import { useState } from 'react';
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
  const { updateParameters, isUpdatingParameters } = useStaking();
  const { toast } = useToast();
  
  // State for form values
  const [stakeRatePerSecond, setStakeRatePerSecond] = useState<string>('0.00125');
  const [harvestThreshold, setHarvestThreshold] = useState<string>('1.0');
  
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
      // Convert percentage to basis points (1/100 of 1%)
      const rateInBasisPoints = Math.round(parseFloat(stakeRatePerSecond) * 10000);
      const thresholdValue = Math.round(parseFloat(harvestThreshold) * 1000000); // Convert to smallest token units
      
      updateParameters({
        stakeRatePerSecond: rateInBasisPoints,
        harvestThreshold: thresholdValue
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