// INTEGRATED LINEAR INTEREST CALCULATION FIX
// This file contains updated versions of both process_harvest and process_unstake 
// to use the same linear interest calculation approach. 
// Copy these functions to replace the existing ones in lib.rs

// FUNCTION 1: Updated process_harvest function
fn process_harvest(
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
    
    // Verify user signature (mandatory signature verification)
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
    
    // Get program state - IMPORTANT: We need this to get the CURRENT staking rate
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Get current time
    let clock = Clock::from_account_info(clock)?;
    let current_time = clock.unix_timestamp;
    
    // Calculate time staked since last harvest
    let time_staked_seconds = current_time.checked_sub(staking_data.last_harvest_time)
        .ok_or(ProgramError::InvalidArgument)?;
    
    // EMERGENCY LINEAR FIX: Using linear interest calculation
    // Convert staking rate from basis points to percentage
    let rate_percentage = (program_state.stake_rate_per_second as f64) / 1_000_000.0;
    
    // Convert from percentage to decimal
    let rate_decimal = rate_percentage / 100.0;
    
    // Convert raw amount to token units for calculation
    let principal_tokens = staking_data.staked_amount as f64 / 1_000_000_000.0;
    
    // SIMPLE LINEAR INTEREST: principal * rate * time
    // No exponentiation, no compounding
    let rewards_token_units = principal_tokens * rate_decimal * time_staked_seconds as f64;
    
    // Convert back to raw token units for blockchain storage - this is critical for proper results
    let raw_rewards = (rewards_token_units * 1_000_000_000.0) as u64;
    
    // Log all values for transparency and debugging
    msg!("Harvest: Staked amount: {} tokens ({} raw units)", principal_tokens, staking_data.staked_amount);
    msg!("Harvest: Rate: {}% per second ({} decimal)", rate_percentage, rate_decimal);
    msg!("Harvest: Time staked: {} seconds", time_staked_seconds);
    msg!("Harvest: Calculated rewards: {} tokens ({} raw units)", rewards_token_units, raw_rewards);
    
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
    
    // Check if program has enough YOS tokens to transfer rewards
    if program_yos_balance < raw_rewards {
        return Err(ProgramError::InsufficientFunds);
    }
    
    // Update staking data
    staking_data.last_harvest_time = current_time;
    staking_data.total_harvested = staking_data.total_harvested.checked_add(raw_rewards)
        .ok_or(ProgramError::InvalidArgument)?;
    
    // Save updated staking data
    staking_data.serialize(&mut *user_staking_account.try_borrow_mut_data()?)?;
    
    // Transfer YOS rewards to user
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            program_yos_token_account.key,
            user_yos_token_account.key,
            program_authority.key,
            &[],
            raw_rewards, // Use raw rewards directly
        )?,
        &[
            program_yos_token_account.clone(),
            user_yos_token_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    msg!("Harvested {} YOS tokens", rewards_token_units);
    
    Ok(())
}

