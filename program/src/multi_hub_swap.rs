use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
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
use arrayref::array_ref;
use spl_token::{instruction as token_instruction, state::Account as TokenAccount};

// Define the program ID for multi-hub swap
solana_program::declare_id!("SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE");

// Program state stored in a PDA (still uses Borsh for storage)
#[derive(BorshSerialize, BorshDeserialize, Debug, Default)]
pub struct ProgramState {
    pub admin: Pubkey,
    pub yot_mint: Pubkey,
    pub yos_mint: Pubkey,
    pub lp_contribution_rate: u64,  // 20% (2000 basis points)
    pub admin_fee_rate: u64,        // 0.1% (10 basis points)
    pub yos_cashback_rate: u64,     // 5% (500 basis points) 
    pub swap_fee_rate: u64,         // 0.3% (30 basis points)
    pub referral_rate: u64,         // 0.5% (50 basis points)
}

// Data structure for liquidity contribution account
#[derive(BorshSerialize, BorshDeserialize, Debug, Default)]
pub struct LiquidityContribution {
    pub user: Pubkey,
    pub contributed_amount: u64,
    pub start_timestamp: i64,
    pub last_claim_time: i64,
    pub total_claimed_yos: u64,
}

// Find program state PDA address
pub fn find_program_state_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"state"], program_id)
}

// Find program authority PDA address
pub fn find_program_authority_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"authority"], program_id)
}

// Find liquidity contribution account for a user
pub fn find_liquidity_contribution_address(user: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"liq", user.as_ref()], program_id)
}

// Instruction discriminator values used in the contract
pub const INITIALIZE_DISCRIMINATOR: u8 = 0;
pub const SWAP_DISCRIMINATOR: u8 = 1;
pub const CLOSE_PROGRAM_DISCRIMINATOR: u8 = 2;
pub const UPDATE_PARAMETERS_DISCRIMINATOR: u8 = 3;
pub const BUY_AND_DISTRIBUTE_DISCRIMINATOR: u8 = 4;
pub const CLAIM_WEEKLY_REWARD_DISCRIMINATOR: u8 = 5;
pub const WITHDRAW_CONTRIBUTION_DISCRIMINATOR: u8 = 6;

