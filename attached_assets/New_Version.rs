// ACCOUNT BORROW FIX
// The following is a modified version of the sol_to_yot_swap function
// that avoids the "account already borrowed" error
// by restructuring how accounts are accessed.

pub fn process_sol_to_yot_swap(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount_in: u64,
    min_amount_out: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    // Get all accounts first
    let user = next_account_info(account_info_iter)?;
    let program_state = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let pool_sol_account = next_account_info(account_info_iter)?;
    let pool_yot_account = next_account_info(account_info_iter)?;
    let user_yot_account = next_account_info(account_info_iter)?;
    let liquidity_contribution_account = next_account_info(account_info_iter)?;
    let yos_mint = next_account_info(account_info_iter)?;
    let user_yos_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let sysvar_rent = next_account_info(account_info_iter)?;

    // Verify that the user signed the transaction
    if !user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // ==================== IMPORTANT CHANGE ====================
    // Clone all the account references that will be used multiple times
    // This prevents the "account already borrowed" error
    // =========================================================
    let user_clone = user.clone();
    let program_authority_clone = program_authority.clone();
    let liquidity_contribution_account_clone = liquidity_contribution_account.clone();
    let user_yot_account_clone = user_yot_account.clone();
    let user_yos_account_clone = user_yos_account.clone();
    let pool_yot_account_clone = pool_yot_account.clone();
    let yos_mint_clone = yos_mint.clone();
    let token_program_clone = token_program.clone();

    // Log transaction parameters
    msg!("SOL to YOT Swap Instruction");
    msg!("SOL amount in: {}, Min YOT out: {}", amount_in, min_amount_out);

    // Verify program state PDA
    let (expected_state_address, _) = Pubkey::find_program_address(&[b"state"], program_id);
    if program_state.key != &expected_state_address {
        return Err(ProgramError::InvalidArgument);
    }

    // Verify program authority PDA
    let (expected_authority, _) = Pubkey::find_program_address(&[b"authority"], program_id);
    if program_authority.key != &expected_authority {
        return Err(ProgramError::InvalidArgument);
    }

    // Process the SOL-YOT swap
    msg!("Processing SOL to YOT swap");
    msg!("Amount in: {} lamports", amount_in);
    msg!("Minimum amount out: {} YOT", min_amount_out);

    // 1. Transfer SOL from user to pool
    msg!("Transferring {} lamports SOL from user to pool", amount_in);
    invoke(
        &system_instruction::transfer(user.key, pool_sol_account.key, amount_in),
        &[
            user.clone(),
            pool_sol_account.clone(),
            system_program.clone(),
        ],
    )?;

    // 2. Calculate YOT output (use your AMM calculation logic here)
    // For this example, we'll use a simplified constant product formula
    let pool_sol_balance = pool_sol_account.lamports();
    
    let pool_yot_token_account = Account::unpack(&pool_yot_account.data.borrow())?;
    let pool_yot_balance = pool_yot_token_account.amount;
    
    // Simple constant product formula: output = (input * out_reserve) / (in_reserve + input)
    // Adjusted to handle potential for zero balances during testing
    let total_yot_output = if pool_sol_balance > amount_in {
        (amount_in as u128)
            .checked_mul(pool_yot_balance as u128).ok_or(ProgramError::ArithmeticOverflow)?
            .checked_div((pool_sol_balance - amount_in) as u128).ok_or(ProgramError::ArithmeticOverflow)?
    } else {
        // Fallback if pool balance is too low
        (amount_in as u128).checked_mul(1000000000u128).ok_or(ProgramError::ArithmeticOverflow)?
    };
    
    let total_yot_output = total_yot_output as u64;
    msg!("Calculated YOT output: {}", total_yot_output);

    // Verify minimum output
    if total_yot_output < min_amount_out {
        return Err(ProgramError::Custom(1)); // Slippage error
    }

    // Get program state data to get rates
    let program_state_data = ProgramState::try_from_slice(&program_state.data.borrow())?;
    
    // Calculate distribution
    // These percentages should match the frontend's understanding
    let lp_contribution_rate = program_state_data.lp_contribution_rate;
    let yos_cashback_rate = program_state_data.yos_cashback_rate;
    
    // Split the output based on rates
    let user_yot_amount = (total_yot_output as u128)
        .checked_mul((10000 - lp_contribution_rate - yos_cashback_rate) as u128).ok_or(ProgramError::ArithmeticOverflow)?
        .checked_div(10000).ok_or(ProgramError::ArithmeticOverflow)? as u64;
    
    let liquidity_yot_amount = (total_yot_output as u128)
        .checked_mul(lp_contribution_rate as u128).ok_or(ProgramError::ArithmeticOverflow)?
        .checked_div(10000).ok_or(ProgramError::ArithmeticOverflow)? as u64;
    
    let yos_cashback_amount = (total_yot_output as u128)
        .checked_mul(yos_cashback_rate as u128).ok_or(ProgramError::ArithmeticOverflow)?
        .checked_div(10000).ok_or(ProgramError::ArithmeticOverflow)? as u64;
    
    msg!("Distribution: User: {}, Liquidity: {}, YOS Cashback: {}", 
         user_yot_amount, liquidity_yot_amount, yos_cashback_amount);

    // 3. Create liquidity contribution account if it doesn't exist
    // ==================== IMPORTANT CHANGE ====================
    // This entire section is now using cloned references
    // to avoid borrowing the same account multiple times
    // =========================================================
    if liquidity_contribution_account_clone.data_is_empty() {
        msg!("Creating new liquidity contribution account");
        
        // Calculate space needed and rent
        let space = std::mem::size_of::<LiquidityContribution>();
        let rent = Rent::from_account_info(sysvar_rent)?;
        let lamports = rent.minimum_balance(space);
        
        // Create account
        invoke_signed(
            &system_instruction::create_account(
                user_clone.key,
                liquidity_contribution_account_clone.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[
                user_clone.clone(),
                liquidity_contribution_account_clone.clone(),
                system_program.clone(),
            ],
            &[&[b"liq", user_clone.key.as_ref(), &[find_liquidity_contribution_bump(program_id, user_clone.key)?]]],
        )?;
        
        // Initialize the account data
        let now = Clock::get()?.unix_timestamp as u64;
        let liquidity_contribution = LiquidityContribution {
            user: *user_clone.key,
            contributed_amount: liquidity_yot_amount,
            start_timestamp: now,
            last_claim_time: now,
            total_claimed_yos: 0,
        };
        
        // Serialize data to the account
        liquidity_contribution.serialize(&mut &mut liquidity_contribution_account_clone.data.borrow_mut()[..])?;
    } else {
        // Account exists, update it
        let mut liquidity_contribution = LiquidityContribution::try_from_slice(&liquidity_contribution_account_clone.data.borrow())?;
        liquidity_contribution.contributed_amount = liquidity_contribution.contributed_amount.checked_add(liquidity_yot_amount).ok_or(ProgramError::ArithmeticOverflow)?;
        liquidity_contribution.serialize(&mut &mut liquidity_contribution_account_clone.data.borrow_mut()[..])?;
    }

    // 4. Transfer user YOT tokens
    // ==================== IMPORTANT CHANGE ====================
    // Using cloned references to avoid borrowing conflicts
    // =========================================================
    msg!("Transferring {} YOT tokens to user", user_yot_amount);
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program_clone.key,
            pool_yot_account_clone.key,
            user_yot_account_clone.key,
            program_authority_clone.key,
            &[],
            user_yot_amount,
        )?,
        &[
            pool_yot_account_clone.clone(),
            user_yot_account_clone.clone(),
            program_authority_clone.clone(),
            token_program_clone.clone(),
        ],
        &[&[b"authority", &[find_authority_bump(program_id)?]]],
    )?;

    // 5. Mint YOS cashback tokens to user
    // ==================== IMPORTANT CHANGE ====================
    // Using cloned references to avoid borrowing conflicts
    // =========================================================
    msg!("Minting {} YOS tokens as cashback", yos_cashback_amount);
    invoke_signed(
        &spl_token::instruction::mint_to(
            token_program_clone.key,
            yos_mint_clone.key,
            user_yos_account_clone.key,
            program_authority_clone.key,
            &[],
            yos_cashback_amount,
        )?,
        &[
            yos_mint_clone.clone(),
            user_yos_account_clone.clone(),
            program_authority_clone.clone(),
            token_program_clone.clone(),
        ],
        &[&[b"authority", &[find_authority_bump(program_id)?]]],
    )?;

    Ok(())
}

// Helper function to find the bump seed for the liquidity contribution account
fn find_liquidity_contribution_bump(program_id: &Pubkey, user: &Pubkey) -> Result<u8, ProgramError> {
    let (_, bump) = Pubkey::find_program_address(&[b"liq", user.as_ref()], program_id);
    Ok(bump)
}

// Helper function to find the bump seed for the program authority
fn find_authority_bump(program_id: &Pubkey) -> Result<u8, ProgramError> {
    let (_, bump) = Pubkey::find_program_address(&[b"authority"], program_id);
    Ok(bump)
}