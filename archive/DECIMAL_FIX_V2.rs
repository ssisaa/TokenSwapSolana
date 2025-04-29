// CRITICAL FIX FOR DECIMAL OVERFLOW (V2)
// This fixes the issue where users are receiving millions of tokens instead of a few

fn process_harvest_fixed_v2(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let user_account = next_account_info(account_info_iter)?;
    let user_yos_token_account = next_account_info(account_info_iter)?;
    let program_yos_token_account = next_account_info(account_info_iter)?;
    let user_staking_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let clock = next_account_info(account_info_iter)?;
    
    // Verify user signature
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Calculate PDA for program authority
    let (authority_pda, authority_bump) = Pubkey::find_program_address(&[b"authority"], program_id);
    if authority_pda != *program_authority.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Get staking data
    let mut staking_data = StakingAccount::try_from_slice(&user_staking_account.data.borrow())?;
    
    // Verify staking account ownership
    if staking_data.owner != *user_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Get program state
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Get current time
    let clock = Clock::from_account_info(clock)?;
    let current_time = clock.unix_timestamp;
    
    // Calculate time staked
    let time_staked_seconds = current_time.checked_sub(staking_data.last_harvest_time)
        .ok_or(ProgramError::InvalidArgument)?;
    
    // CRITICAL FIX: Properly calculate the rate decimal
    // Original: let rate_decimal = (program_state.stake_rate_per_second as f64) / 10000.0;
    // For 12000 basis points = 0.00000125 per second = 0.125% per day = ~45% per year
    let rate_decimal = (program_state.stake_rate_per_second as f64) / 1_000_000.0;
    
    // Calculate rewards in token units (not raw units)
    let rewards_token_units = (staking_data.staked_amount as f64 / 1_000_000_000.0) * 
                              (time_staked_seconds as f64) * 
                              rate_decimal;
    
    // Convert token units to raw units
    let raw_rewards = (rewards_token_units * 1_000_000_000.0) as u64;
    
    // Check rewards meet minimum threshold
    if raw_rewards < program_state.harvest_threshold {
        return Err(ProgramError::InsufficientFunds);
    }
    
    // Check if program has enough YOS tokens
    let program_yos_info = match spl_token::state::Account::unpack(&program_yos_token_account.data.borrow()) {
        Ok(token_account) => token_account,
        Err(error) => {
            msg!("Error unpacking program YOS token account: {:?}", error);
            return Err(ProgramError::InvalidAccountData);
        }
    };
    
    let program_yos_balance = program_yos_info.amount;
    
    if program_yos_balance < raw_rewards {
        return Err(ProgramError::InsufficientFunds);
    }
    
    // Update staking data
    staking_data.last_harvest_time = current_time;
    staking_data.total_harvested = staking_data.total_harvested.checked_add(raw_rewards)
        .ok_or(ProgramError::InvalidArgument)?;
    
    staking_data.serialize(&mut *user_staking_account.try_borrow_mut_data()?)?;
    
    // Transfer YOS rewards to user
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            program_yos_token_account.key,
            user_yos_token_account.key,
            program_authority.key,
            &[],
            raw_rewards,
        )?,
        &[
            program_yos_token_account.clone(),
            user_yos_token_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Log the proper decimal format for clarity
    msg!("Harvested {} YOS rewards (raw amount: {})", rewards_token_units, raw_rewards);
    
    Ok(())
}

// Similar fix needed for process_unstake
fn process_unstake_fixed_v2(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    // ... (same beginning as original)
    
    // Critical changes for reward calculation:
    
    // CRITICAL FIX: Properly calculate the rate decimal
    let rate_decimal = (program_state.stake_rate_per_second as f64) / 1_000_000.0;
    
    // Calculate rewards in token units (not raw units)
    let rewards_token_units = (staking_data.staked_amount as f64 / 1_000_000_000.0) * 
                              (time_staked_seconds as f64) * 
                              rate_decimal;
    
    // Convert token units to raw units
    let raw_rewards = (rewards_token_units * 1_000_000_000.0) as u64;
    
    // ... (then continue with updating staking data and transferring tokens)
    
    // For the YOS rewards transfer:
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            program_yos_token_account.key,
            user_yos_token_account.key,
            program_authority.key,
            &[],
            raw_rewards,
        )?,
        &[...],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // ...
}