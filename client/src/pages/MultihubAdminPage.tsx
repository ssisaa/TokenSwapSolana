import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Wrench, Ban, RefreshCw, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import * as multihubClient from '@/lib/multihub-client';

export default function MultihubAdminPage() {
  const { isAdmin, login } = useAdminAuth();
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isProgramStateLoading, setIsProgramStateLoading] = useState<boolean>(true);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [programState, setProgramState] = useState<any>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  
  // Refresh program state
  const refreshProgramState = async () => {
    setIsProgramStateLoading(true);
    
    try {
      // Check if program is initialized
      const initialized = await multihubClient.isInitialized();
      setIsInitialized(initialized);
      
      if (initialized) {
        // Get program state details
        const state = await multihubClient.getProgramState();
        setProgramState(state);
      } else {
        setProgramState(null);
      }
    } catch (error) {
      console.error("Error fetching program state:", error);
      toast({
        title: "Error",
        description: "Failed to get program state. See console for details.",
        variant: "destructive"
      });
    } finally {
      setIsProgramStateLoading(false);
      setLastRefreshed(new Date());
    }
  };
  
  // Initialize program
  const handleInitialize = async () => {
    if (!isAdmin) {
      toast({
        title: "Admin Access Required",
        description: "You must be logged in as admin to initialize the program.",
        variant: "destructive"
      });
      return;
    }
    
    setIsInitializing(true);
    
    try {
      toast({
        title: "Initializing Program",
        description: "Please approve the transaction in your wallet.",
      });
      
      // Call initialize function from client
      const tx = await multihubClient.initialize(window.solana);
      
      toast({
        title: "Program Initialized",
        description: `Transaction signature: ${tx.substring(0, 12)}...`,
        variant: "default"
      });
      
      // Refresh program state after successful initialization
      await refreshProgramState();
    } catch (error) {
      console.error("Initialization error:", error);
      toast({
        title: "Initialization Failed",
        description: String(error),
        variant: "destructive"
      });
    } finally {
      setIsInitializing(false);
    }
  };
  
  // Close program
  const handleClose = async () => {
    if (!isAdmin) {
      toast({
        title: "Admin Access Required",
        description: "You must be logged in as admin to close the program.",
        variant: "destructive"
      });
      return;
    }
    
    setIsClosing(true);
    
    try {
      toast({
        title: "Closing Program",
        description: "Please approve the transaction in your wallet.",
      });
      
      // Call close function from client
      const tx = await multihubClient.closeProgram(window.solana);
      
      toast({
        title: "Program Closed",
        description: `Transaction signature: ${tx.substring(0, 12)}...`,
        variant: "default"
      });
      
      // Refresh program state after successful closure
      await refreshProgramState();
    } catch (error) {
      console.error("Close error:", error);
      toast({
        title: "Close Failed",
        description: String(error),
        variant: "destructive"
      });
    } finally {
      setIsClosing(false);
    }
  };
  
  // Check program state when component mounts or admin status changes
  useEffect(() => {
    if (isAdmin) {
      refreshProgramState();
    }
  }, [isAdmin]);
  
  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  
  // Format basis points to percentage
  const formatBasisPoints = (basisPoints: number) => {
    return (basisPoints / 100).toFixed(2) + '%';
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">MultiHub Swap Admin Panel</h1>
      
      {!isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Admin Access Required</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Access Restricted</AlertTitle>
              <AlertDescription>
                You need admin privileges to access this page.
              </AlertDescription>
            </Alert>
            <Button onClick={login}>Login as Admin</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Program Status Card */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle>Program Status</CardTitle>
                  <Button variant="outline" size="sm" onClick={refreshProgramState} disabled={isProgramStateLoading}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isProgramStateLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center mb-4">
                      <div className="mr-2">Status:</div>
                      {isInitialized ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Initialized
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-500 border-red-500">
                          <Ban className="h-3 w-3 mr-1" />
                          Not Initialized
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-4 mb-4">
                      <Button onClick={handleInitialize} disabled={isInitialized || isInitializing || isClosing}>
                        {isInitializing ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Initializing...
                          </>
                        ) : (
                          <>
                            <Wrench className="h-4 w-4 mr-2" />
                            Initialize Program
                          </>
                        )}
                      </Button>
                      
                      <Button 
                        variant="destructive" 
                        onClick={handleClose} 
                        disabled={!isInitialized || isInitializing || isClosing}
                      >
                        {isClosing ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Closing...
                          </>
                        ) : (
                          <>
                            <Ban className="h-4 w-4 mr-2" />
                            Close Program
                          </>
                        )}
                      </Button>
                    </div>
                    
                    <div className="text-sm text-gray-500 mt-2">
                      Last refreshed: {lastRefreshed.toLocaleString()}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            
            {/* Program Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Program Details</CardTitle>
              </CardHeader>
              <CardContent>
                {isProgramStateLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin" />
                  </div>
                ) : !isInitialized ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Not Initialized</AlertTitle>
                    <AlertDescription>
                      The program is not initialized. Initialize it to see program details.
                    </AlertDescription>
                  </Alert>
                ) : programState ? (
                  <div className="space-y-4">
                    <div>
                      <div className="font-semibold">Admin Address:</div>
                      <div className="text-sm font-mono break-all">
                        {programState.admin?.toString() || 'Unknown'}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="font-semibold">Liquidity Contribution:</div>
                        <div>{formatBasisPoints(programState.liquidityContributionRate || 0)}</div>
                      </div>
                      <div>
                        <div className="font-semibold">Admin Fee:</div>
                        <div>{formatBasisPoints(programState.adminFeeRate || 0)}</div>
                      </div>
                      <div>
                        <div className="font-semibold">YOS Cashback:</div>
                        <div>{formatBasisPoints(programState.yosCashbackRate || 0)}</div>
                      </div>
                      <div>
                        <div className="font-semibold">Swap Fee:</div>
                        <div>{formatBasisPoints(programState.swapFeeRate || 0)}</div>
                      </div>
                      <div>
                        <div className="font-semibold">Referral Rate:</div>
                        <div>{formatBasisPoints(programState.referralRate || 0)}</div>
                      </div>
                    </div>
                    
                    {programState.totalSwaps !== undefined && (
                      <div>
                        <div className="font-semibold">Total Swaps Processed:</div>
                        <div>{programState.totalSwaps}</div>
                      </div>
                    )}
                    
                    {programState.lastSwapTime && (
                      <div>
                        <div className="font-semibold">Last Swap Time:</div>
                        <div>{formatTimestamp(programState.lastSwapTime)}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Data</AlertTitle>
                    <AlertDescription>
                      Failed to load program details. Try refreshing.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Transaction Monitor */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction Monitor</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Debug Console</AlertTitle>
                <AlertDescription>
                  Check your browser console (F12) for detailed transaction logs.
                </AlertDescription>
              </Alert>
              
              <div className="text-sm text-gray-600">
                Tip: You can see transaction details in real-time by monitoring the console logs.
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}