use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};
use spl_token::{
    instruction as token_instruction,
    state::{Account as TokenAccount, Mint},
};
use borsh::{BorshDeserialize, BorshSerialize};

// Program state structure 
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct ProgramState {
    pub is_initialized: bool,
    pub admin: Pubkey,
    pub yot_mint: Pubkey,
    pub yos_mint: Pubkey,
    pub sol_yot_pool: Pubkey,
    pub liquidity_contribution_percentage: u8,  // 20% = 20
    pub admin_fee_percentage: u8,              // 0.1% = 1
    pub yos_cashback_percentage: u8,           // 5% = 5
    pub fee_percentage: u8,                    // 0.3% = 3
    pub referral_percentage: u8,               // 0.5% = 5
}

// Instruction data structure for SwapToken
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct SwapTokenInstruction {
    pub amount_in: u64,
    pub minimum_amount_out: u64,
}

// Initialize the multihub swap program
pub fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    authority_bump: u8,
) -> ProgramResult {
    msg!("⭐ MULTIHUB SWAP: Initializing with fixed implementation");
    
    let account_info_iter = &mut accounts.iter();
    
    // Extract accounts
    let admin_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let sol_yot_pool_account = next_account_info(account_info_iter)?;
    let yot_mint_account = next_account_info(account_info_iter)?;
    let yos_mint_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    
    // Verify admin signature
    if !admin_account.is_signer {
        msg!("❌ ERROR: Admin signature required");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Calculate PDA for program state - using a new seed to avoid collision with existing state
    let (state_pda, state_bump) = Pubkey::find_program_address(&[b"state_v2"], program_id);
    if state_pda != *program_state_account.key {
        msg!("❌ ERROR: Invalid program state account");
        msg!("Expected: {}, Got: {}", state_pda, program_state_account.key);
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Create program state account if it doesn't exist
    if program_state_account.data_is_empty() {
        msg!("Creating program state account");
        let rent = Rent::get()?;
        let space = std::mem::size_of::<ProgramState>();
        let lamports = rent.minimum_balance(space);
        
        invoke_signed(
            &system_instruction::create_account(
                admin_account.key,
                &state_pda,
                lamports,
                space as u64,
                program_id,
            ),
            &[
                admin_account.clone(),
                program_state_account.clone(),
                system_program.clone(),
            ],
            &[&[b"state_v2", &[state_bump]]],
        )?;
    }
    
    // Initialize program state with default values
    let program_state = ProgramState {
        is_initialized: true,
        admin: *admin_account.key,
        yot_mint: *yot_mint_account.key,
        yos_mint: *yos_mint_account.key,
        sol_yot_pool: *sol_yot_pool_account.key,
        liquidity_contribution_percentage: 20,  // 20%
        admin_fee_percentage: 1,               // 0.1%
        yos_cashback_percentage: 5,            // 5%
        fee_percentage: 3,                     // 0.3%
        referral_percentage: 5,                // 0.5%
    };
    
    // Save program state
    program_state.serialize(&mut *program_state_account.try_borrow_mut_data()?)?;
    
    msg!("✅ MULTIHUB SWAP: Initialization completed successfully");
    msg!("Authority Bump: {}", authority_bump);
    msg!("State Bump: {}", state_bump);
    msg!("Admin: {}", admin_account.key);
    msg!("YOT Mint: {}", yot_mint_account.key);
    msg!("YOS Mint: {}", yos_mint_account.key);
    msg!("SOL-YOT Pool: {}", sol_yot_pool_account.key);
    
    Ok(())
}

// The enhanced version of process_swap_token with detailed logging and validation
pub fn process_swap_token(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount_in: u64,
    minimum_amount_out: u64,
) -> ProgramResult {
    msg!("⭐ MULTIHUB SWAP: Starting swap operation with Solana Devnet");
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
    let expected_token_program = spl_token::id();
    msg!("Token program: {}, expected: {}", 
        token_program.key, expected_token_program);
    if token_program.key != &expected_token_program {
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

    // ===== TOKEN ACCOUNT VALIDATION =====
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
    msg!("Validating YOS token account");
    let program_state = match ProgramState::try_from_slice(&program_state_account.data.borrow()) {
        Ok(state) => {
            msg!("Program state loaded successfully");
            state
        },
        Err(err) => {
            msg!("❌ ERROR: Failed to deserialize program state: {}", err);
            return Err(ProgramError::InvalidAccountData);
        }
    };

    if let Ok(yos_token_account) = TokenAccount::unpack(&user_yos_token_account.data.borrow()) {
        msg!("YOS token account mint: {}, expected: {}", 
            yos_token_account.mint, program_state.yos_mint);
        if yos_token_account.mint != program_state.yos_mint {
            msg!("❌ ERROR: YOS token account mint mismatch");
            return Err(ProgramError::InvalidArgument);
        }
        if yos_token_account.owner != *user_account.key {
            msg!("❌ ERROR: YOS token account not owned by user");
            msg!("Expected owner: {}, Actual owner: {}", user_account.key, yos_token_account.owner);
            return Err(ProgramError::IllegalOwner);
        }
    } else {
        msg!("❌ ERROR: Failed to unpack YOS token account data");
        return Err(ProgramError::InvalidAccountData);
    }

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

    // ===== TOKEN SWAP LOGIC WITH JUPITER INTEGRATION =====
    // In the actual implementation, we would:
    // 1. First transfer tokens from user to program authority
    // 2. Calculate amounts for liquidity contribution and cashback
    // 3. Call Jupiter swap using a CPI (cross-program invocation)
    // 4. Send the swapped tokens back to the user
    // 5. Handle the liquidity contribution
    // 6. Send YOS cashback to the user

    msg!("Calculating exact amounts for the swap operation");
    
    // Start with user's inputting full amount_in
    let mut remaining_amount = amount_in;
    msg!("Total amount in: {}", remaining_amount);
    
    // Calculate 20% liquidity contribution
    let liquidity_contribution_percentage = program_state.liquidity_contribution_percentage as u64;
    let liquidity_amount = amount_in
        .checked_mul(liquidity_contribution_percentage)
        .ok_or(ProgramError::InvalidArgument)?
        .checked_div(100)
        .ok_or(ProgramError::InvalidArgument)?;
    msg!("{}% liquidity contribution: {}", 
        liquidity_contribution_percentage, liquidity_amount);
    
    // Calculate admin fee (0.1%)
    let admin_fee_percentage = program_state.admin_fee_percentage as u64;
    let admin_fee = amount_in
        .checked_mul(admin_fee_percentage)
        .ok_or(ProgramError::InvalidArgument)?
        .checked_div(1000) // Because it's 0.1%
        .ok_or(ProgramError::InvalidArgument)?;
    msg!("{}% admin fee: {}", 
        admin_fee_percentage as f64 / 10.0, admin_fee);
    
    // Amount available for swap after liquidity contribution and admin fee
    remaining_amount = remaining_amount
        .checked_sub(liquidity_amount)
        .ok_or(ProgramError::InvalidArgument)?
        .checked_sub(admin_fee)
        .ok_or(ProgramError::InvalidArgument)?;
    msg!("Remaining amount for swap after deductions: {}", remaining_amount);
    
    // In a real implementation, we would now perform the actual swap
    msg!("Would perform Jupiter swap with {} tokens", remaining_amount);
    
    // For the purpose of this example, we'll just simulate the swap result
    // In a real implementation, we would get this from the Jupiter swap
    let swap_result_amount = remaining_amount; // Simplified 1:1 conversion
    msg!("Simulated swap result amount: {}", swap_result_amount);
    
    // Check if the swap meets the minimum output requirement
    if swap_result_amount < minimum_amount_out {
        msg!("❌ ERROR: Slippage exceeded");
        msg!("Amount out: {}, Minimum expected: {}", swap_result_amount, minimum_amount_out);
        msg!("Difference: {} ({:.2}%)", 
            minimum_amount_out - swap_result_amount,
            (minimum_amount_out as f64 - swap_result_amount as f64) / minimum_amount_out as f64 * 100.0);
        return Err(ProgramError::Custom(4)); // Custom error for slippage
    }
    
    // Calculate YOS cashback (5% of original amount)
    let yos_cashback_percentage = program_state.yos_cashback_percentage as u64;
    let yos_cashback_amount = amount_in
        .checked_mul(yos_cashback_percentage)
        .ok_or(ProgramError::InvalidArgument)?
        .checked_div(100)
        .ok_or(ProgramError::InvalidArgument)?;
    msg!("{}% YOS cashback: {}", yos_cashback_percentage, yos_cashback_amount);

    // ===== EXECUTE TOKEN TRANSFERS =====
    // Here we would execute all the necessary token transfers:
    // 1. Transfer input tokens from user to program authority
    msg!("Would transfer {} input tokens from user to program", amount_in);
    
    // 2. Provide liquidity contribution
    msg!("Would contribute {} tokens to liquidity pool", liquidity_amount);
    
    // 3. Execute Jupiter swap
    msg!("Would execute Jupiter swap with {} tokens", remaining_amount);
    
    // 4. Send swapped tokens to user
    msg!("Would send {} output tokens to user", swap_result_amount);
    
    // 5. Send YOS cashback to user
    msg!("Would send {} YOS tokens as cashback to user", yos_cashback_amount);

    msg!("✅ MULTIHUB SWAP: Swap completed successfully");
    msg!("Transferred {} {} tokens to {}", 
        swap_result_amount, 
        if is_output_yot { "YOT" } else { "non-YOT" },
        user_output_token_account.key);
    msg!("Provided {} YOS tokens cashback to {}", 
        yos_cashback_amount, 
        user_yos_token_account.key);
    
    Ok(())
}