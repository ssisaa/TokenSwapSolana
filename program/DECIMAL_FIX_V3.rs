// Fix for calculate_rewards function - SIMPLE INTEREST VERSION

fn calculate_rewards(
    staked_amount: u64,
    time_staked_seconds: i64,
    stake_rate_per_second: u64
) -> u64 {
    // CRITICAL FIX FOR DECIMAL OVERFLOW
    // Convert staking rate from basis points to decimal (12000 basis points = 0.00000125%)
    let rate_decimal = (stake_rate_per_second as f64) / 1_000_000.0;
    
    // Calculate rewards in token units first (principal in tokens)
    let principal_tokens = staked_amount as f64 / 1_000_000_000.0;
    
    // CRITICAL FIX: Use SIMPLE interest formula instead of compound
    // Formula: principal * rate * time
    let rewards_tokens = principal_tokens * rate_decimal * time_staked_seconds as f64;
    
    // Convert back to raw token units for blockchain
    let raw_rewards = (rewards_tokens * 1_000_000_000.0) as u64;
    
    // Return the simple interest result
    raw_rewards
}

// This change should be made in lib.rs to replace the existing calculate_rewards function
// The fix eliminates the exponential growth issue causing the massive token discrepancy