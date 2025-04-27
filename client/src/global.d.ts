// Global type declarations for browser environment
interface Window {
  Buffer: typeof Buffer;
  global: Window;
}

declare global {
  interface Window {
    Buffer: typeof Buffer;
    global: Window;
  }
}