// This is a minimal patch file that shows only what needs to be changed
// in your existing contract to fix the YOS display issue.

// ----------------- FIND THIS CONSTANT IN YOUR CODE -----------------
// ORIGINAL DEFINITION:
const YOS_DISPLAY_NORMALIZATION_FACTOR: u64 = 9_200_000;

// CHANGE TO:
// CRITICAL FIX: We don't need a divisor, we should NOT reduce the YOS amount
// The display issue occurs because we're dividing when we should be showing the full amount
// Set this to 1 to show the actual intended amount (181 YOS instead of 0.00181)
const YOS_DISPLAY_NORMALIZATION_FACTOR: u64 = 1; // Don't divide at all

// ---------------------------------------------
// Also check all places in the contract where this value is used:
// In the process_harvest function, you're dividing by YOS_DISPLAY_NORMALIZATION_FACTOR:

// CRITICAL FIX: Apply display normalization factor to raw rewards
// This will make the rewards display correctly in Phantom Wallet
// while maintaining proper accounting internally
let display_adjusted_rewards = raw_rewards / YOS_DISPLAY_NORMALIZATION_FACTOR;

// This division is what's causing your amounts to be reduced. With the change to 1,
// this will effectively be: let display_adjusted_rewards = raw_rewards;
// so the full amount will be transferred and displayed.