// Global type declarations for browser environment
interface Window {
  Buffer: typeof Buffer;
  global: Window;
  solana?: any;
  solflare?: any;
}

declare global {
  interface Window {
    Buffer: typeof Buffer;
    global: Window;
    solana?: any;
    solflare?: any;
  }
}