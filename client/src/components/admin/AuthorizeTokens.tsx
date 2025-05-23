import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { InfoIcon, CheckCircle2, AlertTriangle, LoaderIcon, KeyIcon, AlertCircle } from 'lucide-react';
import { checkYosMintAuthority, setProgramAsMintAuthority } from '@/lib/authorize-mint';
import { PublicKey } from '@solana/web3.js';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
// Import centralized configuration to eliminate hardcoded values
import { 
  YOS_TOKEN_ADDRESS,
  MULTI_HUB_SWAP_PROGRAM_ID,
  MULTI_HUB_SWAP_PROGRAM_AUTHORITY
} from '@/lib/config';
import { YOS_TOKEN_ACCOUNT, POOL_AUTHORITY } from '@/lib/constants';

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
      
      // Use custom authority if specified and checkbox is checked
      const customAuthorityValue = useCustomAuthority && customAuthority ? customAuthority.trim() : undefined;
      
      // Extra validation for custom authority
      if (customAuthorityValue) {
        try {
          // This will throw if the address is invalid
          const _ = new PublicKey(customAuthorityValue);
          console.log("Using custom authority:", customAuthorityValue);
        } catch (err) {
          throw new Error("Invalid custom authority address. Please provide a valid Solana public key.");
        }
      }
      
      console.log("Setting program as mint authority with params:", { 
        useCustomAuthority, 
        customAuthorityValue,
        walletConnected: !!wallet
      });
      
      const result = await setProgramAsMintAuthority(wallet, customAuthorityValue);
      
      if (result.success) {
        toast({
          title: "Authority Set Successfully",
          description: "Program authority PDA is now the mint authority for YOS token",
          variant: "default",
        });
        
        // Reset the custom authority fields after successful execution
        setUseCustomAuthority(false);
        setCustomAuthority('');
        
        // Refresh the status
        await handleCheckAuthority();
      } else {
        // Create a more descriptive error message
        let errorDescription = result.error || "An error occurred while setting the mint authority";
        
        // Add detailed information if available
        if (result.details) {
          errorDescription += `\n\nDetails:\n- Current authority: ${result.details.currentAuthority}\n- Target mint: ${result.details.targetMint}\n- New authority: ${result.details.newAuthority}`;
        }
        
        toast({
          title: "Failed to Set Authority",
          description: errorDescription,
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
          <div className="flex gap-2 items-start">
            <InfoIcon className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                The program must be authorized as the mint authority for the YOS token to enable rewards.
                This PDA account (<code>{MULTI_HUB_SWAP_PROGRAM_AUTHORITY}</code>) is derived using
                the seed "authority" and must be set as the mint authority for YOS (<code>{YOS_TOKEN_ADDRESS}</code>).
              </p>
              <Alert className="bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-xs font-medium">Important Permission Requirement</AlertTitle>
                <AlertDescription className="text-xs">
                  <strong>You must connect the wallet that currently owns the mint authority 
                  (<code>{POOL_AUTHORITY}</code>)</strong> to 
                  change the authority. If you're not using this wallet currently, please 
                  switch to it before proceeding.
                </AlertDescription>
              </Alert>
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-xs font-mono space-y-1.5">
            <div>YOS Token Mint: <span className="text-blue-600 dark:text-blue-400">{YOS_TOKEN_ADDRESS}</span></div>
            <div>YOS Token Account: <span className="text-blue-600 dark:text-blue-400">{YOS_TOKEN_ACCOUNT}</span></div>
            <div>Program ID: <span className="text-blue-600 dark:text-blue-400">{MULTI_HUB_SWAP_PROGRAM_ID}</span></div>
            <div>Program Authority PDA: <span className="text-green-600 dark:text-green-400">{MULTI_HUB_SWAP_PROGRAM_AUTHORITY}</span></div>
            <div className="flex items-center gap-2">
              Current Mint Authority: 
              <span className="text-yellow-600 dark:text-yellow-400">{POOL_AUTHORITY}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 font-medium text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(POOL_AUTHORITY);
                  toast({
                    title: "Copied to clipboard",
                    description: "Mint authority address has been copied to clipboard",
                    variant: "default",
                  });
                }}
              >
                Copy
              </Button>
            </div>
          </div>
          
          {!authorityStatus.isCorrect && authorityStatus.checked && (
            <div className="mt-4 border p-4 rounded-md bg-amber-50 dark:bg-amber-950">
              <div className="flex items-center space-x-2 mb-2">
                <Checkbox 
                  id="use-custom-authority" 
                  checked={useCustomAuthority}
                  onCheckedChange={(checked) => setUseCustomAuthority(checked === true)}
                />
                <Label 
                  htmlFor="use-custom-authority"
                  className="text-sm font-medium cursor-pointer"
                >
                  Specify current mint authority (if different from your wallet)
                </Label>
              </div>
              
              {useCustomAuthority && (
                <div className="space-y-2 mt-2">
                  <Label htmlFor="custom-authority" className="text-sm">Current Authority Public Key</Label>
                  <Input
                    id="custom-authority"
                    value={customAuthority}
                    onChange={(e) => setCustomAuthority(e.target.value)}
                    placeholder="Enter the current mint authority public key"
                    className="font-mono text-xs"
                  />
                  <div className="flex gap-2 flex-wrap mt-1">
                    {authorityStatus.currentAuthority && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setCustomAuthority(authorityStatus.currentAuthority || '')}
                      >
                        Use detected value: {authorityStatus.currentAuthority?.substring(0, 8)}...
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setCustomAuthority(POOL_AUTHORITY)}
                    >
                      Use Solscan value
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
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