// Instruction handling for the multi-hub swap program
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // First byte is the instruction discriminator
    match instruction_data.first() {
        // Initialize instruction (0)
        Some(&INITIALIZE_DISCRIMINATOR) => {
            msg!("Multi-Hub Swap: Initialize Instruction");
            let mut offset = 1;
            if instruction_data.len() < 1 + 32*3 + 8*5 {
                msg!("Instruction too short for Initialize: {} bytes", instruction_data.len());
                return Err(ProgramError::InvalidInstructionData);
            }

            // Extract public keys
            let admin = Pubkey::from(*array_ref![instruction_data, offset, 32]);
            offset += 32;
            let yot_mint = Pubkey::from(*array_ref![instruction_data, offset, 32]);
            offset += 32;
            let yos_mint = Pubkey::from(*array_ref![instruction_data, offset, 32]);
            offset += 32;

            // Extract rates (all u64 in little-endian)
            let lp_contribution_rate = u64::from_le_bytes(
                instruction_data[offset..offset + 8].try_into().unwrap(),
            );
            offset += 8;
            let admin_fee_rate = u64::from_le_bytes(
                instruction_data[offset..offset + 8].try_into().unwrap(),
            );
            offset += 8;
            let yos_cashback_rate = u64::from_le_bytes(
                instruction_data[offset..offset + 8].try_into().unwrap(),
            );
            offset += 8;
            let swap_fee_rate = u64::from_le_bytes(
                instruction_data[offset..offset + 8].try_into().unwrap(),
            );
            offset += 8;
            let referral_rate = u64::from_le_bytes(
                instruction_data[offset..offset + 8].try_into().unwrap(),
            );

            msg!("Parsed Initialize params:");
            msg!("Admin: {}", admin);
            msg!("YOT Mint: {}", yot_mint);
            msg!("YOS Mint: {}", yos_mint);
            msg!("Rates: LP {} | Fee {} | Cashback {} | Swap {} | Referral {}",
                lp_contribution_rate,
                admin_fee_rate,
                yos_cashback_rate,
                swap_fee_rate,
                referral_rate);

            // Process initialize
            process_initialize(
                program_id,
                accounts,
                admin,
                yot_mint,
                yos_mint,
                lp_contribution_rate,
                admin_fee_rate,
                yos_cashback_rate,
                swap_fee_rate,
                referral_rate,
            )
        },
        
        // Buy and distribute tokens (4)
        Some(&BUY_AND_DISTRIBUTE_DISCRIMINATOR) => {
            msg!("Multi-Hub Swap: Buy and Distribute Instruction");
            if instruction_data.len() < 1 + 8 {
                msg!("Instruction too short for Buy and Distribute: {} bytes", instruction_data.len());
                return Err(ProgramError::InvalidInstructionData);
            }
            
            // Extract amount parameter
            let amount = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            
            msg!("Buy and Distribute params: Amount: {}", amount);
            
            // Process buy and distribute
            process_buy_and_distribute(program_id, accounts, amount)
        },
        
        // Claim weekly reward (5)
        Some(&CLAIM_WEEKLY_REWARD_DISCRIMINATOR) => {
            msg!("Multi-Hub Swap: Claim Weekly Reward Instruction");
            
            // Process claim weekly reward
            process_claim_weekly_reward(program_id, accounts)
        },
        
        // Withdraw contribution (6)
        Some(&WITHDRAW_CONTRIBUTION_DISCRIMINATOR) => {
            msg!("Multi-Hub Swap: Withdraw Contribution Instruction");
            
            // Process withdraw contribution
            process_withdraw_contribution(program_id, accounts)
        },
        
        // Update parameters (3)
        Some(&UPDATE_PARAMETERS_DISCRIMINATOR) => {
            msg!("Multi-Hub Swap: Update Parameters Instruction");
            if instruction_data.len() < 1 + 8*5 {
                msg!("Instruction too short for UpdateParameters: {} bytes", instruction_data.len());
                return Err(ProgramError::InvalidInstructionData);
            }
            
            // Extract updated parameters
            let lp_contribution_rate = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            let admin_fee_rate = u64::from_le_bytes(instruction_data[9..17].try_into().unwrap());
            let yos_cashback_rate = u64::from_le_bytes(instruction_data[17..25].try_into().unwrap());
            let swap_fee_rate = u64::from_le_bytes(instruction_data[25..33].try_into().unwrap());
            let referral_rate = u64::from_le_bytes(instruction_data[33..41].try_into().unwrap());
            
            msg!("Update params: LP {} | Fee {} | Cashback {} | Swap {} | Referral {}",
                lp_contribution_rate,
                admin_fee_rate,
                yos_cashback_rate,
                swap_fee_rate,
                referral_rate);
            
            // Process update parameters
            process_update_parameters(
                program_id,
                accounts,
                lp_contribution_rate,
                admin_fee_rate,
                yos_cashback_rate,
                swap_fee_rate,
                referral_rate,
            )
        },
        
        // Unrecognized instruction
        _ => {
            msg!("Multi-Hub Swap: Unknown instruction discriminator");
            Err(ProgramError::InvalidInstructionData)
        }
    }
}

