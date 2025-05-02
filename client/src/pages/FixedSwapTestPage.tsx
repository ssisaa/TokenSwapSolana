import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FixedSwapComponent from '@/components/MultiHubSwap/FixedSwapComponent';

const FixedSwapTestPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">MultiHub Swap Debug Tool</h1>
          <p className="text-muted-foreground">
            Testing fixed contract implementation with enhanced error handling
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>What's Fixed</CardTitle>
            <CardDescription>
              Key improvements in the updated contract and client code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="border rounded-lg p-4">
                <h3 className="font-bold mb-2">Contract Fixes</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Properly allocated state account with Rent validation</li>
                  <li>Correct PDA derivation and bump seed handling</li>
                  <li>Added safeguards against serialization panic</li>
                  <li>Enhanced logging for easier debugging</li>
                  <li>Account ownership and size validation</li>
                </ul>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-bold mb-2">Client Fixes</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Correct instruction data serialization</li>
                  <li>Matching PDA seeds with the contract</li>
                  <li>Proper account ordering in transactions</li>
                  <li>Better transaction simulation handling</li>
                  <li>Descriptive error messages from contract codes</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="swap" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="swap">MultiHub Swap</TabsTrigger>
            <TabsTrigger value="debug">Error Debug</TabsTrigger>
          </TabsList>
          <TabsContent value="swap" className="pt-4">
            <FixedSwapComponent />
          </TabsContent>
          <TabsContent value="debug" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Error Debug Information</CardTitle>
                <CardDescription>
                  Guide to understanding and resolving common transaction errors
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-l-4 border-blue-500 pl-4 py-1">
                    <h3 className="font-bold">Initialization Errors</h3>
                    <p className="text-sm text-muted-foreground">Errors that occur during program setup</p>
                    <table className="w-full mt-2">
                      <tbody>
                        <tr>
                          <td className="font-mono text-sm">0x2</td>
                          <td>Program already initialized</td>
                        </tr>
                        <tr>
                          <td className="font-mono text-sm">0x3</td>
                          <td>Invalid authority address</td>
                        </tr>
                        <tr>
                          <td className="font-mono text-sm">0x11</td>
                          <td>Account not owned by program</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="border-l-4 border-green-500 pl-4 py-1">
                    <h3 className="font-bold">Transaction Errors</h3>
                    <p className="text-sm text-muted-foreground">Errors that occur during token swaps</p>
                    <table className="w-full mt-2">
                      <tbody>
                        <tr>
                          <td className="font-mono text-sm">0x1</td>
                          <td>Program not initialized</td>
                        </tr>
                        <tr>
                          <td className="font-mono text-sm">0x4</td>
                          <td>Slippage tolerance exceeded</td>
                        </tr>
                        <tr>
                          <td className="font-mono text-sm">0x6</td>
                          <td>Insufficient funds</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="border-l-4 border-amber-500 pl-4 py-1">
                    <h3 className="font-bold">Common Issues</h3>
                    <ul className="list-disc ml-5 space-y-1 mt-2 text-sm">
                      <li>Make sure to initialize the program before attempting swaps</li>
                      <li>Check that token accounts exist (they will be auto-created)</li>
                      <li>Ensure wallet has sufficient SOL for transaction fees</li>
                      <li>If "Blockhash expired", try again as network may be congested</li>
                      <li>For PDA mismatches, ensure contract and client code use same seeds</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default FixedSwapTestPage;