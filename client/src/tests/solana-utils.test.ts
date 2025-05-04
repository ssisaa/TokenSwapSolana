/**
 * Tests for solana-utils.ts retry and error handling mechanisms
 */
import { withRetry, isRetriableNetworkError, exponentialBackoff } from '../lib/solana-utils';

// Mock console.log to avoid cluttering the test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
beforeEach(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

describe('isRetriableNetworkError', () => {
  test('should identify network errors correctly', () => {
    expect(isRetriableNetworkError(new Error('failed to fetch'))).toBe(true);
    expect(isRetriableNetworkError(new Error('connection timed out'))).toBe(true);
    expect(isRetriableNetworkError(new Error('timeout'))).toBe(true);
    expect(isRetriableNetworkError(new Error('network error'))).toBe(true);
    expect(isRetriableNetworkError(new Error('StructError: Expected'))).toBe(true);
    expect(isRetriableNetworkError(new Error('socket hang up'))).toBe(true);
  });

  test('should reject non-network errors', () => {
    expect(isRetriableNetworkError(new Error('Invalid signature'))).toBe(false);
    expect(isRetriableNetworkError(new Error('Transaction failed'))).toBe(false);
    expect(isRetriableNetworkError(new Error('Insufficient funds'))).toBe(false);
  });
});

describe('exponentialBackoff', () => {
  test('should calculate correct backoff times', () => {
    const baseMs = 100;
    const attempt0 = exponentialBackoff(0, baseMs);
    const attempt1 = exponentialBackoff(1, baseMs);
    const attempt2 = exponentialBackoff(2, baseMs);
    
    // Allow for jitter with 20% margin
    expect(attempt0).toBeGreaterThanOrEqual(80);
    expect(attempt0).toBeLessThanOrEqual(120);
    
    expect(attempt1).toBeGreaterThanOrEqual(160);
    expect(attempt1).toBeLessThanOrEqual(240);
    
    expect(attempt2).toBeGreaterThanOrEqual(320);
    expect(attempt2).toBeLessThanOrEqual(480);
  });

  test('should respect max backoff limit', () => {
    const maxMs = 500;
    const attempt5 = exponentialBackoff(5, 100, maxMs);
    
    // Even with high attempt number, should not exceed maxMs including jitter
    expect(attempt5).toBeLessThanOrEqual(maxMs * 1.2);
  });
});

describe('withRetry', () => {
  test('should return the result on success', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('should retry on retriable error and succeed', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('failed to fetch'))
      .mockRejectedValueOnce(new Error('failed to fetch'))
      .mockResolvedValue('success');
    
    const onRetry = jest.fn();
    const result = await withRetry(fn, { onRetry, maxRetries: 3 });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  test('should not retry on non-retriable error', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Invalid signature'));
    
    await expect(withRetry(fn)).rejects.toThrow('Invalid signature');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('should give up after max retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('failed to fetch'));
    
    await expect(withRetry(fn, { maxRetries: 2 })).rejects.toThrow('failed to fetch');
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  test('should use custom retryable error function', async () => {
    const customRetryable = (error: unknown) => {
      return error instanceof Error && error.message.includes('custom');
    };
    
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('custom error'))
      .mockResolvedValue('success');
    
    const result = await withRetry(fn, { retryableError: customRetryable });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});