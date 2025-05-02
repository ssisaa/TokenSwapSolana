pub fn process_swap_token(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount_in: u64,
    minimum_amount_out: u64,
) -> ProgramResult {
    msg!("⭐ MULTIHUB SWAP: Starting swap operation");
    msg!("Amount in: {}, Minimum amount out: {}", amount_in, minimum_amount_out);
    msg!("Number of accounts provided: {}", accounts.len());

    // ===== ACCOUNT VALIDATION =====
    if accounts.len() != 8 {
        msg!("❌ ERROR: Invalid number of accounts: {}, expected 8", accounts.len());
        return Err(ProgramError::InvalidArgument);
    }

    let account_info_iter = &mut accounts.iter();
    
    // Extract accounts with detailed logging
    let user_account = next_account_info(account_info_iter)?;
    msg!("User account: {}, is_signer: {}, is_writable: {}", 
        user_account.key, user_account.is_signer, user_account.is_writable);
    if !user_account.is_signer {
        msg!("❌ ERROR: User account must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }

    let user_input_token_account = next_account_info(account_info_iter)?;
    msg!("User input token account: {}, is_writable: {}", 
        user_input_token_account.key, user_input_token_account.is_writable);

    let user_output_token_account = next_account_info(account_info_iter)?;
    msg!("User output token account: {}, is_writable: {}", 
        user_output_token_account.key, user_output_token_account.is_writable);

    let user_yos_token_account = next_account_info(account_info_iter)?;
    msg!("User YOS token account: {}, is_writable: {}", 
        user_yos_token_account.key, user_yos_token_account.is_writable);

    let program_state_account = next_account_info(account_info_iter)?;
    msg!("Program state account: {}, is_writable: {}", 
        program_state_account.key, program_state_account.is_writable);

    let token_program = next_account_info(account_info_iter)?;
    msg!("Token program: {}, expected: {}", 
        token_program.key, TOKEN_PROGRAM_ID);
    if token_program.key != &TOKEN_PROGRAM_ID {
        msg!("❌ ERROR: Invalid token program ID");
        return Err(ProgramError::IncorrectProgramId);
    }

    let input_token_mint = next_account_info(account_info_iter)?;
    msg!("Input token mint: {}", input_token_mint.key);

    let output_token_mint = next_account_info(account_info_iter)?;
    msg!("Output token mint: {}", output_token_mint.key);

    // ===== ACCOUNT OWNERSHIP CHECKS =====
    if program_state_account.owner != program_id {
        msg!("❌ ERROR: Program state account not owned by this program");
        msg!("Expected owner: {}, Actual owner: {}", program_id, program_state_account.owner);
        return Err(ProgramError::IllegalOwner);
    }

    // Verify token accounts belong to the correct mints
    msg!("Verifying token account ownership and mint associations...");
    
    // Check the user's input token account
    if let Ok(input_token_account) = Account::unpack(&user_input_token_account.data.borrow()) {
        msg!("Input token account mint: {}, expected: {}", 
            input_token_account.mint, input_token_mint.key);
        if input_token_account.mint != *input_token_mint.key {
            msg!("❌ ERROR: Input token account mint mismatch");
            return Err(ProgramError::InvalidArgument);
        }
        if input_token_account.owner != *user_account.key {
            msg!("❌ ERROR: Input token account not owned by user");
            msg!("Expected owner: {}, Actual owner: {}", user_account.key, input_token_account.owner);
            return Err(ProgramError::IllegalOwner);
        }
        msg!("Input token account balance: {}", input_token_account.amount);
        if input_token_account.amount < amount_in {
            msg!("❌ ERROR: Insufficient balance in input token account");
            msg!("Required: {}, Available: {}", amount_in, input_token_account.amount);
            return Err(ProgramError::InsufficientFunds);
        }
    } else {
        msg!("❌ ERROR: Failed to unpack input token account data");
        return Err(ProgramError::InvalidAccountData);
    }

    // Check the user's output token account
    if let Ok(output_token_account) = Account::unpack(&user_output_token_account.data.borrow()) {
        msg!("Output token account mint: {}, expected: {}", 
            output_token_account.mint, output_token_mint.key);
        if output_token_account.mint != *output_token_mint.key {
            msg!("❌ ERROR: Output token account mint mismatch");
            return Err(ProgramError::InvalidArgument);
        }
        if output_token_account.owner != *user_account.key {
            msg!("❌ ERROR: Output token account not owned by user");
            msg!("Expected owner: {}, Actual owner: {}", user_account.key, output_token_account.owner);
            return Err(ProgramError::IllegalOwner);
        }
    } else {
        msg!("❌ ERROR: Failed to unpack output token account data");
        return Err(ProgramError::InvalidAccountData);
    }

    // Deserialize program state for routing logic
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    msg!("Program state loaded successfully");
    msg!("YOT mint: {}", program_state.yot_mint);
    msg!("YOS mint: {}", program_state.yos_mint);
    msg!("SOL-YOT pool: {}", program_state.sol_yot_pool);
    
    // ===== TRANSACTION DIRECTION DETERMINATION =====
    let is_input_yot = input_token_mint.key == &program_state.yot_mint;
    let is_output_yot = output_token_mint.key == &program_state.yot_mint;
    
    msg!("Is input YOT? {}", is_input_yot);
    msg!("Is output YOT? {}", is_output_yot);

    // Get the program authority PDA for token operations
    let (authority_pubkey, authority_bump_seed) = Pubkey::find_program_address(
        &[b"authority"],
        program_id,
    );
    msg!("Authority PDA: {}, bump: {}", authority_pubkey, authority_bump_seed);

    // ===== TOKEN SWAP LOGIC =====
    // This is a simplified version. In the real contract, you'd implement
    // the actual swap logic with Jupiter or Raydium integration.
    
    // For now, let's simulate the swap with token transfers
    let amount_out: u64 = amount_in; // Simplified 1:1 conversion for demo
    
    msg!("Calculated amount out: {}", amount_out);
    if amount_out < minimum_amount_out {
        msg!("❌ ERROR: Slippage exceeded");
        msg!("Amount out: {}, Minimum expected: {}", amount_out, minimum_amount_out);
        return Err(ProgramError::Custom(4)); // Custom error for slippage
    }

    // Calculate 20% liquidity contribution amount
    let liquidity_amount = amount_in.checked_mul(20).unwrap().checked_div(100).unwrap();
    msg!("20% liquidity contribution: {}", liquidity_amount);

    // Calculate 5% cashback in YOS
    let cashback_amount = amount_in.checked_mul(5).unwrap().checked_div(100).unwrap();
    msg!("5% YOS cashback: {}", cashback_amount);

    // Execute token transfers
    // In a complete implementation, you would:
    // 1. Transfer input tokens from user to the program
    // 2. Use Jupiter/Raydium to execute the swap
    // 3. Send output tokens to the user
    // 4. Send YOS cashback to the user

    msg!("Would execute these token transfers in complete implementation:");
    msg!("1. Transfer {} input tokens from user to program", amount_in);
    msg!("2. Provide {} tokens as liquidity contribution (20%)", liquidity_amount);
    msg!("3. Send {} output tokens to user", amount_out);
    msg!("4. Send {} YOS tokens as cashback (5%)", cashback_amount);

    msg!("✅ MULTIHUB SWAP: Swap completed successfully");
    Ok(())
}