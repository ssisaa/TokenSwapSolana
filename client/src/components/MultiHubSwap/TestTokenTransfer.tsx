import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useWalletContext } from '@/components/MultiWalletContext';
import { transferTestTokens, checkTokenBalances, TEST_TOKENS } from '@/lib/test-token-transfer';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, Check, AlertCircle } from "lucide-react";

interface TransferStatus {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: string;
  signatures: string[];
}

export default function TestTokenTransfer() {
  const { wallet, connected } = useWalletContext();
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<number>(1000);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [transferStatus, setTransferStatus] = useState<TransferStatus>({
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: '',
    signatures: []
  });
  
  // Available tokens for transfer
  const availableTokens = Object.keys(TEST_TOKENS);
  
  // Toggle token selection
  const toggleToken = (token: string) => {
    if (selectedTokens.includes(token)) {
      setSelectedTokens(selectedTokens.filter(t => t !== token));
    } else {
      setSelectedTokens([...selectedTokens, token]);
    }
  };
  
  // Select all tokens
  const selectAllTokens = () => {
    if (selectedTokens.length === availableTokens.length) {
      setSelectedTokens([]);
    } else {
      setSelectedTokens([...availableTokens]);
    }
  };
  
  // Handle transfer
  const handleTransfer = async () => {
    if (!connected || !wallet) {
      setTransferStatus({
        isLoading: false,
        isSuccess: false,
        isError: true,
        error: 'Wallet not connected',
        signatures: []
      });
      return;
    }
    
    if (!recipient) {
      setTransferStatus({
        isLoading: false,
        isSuccess: false,
        isError: true,
        error: 'Recipient address is required',
        signatures: []
      });
      return;
    }
    
    if (selectedTokens.length === 0) {
      setTransferStatus({
        isLoading: false,
        isSuccess: false,
        isError: true,
        error: 'Select at least one token',
        signatures: []
      });
      return;
    }
    
    try {
      setTransferStatus({
        isLoading: true,
        isSuccess: false,
        isError: false,
        error: '',
        signatures: []
      });
      
      // Make transfers
      const signatures = await transferTestTokens(
        wallet,
        [recipient],
        selectedTokens as any,
        amount
      );
      
      setTransferStatus({
        isLoading: false,
        isSuccess: true,
        isError: false,
        error: '',
        signatures
      });
      
    } catch (error: any) {
      setTransferStatus({
        isLoading: false,
        isSuccess: false,
        isError: true,
        error: error.message || 'Transfer failed',
        signatures: []
      });
    }
  };
  
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Test Token Transfer</CardTitle>
        <CardDescription>
          Transfer test tokens to the specified address for testing multi-hop swaps
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Address</Label>
            <Input
              id="recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Solana wallet address"
              disabled={transferStatus.isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (per token)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Amount per token"
              disabled={transferStatus.isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Select Tokens</Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={selectAllTokens}
                disabled={transferStatus.isLoading}
              >
                {selectedTokens.length === availableTokens.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {availableTokens.map(token => (
                <div className="flex items-center space-x-2" key={token}>
                  <Checkbox 
                    id={`token-${token}`} 
                    checked={selectedTokens.includes(token)}
                    onCheckedChange={() => toggleToken(token)}
                    disabled={transferStatus.isLoading}
                  />
                  <Label 
                    htmlFor={`token-${token}`}
                    className="font-medium"
                  >
                    {token}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          
          {transferStatus.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {transferStatus.error}
              </AlertDescription>
            </Alert>
          )}
          
          {transferStatus.isSuccess && (
            <Alert className="bg-green-50 border-green-200">
              <Check className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Success</AlertTitle>
              <AlertDescription className="text-green-700">
                Tokens transferred successfully!
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleTransfer} 
          disabled={transferStatus.isLoading || !connected}
          className="w-full"
        >
          {transferStatus.isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Transferring...
            </>
          ) : 'Transfer Tokens'}
        </Button>
      </CardFooter>
    </Card>
  );
}