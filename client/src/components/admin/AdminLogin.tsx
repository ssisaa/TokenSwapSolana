import { useState } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useMultiWallet } from "@/context/MultiWalletContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export default function AdminLogin() {
  const { loginMutation, registerMutation, verifyWalletMutation } = useAdminAuth();
  const { connected, publicKey } = useMultiWallet();
  
  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });
  
  const [registerData, setRegisterData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    isFounder: false,
  });
  
  const [activeTab, setActiveTab] = useState("login");
  
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginData);
  };
  
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (registerData.password !== registerData.confirmPassword) {
      return;
    }
    
    registerMutation.mutate({
      username: registerData.username,
      password: registerData.password,
      isFounder: registerData.isFounder,
      founderPublicKey: registerData.isFounder && connected ? publicKey?.toBase58() : undefined
    });
  };
  
  const handleVerifyWallet = () => {
    if (connected && publicKey) {
      verifyWalletMutation.mutate({ publicKey: publicKey.toBase58() });
    }
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Admin Portal</CardTitle>
        <CardDescription>
          Login to access the admin controls for managing the YOT ecosystem
        </CardDescription>
      </CardHeader>
      
      <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>
        
        <TabsContent value="login">
          <CardContent className="pt-4">
            <form onSubmit={handleLoginSubmit}>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={loginData.username}
                    onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                    required
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                  />
                </div>
                
                <Button type="submit" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>
              </div>
            </form>
            
            {connected && publicKey && (
              <>
                <Separator className="my-4" />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Or verify with your connected wallet
                  </p>
                  <Button 
                    variant="outline"
                    onClick={handleVerifyWallet}
                    disabled={verifyWalletMutation.isPending}
                  >
                    {verifyWalletMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      `Verify with ${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </TabsContent>
        
        <TabsContent value="register">
          <CardContent className="pt-4">
            <form onSubmit={handleRegisterSubmit}>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="reg-username">Username</Label>
                  <Input
                    id="reg-username"
                    type="text"
                    placeholder="Choose a username"
                    value={registerData.username}
                    onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                    required
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="Choose a password"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    required
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="reg-confirm-password">Confirm Password</Label>
                  <Input
                    id="reg-confirm-password"
                    type="password"
                    placeholder="Confirm your password"
                    value={registerData.confirmPassword}
                    onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
                
                {connected && publicKey && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is-founder"
                      checked={registerData.isFounder}
                      onChange={(e) => setRegisterData({ ...registerData, isFounder: e.target.checked })}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="is-founder" className="text-sm font-normal">
                      Register as founder with connected wallet
                    </Label>
                  </div>
                )}
                
                <Button type="submit" disabled={registerMutation.isPending}>
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    "Register"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </TabsContent>
      </Tabs>
      
      <CardFooter className="flex justify-center pt-2 pb-6">
        <p className="text-xs text-muted-foreground">
          Protected area for YOT ecosystem administrators
        </p>
      </CardFooter>
    </Card>
  );
}