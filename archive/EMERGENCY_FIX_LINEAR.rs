// EMERGENCY FIX: LINEAR INTEREST CALCULATION
// This file contains a simple, reliable approach to fix the massive token discrepancy
// by using linear interest instead of compound interest

// Helper function for reward calculation - SIMPLE LINEAR VERSION
fn calculate_rewards(
    staked_amount: u64,
    time_staked_seconds: i64,
    stake_rate_per_second: u64
) -> u64 {
    // Convert staking rate from basis points to decimal (12000 basis points = 0.00000125%)
    let rate_percentage = (stake_rate_per_second as f64) / 1_000_000.0;
    
    // Convert from percentage to decimal 
    let rate_decimal = rate_percentage / 100.0;
    
    // Convert raw amount to token units for calculation
    let principal_tokens = staked_amount as f64 / 1_000_000_000.0;
    
    // SIMPLE LINEAR INTEREST: principal * rate * time
    // No exponentiation, no compounding
    let rewards_tokens = principal_tokens * rate_decimal * time_staked_seconds as f64;
    
    // Convert back to raw token units for blockchain storage - this is critical for proper results
    let raw_rewards = (rewards_tokens * 1_000_000_000.0) as u64;
    
    // Log all values for transparency and debugging
    msg!("Staked amount: {} tokens ({} raw units)", principal_tokens, staked_amount);
    msg!("Rate: {}% per second ({} decimal)", rate_percentage, rate_decimal);
    msg!("Time staked: {} seconds", time_staked_seconds);
    msg!("Calculated rewards: {} tokens ({} raw units)", rewards_tokens, raw_rewards);
    
    raw_rewards
}

// This function should replace the existing calculate_rewards function in lib.rs
// All other parts of the program can remain the same as they already use this function
// The key difference is that we've:
// 1. Removed all compounding logic
// 2. Used a simple principal * rate * time formula
// 3. Added extensive logging for debugging
// 4. Made sure to properly convert percentages to decimals
// 5. Properly handled token decimals in both directions

// Note: This simplistic approach may not match the advertised APY, but it guarantees
// that rewards shown in the UI will match rewards received in the wallet