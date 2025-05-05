import { useState } from "react";
import { useWallet } from "@/hooks/useSolanaWallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle, InfoIcon } from "lucide-react";

export default function AdminYieldDistribution() {
  const { wallet, connected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastDistribution, setLastDistribution] = useState<Date | null>(null);

  const handleDistribute = async () => {
    if (!connected || !wallet) {
      setError("Please connect your admin wallet first");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // Simulate a transaction
    try {
      // Just a simulation for now
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSuccess(`Feature currently unavailable. Multihub distribution functionality is being reconfigured.`);
      setLastDistribution(new Date());
    } catch (err: any) {
      console.error("Error triggering yield distribution:", err);
      setError(err.message || "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yield Distribution</CardTitle>
        <CardDescription>
          Trigger manual distribution of yield rewards to LP stakers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Alert className="bg-amber-50 border-amber-200">
            <InfoIcon className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Maintenance Notice</AlertTitle>
            <AlertDescription className="text-amber-700">
              The yield distribution feature is currently undergoing maintenance. Please check back later.
            </AlertDescription>
          </Alert>
          
          <p className="text-sm">
            This action will distribute YOS rewards to all liquidity providers based on their staked LP tokens and the configured APR.
            Yield distribution can only be triggered once per day (24 hours).
          </p>

          {lastDistribution && (
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">Last distribution: {lastDistribution.toLocaleString()}</p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 text-green-800 border border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Success</AlertTitle>
              <AlertDescription className="text-green-700">{success}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleDistribute}
          disabled={isLoading || !connected}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Distribute Yield Rewards"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}