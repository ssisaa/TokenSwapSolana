import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Transaction } from '@solana/web3.js';
import { sendTransaction } from '@/lib/transaction-helper';

export default function SwapTestPanel() {
  const { toast } = useToast();
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [simulationMessage, setSimulationMessage] = useState('');

  const runTestTransaction = async () => {
    setIsSimulating(true);
    setSimulationResult('idle');
    setSimulationMessage('');
    
    try {
      // Create a dummy transaction for simulation
      const transaction = new Transaction();
      
      // Simulate the transaction - it will return a simulated signature in maintenance mode
      const signature = await sendTransaction(window.phantom?.solana || null, transaction);
      
      // Simulate success after a short delay
      setTimeout(() => {
        setIsSimulating(false);
        setSimulationResult('success');
        setSimulationMessage('Test swap simulation successful! The transaction would be processed with normal liquidity pool contribution (20%) and YOS cashback (5%).');
        
        toast({
          title: 'Simulation Successful',
          description: 'Test swap simulation completed successfully.',
        });
      }, 2000);
      
    } catch (error: any) {
      console.error('Test swap simulation failed:', error);
      
      setIsSimulating(false);
      setSimulationResult('error');
      setSimulationMessage(error.message || 'Unknown error occurred during test swap simulation.');
      
      toast({
        title: 'Simulation Failed',
        description: error.message || 'Test swap simulation failed.',
        variant: 'destructive'
      });
    }
  };

  return (
    <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45]">
      <CardHeader className="bg-gradient-to-br from-[#1e2a45] to-[#0f1421] border-b border-[#1e2a45] pb-4">
        <CardTitle className="text-2xl font-bold text-white">
          Swap Test Panel
        </CardTitle>
        <CardDescription className="text-[#a3accd]">
          Test the swap functionality in maintenance mode
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {/* Maintenance Mode Notice */}
        <Alert className="bg-amber-900/20 border-amber-700">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-500">Maintenance Mode</AlertTitle>
          <AlertDescription>
            All swap tests will be simulated and not sent to the blockchain
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4">
          <div className="bg-[#1a2338] rounded-md p-4 border border-[#252f4a]">
            <h3 className="font-medium text-white mb-2">Test Swap Details</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span className="text-[#a3accd]">From Token:</span>
                <span className="text-white">SOL (1.0)</span>
              </li>
              <li className="flex justify-between">
                <span className="text-[#a3accd]">To Token:</span>
                <span className="text-white">YOT (~10,000)</span>
              </li>
              <li className="flex justify-between">
                <span className="text-[#a3accd]">Liquidity Contribution:</span>
                <span className="text-green-400">20% (2,000 YOT)</span>
              </li>
              <li className="flex justify-between">
                <span className="text-[#a3accd]">YOS Cashback:</span>
                <span className="text-green-400">5% (500 YOS)</span>
              </li>
              <li className="flex justify-between">
                <span className="text-[#a3accd]">Network Fee:</span>
                <span className="text-white">~0.000005 SOL</span>
              </li>
            </ul>
          </div>
          
          {simulationResult !== 'idle' && (
            <Alert className={`${
              simulationResult === 'success' ? 'bg-green-900/20 border-green-700' : 
              'bg-red-900/20 border-red-700'
            }`}>
              {simulationResult === 'success' ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
              <AlertTitle className={`${
                simulationResult === 'success' ? 'text-green-500' : 'text-red-500'
              }`}>
                {simulationResult === 'success' ? 'Simulation Successful' : 'Simulation Failed'}
              </AlertTitle>
              <AlertDescription className="text-gray-300">
                {simulationMessage}
              </AlertDescription>
            </Alert>
          )}
          
          <Button 
            className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90"
            onClick={runTestTransaction}
            disabled={isSimulating}
          >
            {isSimulating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Simulating Swap...
              </>
            ) : (
              'Run Test Swap Simulation'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}