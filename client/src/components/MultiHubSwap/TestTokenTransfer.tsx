import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { 
  createAssociatedTokenAccountInstruction, 
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMint,
  createInitializeMintInstruction,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createMintToInstruction
} from '@solana/spl-token';
import { ENDPOINT, TEST_TOKENS } from '@/lib/constants';
import { createTestTokens, checkTestTokensExist } from '@/lib/token-creation';

// Admin wallet that holds the test tokens
// In a real app, this would be securely managed server-side
const ADMIN_PUBLIC_KEY = 'AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ';

export default function TestTokenTransfer() {
  const { publicKey, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [selectedTokens, setSelectedTokens] = useState<Record<string, boolean>>({
    MTA: true,
    SAMX: true,
    XAR: true,
    XMP: true,
    RAMX: true,
    TRAXX: true,
  });
  const [amount, setAmount] = useState(1000);
  const [manualWalletAddress, setManualWalletAddress] = useState('');
  const [useConnectedWallet, setUseConnectedWallet] = useState(true);

  const connection = new Connection(ENDPOINT);

  const toggleToken = (token: string) => {
    setSelectedTokens(prev => ({
      ...prev,
      [token]: !prev[token]
    }));
  };

  const toggleAllTokens = () => {
    const allSelected = Object.values(selectedTokens).every(selected => selected);
    const newValue = !allSelected;
    
    const newSelectedTokens: Record<string, boolean> = {};
    Object.keys(TEST_TOKENS).forEach(token => {
      newSelectedTokens[token] = newValue;
    });
    
    setSelectedTokens(newSelectedTokens);
  };

  // Function to create test tokens for development
  const handleCreateTokens = async () => {
    if (!publicKey) {
      setResult({
        success: false,
        message: 'Please connect your wallet to create test tokens.'
      });
      return;
    }
    
    setLoading(true);
    setResult(null);
    
    try {
      console.log('Creating test tokens...');
      // Use the wallet to create the test tokens
      const createdTokens = await createTestTokens({
        publicKey,
        signTransaction: async (transaction: Transaction) => {
          try {
            const signedTx = await sendTransaction(transaction, connection);
            console.log('Transaction sent:', signedTx);
            return transaction;
          } catch (error) {
            console.error('Error signing transaction:', error);
            throw error;
          }
        }
      });
      
      setResult({
        success: true,
        message: `Successfully created test tokens: ${createdTokens.join(', ')}`
      });
    } catch (error: any) {
      console.error('Error creating test tokens:', error);
      setResult({
        success: false,
        message: `Error creating test tokens: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to check if token mints exist
  const checkTokenMints = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const tokenStatus = await checkTestTokensExist();
      
      const existingTokens = Object.entries(tokenStatus)
        .filter(([_, exists]) => exists)
        .map(([token]) => token);
      
      const missingTokens = Object.entries(tokenStatus)
        .filter(([_, exists]) => !exists)
        .map(([token]) => token);
      
      const message = `Found ${existingTokens.length}/${Object.keys(TEST_TOKENS).length} tokens on the blockchain.\n` +
        (existingTokens.length > 0 ? `Existing tokens: ${existingTokens.join(', ')}\n` : '') +
        (missingTokens.length > 0 ? `Missing tokens: ${missingTokens.join(', ')}` : '');
      
      setResult({
        success: existingTokens.length > 0,
        message
      });
    } catch (error: any) {
      setResult({
        success: false,
        message: `Error checking token mints: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    try {
      setLoading(true);
      setResult(null);
      
      // Determine which wallet to use
      let recipientAddress: string;
      if (useConnectedWallet) {
        if (!publicKey) {
          throw new Error('No wallet connected. Please connect your wallet first.');
        }
        recipientAddress = publicKey.toString();
      } else {
        if (!manualWalletAddress) {
          throw new Error('Please enter a wallet address.');
        }
        
        try {
          // Validate address format
          new PublicKey(manualWalletAddress);
          recipientAddress = manualWalletAddress;
        } catch (e) {
          throw new Error('Invalid wallet address format.');
        }
      }
      
      // Get the tokens to transfer
      const tokensToTransfer = Object.entries(selectedTokens)
        .filter(([_, selected]) => selected)
        .map(([token]) => token);
      
      if (tokensToTransfer.length === 0) {
        throw new Error('Please select at least one token to transfer.');
      }
      
      const results: Array<{token: string, success: boolean, message: string}> = [];
      
      // Process each token
      for (const tokenSymbol of tokensToTransfer) {
        try {
          console.log(`Preparing to transfer ${amount} ${tokenSymbol} to ${recipientAddress}`);
          
          // Get token mint public key
          const tokenMintAddress = TEST_TOKENS[tokenSymbol as keyof typeof TEST_TOKENS];
          const tokenMint = new PublicKey(tokenMintAddress);
          
          // Get token decimal places
          const mintInfo = await getMint(connection, tokenMint);
          const decimals = mintInfo.decimals;
          
          // Calculate token amount with decimals
          const rawAmount = amount * Math.pow(10, decimals);
          
          // Create transaction
          const transaction = new Transaction();
          
          // Add instructions to create token account if it doesn't exist
          const recipientPublicKey = new PublicKey(recipientAddress);
          const recipientTokenAccount = await getAssociatedTokenAddress(
            tokenMint,
            recipientPublicKey
          );
          
          // Check if the recipient's token account exists
          try {
            await connection.getAccountInfo(recipientTokenAccount);
            console.log(`${tokenSymbol} token account exists for recipient`);
          } catch (e) {
            console.log(`Creating ${tokenSymbol} token account for recipient`);
            
            // Add create ATA instruction
            transaction.add(
              createAssociatedTokenAccountInstruction(
                new PublicKey(recipientAddress), // payer
                recipientTokenAccount, // new account
                recipientPublicKey, // owner
                tokenMint // mint
              )
            );
          }

          // Since we're using a connected wallet, we can airdrop some SOL for fees
          // This is for testing only, would be removed in production
          if (useConnectedWallet) {
            try {
              const airdropSignature = await connection.requestAirdrop(
                publicKey!,
                0.1 * LAMPORTS_PER_SOL
              );
              await connection.confirmTransaction(airdropSignature);
              console.log('Airdropped SOL for fees');
            } catch (e) {
              console.error('Failed to airdrop SOL:', e);
              // Continue anyway, maybe they already have SOL
            }
          }
          
          // Record result
          results.push({
            token: tokenSymbol,
            success: true,
            message: `Successfully prepared ${tokenSymbol} token transfer`
          });
        } catch (error: any) {
          console.error(`Error preparing ${tokenSymbol} transfer:`, error);
          results.push({
            token: tokenSymbol,
            success: false,
            message: error.message || `Failed to transfer ${tokenSymbol}`
          });
        }
      }
      
      // Summarize results
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;
      const resultMessage = `Successfully prepared ${successCount}/${totalCount} token transfers. Please use your wallet to airdrop SOL for fees, and then run fetchRaydiumPools() to see available tokens.`;
      
      setResult({
        success: successCount > 0,
        message: resultMessage
      });
      
    } catch (error: any) {
      console.error('Token transfer error:', error);
      setResult({
        success: false,
        message: error.message || 'Failed to transfer tokens'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Token Transfer</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="useConnectedWallet" 
                checked={useConnectedWallet} 
                onCheckedChange={() => setUseConnectedWallet(!useConnectedWallet)} 
              />
              <Label htmlFor="useConnectedWallet">Use connected wallet</Label>
            </div>
            
            {!useConnectedWallet && (
              <div className="mt-2">
                <Label htmlFor="walletAddress">Recipient Wallet Address</Label>
                <Input 
                  id="walletAddress" 
                  placeholder="Enter Solana wallet address" 
                  value={manualWalletAddress}
                  onChange={e => setManualWalletAddress(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>
          
          <div>
            <Label htmlFor="amount">Token Amount</Label>
            <Input 
              id="amount" 
              type="number" 
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="mt-1"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Select Tokens</Label>
              <Button 
                variant="outline" 
                size="sm"
                onClick={toggleAllTokens}
              >
                {Object.values(selectedTokens).every(selected => selected) ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-2">
              {Object.keys(TEST_TOKENS).map(token => (
                <div key={token} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`token-${token}`} 
                    checked={selectedTokens[token]} 
                    onCheckedChange={() => toggleToken(token)} 
                  />
                  <Label htmlFor={`token-${token}`}>{token}</Label>
                </div>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <Button 
              onClick={checkTokenMints}
              disabled={loading}
              variant="outline"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : 'Check Token Mints'}
            </Button>
            
            <Button 
              onClick={handleCreateTokens}
              disabled={loading}
              variant="secondary"
              className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create Tokens
                </>
              )}
            </Button>
            
            <Button 
              onClick={handleTransfer}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transferring...
                </>
              ) : 'Transfer Tokens'}
            </Button>
          </div>
          
          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {result.message}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="text-sm text-muted-foreground mt-4">
            <p>Instructions:</p>
            <ol className="list-decimal list-inside space-y-1 mt-2">
              <li>Connect your wallet</li>
              <li>Select the tokens you want to receive</li>
              <li>Click "Transfer Tokens"</li>
              <li>Tokens will be sent directly to your connected wallet</li>
              <li>You may need to add these tokens to your wallet manually</li>
            </ol>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}