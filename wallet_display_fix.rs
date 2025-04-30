// Add this function to the existing code in lib.rs

// CRITICAL FIX: Add YOS token decimal adjustment function
// This function divides the raw token amount by 10^9 to normalize for YOS token's 9 decimals
pub fn get_wallet_adjusted_yos_amount(amount: u64) -> u64 {
    // Adjust for YOS token decimals (divide by 10^9)
    amount / 10u64.pow(9) // Adjust for 9 decimals in YOS token
}

// Then in the process_harvest function, modify the rewards transfer like this:
// Find where you transfer YOS tokens to the user and change this part:

// BEFORE:
// invoke_signed(
//     &spl_token::instruction::transfer(
//         token_program.key,
//         program_yos_token_account.key,
//         user_yos_token_account.key,
//         program_authority.key,
//         &[],
//         rewards, // Original rewards amount
//     )?,
//     ...
// )?;

// AFTER:
// Calculate adjusted rewards for wallet display
let adjusted_rewards = get_wallet_adjusted_yos_amount(rewards);
msg!("Original rewards amount: {} YOS tokens", rewards);
msg!("Adjusted for wallet display: {} YOS tokens", adjusted_rewards);

// Transfer adjusted YOS rewards from program to user
invoke_signed(
    &spl_token::instruction::transfer(
        token_program.key,
        program_yos_token_account.key,
        user_yos_token_account.key,
        program_authority.key,
        &[],
        adjusted_rewards, // Use adjusted amount for proper wallet display
    )?,
    &[
        program_yos_token_account.clone(),
        user_yos_token_account.clone(),
        program_authority.clone(),
        token_program.clone(),
    ],
    &[&[b"authority", &[bump_seed]]],
)?;