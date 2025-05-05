// Fix for multihub_swap_v4.rs
// This fixes the incorrect PDA handling that causes InvalidAccountData error

// In the process_swap function, replace:

// Verify program authority PDA
let (expected_program_authority, program_authority_bump) = find_program_authority_address(program_id);
if expected_program_authority != *program_authority_account.key {
    msg!("Invalid program authority account");
    return Err(ProgramError::InvalidAccountData);
}

// Add debug logs
msg!("Account[2] key: {}", program_authority_account.key);
msg!("Expected PDA: {}", expected_program_authority);

// Don't deserialize any data from program_authority_account
// Just use it for signing in invoke_signed only