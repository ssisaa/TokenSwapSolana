import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { InfoIcon, CheckCircle2, AlertTriangle, LoaderIcon } from 'lucide-react';
import { checkYosMintAuthority, setProgramAsMintAuthority } from '@/lib/authorize-mint';

export default function AuthorizeTokens() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [authorityStatus, setAuthorityStatus] = useState<{
    checked: boolean;
    isCorrect?: boolean;
    currentAuthority?: string;
    expectedAuthority?: string;
  }>({ checked: false });

  async function handleCheckAuthority() {
    setLoading(true);
    try {
      const result = await checkYosMintAuthority();
      setAuthorityStatus({
        checked: true,
        isCorrect: result.isCorrect,
        currentAuthority: result.currentAuthority,
        expectedAuthority: result.expectedAuthority
      });
      
      if (result.isCorrect) {
        toast({
          title: "Authority Check Passed",
          description: "YOS token mint authority is correctly set to the program authority PDA",
          variant: "default",
        });
      } else {
        toast({
          title: "Authority Check Failed",
          description: "YOS token mint authority is not correctly set",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Authority Check Failed",
        description: error.message || "Could not check YOS mint authority",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSetAuthority() {
    setLoading(true);
    try {
      const result = await setProgramAsMintAuthority();
      
      if (result.success) {
        toast({
          title: "Authority Set Successfully",
          description: "Program authority PDA is now the mint authority for YOS token",
          variant: "default",
        });
        // Refresh the status
        await handleCheckAuthority();
      } else {
        toast({
          title: "Failed to Set Authority",
          description: "An error occurred while setting the mint authority",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Failed to Set Authority",
        description: error.message || "Could not set program as YOS mint authority",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle>Token Authorization</CardTitle>
        <CardDescription>
          Check and fix YOS token mint authority to enable YOS rewards
        </CardDescription>
      </CardHeader>
      <CardContent>
        {authorityStatus.checked && (
          <Alert 
            className={`mb-4 ${authorityStatus.isCorrect ? 'bg-green-50 text-green-800 border-green-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200'}`}
          >
            <div className="flex items-center gap-2">
              {authorityStatus.isCorrect ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              <AlertTitle>
                {authorityStatus.isCorrect 
                  ? "Correct Mint Authority" 
                  : "Incorrect Mint Authority"}
              </AlertTitle>
            </div>
            <AlertDescription className="mt-2">
              {authorityStatus.isCorrect 
                ? "The YOS token mint authority is correctly set to the program authority PDA."
                : "The YOS token mint authority is not set to the program authority PDA. This will prevent YOS rewards from being minted."}
              
              <div className="mt-2 text-sm font-mono">
                <div>Current: <span className="font-semibold">{authorityStatus.currentAuthority}</span></div>
                <div>Expected: <span className="font-semibold">{authorityStatus.expectedAuthority}</span></div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <InfoIcon className="h-5 w-5 text-blue-500" />
            <p className="text-sm text-muted-foreground">
              The program must be authorized as the mint authority for the YOS token to enable rewards.
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2 justify-end">
        <Button 
          variant="outline" 
          onClick={handleCheckAuthority}
          disabled={loading}
        >
          {loading ? <LoaderIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
          Check Authority
        </Button>
        <Button 
          onClick={handleSetAuthority}
          disabled={loading || (authorityStatus.checked && authorityStatus.isCorrect)}
        >
          {loading ? <LoaderIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
          Set Program as Authority
        </Button>
      </CardFooter>
    </Card>
  );
}