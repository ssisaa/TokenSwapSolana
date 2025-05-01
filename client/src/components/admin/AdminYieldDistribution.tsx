import { useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { triggerYieldDistribution } from "@/lib/multihub-contract";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

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

    try {
      const txSignature = await triggerYieldDistribution(wallet);
      setSuccess(`Yield distribution triggered successfully! Transaction: ${txSignature.substring(0, 8)}...`);
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
            <Alert variant="success" className="bg-green-50 text-green-800 border-green-200">
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