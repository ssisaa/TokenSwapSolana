import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, decimals: number = 6): string {
  if (typeof amount === 'string') {
    amount = parseFloat(amount);
  }
  
  if (isNaN(amount)) return '0.00';
  
  const absAmount = Math.abs(amount);
  
  // For very small numbers (below 0.0001), use scientific notation
  if (absAmount < 0.0001 && absAmount > 0) {
    return amount.toExponential(4);
  }
  
  // Use exact values for all currency amounts to ensure users see their precise balances
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  });
  
  return formatter.format(amount);
}

export function formatDollarAmount(amount: number): string {
  // Use abbreviated format for large numbers
  const absAmount = Math.abs(amount);
  if (absAmount >= 1_000_000_000_000) { // >= 1 trillion
    return '$' + (amount / 1_000_000_000_000).toFixed(2) + 'T';
  } else if (absAmount >= 1_000_000_000) { // >= 1 billion
    return '$' + (amount / 1_000_000_000).toFixed(2) + 'B';
  } else if (absAmount >= 1_000_000) { // >= 1 million
    return '$' + (amount / 1_000_000).toFixed(2) + 'M';
  } else if (absAmount >= 1_000) { // >= 1 thousand
    return '$' + (amount / 1_000).toFixed(2) + 'K';
  }
  
  // Use standard formatting for smaller numbers - always with 2 decimal places for USD values
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function formatTransactionTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

export function formatNumber(value: number, decimals: number = 4): string {
  if (isNaN(value) || value === 0) return '0';
  
  // For amounts less than 10,000, we show exact values with appropriate decimals
  const absValue = Math.abs(value);
  
  // For very small numbers (below 0.0001), use scientific notation to avoid too many zeros
  if (absValue < 0.0001) {
    return value.toExponential(4);
  }
  
  // Regular formatting for all numbers - show exact values, not abbreviations
  // This ensures users see their precise token amounts
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
}
