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
  
  // Use abbreviated format for large numbers
  const absAmount = Math.abs(amount);
  if (absAmount >= 1_000_000_000_000) { // >= 1 trillion
    return (amount / 1_000_000_000_000).toFixed(2) + 'T';
  } else if (absAmount >= 1_000_000_000) { // >= 1 billion
    return (amount / 1_000_000_000).toFixed(2) + 'B';
  } else if (absAmount >= 1_000_000) { // >= 1 million
    return (amount / 1_000_000).toFixed(2) + 'M';
  } else if (absAmount >= 1_000) { // >= 1 thousand
    return (amount / 1_000).toFixed(2) + 'K';
  }
  
  // Use standard formatting for smaller numbers
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
  
  // Use standard formatting for smaller numbers
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
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
  
  // For very small numbers, use scientific notation
  if (value < 0.0001) {
    return value.toExponential(4);
  }
  
  // Use abbreviated format for large numbers
  const absValue = Math.abs(value);
  if (absValue >= 1_000_000_000_000) { // >= 1 trillion
    return (value / 1_000_000_000_000).toFixed(2) + 'T';
  } else if (absValue >= 1_000_000_000) { // >= 1 billion
    return (value / 1_000_000_000).toFixed(2) + 'B';
  } else if (absValue >= 1_000_000) { // >= 1 million
    return (value / 1_000_000).toFixed(2) + 'M';
  } else if (absValue >= 1_000) { // >= 1 thousand
    return (value / 1_000).toFixed(2) + 'K';
  }
  
  // Regular formatting for other numbers
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
}
