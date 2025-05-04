import React, { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import MultihubSwapV3 from '../lib/multihub-contract-v3';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { DEVNET_ENDPOINT } from '@/lib/multihub-integration-v3';

export default function MultihubV3DebugPanel() {
  const { wallet, connected } = useMultiWallet();
  const connection = new Connection(DEVNET_ENDPOINT);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pdaInfo, setPdaInfo] = useState<any>(null);
  const [programInfo, setProgramInfo] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check PDAs and program info when wallet is connected
  const checkProgramSetup = async () => {
    if (!wallet.publicKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const programId = new PublicKey(MultihubSwapV3.MULTIHUB_SWAP_PROGRAM_ID);
      const [programStateAddress, stateBump] = MultihubSwapV3.findProgramStateAddress();
      const [programAuthorityAddress, authorityBump] = MultihubSwapV3.findProgramAuthorityAddress();
      
      // Get program account info (to verify if program exists)
      const programAccountInfo = await connection.getAccountInfo(programId);
      
      // Get program state account info (to verify if it's initialized)
      const programStateInfo = await connection.getAccountInfo(programStateAddress);
      
      // Get program authority account info
      const authorityInfo = await connection.getAccountInfo(programAuthorityAddress);
      
      // Get program authority SOL balance
      const authorityBalance = await connection.getBalance(programAuthorityAddress);
      const authorityBalanceSOL = authorityBalance / 1_000_000_000; // Convert lamports to SOL
      
      setPdaInfo({
        programStateAddress: programStateAddress.toBase58(),
        stateBump,
        programAuthorityAddress: programAuthorityAddress.toBase58(),
        authorityBump,
        programStateExists: !!programStateInfo,
        programStateSize: programStateInfo?.data.length || 0,
        authorityExists: !!authorityInfo,
        authorityBalanceLamports: authorityBalance,
        authorityBalanceSOL: authorityBalanceSOL,
      });
      
      setProgramInfo({
        programId: programId.toBase58(),
        programExists: !!programAccountInfo,
        programSize: programAccountInfo?.data.length || 0,
        programExecutable: programAccountInfo?.executable || false,
        programOwner: programAccountInfo?.owner?.toBase58() || 'Unknown',
        yotMint: MultihubSwapV3.YOT_TOKEN_MINT,
        yosMint: MultihubSwapV3.YOS_TOKEN_MINT,
      });
      
    } catch (err: any) {
      console.error('Error checking program setup:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (connected) {
      checkProgramSetup();
    }
  }, [connected]);
  
  // Verify program authority to fix "InvalidAccountData" error
  const verifyAuthority = async () => {
    if (!wallet.publicKey) return;
    
    setVerifying(true);
    setVerificationResult(null);
    setError(null);
    
    try {
      console.log("Running program authority verification...");
      const result = await MultihubSwapV3.verifyProgramAuthority(connection, wallet);
      
      if (result) {
        setVerificationResult("Program authority successfully verified and funded if needed.");
        // Refresh the program info to show updated balance
        checkProgramSetup();
      } else {
        setVerificationResult("Program authority verification failed. This may cause swap failures.");
      }
    } catch (err: any) {
      console.error("Authority verification error:", err);
      setError(`Authority verification error: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };
  
  // Format bytes as a readable size
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>MultihubSwap V3 Debug Panel</CardTitle>
        <CardDescription>Program and PDA information for debugging</CardDescription>
      </CardHeader>
      <CardContent>
        {!connected && (
          <div className="text-center py-4">
            Connect your wallet to view program information
          </div>
        )}
        
        {connected && (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              <Button 
                onClick={checkProgramSetup} 
                disabled={loading || verifying}
                variant="outline"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Refresh Program Info
              </Button>
              
              <Button 
                onClick={verifyAuthority} 
                disabled={verifying || loading}
                variant="default"
                className={pdaInfo?.authorityBalanceSOL < 0.01 ? "bg-red-600 hover:bg-red-700" : ""}
              >
                {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pdaInfo?.authorityBalanceSOL < 0.01 ? "Fund & Verify Authority" : "Verify Authority"}
              </Button>
            </div>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            
            {verificationResult && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                {verificationResult}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Program Information */}
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Program Info</h3>
                <Separator />
                
                {programInfo && (
                  <div className="space-y-1 text-sm">
                    <div><span className="font-medium">Program ID:</span> {programInfo.programId}</div>
                    <div><span className="font-medium">Program Exists:</span> {programInfo.programExists ? 'Yes' : 'No'}</div>
                    <div><span className="font-medium">Program Size:</span> {formatBytes(programInfo.programSize)}</div>
                    <div><span className="font-medium">Executable:</span> {programInfo.programExecutable ? 'Yes' : 'No'}</div>
                    <div><span className="font-medium">Program Owner:</span> {programInfo.programOwner}</div>
                    <div><span className="font-medium">YOT Mint:</span> {programInfo.yotMint}</div>
                    <div><span className="font-medium">YOS Mint:</span> {programInfo.yosMint}</div>
                  </div>
                )}
                
                {!programInfo && !loading && (
                  <div className="text-sm text-muted-foreground">
                    No program information available
                  </div>
                )}
              </div>
              
              {/* PDA Information */}
              <div className="space-y-2">
                <h3 className="text-lg font-medium">PDA Info</h3>
                <Separator />
                
                {pdaInfo && (
                  <div className="space-y-1 text-sm">
                    <div><span className="font-medium">Program State Address:</span> {pdaInfo.programStateAddress}</div>
                    <div><span className="font-medium">State Bump:</span> {pdaInfo.stateBump}</div>
                    <div><span className="font-medium">Program Authority Address:</span> {pdaInfo.programAuthorityAddress}</div>
                    <div><span className="font-medium">Authority Bump:</span> {pdaInfo.authorityBump}</div>
                    <div><span className="font-medium">State Account Exists:</span> {pdaInfo.programStateExists ? 'Yes' : 'No'}</div>
                    <div><span className="font-medium">State Account Size:</span> {formatBytes(pdaInfo.programStateSize)}</div>
                    <div><span className="font-medium">Authority Account Exists:</span> {pdaInfo.authorityExists ? 'Yes' : 'No'}</div>
                    <div className="font-medium mt-2">Program Authority Balance:</div>
                    <div className={pdaInfo.authorityBalanceSOL < 0.01 ? "text-red-500 font-bold" : pdaInfo.authorityBalanceSOL < 0.05 ? "text-amber-500 font-bold" : "text-green-600"}>
                      {pdaInfo.authorityBalanceSOL.toFixed(6)} SOL
                      {pdaInfo.authorityBalanceSOL < 0.01 && (
                        <span className="ml-2 text-red-500 text-xs">Low balance! Fund now.</span>
                      )}
                      {pdaInfo.authorityBalanceSOL >= 0.01 && pdaInfo.authorityBalanceSOL < 0.05 && (
                        <span className="ml-2 text-amber-500 text-xs">Consider funding soon.</span>
                      )}
                    </div>
                  </div>
                )}
                
                {!pdaInfo && !loading && (
                  <div className="text-sm text-muted-foreground">
                    No PDA information available
                  </div>
                )}
              </div>
            </div>
            
            {loading && (
              <div className="flex justify-center items-center py-4">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                <span>Loading program information...</span>
              </div>
            )}
            
            {verifying && (
              <div className="flex justify-center items-center py-4 bg-blue-50 rounded-lg border border-blue-300 mt-4">
                <Loader2 className="mr-2 h-6 w-6 animate-spin text-blue-600" />
                <span className="text-blue-800">
                  Verifying program authority and funding if needed...
                  <br />
                  <span className="text-xs">This prevents the "InvalidAccountData" error at index 2</span>
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}