// Initialize the multi-hub swap program
pub fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    admin: Pubkey,
    yot_mint: Pubkey,
    yos_mint: Pubkey,
    lp_contribution_rate: u64,
    admin_fee_rate: u64,
    yos_cashback_rate: u64,
    swap_fee_rate: u64,
    referral_rate: u64,
) -> ProgramResult {
    // Get accounts
    let accounts_iter = &mut accounts.iter();
    
    // Extract accounts
    let payer_account = next_account_info(accounts_iter)?;
    let program_state_account = next_account_info(accounts_iter)?;
    let program_authority_account = next_account_info(accounts_iter)?;
    let system_program_account = next_account_info(accounts_iter)?;
    let _rent_sysvar_account = next_account_info(accounts_iter)?;  // Prefixed with underscore since it's unused
    
    // Validate accounts
    if !payer_account.is_signer {
        msg!("Payer account must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify program state PDA
    let (expected_program_state, program_state_bump) = find_program_state_address(program_id);
    if expected_program_state != *program_state_account.key {
        msg!("❌ Invalid program state account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Verify program authority PDA
    let (expected_program_authority, _program_authority_bump) = find_program_authority_address(program_id);
    if expected_program_authority != *program_authority_account.key {
        msg!("❌ Invalid program authority account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Calculate space for program state
    let space = 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8; // 3 pubkeys + 5 u64 rates
    
    // Check if the account already exists and validate it
    if !program_state_account.data_is_empty() {
        // If it exists, check owner and size
        if program_state_account.owner != program_id {
            msg!("❌ State account not owned by this program");
            return Err(ProgramError::IncorrectProgramId);
        }
        
        if program_state_account.data_len() < space {
            msg!("❌ State account too small: expected {}, got {}", space, program_state_account.data_len());
            return Err(ProgramError::AccountDataTooSmall);
        }
        
        msg!("✓ Program state account already exists and is valid");
    } else {
        // Create program state account if it doesn't exist
        let rent = Rent::get()?;
        let required_lamports = rent.minimum_balance(space);
        msg!("Creating program state with {} bytes", space);
        msg!("Rent-exempt balance: {} lamports", required_lamports);
        
        invoke_signed(
            &system_instruction::create_account(
                payer_account.key,
                program_state_account.key,
                required_lamports,
                space as u64,
                program_id,
            ),
            &[
                payer_account.clone(),
                program_state_account.clone(),
                system_program_account.clone(),
            ],
            &[&[b"state", &[program_state_bump]]],
        )?;
    }
    
    // Initialize program state
    let program_state = ProgramState {
        admin,
        yot_mint,
        yos_mint,
        lp_contribution_rate,
        admin_fee_rate,
        yos_cashback_rate,
        swap_fee_rate,
        referral_rate,
    };
    
    msg!("Initialized program state:");
    msg!("Admin: {}", admin);
    msg!("YOT mint: {}", yot_mint);
    msg!("YOS mint: {}", yos_mint);
    msg!("LP contribution rate: {}", lp_contribution_rate);
    msg!("Admin fee rate: {}", admin_fee_rate);
    msg!("YOS cashback rate: {}", yos_cashback_rate);
    msg!("Swap fee rate: {}", swap_fee_rate);
    msg!("Referral rate: {}", referral_rate);
    
    // Serialize and store program state
    program_state.serialize(&mut &mut program_state_account.data.borrow_mut()[..])?;
    
    Ok(())
}

// Process buy and distribute tokens
pub fn process_buy_and_distribute(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    msg!("Starting buy and distribute");
    msg!("Amount: {}", amount);
    
    // Get accounts
    let accounts_iter = &mut accounts.iter();
    
    // Extract all required accounts
    let user_account = next_account_info(accounts_iter)?;
    let vault_yot_account = next_account_info(accounts_iter)?;
    let user_yot_account = next_account_info(accounts_iter)?;
    let liquidity_yot_account = next_account_info(accounts_iter)?;
    let yos_mint_account = next_account_info(accounts_iter)?;
    let user_yos_account = next_account_info(accounts_iter)?;
    let liquidity_contribution_account = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    let rent_sysvar = next_account_info(accounts_iter)?;
    
    // Validate accounts
    if !user_account.is_signer {
        msg!("User account must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Find program state PDA
    let (program_state_address, _program_state_bump) = find_program_state_address(program_id);
    
    // Load program state to get the rates
    // For this example, we're assuming program state is already initialized
    // In a real implementation, we would fetch and deserialize the program state account
    
    // Verify liquidity contribution PDA
    let (expected_liquidity_contribution, liquidity_contribution_bump) = 
        find_liquidity_contribution_address(user_account.key, program_id);
    
    if expected_liquidity_contribution != *liquidity_contribution_account.key {
        msg!("❌ Invalid liquidity contribution account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check if liquidity contribution account exists, if not, create it
    if liquidity_contribution_account.data_is_empty() {
        msg!("Creating new liquidity contribution account");
        
        // Calculate space for liquidity contribution data
        let space = 32 + 8 + 8 + 8 + 8; // pubkey + amount + start_time + last_claim_time + total_claimed
        
        // Create the account
        let rent = Rent::get()?;
        let required_lamports = rent.minimum_balance(space);
        
        invoke_signed(
            &system_instruction::create_account(
                user_account.key,
                liquidity_contribution_account.key,
                required_lamports,
                space as u64,
                program_id,
            ),
            &[
                user_account.clone(),
                liquidity_contribution_account.clone(),
                system_program.clone(),
            ],
            &[&[b"liq", user_account.key.as_ref(), &[liquidity_contribution_bump]]],
        )?;
        
        // Initialize liquidity contribution data
        let now = solana_program::clock::Clock::get()?.unix_timestamp;
        let liquidity_contribution = LiquidityContribution {
            user: *user_account.key,
            contributed_amount: 0, // Will be updated after token transfer
            start_timestamp: now,
            last_claim_time: now,
            total_claimed_yos: 0,
        };
        
        // Serialize and store liquidity contribution
        liquidity_contribution.serialize(&mut &mut liquidity_contribution_account.data.borrow_mut()[..])?;
    }
    
    // In a real implementation:
    // 1. Transfer YOT tokens from user to program
    // 2. Distribute tokens according to the rates (75% to user, 20% to LP, 5% as YOS)
    // 3. Update the liquidity contribution account
    
    // For this example, we'll just log the expected distribution
    msg!("Distribution would be:");
    msg!("75% back to user: {}", amount * 75 / 100);
    msg!("20% to liquidity pool: {}", amount * 20 / 100);
    msg!("5% as YOS cashback: {}", amount * 5 / 100);
    
    // Success
    msg!("Buy and distribute completed successfully");
    Ok(())
}

// Process claim weekly reward
pub fn process_claim_weekly_reward(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    msg!("Processing claim weekly reward");
    
    // Get accounts
    let accounts_iter = &mut accounts.iter();
    
    // Extract accounts
    let user_account = next_account_info(accounts_iter)?;
    let liquidity_contribution_account = next_account_info(accounts_iter)?;
    let yos_mint_account = next_account_info(accounts_iter)?;
    let user_yos_account = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    
    // Validate accounts
    if !user_account.is_signer {
        msg!("User account must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify liquidity contribution PDA
    let (expected_liquidity_contribution, _liquidity_contribution_bump) = 
        find_liquidity_contribution_address(user_account.key, program_id);
    
    if expected_liquidity_contribution != *liquidity_contribution_account.key {
        msg!("❌ Invalid liquidity contribution account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check if liquidity contribution account exists
    if liquidity_contribution_account.data_is_empty() {
        msg!("❌ Liquidity contribution account does not exist");
        return Err(ProgramError::UninitializedAccount);
    }
    
    // Deserialize liquidity contribution
    let mut liquidity_contribution = LiquidityContribution::try_from_slice(
        &liquidity_contribution_account.data.borrow()
    )?;
    
    // Verify user is the owner of the liquidity contribution
    if liquidity_contribution.user != *user_account.key {
        msg!("❌ User does not own this liquidity contribution");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check if contribution amount is positive
    if liquidity_contribution.contributed_amount == 0 {
        msg!("❌ No liquidity contribution found");
        return Err(ProgramError::InsufficientFunds);
    }
    
    // Get current time
    let now = solana_program::clock::Clock::get()?.unix_timestamp;
    
    // Check if 7 days (604,800 seconds) have passed since last claim
    let seconds_since_last_claim = now - liquidity_contribution.last_claim_time;
    let claim_period_seconds = 7 * 24 * 60 * 60; // 7 days in seconds
    
    if seconds_since_last_claim < claim_period_seconds {
        msg!("❌ Cannot claim yet. Must wait 7 days between claims");
        let seconds_remaining = claim_period_seconds - seconds_since_last_claim;
        msg!("Time remaining: {} seconds", seconds_remaining);
        return Err(ProgramError::Custom(100)); // Custom error code for "too early to claim"
    }
    
    // Calculate reward amount (1.92% of contribution amount - 100% APR / 52 weeks)
    let reward_amount = (liquidity_contribution.contributed_amount * 192) / 10000; // 1.92%
    
    // In a real implementation, we would:
    // 1. Mint YOS tokens to the user
    // 2. Update the liquidity contribution data
    
    // Update liquidity contribution data
    liquidity_contribution.last_claim_time = now;
    liquidity_contribution.total_claimed_yos += reward_amount;
    
    // Serialize and store updated liquidity contribution
    liquidity_contribution.serialize(&mut &mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    msg!("Claim successful");
    msg!("Reward amount: {} YOS", reward_amount);
    msg!("Next claim available at: {}", now + claim_period_seconds);
    
    Ok(())
}

// Process withdraw contribution
pub fn process_withdraw_contribution(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    msg!("Processing withdraw contribution");
    
    // Get accounts
    let accounts_iter = &mut accounts.iter();
    
    // Extract accounts
    let user_account = next_account_info(accounts_iter)?;
    let liquidity_contribution_account = next_account_info(accounts_iter)?;
    let liquidity_yot_account = next_account_info(accounts_iter)?;
    let user_yot_account = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    
    // Validate accounts
    if !user_account.is_signer {
        msg!("User account must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify liquidity contribution PDA
    let (expected_liquidity_contribution, _liquidity_contribution_bump) = 
        find_liquidity_contribution_address(user_account.key, program_id);
    
    if expected_liquidity_contribution != *liquidity_contribution_account.key {
        msg!("❌ Invalid liquidity contribution account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check if liquidity contribution account exists
    if liquidity_contribution_account.data_is_empty() {
        msg!("❌ Liquidity contribution account does not exist");
        return Err(ProgramError::UninitializedAccount);
    }
    
    // Deserialize liquidity contribution
    let mut liquidity_contribution = LiquidityContribution::try_from_slice(
        &liquidity_contribution_account.data.borrow()
    )?;
    
    // Verify user is the owner of the liquidity contribution
    if liquidity_contribution.user != *user_account.key {
        msg!("❌ User does not own this liquidity contribution");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check if contribution amount is positive
    if liquidity_contribution.contributed_amount == 0 {
        msg!("❌ No liquidity contribution to withdraw");
        return Err(ProgramError::InsufficientFunds);
    }
    
    // Get the withdrawal amount
    let withdrawal_amount = liquidity_contribution.contributed_amount;
    
    // In a real implementation, we would:
    // 1. Transfer YOT tokens from liquidity pool to user
    // 2. Update the liquidity contribution data
    
    // Update liquidity contribution data
    liquidity_contribution.contributed_amount = 0;
    
    // Serialize and store updated liquidity contribution
    liquidity_contribution.serialize(&mut &mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    msg!("Withdrawal successful");
    msg!("Withdrawn amount: {} YOT", withdrawal_amount);
    
    Ok(())
}

// Update program parameters
pub fn process_update_parameters(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    lp_contribution_rate: u64,
    admin_fee_rate: u64,
    yos_cashback_rate: u64,
    swap_fee_rate: u64,
    referral_rate: u64,
) -> ProgramResult {
    // Get accounts
    let accounts_iter = &mut accounts.iter();
    
    // Extract accounts
    let admin_account = next_account_info(accounts_iter)?;
    let program_state_account = next_account_info(accounts_iter)?;
    
    // Verify program state PDA
    let (expected_program_state, _program_state_bump) = find_program_state_address(program_id);
    if expected_program_state != *program_state_account.key {
        msg!("❌ Invalid program state account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Validate that state account exists, is owned by this program
    if program_state_account.data_is_empty() {
        msg!("❌ Program state account is empty");
        return Err(ProgramError::UninitializedAccount);
    }
    
    if program_state_account.owner != program_id {
        msg!("❌ Program state account has wrong owner, expected {}, got {}", program_id, program_state_account.owner);
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Verify admin signature
    if !admin_account.is_signer {
        msg!("Admin account must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Deserialize program state
    let mut program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Only admin can update parameters
    if program_state.admin != *admin_account.key {
        msg!("Only the admin can update parameters");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Validate parameters
    if lp_contribution_rate > 10000 || 
       admin_fee_rate > 10000 || 
       yos_cashback_rate > 10000 || 
       swap_fee_rate > 10000 || 
       referral_rate > 10000 {
        msg!("Parameter rates must be <= 10000 (100%)");
        return Err(ProgramError::InvalidArgument);
    }
    
    // Update parameters
    program_state.lp_contribution_rate = lp_contribution_rate;
    program_state.admin_fee_rate = admin_fee_rate;
    program_state.yos_cashback_rate = yos_cashback_rate;
    program_state.swap_fee_rate = swap_fee_rate;
    program_state.referral_rate = referral_rate;
    
    // Serialize and store updated program state
    program_state.serialize(&mut &mut program_state_account.data.borrow_mut()[..])?;
    
    msg!("Parameters updated successfully:");
    msg!("LP contribution rate: {}", program_state.lp_contribution_rate);
    msg!("Admin fee rate: {}", program_state.admin_fee_rate);
    msg!("YOS cashback rate: {}", program_state.yos_cashback_rate);
    msg!("Swap fee rate: {}", program_state.swap_fee_rate);
    msg!("Referral rate: {}", program_state.referral_rate);
    
    Ok(())
}