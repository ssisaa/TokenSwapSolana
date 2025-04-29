// Improved harvest function that fixes the decimal issue
// The original function divides by 1_000_000_000 when transferring, causing a decimal mismatch
// This version uses raw_rewards directly for token transfer, ensuring UI & wallet values match

fn process_harvest_fixed(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts (keep same order as original)
    let user_account = next_account_info(account_info_iter)?;
    let user_yos_token_account = next_account_info(account_info_iter)?;
    let program_yos_token_account = next_account_info(account_info_iter)?;
    let user_staking_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let clock = next_account_info(account_info_iter)?;
    
    // Verify user signature (mandatory)
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
    
    // Get program state for current staking rate
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Get current time
    let clock = Clock::from_account_info(clock)?;
    let current_time = clock.unix_timestamp;
    
    // Calculate rewards using current rate
    let time_staked_seconds = current_time.checked_sub(staking_data.last_harvest_time)
        .ok_or(ProgramError::InvalidArgument)?;
    
    // Convert staking rate from basis points to decimal
    let rate_decimal = (program_state.stake_rate_per_second as f64) / 10000.0;
    
    // Calculate raw rewards - this is in token raw units already (includes decimals)
    let raw_rewards = (staking_data.staked_amount as f64 * time_staked_seconds as f64 * rate_decimal) as u64;
    
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
    
    // CRITICAL FIX: Use raw_rewards directly without division
    // Previous implementation divided by 10^9, causing decimal mismatch:
    // let ui_rewards = raw_rewards / 1_000_000_000;
    
    // Transfer YOS rewards to user using full precision
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            program_yos_token_account.key,
            user_yos_token_account.key,
            program_authority.key,
            &[],
            raw_rewards, // FIXED: Use raw amount directly instead of dividing
        )?,
        &[
            program_yos_token_account.clone(),
            user_yos_token_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Log with correct decimal formatting
    msg!("Harvested {} YOS rewards", raw_rewards as f64 / 1_000_000_000.0);
    
    Ok(())
}