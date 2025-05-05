import { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 as LoaderIcon, AlertCircle, Info as InfoIcon, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createNewToken, verifyTokenMintAuthority } from "@/lib/create-token";
import { useQueryClient } from "@tanstack/react-query";
import { useMultiWallet } from "@/context/MultiWalletContext";
import { getConfig, useUpdateConfig } from "@/lib/config";

export function CreateTokenCard() {
  const { connected, wallet } = useMultiWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [tokenName, setTokenName] = useState("Your Opportunity Savings");
  const [tokenSymbol, setTokenSymbol] = useState("YOS");
  const [tokenDecimals, setTokenDecimals] = useState(9);
  const [initialSupply, setInitialSupply] = useState(10_000_000);
  const [newTokenInfo, setNewTokenInfo] = useState<{
    mintAddress: string;
    tokenAccount: string;
    signature: string;
    verified: boolean;
  } | null>(null);

  const updateConfig = useUpdateConfig();
  
  const handleCreateToken = async () => {
    if (!connected || !wallet) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your admin wallet first",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setLoading(true);
      
      const result = await createNewToken(
        wallet,
        tokenName,
        tokenSymbol,
        tokenDecimals,
        initialSupply
      );
      
      // Verify the token authority was set correctly
      const verificationResult = await verifyTokenMintAuthority(result.mintAddress);
      
      setNewTokenInfo({
        ...result,
        verified: verificationResult.isCorrect,
      });
      
      toast({
        title: "Token Created Successfully",
        description: `New YOS token created with address: ${result.mintAddress}`,
        variant: "default",
      });
      
    } catch (error) {
      console.error("Error creating token:", error);
      toast({
        title: "Token Creation Failed",
        description: error.message || "An error occurred while creating the token",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdateProgramConfig = async () => {
    if (!newTokenInfo) return;
    
    try {
      setLoading(true);
      
      // Update the configuration
      await updateConfig({
        yosMint: newTokenInfo.mintAddress
      });
      
      toast({
        title: "Configuration Updated",
        description: "The program configuration has been updated to use the new YOS token",
        variant: "default",
      });
      
      // Invalidate any queries that might use the YOS mint
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      
    } catch (error) {
      console.error("Error updating config:", error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update program configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New YOS Token</CardTitle>
        <CardDescription>
          Create a new YOS token with your wallet as the authority and set it up for the program
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!connected && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Wallet Not Connected</AlertTitle>
            <AlertDescription>
              Connect an admin wallet to create a new token
            </AlertDescription>
          </Alert>
        )}
        
        <Alert className="mb-4 border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Token Creation Information</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              This will create a new YOS token with your admin wallet as the initial authority.
              The process will:
            </p>
            <ol className="list-decimal ml-4 space-y-1">
              <li>Create a new token mint with your wallet as the authority</li>
              <li>Mint the initial supply to your wallet</li>
              <li>Transfer the mint authority to the program's PDA</li>
              <li>Update the program configuration to use the new token</li>
            </ol>
            <p className="font-medium mt-2">
              Once created, only the program will be able to mint additional tokens.
            </p>
          </AlertDescription>
        </Alert>
        
        {newTokenInfo ? (
          <div className="space-y-4">
            <Alert 
              variant={newTokenInfo.verified ? "default" : "destructive"}
              className={newTokenInfo.verified ? 
                "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300" : 
                ""}
            >
              {newTokenInfo.verified ? 
                <CheckCircle2 className="h-4 w-4" /> : 
                <AlertCircle className="h-4 w-4" />
              }
              <AlertTitle>
                {newTokenInfo.verified ? 
                  "Token Created Successfully" : 
                  "Token Created But Verification Failed"
                }
              </AlertTitle>
              <AlertDescription>
                {newTokenInfo.verified ? 
                  "The new YOS token was created and the program was set as the mint authority." : 
                  "The token was created but the program authority verification failed."
                }
              </AlertDescription>
            </Alert>
            
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-xs font-mono space-y-1.5">
              <div>YOS Token Mint: <span className="text-blue-600 dark:text-blue-400">{newTokenInfo.mintAddress}</span></div>
              <div>Your Token Account: <span className="text-blue-600 dark:text-blue-400">{newTokenInfo.tokenAccount}</span></div>
              <div>Transaction: <a 
                href={`https://explorer.solana.com/tx/${newTokenInfo.signature}?cluster=devnet`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                View on Solana Explorer
              </a></div>
            </div>
            
            {newTokenInfo.verified && (
              <div className="mt-4">
                <Label htmlFor="update-config" className="block mb-2">
                  Update Program Configuration
                </Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Update the program configuration to use the new YOS token mint.
                  Current YOS mint: <code className="font-mono">{getConfig().yosMint}</code>
                </p>
                <Button
                  onClick={handleUpdateProgramConfig}
                  disabled={loading}
                >
                  {loading ? <LoaderIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Update Program Configuration
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="token-name">Token Name</Label>
                <Input
                  id="token-name"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="Token Name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="token-symbol">Token Symbol</Label>
                <Input
                  id="token-symbol"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  placeholder="Token Symbol"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="token-decimals">Decimals</Label>
                  <Input
                    id="token-decimals"
                    type="number"
                    value={tokenDecimals}
                    onChange={(e) => setTokenDecimals(parseInt(e.target.value))}
                    min={0}
                    max={9}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="initial-supply">Initial Supply</Label>
                  <Input
                    id="initial-supply"
                    type="number"
                    value={initialSupply}
                    onChange={(e) => setInitialSupply(parseFloat(e.target.value))}
                    min={1}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        {!newTokenInfo && (
          <Button 
            onClick={handleCreateToken}
            disabled={loading || !connected}
          >
            {loading ? <LoaderIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create New YOS Token
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}