// FUNCTION 2: Updated process_unstake function
fn process_unstake(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let user_account = next_account_info(account_info_iter)?;
    let user_yot_token_account = next_account_info(account_info_iter)?;
    let program_yot_token_account = next_account_info(account_info_iter)?;
    let user_yos_token_account = next_account_info(account_info_iter)?;
    let program_yos_token_account = next_account_info(account_info_iter)?;
    let user_staking_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let clock = next_account_info(account_info_iter)?;
    
    // Verify user signature (mandatory signature verification)
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
    
    // Check sufficient staked amount
    if staking_data.staked_amount < amount {
        return Err(ProgramError::InsufficientFunds);
    }
    
    // Get program state - IMPORTANT: We need this to get the CURRENT staking rate
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Get current time
    let clock = Clock::from_account_info(clock)?;
    let current_time = clock.unix_timestamp;
    
    // Calculate time staked since last harvest
    let time_staked_seconds = current_time.checked_sub(staking_data.last_harvest_time)
        .ok_or(ProgramError::InvalidArgument)?;
    
    // EMERGENCY LINEAR FIX: Using linear interest calculation
    // Convert staking rate from basis points to percentage
    let rate_percentage = (program_state.stake_rate_per_second as f64) / 1_000_000.0;
    
    // Convert from percentage to decimal
    let rate_decimal = rate_percentage / 100.0;
    
    // Convert raw amount to token units for calculation
    let principal_tokens = staking_data.staked_amount as f64 / 1_000_000_000.0;
    
    // SIMPLE LINEAR INTEREST: principal * rate * time
    // No exponentiation, no compounding
    let rewards_token_units = principal_tokens * rate_decimal * time_staked_seconds as f64;
    
    // Convert back to raw token units for blockchain storage - this is critical for proper results
    let raw_rewards = (rewards_token_units * 1_000_000_000.0) as u64;
    
    // Log all values for transparency and debugging
    msg!("Unstake: Staked amount: {} tokens ({} raw units)", principal_tokens, staking_data.staked_amount);
    msg!("Unstake: Rate: {}% per second ({} decimal)", rate_percentage, rate_decimal);
    msg!("Unstake: Time staked: {} seconds", time_staked_seconds);
    msg!("Unstake: Calculated rewards: {} tokens ({} raw units)", rewards_token_units, raw_rewards);
    
    // Update staking data
    staking_data.last_harvest_time = current_time;
    
    // Only add to total harvested if there are rewards to claim
    if raw_rewards > 0 {
        staking_data.total_harvested = staking_data.total_harvested.checked_add(raw_rewards)
            .ok_or(ProgramError::InvalidArgument)?;
    }
    
    // Reduce staked amount
    staking_data.staked_amount = staking_data.staked_amount.checked_sub(amount)
        .ok_or(ProgramError::InvalidArgument)?;
    
    // Save updated staking data
    staking_data.serialize(&mut *user_staking_account.try_borrow_mut_data()?)?;
    
    // Transfer YOT tokens back to user (this should ALWAYS happen)
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            program_yot_token_account.key,
            user_yot_token_account.key,
            program_authority.key,
            &[],
            amount, // Use the raw amount directly - no division needed
        )?,
        &[
            program_yot_token_account.clone(),
            user_yot_token_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Only attempt to transfer YOS rewards if there are rewards to claim
    if raw_rewards > 0 {
        let program_yos_info = match spl_token::state::Account::unpack(&program_yos_token_account.data.borrow()) {
            Ok(token_account) => token_account,
            Err(error) => {
                msg!("Error unpacking program YOS token account: {:?}", error);
                msg!("Unstaked {} YOT tokens but YOS rewards transfer failed", amount as f64 / 1_000_000_000.0);
                return Ok(());
            }
        };
        
        let program_yos_balance = program_yos_info.amount;
        
        // Check if program has enough YOS tokens to transfer rewards
        if program_yos_balance >= raw_rewards {
            // Only attempt to transfer rewards if the program has enough YOS tokens
            let transfer_result = invoke_signed(
                &spl_token::instruction::transfer(
                    token_program.key,
                    program_yos_token_account.key,
                    user_yos_token_account.key,
                    program_authority.key,
                    &[],
                    raw_rewards, // Use raw rewards directly
                )?,
                &[
                    program_yos_token_account.clone(),
                    user_yos_token_account.clone(),
                    program_authority.clone(),
                    token_program.clone(),
                ],
                &[&[b"authority", &[authority_bump]]],
            );
            
            match transfer_result {
                Ok(_) => {
                    msg!("Unstaked {} YOT and harvested {} YOS tokens", 
                         amount as f64 / 1_000_000_000.0, 
                         rewards_token_units);
                }
                Err(error) => {
                    msg!("Unstaked {} YOT tokens but YOS rewards transfer failed: {:?}", 
                         amount as f64 / 1_000_000_000.0, 
                         error);
                }
            }
        } else {
            // The program doesn't have enough YOS tokens
            msg!("Unstaked {} YOT tokens but program has insufficient YOS for rewards", 
                 amount as f64 / 1_000_000_000.0);
        }
    } else {
        msg!("Unstaked {} YOT tokens (no rewards to claim)", 
             amount as f64 / 1_000_000_000.0);
    }
    
    Ok(())
}