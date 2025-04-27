import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle2, GitMerge, Code, Database, ServerCrash, Shield, ArrowLeftRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getIntegrationRequirements } from "@/lib/tokenSwapProgram";
import { Link } from "wouter";

export default function Integration() {
  const requirements = getIntegrationRequirements();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Token Swap Integration Roadmap</h1>
          <p className="text-gray-400 mt-1">Guide to implementing complete token swap functionality</p>
        </div>
        <Link href="/">
          <Button variant="outline" className="text-white">
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Back to Swap Interface
          </Button>
        </Link>
      </div>
      
      <Alert className="bg-dark-400 border-primary-800 text-gray-200">
        <AlertTriangle className="h-5 w-5 text-primary-400" />
        <AlertTitle>Current Implementation Status</AlertTitle>
        <AlertDescription className="text-gray-300">
          <div className="mt-2 space-y-2">
            <div className="flex items-start">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <span className="font-medium text-green-400">Completed:</span> Sending SOL/YOT to the liquidity pool with real blockchain transactions
              </div>
            </div>
            
            <div className="flex items-start">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <span className="font-medium text-green-400">Completed:</span> Transaction verification and explorer links
              </div>
            </div>
            
            <div className="flex items-start">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <span className="font-medium text-green-400">Completed:</span> Receiving tokens back from the pool (using pool authority key)
              </div>
            </div>
            
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <span className="font-medium text-yellow-400">Optimization Needed:</span> Atomic swap transactions (send and receive in one transaction)
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-dark-300 rounded-md border border-green-800">
            <span className="text-green-400 font-medium">✓ Implementation Complete:</span> 
            <span className="text-gray-300"> We've successfully implemented both sides of the token swap process using real blockchain transactions. The implementation uses two separate transactions but ensures tokens are properly exchanged in both directions.</span>
          </div>
        </AlertDescription>
      </Alert>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-dark-100 rounded-xl p-6 shadow-lg">
          <div className="flex items-center mb-4">
            <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
              <GitMerge className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Implementation Requirements</h2>
              <p className="text-sm text-gray-400">Steps needed for complete token swap functionality</p>
            </div>
          </div>
          
          <Separator className="bg-dark-400 my-4" />
          
          <div className="space-y-4">
            {requirements.map((req, i) => (
              <div key={i} className="flex items-start">
                <div className="mt-0.5 bg-dark-300 rounded-full p-1 mr-3">
                  <span className="text-xs text-primary-400 w-5 h-5 flex items-center justify-center">{i + 1}</span>
                </div>
                <p className="text-gray-300">{req}</p>
              </div>
            ))}
          </div>
        </Card>
        
        <Card className="bg-dark-100 rounded-xl p-6 shadow-lg">
          <div className="flex items-center mb-4">
            <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center mr-3">
              <Code className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Resources & References</h2>
              <p className="text-sm text-gray-400">Official documentation and examples</p>
            </div>
          </div>
          
          <Separator className="bg-dark-400 my-4" />
          
          <div className="space-y-4">
            <div className="bg-dark-300 p-4 rounded-lg">
              <h3 className="text-white font-medium mb-2 flex items-center">
                <Database className="h-4 w-4 mr-2 text-primary-400" />
                SPL Token-Swap Program
              </h3>
              <p className="text-gray-400 text-sm mb-3">
                The official Solana Program Library (SPL) token-swap program that facilitates swapping between any two SPL tokens.
              </p>
              <div className="flex flex-wrap gap-2">
                <a 
                  href="https://spl.solana.com/token-swap" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs bg-dark-400 text-primary-400 px-3 py-1.5 rounded-md hover:bg-dark-500"
                >
                  Documentation
                </a>
                <a 
                  href="https://github.com/solana-labs/solana-program-library/tree/master/token-swap/program" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs bg-dark-400 text-primary-400 px-3 py-1.5 rounded-md hover:bg-dark-500"
                >
                  Source Code
                </a>
              </div>
            </div>
            
            <div className="bg-dark-300 p-4 rounded-lg">
              <h3 className="text-white font-medium mb-2 flex items-center">
                <ServerCrash className="h-4 w-4 mr-2 text-primary-400" />
                JavaScript Bindings
              </h3>
              <p className="text-gray-400 text-sm mb-3">
                JavaScript client library for interacting with the token-swap program.
              </p>
              <div className="flex flex-wrap gap-2">
                <a 
                  href="https://github.com/solana-labs/solana-program-library/tree/master/token-swap/js" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs bg-dark-400 text-primary-400 px-3 py-1.5 rounded-md hover:bg-dark-500"
                >
                  JS Library
                </a>
                <a 
                  href="https://www.npmjs.com/package/@solana/spl-token-swap" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs bg-dark-400 text-primary-400 px-3 py-1.5 rounded-md hover:bg-dark-500"
                >
                  NPM Package
                </a>
              </div>
            </div>
            
            <div className="bg-dark-300 p-4 rounded-lg">
              <h3 className="text-white font-medium mb-2 flex items-center">
                <Shield className="h-4 w-4 mr-2 text-primary-400" />
                Security Considerations
              </h3>
              <p className="text-gray-400 text-sm mb-3">
                Important security aspects to consider when implementing a token swap pool.
              </p>
              <ul className="text-gray-400 text-sm space-y-1 list-disc pl-4">
                <li>Always verify account ownership</li>
                <li>Protect pool authority keys</li>
                <li>Validate all transaction inputs</li>
                <li>Test extensively on devnet before mainnet</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
      
      <Card className="bg-dark-100 rounded-xl p-6 shadow-lg">
        <div className="flex items-center mb-4">
          <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center mr-3">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Current Implementation Features</h2>
            <p className="text-sm text-gray-400">What's already working in the application</p>
          </div>
        </div>
        
        <Separator className="bg-dark-400 my-4" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-dark-300 p-4 rounded-lg">
            <h3 className="text-white font-medium mb-2">Real Blockchain Interaction</h3>
            <p className="text-gray-400 text-sm">
              The application connects to real Solana devnet addresses and balances, fetching live data from the blockchain.
            </p>
          </div>
          
          <div className="bg-dark-300 p-4 rounded-lg">
            <h3 className="text-white font-medium mb-2">Wallet Integration</h3>
            <p className="text-gray-400 text-sm">
              Secure wallet connection using Phantom or other Solana wallets, with proper transaction signing.
            </p>
          </div>
          
          <div className="bg-dark-300 p-4 rounded-lg">
            <h3 className="text-white font-medium mb-2">Pool Deposits</h3>
            <p className="text-gray-400 text-sm">
              Successfully sending SOL to the liquidity pool with on-chain confirmation.
            </p>
          </div>
          
          <div className="bg-dark-300 p-4 rounded-lg">
            <h3 className="text-white font-medium mb-2">Transaction History</h3>
            <p className="text-gray-400 text-sm">
              Viewing transaction history with Solana Explorer integration for verification.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}