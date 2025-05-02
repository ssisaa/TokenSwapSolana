// This file provides polyfills for Node.js built-in modules that are required by Solana libraries
import { Buffer } from 'buffer';

// Make Buffer available globally
window.Buffer = Buffer;

// Ensure global object is defined for browser compatibility
if (typeof window !== 'undefined') {
  (window as any).global = window;
  
  // Add process object if it doesn't exist
  if (!(window as any).process) {
    (window as any).process = {
      env: {
        NODE_ENV: import.meta.env.MODE || 'development',
        // Add any other environment variables needed
      },
      browser: true,
      version: ''
    };
  }
}

export {};