/**
 * Formats a number to regular decimal format with appropriate precision,
 * avoids scientific notation for small numbers
 */
export function formatNumber(value: number): string {
  if (value === 0) return "0";
  
  // For very small numbers, use fixed notation with appropriate precision
  if (Math.abs(value) < 0.0001) {
    // For extremely small numbers, show up to 10 decimal places
    return value.toFixed(10).replace(/\.?0+$/, "");
  }
  
  // For small numbers, show up to 6 decimal places
  if (Math.abs(value) < 0.1) {
    return value.toFixed(6).replace(/\.?0+$/, "");
  }
  
  // For regular numbers, show up to 4 decimal places
  if (Math.abs(value) < 1000) {
    return value.toFixed(4).replace(/\.?0+$/, "");
  }
  
  // For large numbers, use Intl.NumberFormat for nice comma formatting
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(value);
}