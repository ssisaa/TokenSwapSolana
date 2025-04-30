// This is a minimal patch file that shows only what needs to be changed
// in your existing contract to fix the YOS display issue.

// ----------------- LINE 22-24 -----------------
// CHANGE THIS:
// CRITICAL FIX: Add display normalization factor to fix wallet display issue
// Based on the observed behavior, Phantom Wallet shows YOS rewards as millions
// This factor will be applied during token transfers to normalize the display
const YOS_DISPLAY_NORMALIZATION_FACTOR: u64 = 9_200_000;

// TO THIS:
// CRITICAL FIX: Add display normalization factor to fix wallet display issue
// Based on the Solana token standard, YOS tokens have 9 decimals
// This factor divides by 10^9 to normalize for proper decimal display
const YOS_DISPLAY_NORMALIZATION_FACTOR: u64 = 1_000_000_000; // 10^9

// ---------------------------------------------
// You don't need to change anything else in your contract!
// The existing code already has the display normalization logic
// in the process_harvest function where it divides by this factor:

// CRITICAL FIX: Apply display normalization factor to raw rewards
// This will make the rewards display correctly in Phantom Wallet
// while maintaining proper accounting internally
let display_adjusted_rewards = raw_rewards / YOS_DISPLAY_NORMALIZATION_FACTOR;

// ---------------------------------------------
// This minimal fix should resolve the wallet display issue
// without requiring any structural changes to your contract.