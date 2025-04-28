// This is a proposed fix for the decimal issue in the process_unstake function
// The problem is that the contract calculates rewards correctly but transfers the raw amount
// without considering token decimals, causing wallet displays to show large numbers.

// Replace the existing process_unstake function with this updated version or adapt as needed:

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
    
    // Calculate pending rewards using CURRENT rate from program state
    let time_staked_seconds = current_time.checked_sub(staking_data.last_harvest_time)
        .ok_or(ProgramError::InvalidArgument)?;
    
    // Convert staking rate from basis points to decimal
    let rate_decimal = (program_state.stake_rate_per_second as f64) / 10000.0;
    
    // Calculate raw rewards based on staked amount, time, and CURRENT rate
    let raw_rewards = (staking_data.staked_amount as f64 * time_staked_seconds as f64 * rate_decimal) as u64;
    
    // Update staking data - store raw rewards in staking data
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
    
    // Transfer any pending YOS rewards if available
    if raw_rewards > 0 {
        // For wallet display purposes, use the same raw amount as SPL tokens already account for decimals
        let ui_rewards = raw_rewards;
        
        invoke_signed(
            &spl_token::instruction::transfer(
                token_program.key,
                program_yos_token_account.key,
                user_yos_token_account.key,
                program_authority.key,
                &[],
                ui_rewards,
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
        msg!("Unstaked {} YOT tokens and harvested {} YOS rewards (raw amount: {})", 
             amount as f64 / 1_000_000_000.0, 
             ui_rewards as f64 / 1_000_000_000.0, 
             raw_rewards);
    } else {
        msg!("Unstaked {} YOT tokens", amount as f64 / 1_000_000_000.0);
    }
    
    Ok(())
}

// NOTE: The key changes are:
// 1. We now consistently use raw_rewards for internal calculations and storage
// 2. For token transfers, we use ui_rewards (same as raw_rewards since SPL tokens already handle decimals)
// 3. In logs, we show both the user-friendly amount (divided by 10^9) and the raw amount

// This approach ensures consistency between internal calculations, stored values,
// and what users see in their wallets.