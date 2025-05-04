/**
 * Utility functions for Solana operations and error handling
 */

/**
 * Classifies a Solana error to determine if it's a retriable network error
 * 
 * @param error The error to classify
 * @returns True if the error is a network error that can be retried
 */
export function isRetriableNetworkError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // These are common Solana network errors that can be retried
  return (
    errorMessage.includes("failed to fetch") || 
    errorMessage.includes("timed out") ||
    errorMessage.includes("network error") ||
    errorMessage.includes("connecting to network") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("connection") ||
    errorMessage.includes("read ECONNRESET") ||
    errorMessage.includes("socket hang up") ||
    errorMessage.includes("fetch failed") ||
    errorMessage.includes("ETIMEDOUT") ||
    errorMessage.includes("too busy") ||
    errorMessage.includes("rate limit") ||
    errorMessage.includes("429") || // Too many requests
    errorMessage.includes("StructError") // Common in Solana responses from network issues
  );
}

/**
 * Sleep for a specified number of milliseconds
 * 
 * @param ms Milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Implements exponential backoff for retries
 * 
 * @param attempt Current attempt number (0-based)
 * @param baseMs Base milliseconds for the first retry
 * @param maxMs Maximum milliseconds to wait
 * @returns Milliseconds to wait before next retry
 */
export function exponentialBackoff(attempt: number, baseMs = 500, maxMs = 15000): number {
  const delay = Math.min(
    baseMs * Math.pow(2, attempt),
    maxMs
  );
  
  // Add some jitter (±20%) to prevent synchronized retries
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}

/**
 * Executes a function with retries using exponential backoff
 * 
 * @param fn Function to execute that returns a Promise
 * @param options Retry options
 * @returns Promise that resolves with the function result or rejects after all retries
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryableError?: (error: unknown) => boolean;
    onRetry?: (attempt: number, error: unknown, backoffMs: number) => void;
    baseBackoffMs?: number;
    maxBackoffMs?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryableError = isRetriableNetworkError,
    onRetry = () => {},
    baseBackoffMs = 500,
    maxBackoffMs = 15000
  } = options;
  
  let attempt = 0;
  let lastError: unknown;
  
  while (attempt <= maxRetries) {
    try {
      // Execute the function and return result on success
      return await fn();
    } catch (error) {
      lastError = error;
      
      // If we've reached max retries or it's not a retriable error, throw
      if (attempt >= maxRetries || !retryableError(error)) {
        throw error;
      }
      
      // Calculate backoff time
      const backoffMs = exponentialBackoff(attempt, baseBackoffMs, maxBackoffMs);
      
      // Log retry information
      onRetry(attempt + 1, error, backoffMs);
      
      // Wait before next retry
      await sleep(backoffMs);
      
      // Increment attempt counter
      attempt++;
    }
  }
  
  // Should not reach here due to the throw in the loop,
  // but TypeScript needs it for type safety
  throw lastError;
}