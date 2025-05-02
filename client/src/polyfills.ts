// Process polyfill for browser environment
if (typeof window !== 'undefined' && !window.process) {
  window.process = {
    env: {
      NODE_ENV: import.meta.env.MODE || 'development',
      // Add any other environment variables your app needs
    }
  };
}

export {};