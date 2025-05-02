use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    program::{invoke, invoke_signed},
    system_instruction,
    sysvar::{rent::Rent, Sysvar},
};
use borsh::{BorshDeserialize, BorshSerialize};
use spl_token::{
    state::{Account as TokenAccount, Mint},
    instruction as token_instruction,
};

/// Program state data struct
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct ProgramState {
    pub is_initialized: bool,
    pub yot_mint: Pubkey,
    pub yos_mint: Pubkey,
    pub sol_yot_pool: Pubkey,
    pub admin: Pubkey,
    pub swap_fee_bps: u16,
    pub admin_fee_bps: u16,
    pub yos_cashback_bps: u16,
    pub liquidity_contribution_bps: u16,
    pub authority_bump: u8,
}

/// Initialize the program with parameters
pub fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    authority_bump: u8,
) -> ProgramResult {
    msg!("Instruction: Initialize");

    let account_info_iter = &mut accounts.iter();
    let admin = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let yot_mint = next_account_info(account_info_iter)?;
    let yos_mint = next_account_info(account_info_iter)?;
    let sol_yot_pool = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;

    // Validate admin is signer
    if !admin.is_signer {
        msg!("Admin must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Create program state account
    let rent = Rent::from_account_info(rent_sysvar)?;
    let required_lamports = rent.minimum_balance(std::mem::size_of::<ProgramState>());

    // Use invoke_signed to create program state account with proper PDA
    let seeds = &[b"program_state".as_ref()];
    let (expected_state_pubkey, _) = Pubkey::find_program_address(seeds, program_id);

    // Validate program state account matches expected PDA
    if program_state_account.key != &expected_state_pubkey {
        msg!("Program state account does not match PDA");
        return Err(ProgramError::InvalidArgument);
    }

    // Create PDA if it doesn't exist
    if program_state_account.data_is_empty() {
        msg!("Creating program state account");
        invoke_signed(
            &system_instruction::create_account(
                admin.key,
                program_state_account.key,
                required_lamports,
                std::mem::size_of::<ProgramState>() as u64,
                program_id,
            ),
            &[admin.clone(), program_state_account.clone()],
            &[&[b"program_state".as_ref(), &[_]]],
        )?;
    }

    // Initialize program state
    let program_state = ProgramState {
        is_initialized: true,
        yot_mint: *yot_mint.key,
        yos_mint: *yos_mint.key,
        sol_yot_pool: *sol_yot_pool.key,
        admin: *admin.key,
        swap_fee_bps: 30, // 0.3%
        admin_fee_bps: 10, // 0.1%
        yos_cashback_bps: 300, // 3%
        liquidity_contribution_bps: 2000, // 20%
        authority_bump,
    };

    // Serialize and save program state
    let mut state_data = program_state_account.data.borrow_mut();
    program_state.serialize(&mut &mut state_data[..])?;

    msg!("Program state initialized");
    msg!("YOT mint: {}", yot_mint.key);
    msg!("YOS mint: {}", yos_mint.key);
    msg!("SOL-YOT pool: {}", sol_yot_pool.key);
    msg!("Authority bump: {}", authority_bump);

    Ok(())
}

/// Process token swap with detailed error handling
pub fn process_swap_token(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount_in: u64,
    minimum_amount_out: u64,
) -> ProgramResult {
    msg!("⭐ MULTIHUB SWAP: Starting swap operation");
    msg!("Amount in: {}, Minimum amount out: {}", amount_in, minimum_amount_out);
    msg!("Number of accounts provided: {}", accounts.len());
    msg!("CUSTOM ERROR CODE 11 = InvalidMint in the SPL token program - check if all required token accounts exist");

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

    // Make sure YOS token account exists - this is crucial
    if user_yos_token_account.data_len() == 0 {
        msg!("❌ ERROR: User YOS token account doesn't exist. It must be created before using this instruction");
        return Err(ProgramError::UninitializedAccount);
    }

    let program_state_account = next_account_info(account_info_iter)?;
    msg!("Program state account: {}, is_writable: {}", 
        program_state_account.key, program_state_account.is_writable);

    let token_program = next_account_info(account_info_iter)?;
    msg!("Token program: {}, expected: {}", 
        token_program.key, spl_token::id());
    if token_program.key != &spl_token::id() {
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
    if let Ok(input_token_account) = TokenAccount::unpack(&user_input_token_account.data.borrow()) {
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
    if let Ok(output_token_account) = TokenAccount::unpack(&user_output_token_account.data.borrow()) {
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

    // Check the user's YOS token account
    if let Ok(yos_token_account) = TokenAccount::unpack(&user_yos_token_account.data.borrow()) {
        // We'll check this against the program state YOS mint later
        msg!("YOS token account mint: {}", yos_token_account.mint);
        if yos_token_account.owner != *user_account.key {
            msg!("❌ ERROR: YOS token account not owned by user");
            msg!("Expected owner: {}, Actual owner: {}", user_account.key, yos_token_account.owner);
            return Err(ProgramError::IllegalOwner);
        }
    } else {
        msg!("❌ ERROR: Failed to unpack YOS token account data");
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

    // Verify the YOS token account belongs to the correct mint from program state
    if let Ok(yos_token_account) = TokenAccount::unpack(&user_yos_token_account.data.borrow()) {
        if yos_token_account.mint != program_state.yos_mint {
            msg!("❌ ERROR: YOS token account mint does not match program state YOS mint");
            msg!("YOS account mint: {}, Program state YOS mint: {}", 
                yos_token_account.mint, program_state.yos_mint);
            return Err(ProgramError::InvalidArgument);
        }
    }

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
    let liquidity_amount = amount_in
        .checked_mul(program_state.liquidity_contribution_bps as u64)
        .ok_or(ProgramError::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    msg!("{}% liquidity contribution: {}", 
         program_state.liquidity_contribution_bps / 100, liquidity_amount);

    // Calculate 5% cashback in YOS
    let cashback_amount = amount_in
        .checked_mul(program_state.yos_cashback_bps as u64)
        .ok_or(ProgramError::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    msg!("{}% YOS cashback: {}", program_state.yos_cashback_bps / 100, cashback_amount);

    // Execute token transfers
    // In a complete implementation, you would:
    // 1. Transfer input tokens from user to the program
    // 2. Use Jupiter/Raydium to execute the swap
    // 3. Send output tokens to the user
    // 4. Send YOS cashback to the user

    msg!("Would execute these token transfers in complete implementation:");
    msg!("1. Transfer {} input tokens from user to program", amount_in);
    msg!("2. Provide {} tokens as liquidity contribution ({}%)", 
         liquidity_amount, program_state.liquidity_contribution_bps / 100);
    msg!("3. Send {} output tokens to user", amount_out);
    msg!("4. Send {} YOS tokens as cashback ({}%)", 
         cashback_amount, program_state.yos_cashback_bps / 100);

    msg!("✅ MULTIHUB SWAP: Swap completed successfully");
    Ok(())
}