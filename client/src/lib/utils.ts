import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple class values into a single string with Tailwind merging
 * @param inputs Class values to be combined
 * @returns Single merged class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number to a readable string with given decimal places
 * @param value The number to format
 * @param decimals Number of decimal places to show
 * @returns Formatted number string
 */
export function formatNumber(value: number, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formats a currency value with currency symbol
 * @param value The number to format
 * @param currency Currency code (default: USD)
 * @param decimals Number of decimal places
 * @returns Formatted currency string
 */
export function formatCurrency(value: number | string, currency = 'USD', decimals = 2): string {
  // Handle non-numeric values
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '-';
  }
  
  // Convert to number if string
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Validate the currency code (must be 3 letters according to ISO 4217)
  const validCurrency = /^[A-Z]{3}$/.test(currency) ? currency : 'USD';
  
  try {
    return numValue.toLocaleString('en-US', {
      style: 'currency',
      currency: validCurrency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  } catch (error) {
    // Fallback if formatting fails
    return `$${numValue.toFixed(decimals)}`;
  }
}

/**
 * Formats a dollar amount with adaptive precision based on the value's size
 * @param value The number to format as a dollar amount
 * @returns Formatted dollar string
 */
export function formatDollarAmount(value: number): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  
  if (value === 0) return '$0.00';
  
  if (Math.abs(value) < 0.01) {
    return `$${value.toFixed(6)}`;
  } else if (Math.abs(value) < 1) {
    return `$${value.toFixed(4)}`;
  } else if (Math.abs(value) < 10) {
    return `$${value.toFixed(2)}`;
  } else if (Math.abs(value) < 1000) {
    return `$${value.toFixed(2)}`;
  } else if (Math.abs(value) < 1000000) {
    return `$${(value / 1000).toFixed(2)}K`;
  } else {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
}

/**
 * Formats an address to a shorter version for display
 * @param address The full address
 * @param startChars Number of characters to show at start
 * @param endChars Number of characters to show at end
 * @returns Shortened address
 */
export function shortenAddress(address: string, startChars = 4, endChars = 4): string {
  if (!address) return '';
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Delays execution for specified milliseconds
 * @param ms Milliseconds to delay
 * @returns Promise that resolves after delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Copies text to clipboard
 * @param text Text to copy
 * @returns True if successful, false otherwise
 */
export function copyToClipboard(text: string): boolean {
  try {
    navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Formats a token amount to a readable string with appropriate formatting
 * @param value The token amount to format
 * @param maxDecimals Maximum number of decimal places to show (default: 2)
 * @returns Formatted token amount string
 */
export function formatTokenAmount(value: number, maxDecimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  
  // For large numbers
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  
  // For small numbers, we want to show more decimals
  if (value < 0.01 && value > 0) {
    return value.toFixed(6);
  }
  
  // For normal numbers
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals
  });
}

/**
 * Formats a Unix timestamp or Date object to a readable time string
 * @param timestamp Unix timestamp in seconds or milliseconds, or Date object
 * @returns Formatted time string
 */
export function formatTransactionTime(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}