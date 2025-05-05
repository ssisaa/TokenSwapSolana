import React, { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRightIcon, InfoIcon } from 'lucide-react';
import { config } from '@/lib/config';
import { findProgramAuthorityAddress } from '@/lib/multihub-contract-v3';
import { getAssociatedTokenAddress } from '@solana/spl-token';

interface MultihubV3TokenTransferPanelProps {
  connection: Connection;
  wallet: any;
}

export default function MultihubV3TokenTransferPanel({ connection, wallet }: MultihubV3TokenTransferPanelProps) {
  const { toast } = useToast();

  // State for mint operation
  const [mintAmount, setMintAmount] = useState('1000000');
  const [selectedToken, setSelectedToken] = useState('YOT');
  const [mintLoading, setMintLoading] = useState(false);

  // State for transfer operation
  const [transferAmount, setTransferAmount] = useState('1000000');
  const [sourceTokenAddress, setSourceTokenAddress] = useState('');
  const [transferTokenType, setTransferTokenType] = useState('YOT');
  const [transferLoading, setTransferLoading] = useState(false);

  // State for derived PDA info
  const [pdaAddress, setPdaAddress] = useState('');
  const [pdaYotAta, setPdaYotAta] = useState('');
  const [pdaYosAta, setPdaYosAta] = useState('');

  useEffect(() => {
    loadProgramAuthority();
  }, []);

  const loadProgramAuthority = async () => {
    try {
      const [programAuthority] = findProgramAuthorityAddress();
      setPdaAddress(programAuthority.toString());
      
      // Get YOT PDA ATA
      const yotMint = new PublicKey(config.tokens.YOT);
      const yotAta = await getAssociatedTokenAddress(
        yotMint,
        programAuthority,
        true // Allow PDA as owner
      );
      setPdaYotAta(yotAta.toString());
      
      // Get YOS PDA ATA
      const yosMint = new PublicKey(config.tokens.YOS);
      const yosAta = await getAssociatedTokenAddress(
        yosMint,
        programAuthority,
        true // Allow PDA as owner
      );
      setPdaYosAta(yosAta.toString());
    } catch (err) {
      console.error("Error loading program authority addresses:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load program authority addresses."
      });
    }
  };

  const handleMintTokens = async () => {
    if (!wallet?.publicKey) {
      toast({
        variant: "destructive",
        title: "Wallet not connected",
        description: "Please connect your wallet to continue."
      });
      return;
    }

    if (!mintAmount || parseFloat(mintAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid amount to mint."
      });
      return;
    }

    setMintLoading(true);
    try {
      const multiHubModule = await import('@/lib/multihub-contract-v3');
      const amount = parseFloat(mintAmount);
      
      // Call the mint function based on selected token
      let result;
      if (selectedToken === 'YOT') {
        result = await multiHubModule.mintTokensToProgramPDA(connection, wallet, amount, 0);
      } else { // YOS
        result = await multiHubModule.mintTokensToProgramPDA(connection, wallet, 0, amount);
      }
      
      toast({
        title: "Mint Successful",
        description: `Successfully minted ${amount} ${selectedToken} tokens to the PDA.`,
      });
      
      // Reset input
      setMintAmount('1000000');
    } catch (err: any) {
      console.error("Error minting tokens:", err);
      toast({
        variant: "destructive",
        title: "Mint Failed",
        description: err.message || "Failed to mint tokens to PDA."
      });
    } finally {
      setMintLoading(false);
    }
  };

  const handleTransferTokens = async () => {
    if (!wallet?.publicKey) {
      toast({
        variant: "destructive",
        title: "Wallet not connected",
        description: "Please connect your wallet to continue."
      });
      return;
    }

    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid amount to transfer."
      });
      return;
    }

    if (!sourceTokenAddress) {
      toast({
        variant: "destructive",
        title: "Invalid source address",
        description: "Please enter a valid source token account address."
      });
      return;
    }

    try {
      // Validate source address
      new PublicKey(sourceTokenAddress);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Invalid source address",
        description: "The address you provided is not a valid Solana address."
      });
      return;
    }

    setTransferLoading(true);
    try {
      const multiHubModule = await import('@/lib/multihub-contract-v3');
      
      const amount = parseFloat(transferAmount);
      const sourceAddress = new PublicKey(sourceTokenAddress);
      
      try {
        const result = await multiHubModule.transferTokensToPDA(
          connection, 
          wallet, 
          sourceAddress, 
          transferTokenType === 'YOT' ? true : false,
          amount
        );
        
        toast({
          title: "Transfer Successful",
          description: `Successfully transferred ${amount} ${transferTokenType} tokens to the PDA.`,
        });
        
        // Reset input fields after successful transfer
        setTransferAmount('1000000');
        setSourceTokenAddress('');
      } catch (transferError: any) {
        console.error("Transfer error:", transferError);
        toast({
          variant: "destructive",
          title: "Transfer Failed",
          description: transferError.message || "Failed to transfer tokens. Check that you have authority over the source account."
        });
      }
      
      // Reset input
      setTransferAmount('1000000');
      setSourceTokenAddress('');
    } catch (err: any) {
      console.error("Error transferring tokens:", err);
      toast({
        variant: "destructive",
        title: "Transfer Failed",
        description: err.message || "Failed to transfer tokens to PDA."
      });
    } finally {
      setTransferLoading(false);
    }
  };

  if (!wallet?.publicKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Admin Token Transfer Panel</CardTitle>
          <CardDescription>Connect wallet to access admin functions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center p-4 text-sm text-muted-foreground border rounded-md">
            <InfoIcon className="h-4 w-4 mr-2" />
            <p>Please connect your wallet to access the token transfer panel.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Token Transfer Panel</CardTitle>
        <CardDescription>Transfer tokens to Program Authority PDAs</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 space-y-3">
          <div className="text-sm">
            <div className="font-medium mb-1">Program Authority PDA:</div>
            <code className="bg-muted p-1 rounded text-xs break-all">{pdaAddress}</code>
          </div>
          <div className="text-sm">
            <div className="font-medium mb-1">Program Authority YOT ATA:</div>
            <code className="bg-muted p-1 rounded text-xs break-all">{pdaYotAta}</code>
          </div>
          <div className="text-sm">
            <div className="font-medium mb-1">Program Authority YOS ATA:</div>
            <code className="bg-muted p-1 rounded text-xs break-all">{pdaYosAta}</code>
          </div>
        </div>

        <Tabs defaultValue="mint">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="mint">Mint from SPL</TabsTrigger>
            <TabsTrigger value="transfer">Transfer from Account</TabsTrigger>
          </TabsList>
          
          <TabsContent value="mint" className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mint-token">Token Type</Label>
              <Select
                value={selectedToken}
                onValueChange={setSelectedToken}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YOT">YOT</SelectItem>
                  <SelectItem value="YOS">YOS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="mint-amount">Amount to Mint</Label>
              <Input
                id="mint-amount"
                type="number"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                placeholder="1000000"
              />
            </div>
            
            <div className="mt-6 flex items-center">
              <Button 
                onClick={handleMintTokens}
                disabled={mintLoading}
                className="w-full"
              >
                {mintLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Mint Tokens to PDA
              </Button>
            </div>
            
            <div className="mt-4 text-sm text-muted-foreground">
              <p>This will mint new tokens directly from the SPL token mint to the Program Authority's ATA.</p>
              <p className="mt-1">Note: Your wallet must have mint authority for this operation to succeed.</p>
            </div>
          </TabsContent>
          
          <TabsContent value="transfer" className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transfer-token">Token Type</Label>
              <Select
                value={transferTokenType}
                onValueChange={setTransferTokenType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YOT">YOT</SelectItem>
                  <SelectItem value="YOS">YOS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="source-address">Source Token Account</Label>
              <Input
                id="source-address"
                value={sourceTokenAddress}
                onChange={(e) => setSourceTokenAddress(e.target.value)}
                placeholder="Enter source token account address"
              />
              <p className="text-xs text-muted-foreground">
                This can be a token account or an SPL token mint with proper authority
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="transfer-amount">Amount to Transfer</Label>
              <Input
                id="transfer-amount"
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="1000000"
              />
            </div>
            
            <div className="mt-4 flex items-center justify-between gap-2 p-3 bg-muted rounded-lg">
              <div className="flex-grow text-center overflow-hidden text-ellipsis whitespace-nowrap">
                <span className="text-sm">{sourceTokenAddress || 'Source Account'}</span>
              </div>
              <ArrowRightIcon className="h-4 w-4 flex-shrink-0 mx-2" />
              <div className="flex-grow text-center overflow-hidden text-ellipsis whitespace-nowrap">
                <span className="text-sm">{transferTokenType === 'YOT' ? pdaYotAta : pdaYosAta}</span>
              </div>
            </div>
            
            <div className="mt-6 flex items-center">
              <Button 
                onClick={handleTransferTokens}
                disabled={transferLoading}
                className="w-full"
              >
                {transferLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Transfer Tokens to PDA
              </Button>
            </div>
            
            <div className="mt-4 text-sm text-muted-foreground">
              <p>This will transfer tokens from a specified token account to the Program Authority's ATA.</p>
              <p className="mt-1">Note: Your wallet must have authority over the source token account for this operation to succeed.</p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}