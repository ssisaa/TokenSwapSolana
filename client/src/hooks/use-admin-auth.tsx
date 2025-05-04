import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { AdminUser } from "../../shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "./use-toast";

type LoginData = {
  username: string;
  password: string;
};

type RegisterData = LoginData & {
  isFounder?: boolean;
  founderPublicKey?: string;
};

type AdminAuthContextType = {
  admin: AdminUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<Omit<AdminUser, "password">, Error, LoginData>;
  logoutMutation: UseMutationResult<{success: boolean}, Error, void>;
  registerMutation: UseMutationResult<Omit<AdminUser, "password">, Error, RegisterData>;
  verifyWalletMutation: UseMutationResult<Omit<AdminUser, "password">, Error, {publicKey: string}>;
};

export const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: admin,
    error,
    isLoading,
  } = useQuery<AdminUser | null, Error>({
    queryKey: ["/api/admin/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/admin/login", credentials);
      return res.json();
    },
    onSuccess: (admin: Omit<AdminUser, "password">) => {
      queryClient.setQueryData(["/api/admin/user"], admin);
      toast({
        title: "Login successful",
        description: `Welcome back, ${admin.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const res = await apiRequest("POST", "/api/admin/register", data);
      return res.json();
    },
    onSuccess: (admin: Omit<AdminUser, "password">) => {
      queryClient.setQueryData(["/api/admin/user"], admin);
      toast({
        title: "Registration successful",
        description: `Welcome, ${admin.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/logout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/admin/user"], null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const verifyWalletMutation = useMutation({
    mutationFn: async ({ publicKey }: { publicKey: string }) => {
      const res = await apiRequest("POST", "/api/admin/verify-wallet", { publicKey });
      return res.json();
    },
    onSuccess: (admin: Omit<AdminUser, "password">) => {
      queryClient.setQueryData(["/api/admin/user"], admin);
      toast({
        title: "Wallet verified",
        description: `Welcome back, ${admin.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Wallet verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AdminAuthContext.Provider
      value={{
        admin: admin || null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        verifyWalletMutation
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}