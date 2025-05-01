import { useState } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Redirect } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut } from "lucide-react";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminSettings from "@/components/admin/AdminSettings";
import StakingSettings from "@/components/admin/StakingSettings";
import AdminStatistics from "@/components/admin/AdminStatistics";
import AdminTransactions from "@/components/admin/AdminTransactions";
import FundProgramAccounts from "@/components/admin/FundProgramAccounts";
import AdminYieldDistribution from "@/components/admin/AdminYieldDistribution";

export default function AdminPage() {
  const { admin, isLoading, logoutMutation } = useAdminAuth();
  const [activeTab, setActiveTab] = useState("settings");
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!admin) {
    return <AdminLogin />;
  }
  
  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage YOT ecosystem settings and configurations
          </p>
        </div>
        
        <div className="mt-4 md:mt-0 flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">
            Logged in as <span className="font-semibold">{admin.username}</span>
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </>
            )}
          </Button>
        </div>
      </div>
      
      <Separator className="mb-6" />
      
      <Tabs defaultValue="settings" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="settings">Database Settings</TabsTrigger>
          <TabsTrigger value="blockchain">Blockchain Settings</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="settings">
          <AdminSettings />
        </TabsContent>
        
        <TabsContent value="blockchain">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <StakingSettings />
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-md">
                <p className="text-amber-800 font-semibold">Important Note:</p>
                <p className="text-amber-700 text-sm mt-1">
                  Changes made here are written directly to the blockchain and require your admin wallet signature.
                  Rate changes will affect all users immediately upon their next action (stake, unstake, or harvest).
                </p>
              </div>

              {/* Added Program Funding Component */}
              <FundProgramAccounts />
            </div>
            
            {/* Statistics panel next to Blockchain settings */}
            <div>
              <AdminStatistics />
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="statistics">
          <AdminStatistics />
        </TabsContent>
        
        <TabsContent value="transactions">
          <AdminTransactions />
        </TabsContent>
      </Tabs>
    </div>
  );
}