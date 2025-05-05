import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { TestTokenDisplay } from '@/components/TestTokenDisplay';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function TestPage() {
  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <h1 className="text-2xl font-bold mb-6">Token Display Testing</h1>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Token Display Test Tool</CardTitle>
            <CardDescription>
              Test how tokens will appear in wallet confirmation screens
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TestTokenDisplay />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Testing Instructions</CardTitle>
            <CardDescription>
              How to use this testing tool
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-lg mb-2">Why We Need Display-Only Instructions</h3>
                <p className="text-muted-foreground">
                  When a transaction interacts with tokens, wallet confirmation screens show values 
                  that sometimes don't match what we expect. This is due to scaling factors in the 
                  token contracts and how wallets interpret these values.
                </p>
              </div>
              
              <div>
                <h3 className="font-medium text-lg mb-2">Current Display Solutions</h3>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li>For <span className="font-medium">YOT</span>: Using integer amounts to avoid decimal display issues</li>
                  <li>For <span className="font-medium">YOS</span>: Using a divisor (currently 1/17000) to fix the "millions display" issue</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium text-lg mb-2">How the Test Works</h3>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li>Enter token amounts you want to test</li>
                  <li>For YOS, adjust the divisor to find the optimal value</li>
                  <li>Click "Test Wallet Display" to create a test transaction</li>
                  <li>Approve in your wallet to see how amounts are displayed</li>
                  <li>No actual tokens are transferred - source and destination are the same</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}