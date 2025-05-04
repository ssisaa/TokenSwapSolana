import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useSolanaWallet";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { YOT_MINT, YOS_MINT } from "@/lib/constants";
import { 
  fundProgramTokenAccount,
  findProgramAuthorityAddress, 
  getTokenBalance 
} from "@/lib/program-admin";
import { formatCurrency } from "@/lib/utils";
import PageHeading from "@/components/PageHeading";
import { ShieldAlert, ArrowUpCircle, Coins, Info, Lock } from "lucide-react";

const ADMIN_WALLET = new PublicKey("AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ");

export default function AdminPage() {
  const { toast } = useToast();
  const { wallet, connected } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [yotAmount, setYotAmount] = useState("");
  const [yosAmount, setYosAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [programAuthority, setProgramAuthority] = useState<PublicKey | null>(null);
  const [yotBalance, setYotBalance] = useState<number | null>(null);
  const [yosBalance, setYosBalance] = useState<number | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Check if connected wallet is admin
  useState(() => {
    const checkAdmin = async () => {
      setLoadingAuth(true);
      try {
        if (connected && wallet) {
          // Check if the connected wallet is the admin wallet
          const isAdminWallet = wallet.publicKey?.toString() === ADMIN_WALLET.toString();
          setIsAdmin(isAdminWallet);
          
          // If admin, get program authority
          if (isAdminWallet) {
            const [authority] = findProgramAuthorityAddress();
            setProgramAuthority(authority);
            await loadTokenBalances(authority);
          }
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Error checking admin status:", err);
      } finally {
        setLoadingAuth(false);
      }
    };
    
    checkAdmin();
  }, [connected, wallet]);
  
  // Load token balances for program authority
  const loadTokenBalances = async (authority: PublicKey) => {
    setLoadingBalances(true);
    try {
      // Get YOT balance
      const yotAta = await getAssociatedTokenAddress(
        new PublicKey(YOT_MINT),
        authority,
        true // allowOwnerOffCurve
      );
      
      // Get YOS balance
      const yosAta = await getAssociatedTokenAddress(
        new PublicKey(YOS_MINT),
        authority,
        true // allowOwnerOffCurve
      );
      
      const [yotBal, yosBal] = await Promise.all([
        getTokenBalance(yotAta),
        getTokenBalance(yosAta)
      ]);
      
      setYotBalance(yotBal);
      setYosBalance(yosBal);
    } catch (err) {
      console.error("Error loading token balances:", err);
      toast({
        title: "Failed to load balances",
        description: "Could not retrieve current program token balances",
        variant: "destructive"
      });
    } finally {
      setLoadingBalances(false);
    }
  };
  
  // Fund YOT token account
  const handleFundYot = async () => {
    if (!connected || !wallet || !isAdmin || !programAuthority) return;
    
    setLoading(true);
    try {
      const amount = parseFloat(yotAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid amount");
      }
      
      const signature = await fundProgramTokenAccount(
        wallet,
        new PublicKey(YOT_MINT),
        amount
      );
      
      toast({
        title: "Successfully funded YOT",
        description: `Funded program with ${amount} YOT. Tx: ${signature.slice(0, 8)}...`,
        variant: "default"
      });
      
      // Reload balances
      if (programAuthority) {
        await loadTokenBalances(programAuthority);
      }
      
      setYotAmount("");
    } catch (err) {
      console.error("Error funding YOT:", err);
      toast({
        title: "Failed to fund YOT",
        description: err instanceof Error ? err.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Fund YOS token account
  const handleFundYos = async () => {
    if (!connected || !wallet || !isAdmin || !programAuthority) return;
    
    setLoading(true);
    try {
      const amount = parseFloat(yosAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid amount");
      }
      
      const signature = await fundProgramTokenAccount(
        wallet,
        new PublicKey(YOS_MINT),
        amount
      );
      
      toast({
        title: "Successfully funded YOS",
        description: `Funded program with ${amount} YOS. Tx: ${signature.slice(0, 8)}...`,
        variant: "default"
      });
      
      // Reload balances
      if (programAuthority) {
        await loadTokenBalances(programAuthority);
      }
      
      setYosAmount("");
    } catch (err) {
      console.error("Error funding YOS:", err);
      toast({
        title: "Failed to fund YOS",
        description: err instanceof Error ? err.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const refreshBalances = async () => {
    if (programAuthority) {
      await loadTokenBalances(programAuthority);
    }
  };

  if (!connected) {
    return (
      <div className="container mx-auto py-6">
        <PageHeading
          title="Admin Tools"
          subtitle="Connect your wallet to access admin features"
          icon={<ShieldAlert className="h-8 w-8 text-primary-400" />}
        />
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please connect your wallet to access admin tools
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Lock className="h-16 w-16 text-gray-400 mb-4" />
            <p className="text-center text-gray-500">
              You must connect a wallet with administrator privileges to access this page
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadingAuth) {
    return (
      <div className="container mx-auto py-6">
        <PageHeading
          title="Admin Tools"
          subtitle="Verifying admin privileges..."
          icon={<ShieldAlert className="h-8 w-8 text-primary-400" />}
        />
        <div className="flex justify-center py-20">
          <div className="animate-spin h-10 w-10 border-4 border-primary-400 rounded-full border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-6">
        <PageHeading
          title="Admin Tools"
          subtitle="Unauthorized access"
          icon={<ShieldAlert className="h-8 w-8 text-primary-400" />}
        />
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-red-500">Access Denied</CardTitle>
            <CardDescription>
              Your wallet does not have administrator privileges
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Lock className="h-16 w-16 text-red-400 mb-4" />
            <p className="text-center text-gray-500">
              The connected wallet ({wallet?.publicKey.toString().slice(0, 8)}...) is not authorized to access admin tools.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <PageHeading
        title="Admin Tools"
        subtitle="Manage program settings and funding"
        icon={<ShieldAlert className="h-8 w-8 text-primary-400" />}
      />
      
      <Tabs defaultValue="funding" className="mt-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="funding">Token Funding</TabsTrigger>
          <TabsTrigger value="settings">Program Settings</TabsTrigger>
        </TabsList>
        
        {/* Token Funding Tab */}
        <TabsContent value="funding">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Coins className="h-5 w-5 mr-2" />
                Fund Program Token Accounts
              </CardTitle>
              <CardDescription>
                Transfer tokens from admin wallet to program authority accounts
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="flex items-center mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
                <Info className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" />
                <p className="text-sm text-amber-600">
                  Program authority: <span className="font-mono text-xs">{programAuthority?.toString()}</span>
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* YOT Funding */}
                <div className="bg-dark-200 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2">Fund YOT Account</h3>
                  
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-400">Current balance:</span>
                    <div className="flex items-center">
                      {loadingBalances ? (
                        <div className="animate-pulse bg-dark-300 h-6 w-24 rounded" />
                      ) : (
                        <span className="font-medium">
                          {yotBalance !== null ? formatCurrency(yotBalance) : '0'} YOT
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-7 w-7 p-0"
                        onClick={refreshBalances}
                        disabled={loadingBalances}
                      >
                        <svg 
                          className={`h-4 w-4 ${loadingBalances ? 'animate-spin' : ''}`} 
                          xmlns="http://www.w3.org/2000/svg" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={yotAmount}
                      onChange={(e) => setYotAmount(e.target.value)}
                      min="0"
                      className="bg-dark-300"
                    />
                    <Button
                      onClick={handleFundYot}
                      disabled={loading || !connected || !yotAmount}
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-current rounded-full border-t-transparent" />
                          <span>Funding...</span>
                        </>
                      ) : (
                        <>
                          <ArrowUpCircle className="h-4 w-4" />
                          <span>Fund</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* YOS Funding */}
                <div className="bg-dark-200 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2">Fund YOS Account</h3>
                  
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-400">Current balance:</span>
                    <div className="flex items-center">
                      {loadingBalances ? (
                        <div className="animate-pulse bg-dark-300 h-6 w-24 rounded" />
                      ) : (
                        <span className="font-medium">
                          {yosBalance !== null ? formatCurrency(yosBalance) : '0'} YOS
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-7 w-7 p-0"
                        onClick={refreshBalances}
                        disabled={loadingBalances}
                      >
                        <svg 
                          className={`h-4 w-4 ${loadingBalances ? 'animate-spin' : ''}`} 
                          xmlns="http://www.w3.org/2000/svg" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={yosAmount}
                      onChange={(e) => setYosAmount(e.target.value)}
                      min="0"
                      className="bg-dark-300"
                    />
                    <Button
                      onClick={handleFundYos}
                      disabled={loading || !connected || !yosAmount}
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-current rounded-full border-t-transparent" />
                          <span>Funding...</span>
                        </>
                      ) : (
                        <>
                          <ArrowUpCircle className="h-4 w-4" />
                          <span>Fund</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-dark-200 rounded-lg">
                <h3 className="text-md font-medium mb-2">Usage Instructions</h3>
                <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-400">
                  <li>Enter the amount of tokens you want to transfer to the program</li>
                  <li>Click "Fund" to initiate the transfer transaction</li>
                  <li>Approve the transaction in your wallet</li>
                  <li>Once confirmed, the program's token balance will be updated</li>
                </ol>
                <p className="mt-2 text-sm text-amber-400">
                  Note: You must have sufficient token balance in your admin wallet to fund the program.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Program Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Program Settings</CardTitle>
              <CardDescription>
                Configure program parameters and settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400">Program settings will be implemented in a future update.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}