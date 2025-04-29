// DECIMAL FIX V3: COMPLETE IMPLEMENTATION
// This file contains the complete solution to fix the massive token discrepancy
// by replacing compound interest with simple interest calculations

// Helper function for reward calculation - SIMPLE INTEREST VERSION
fn calculate_rewards(
    staked_amount: u64,
    time_staked_seconds: i64,
    stake_rate_per_second: u64
) -> u64 {
    // Convert staking rate from basis points to decimal (12000 basis points = 0.00000125%)
    // Using the fixed 1,000,000.0 divisor for consistent conversion
    let rate_decimal = (stake_rate_per_second as f64) / 1_000_000.0;
    
    // Convert raw amount to token units for calculation
    let principal_tokens = staked_amount as f64 / 1_000_000_000.0;
    
    // CRITICAL FIX: Use SIMPLE interest formula instead of compound interest
    // Formula: principal * rate * time
    // This eliminates the exponential growth that was causing the massive overflow
    let rewards_tokens = principal_tokens * rate_decimal * time_staked_seconds as f64;
    
    // Convert back to raw token units for blockchain storage
    let raw_rewards = (rewards_tokens * 1_000_000_000.0) as u64;
    
    // Return the simple interest result
    raw_rewards
}

// Process harvest instruction with fixed simple interest calculation
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
    
    // Get program state
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Get current time
    let clock = Clock::from_account_info(clock)?;
    let current_time = clock.unix_timestamp;
    
    // Calculate time staked since last harvest
    let time_staked_seconds = current_time.checked_sub(staking_data.last_harvest_time)
        .ok_or(ProgramError::InvalidArgument)?;
    
    // Calculate rewards using SIMPLE interest formula
    let raw_rewards = calculate_rewards(
        staking_data.staked_amount,
        time_staked_seconds,
        program_state.stake_rate_per_second
    );
    
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
    
    // Transfer YOS rewards to user (using the FULL raw amount)
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            program_yos_token_account.key,
            user_yos_token_account.key,
            program_authority.key,
            &[],
            raw_rewards, // Use raw amount directly
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
    msg!("Harvested {} YOS rewards (raw amount: {})", raw_rewards as f64 / 1_000_000_000.0, raw_rewards);
    
    Ok(())
}

// Process unstake instruction with fixed simple interest calculation
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
    
    // Get program state
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Get current time
    let clock = Clock::from_account_info(clock)?;
    let current_time = clock.unix_timestamp;
    
    // Calculate time staked since last harvest
    let time_staked_seconds = current_time.checked_sub(staking_data.last_harvest_time)
        .ok_or(ProgramError::InvalidArgument)?;
    
    // Calculate rewards using SIMPLE interest formula
    let raw_rewards = calculate_rewards(
        staking_data.staked_amount,
        time_staked_seconds,
        program_state.stake_rate_per_second
    );
    
    // Update staking data
    staking_data.last_harvest_time = current_time;
    staking_data.staked_amount = staking_data.staked_amount.checked_sub(amount)
        .ok_or(ProgramError::InvalidArgument)?;
    
    if raw_rewards > 0 {
        staking_data.total_harvested = staking_data.total_harvested.checked_add(raw_rewards)
            .ok_or(ProgramError::InvalidArgument)?;
    }
    
    staking_data.serialize(&mut *user_staking_account.try_borrow_mut_data()?)?;
    
    // Transfer YOT tokens back to user
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            program_yot_token_account.key,
            user_yot_token_account.key,
            program_authority.key,
            &[],
            amount,
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
            // Use the full raw amount for the transfer
            let transfer_result = invoke_signed(
                &spl_token::instruction::transfer(
                    token_program.key,
                    program_yos_token_account.key,
                    user_yos_token_account.key,
                    program_authority.key,
                    &[],
                    raw_rewards, // Use raw amount directly
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
                    msg!("Unstaked {} YOT tokens and harvested {} YOS rewards (raw amount: {})", 
                         amount as f64 / 1_000_000_000.0, 
                         raw_rewards as f64 / 1_000_000_000.0, 
                         raw_rewards);
                },
                Err(error) => {
                    // If YOS transfer fails, log the error but don't fail the entire unstaking process
                    msg!("WARNING: Failed to transfer YOS rewards: {:?}", error);
                    msg!("Unstaked {} YOT tokens but YOS rewards transfer failed", amount as f64 / 1_000_000_000.0);
                }
            }
        } else {
            // Not enough YOS in program account - log the issue but continue with unstaking
            msg!("WARNING: Insufficient YOS tokens in program account for rewards. Available: {}, Required: {}", 
                 program_yos_balance, raw_rewards);
            msg!("Unstaked {} YOT tokens but YOS rewards were not transferred due to insufficient program balance", 
                 amount as f64 / 1_000_000_000.0);
        }
    } else {
        msg!("Unstaked {} YOT tokens", amount as f64 / 1_000_000_000.0);
    }
    
    Ok(())
}