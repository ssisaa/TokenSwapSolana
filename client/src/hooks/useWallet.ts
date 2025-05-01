import { useMultiWallet } from "@/context/MultiWalletContext";
import { Connection, Transaction } from "@solana/web3.js";
import { ENDPOINT } from "@/lib/constants";

// This hook provides compatibility with components that expect the Solana wallet-adapter-react useWallet hook
// It maps our custom MultiWalletContext to the expected shape of the Solana wallet-adapter-react hook
export function useWallet() {
  const multiWallet = useMultiWallet();
  const connection = new Connection(ENDPOINT);
  
  // Map our custom context to the shape expected by components using Solana wallet-adapter-react
  return {
    publicKey: multiWallet.publicKey,
    connected: multiWallet.connected,
    connecting: multiWallet.connecting,
    
    // Map the sendTransaction function to use our MultiWallet context
    // This is crucial for components expecting Solana wallet-adapter behavior
    sendTransaction: async (transaction: Transaction, connection: Connection) => {
      if (!multiWallet.wallet || !multiWallet.publicKey) {
        throw new Error("Wallet not connected");
      }
      
      if (!multiWallet.wallet.signTransaction) {
        throw new Error("Wallet doesn't support transaction signing");
      }
      
      try {
        // Set the fee payer and recent blockhash
        transaction.feePayer = multiWallet.publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        // Sign the transaction using our wallet
        const signedTransaction = await multiWallet.wallet.signTransaction(transaction);
        
        // Send the signed transaction
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());
        
        // Return the transaction signature
        return signature;
      } catch (error: any) {
        console.error("Error in sendTransaction:", error);
        throw error;
      }
    },
    
    // Add any additional methods that might be expected by components
    // For example, wallet connection functions
    connect: multiWallet.connect,
    disconnect: multiWallet.disconnect,
    
    // Provide a signTransaction method for components that might expect it
    signTransaction: async (transaction: Transaction) => {
      if (!multiWallet.wallet || !multiWallet.wallet.signTransaction) {
        throw new Error("Wallet doesn't support transaction signing");
      }
      return multiWallet.wallet.signTransaction(transaction);
    },
    
    // Add wallet adapter name and icon for UI purposes
    wallet: multiWallet.wallet,
    walletName: multiWallet.selectedWallet?.name || null,
  };
}

export default useWallet;