import { useState } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Redirect } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut } from "lucide-react";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminSettings from "@/components/admin/AdminSettings";
import AdminStatistics from "@/components/admin/AdminStatistics";
import AdminTransactions from "@/components/admin/AdminTransactions";

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
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="statistics" disabled>Statistics</TabsTrigger>
          <TabsTrigger value="transactions" disabled>Transactions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="settings">
          <AdminSettings />
        </TabsContent>
        
        <TabsContent value="statistics">
          <div className="p-8 text-center">
            <p className="text-muted-foreground">Statistics dashboard coming soon</p>
          </div>
        </TabsContent>
        
        <TabsContent value="transactions">
          <div className="p-8 text-center">
            <p className="text-muted-foreground">Transaction management coming soon</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}