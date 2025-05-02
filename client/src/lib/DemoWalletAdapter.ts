import { WalletAdapter } from '@solana/wallet-adapter-base';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { ADMIN_WALLET_ADDRESS } from './constants';

/**
 * Demo wallet adapter that automatically approves transactions without showing a prompt
 * This is specifically for testing in environments where wallet extensions aren't available
 */
export class DemoWalletAdapter implements WalletAdapter {
  private _publicKey: PublicKey | null = null;
  private _connected: boolean = false;
  private _listeners: { [event: string]: Function[] } = {
    connect: [],
    disconnect: [],
    error: []
  };
  
  constructor() {
    try {
      this._publicKey = new PublicKey(ADMIN_WALLET_ADDRESS);
    } catch (error) {
      console.error("Error creating demo wallet:", error);
      this._publicKey = Keypair.generate().publicKey;
    }
  }
  
  get publicKey(): PublicKey | null {
    return this._publicKey;
  }
  
  get connected(): boolean {
    return this._connected;
  }
  
  async connect(): Promise<void> {
    this._connected = true;
    
    // Notify listeners
    this._listeners.connect.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error("Error in connect listener:", error);
      }
    });
  }
  
  async disconnect(): Promise<void> {
    this._connected = false;
    
    // Notify listeners
    this._listeners.disconnect.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error("Error in disconnect listener:", error);
      }
    });
  }
  
  on(event: string, listener: Function): void {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(listener);
  }
  
  off(event: string, listener: Function): void {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(l => l !== listener);
    }
  }
  
  async signTransaction(transaction: Transaction): Promise<Transaction> {
    // Non-interactive signing - auto approve without wallet prompt
    // This is just a mock implementation for demo purposes
    console.log("Demo wallet auto-approving transaction", transaction);
    
    // Make it ready to be serialized
    transaction.feePayer = this.publicKey!;
    
    // Return the transaction as if it was signed
    return transaction;
  }
  
  async signAllTransactions(transactions: Transaction[]): Promise<Transaction[]> {
    return Promise.all(transactions.map(tx => this.signTransaction(tx)));
  }
  
  // Required by newer adapters but we can leave empty for the demo
  async sendTransaction(
    transaction: Transaction,
    connection: any,
    options: any = {}
  ): Promise<string> {
    console.log("Demo wallet auto-sending transaction", transaction);
    
    // Sign the transaction first
    const signedTransaction = await this.signTransaction(transaction);
    
    // Demo signature - production would actually send to blockchain
    const signature = `DEMO_SUCCESS_${Date.now()}`;
    
    return signature;
  }
}