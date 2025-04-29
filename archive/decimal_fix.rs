// This is a proposed fix for the decimal issue in the process_unstake function
// The problem is that the contract incorrectly divides the amount by 10^9 before transfer,
// causing users to receive a fraction of their unstaked amount

// INCORRECT CODE (current implementation):
// let transfer_amount = amount / 1_000_000_000;

// CORRECT IMPLEMENTATION:
// We should NOT divide by 10^9 as SPL tokens already account for decimals
// The amount received from the client is already in the correct raw format

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
    
    // CRITICAL FIX: Use the original amount directly, do NOT divide by 10^9
    // SPL tokens already account for decimals, so we should use the raw amount
    let transfer_amount = amount; // Use raw amount directly
    
    // Transfer YOT tokens back to user (this should ALWAYS happen)
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            program_yot_token_account.key,
            user_yot_token_account.key,
            program_authority.key,
            &[],
            transfer_amount, // No division, use the raw amount directly
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
            // CRITICAL FIX: Use the original raw_rewards directly, do NOT divide by 10^9
            let ui_rewards = raw_rewards; // No division
            
            // Only attempt to transfer rewards if the program has enough YOS tokens
            let transfer_result = invoke_signed(
                &spl_token::instruction::transfer(
                    token_program.key,
                    program_yos_token_account.key,
                    user_yos_token_account.key,
                    program_authority.key,
                    &[],
                    ui_rewards, // No division, use the raw amount directly
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
                    msg!("Unstaked {} YOT tokens and harvested {} YOS rewards", 
                         amount as f64 / 1_000_000_000.0, 
                         ui_rewards as f64 / 1_000_000_000.0);
                },
                Err(error) => {
                    // If YOS transfer fails, log the error but don't fail the entire unstaking process
                    msg!("WARNING: Failed to transfer YOS rewards: {:?}", error);
                    msg!("Unstaked {} YOT tokens but YOS rewards transfer failed", 
                         amount as f64 / 1_000_000_000.0);
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

// NOTE: The key changes are:
// 1. We removed the division by 10^9 when transferring tokens
// 2. We use the raw amount directly for both YOT and YOS transfers
// 3. We still use division for display purposes in log messages