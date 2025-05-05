import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { InfoIcon, CheckCircle2, AlertTriangle, LoaderIcon, KeyIcon, AlertCircle } from 'lucide-react';
import { checkYosMintAuthority, setProgramAsMintAuthority } from '@/lib/authorize-mint';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

export default function AuthorizeTokens() {
  const { toast } = useToast();
  const { connected, wallet } = useMultiWallet();
  const [loading, setLoading] = useState(false);
  const [useCustomAuthority, setUseCustomAuthority] = useState(false);
  const [customAuthority, setCustomAuthority] = useState('');
  const [authorityStatus, setAuthorityStatus] = useState<{
    checked: boolean;
    isCorrect?: boolean;
    currentAuthority?: string;
    expectedAuthority?: string;
    authorityBump?: number;
  }>({ checked: false });

  async function handleCheckAuthority() {
    setLoading(true);
    try {
      const result = await checkYosMintAuthority();
      setAuthorityStatus({
        checked: true,
        isCorrect: result.isCorrect,
        currentAuthority: result.currentAuthority,
        expectedAuthority: result.expectedAuthority,
        authorityBump: result.authorityBump
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
      if (!wallet) {
        throw new Error("Wallet not connected");
      }
      
      const result = await setProgramAsMintAuthority(wallet);
      
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
          description: result.error || "An error occurred while setting the mint authority",
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Token Authorization</CardTitle>
            <CardDescription>
              Check and fix YOS token mint authority to enable YOS rewards
            </CardDescription>
          </div>
          <KeyIcon className="h-5 w-5 text-blue-500" />
        </div>
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
              
              <div className="mt-2 space-y-1 text-sm font-mono">
                <div>Current: <span className="font-semibold">{authorityStatus.currentAuthority}</span></div>
                <div>Expected: <span className="font-semibold">{authorityStatus.expectedAuthority}</span></div>
                {authorityStatus.authorityBump !== undefined && (
                  <div className="flex items-center">
                    Bump Seed: <Badge variant="outline" className="ml-2 font-mono">{authorityStatus.authorityBump}</Badge>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!connected && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Wallet Not Connected</AlertTitle>
            <AlertDescription>
              Connect an admin wallet to check and set token authorities
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <InfoIcon className="h-5 w-5 text-blue-500" />
            <p className="text-sm text-muted-foreground">
              The program must be authorized as the mint authority for the YOS token to enable rewards.
              This PDA account (<code>Au1gRnNzhtN7odbtUPRHPF7N4c8siwePW8wLsD1FmqHQ</code>) is derived using
              the seed "authority" and must be set as the mint authority for YOS (<code>2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop</code>).
            </p>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-xs font-mono">
            <div>YOS Token: <span className="text-blue-600 dark:text-blue-400">2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop</span></div>
            <div>Program ID: <span className="text-blue-600 dark:text-blue-400">SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE</span></div>
            <div>Program Authority PDA: <span className="text-green-600 dark:text-green-400">Au1gRnNzhtN7odbtUPRHPF7N4c8siwePW8wLsD1FmqHQ</span></div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2 justify-end">
        <Button 
          variant="outline" 
          onClick={handleCheckAuthority}
          disabled={loading || !connected}
        >
          {loading ? <LoaderIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
          Check Authority
        </Button>
        <Button 
          onClick={handleSetAuthority}
          disabled={loading || !connected || (authorityStatus.checked && authorityStatus.isCorrect)}
        >
          {loading ? <LoaderIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
          Set Program as Authority
        </Button>
      </CardFooter>
    </Card>
  );
}