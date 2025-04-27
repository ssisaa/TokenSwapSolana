import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StakingCard from '@/components/StakingCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Coins, ArrowRight, Shield } from 'lucide-react';
import { useMultiWallet } from '@/context/MultiWalletContext';

export default function Stake() {
  const { connected } = useMultiWallet();

  // Benefits of staking - these would typically come from your protocol documentation
  const stakingBenefits = [
    {
      title: "Earn YOS Rewards",
      description: "Stake YOT tokens to earn YOS rewards automatically calculated on-chain.",
      icon: <Coins className="h-6 w-6 text-primary" />
    },
    {
      title: "Blockchain Security",
      description: "All staking operations are secured by Solana blockchain with mandatory wallet signatures.",
      icon: <Shield className="h-6 w-6 text-primary" />
    },
    {
      title: "Flexible Staking",
      description: "Stake and unstake your tokens anytime with no minimum lock period.",
      icon: <ArrowRight className="h-6 w-6 text-primary" />
    },
    {
      title: "Transparent Rewards",
      description: "Rewards calculation is transparent and verifiable on the blockchain.",
      icon: <Wallet className="h-6 w-6 text-primary" />
    }
  ];

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-8">
        <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Staking</h1>
            <p className="text-muted-foreground">
              Stake your YOT tokens to earn YOS rewards
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Staking Card in first column (takes 1/3 of space) */}
          <div className="md:col-span-1">
            <StakingCard />
          </div>

          {/* Info cards in second column (takes 2/3 of space) */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>How Staking Works</CardTitle>
                <CardDescription>
                  Earn rewards by staking your YOT tokens in our secure Solana program
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p>
                    Staking allows you to earn YOS tokens by locking your YOT tokens in our staking program. 
                    All operations are performed on-chain with your wallet signature for maximum security.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {stakingBenefits.map((benefit, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 rounded-lg border">
                        <div className="mt-0.5">{benefit.icon}</div>
                        <div>
                          <h3 className="font-medium">{benefit.title}</h3>
                          <p className="text-sm text-muted-foreground">{benefit.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Staking Security</CardTitle>
                <CardDescription>
                  Our staking program is built with security as the highest priority
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p>
                    Security is paramount in our staking protocol. All staking operations require your explicit wallet 
                    signature, ensuring that only you can control your staked tokens.
                  </p>
                  
                  <div className="bg-primary/10 p-4 rounded-lg">
                    <h3 className="font-medium text-primary">💡 Key Security Features</h3>
                    <ul className="mt-2 space-y-2 text-sm">
                      <li className="flex items-start">
                        <span className="font-bold mr-2">•</span>
                        <span>Mandatory wallet signatures for all blockchain interactions</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-bold mr-2">•</span>
                        <span>On-chain storage of staking data through Program Derived Addresses (PDAs)</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-bold mr-2">•</span>
                        <span>Transparent rewards calculation visible on the blockchain</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-bold mr-2">•</span>
                        <span>No client-side storage of sensitive information</span>
                      </li>
                    </ul>
                  </div>
                  
                  {!connected && (
                    <div className="mt-4">
                      <Button variant="outline" className="w-full" onClick={() => {}}>
                        <Wallet className="mr-2 h-4 w-4" />
                        Connect Wallet to Start Staking
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}