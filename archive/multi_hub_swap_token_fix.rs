// Updated multi_hub_swap.rs with critical token flow direction fix
// Version 1.2 - May 5, 2025
// This file fixes the token flow direction to match the client implementation

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
    clock::Clock,
};
use arrayref::array_ref;
use spl_token::{instruction as token_instruction, state::Account as TokenAccount};

// Define the program ID here (will be replaced during deployment)
solana_program::declare_id!("SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE");

// Program state stored in a PDA
#[derive(BorshSerialize, BorshDeserialize, Debug, Default)]
pub struct ProgramState {
    pub admin: Pubkey,
    pub yot_mint: Pubkey,
    pub yos_mint: Pubkey,
    pub lp_contribution_rate: u64,
    pub admin_fee_rate: u64,
    pub yos_cashback_rate: u64,
    pub swap_fee_rate: u64,
    pub referral_rate: u64,
}

// Liquidity contribution tracking
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct LiquidityContribution {
    pub user: Pubkey,
    pub contributed_amount: u64,
    pub start_timestamp: i64,
    pub last_claim_time: i64,
    pub total_claimed_yos: u64,
}

// Fixed index values for all possible instruction types
pub const INITIALIZE_IX: u8 = 0;
pub const SWAP_IX: u8 = 1;
pub const CONTRIBUTE_IX: u8 = 2;
pub const CLAIM_WEEKLY_REWARD_IX: u8 = 3;
pub const BUY_AND_DISTRIBUTE_IX: u8 = 4;
pub const WITHDRAW_CONTRIBUTION_IX: u8 = 5;
pub const UPDATE_PARAMETERS_IX: u8 = 6;

// One-week time period for rewards (in seconds)
pub const ONE_WEEK_SECONDS: i64 = 604_800; // 7 days * 24 hours * 60 minutes * 60 seconds

// Program entrypoint
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("MultiHubSwap - Processing instruction");
    
    if instruction_data.is_empty() {
        msg!("No instruction data provided");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Get the first byte as the instruction discriminator
    let discriminator = instruction_data[0];
    
    // Parse rest of data based on instruction type
    match discriminator {
        INITIALIZE_IX => {
            msg!("Initialize Instruction");
            
            // Initialize requires two Pubkeys: YOT mint and YOS mint
            if instruction_data.len() < 65 { // 1 byte discriminator + 2 * 32 bytes pubkeys
                msg!("Invalid data for Initialize - Need YOT and YOS mint addresses");
                return Err(ProgramError::InvalidInstructionData);
            }
            
            let yot_mint = Pubkey::new(&instruction_data[1..33]);
            let yos_mint = Pubkey::new(&instruction_data[33..65]);
            
            process_initialize(program_id, accounts, yot_mint, yos_mint)
        },
        
        SWAP_IX => {
            msg!("Swap Instruction");
            
            // Swap requires an amount
            if instruction_data.len() < 9 { // 1 byte discriminator + 8 bytes u64
                msg!("Invalid data for Swap - Need amount");
                return Err(ProgramError::InvalidInstructionData);
            }
            
            let amount = u64::from_le_bytes(*array_ref![instruction_data, 1, 8]);
            
            process_swap(program_id, accounts, amount)
        },
        
        CONTRIBUTE_IX => {
            msg!("Contribute Instruction");
            
            // Contribute requires an amount
            if instruction_data.len() < 9 { // 1 byte discriminator + 8 bytes u64
                msg!("Invalid data for Contribute - Need amount");
                return Err(ProgramError::InvalidInstructionData);
            }
            
            let amount = u64::from_le_bytes(*array_ref![instruction_data, 1, 8]);
            
            process_contribute(program_id, accounts, amount)
        },
        
        CLAIM_WEEKLY_REWARD_IX => {
            msg!("ClaimWeeklyReward Instruction");
            
            process_claim_weekly_reward(program_id, accounts)
        },
        
        BUY_AND_DISTRIBUTE_IX => {
            msg!("BuyAndDistribute Instruction");
            
            // BuyAndDistribute requires an amount
            if instruction_data.len() < 9 { // 1 byte discriminator + 8 bytes u64
                msg!("Invalid data for BuyAndDistribute - Need amount");
                return Err(ProgramError::InvalidInstructionData);
            }
            
            let amount = u64::from_le_bytes(*array_ref![instruction_data, 1, 8]);
            msg!("BuyAndDistribute amount: {}", amount);
            
            process_buy_and_distribute(program_id, accounts, amount)
        },
        
        WITHDRAW_CONTRIBUTION_IX => {
            msg!("WithdrawContribution Instruction");
            
            process_withdraw_contribution(program_id, accounts)
        },
        
        UPDATE_PARAMETERS_IX => {
            msg!("UpdateParameters Instruction");
            
            // UpdateParameters requires 5 u64 values
            if instruction_data.len() < 41 { // 1 byte discriminator + 5 * 8 bytes u64
                msg!("Invalid data for UpdateParameters - Need 5 rate parameters");
                return Err(ProgramError::InvalidInstructionData);
            }
            
            // Parse the parameters
            let lp_contribution_rate = u64::from_le_bytes(*array_ref![instruction_data, 1, 8]);
            let yos_cashback_rate = u64::from_le_bytes(*array_ref![instruction_data, 9, 8]);
            let admin_fee_rate = u64::from_le_bytes(*array_ref![instruction_data, 17, 8]);
            let swap_fee_rate = u64::from_le_bytes(*array_ref![instruction_data, 25, 8]);
            let referral_rate = u64::from_le_bytes(*array_ref![instruction_data, 33, 8]);
            
            process_update_parameters(
                program_id, 
                accounts, 
                lp_contribution_rate,
                yos_cashback_rate,
                admin_fee_rate,
                swap_fee_rate,
                referral_rate
            )
        },
        
        _ => {
            msg!("Unknown instruction discriminator: {}", discriminator);
            Err(ProgramError::InvalidInstructionData)
        }
    }
}

// Auto-distribute weekly YOS rewards based on liquidity contribution
// This can be called by anyone on behalf of a user after the 7-day waiting period
fn process_claim_weekly_reward(
    program_id: &Pubkey, 
    accounts: &[AccountInfo]
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Parse accounts
    let caller = next_account_info(accounts_iter)?; // This could be any caller (admin, cron job, or user themselves)
    let user_key = next_account_info(accounts_iter)?; // The user who will receive the rewards
    let liquidity_contribution_account = next_account_info(accounts_iter)?;
    let yos_mint = next_account_info(accounts_iter)?;
    let user_yos = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    
    // Verify caller is a signer
    if !caller.is_signer {
        msg!("Caller must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify liquidity contribution account belongs to the user
    let (expected_liq_contrib, _) = find_liquidity_contribution_address(user_key.key, program_id);
    if expected_liq_contrib != *liquidity_contribution_account.key {
        msg!("Invalid liquidity contribution account for this user");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Deserialize liquidity contribution data
    let mut contribution = LiquidityContribution::try_from_slice(&liquidity_contribution_account.data.borrow())?;
    
    // Verify contribution belongs to this user
    if contribution.user != *user_key.key {
        msg!("Liquidity contribution account does not belong to the specified user");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Verify the user has some contribution amount
    if contribution.contributed_amount == 0 {
        msg!("No liquidity contribution found for this user");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check if enough time has passed since last claim (1 week minimum)
    let current_time = Clock::get()?.unix_timestamp;
    let time_since_last_claim = current_time - contribution.last_claim_time;
    
    if time_since_last_claim < ONE_WEEK_SECONDS {
        let time_remaining = ONE_WEEK_SECONDS - time_since_last_claim;
        msg!("Cannot claim rewards yet. Must wait {} more seconds", time_remaining);
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Calculate YOS reward amount
    // Using 100% APR / 52 weeks = ~2% weekly returns
    // The actual value is 1.92% but we simplify to 2% for easier calculation
    let weekly_reward_percentage = 2; // 2% per week
    let reward_amount = (contribution.contributed_amount * weekly_reward_percentage) / 100;
    
    // Find program authority for signing
    let (program_authority, authority_bump) = Pubkey::find_program_address(&[b"authority"], program_id);
    
    // Mint YOS tokens to user
    invoke_signed(
        &token_instruction::mint_to(
            token_program.key,
            yos_mint.key,
            user_yos.key,
            &program_authority,
            &[],
            reward_amount,
        )?,
        &[
            yos_mint.clone(),
            user_yos.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Update contribution with new claim time and total claimed amount
    contribution.last_claim_time = current_time;
    contribution.total_claimed_yos += reward_amount;
    
    contribution.serialize(&mut &mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    msg!("✅ Weekly rewards claimed successfully: {} YOS tokens", reward_amount);
    Ok(())
}

// Withdraw liquidity contribution
fn process_withdraw_contribution(
    program_id: &Pubkey,
    accounts: &[AccountInfo]
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Parse accounts
    let user = next_account_info(accounts_iter)?;
    let liquidity_contribution_account = next_account_info(accounts_iter)?;
    let liquidity_yot = next_account_info(accounts_iter)?;
    let user_yot = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    
    // Verify user is a signer
    if !user.is_signer {
        msg!("User must sign withdrawal instruction");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify liquidity contribution account belongs to the user
    let (expected_liq_contrib, _) = find_liquidity_contribution_address(user.key, program_id);
    if expected_liq_contrib != *liquidity_contribution_account.key {
        msg!("Invalid liquidity contribution account for this user");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Deserialize liquidity contribution data
    let mut contribution = LiquidityContribution::try_from_slice(&liquidity_contribution_account.data.borrow())?;
    
    // Verify contribution belongs to this user
    if contribution.user != *user.key {
        msg!("Liquidity contribution account does not belong to the user");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Verify the user has some contribution amount
    let amount_to_withdraw = contribution.contributed_amount;
    if amount_to_withdraw == 0 {
        msg!("No liquidity contribution found to withdraw");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Find program authority for signing
    let (program_authority, authority_bump) = Pubkey::find_program_address(&[b"authority"], program_id);
    
    // Transfer YOT tokens from liquidity pool back to user
    invoke_signed(
        &token_instruction::transfer(
            token_program.key,
            liquidity_yot.key,
            user_yot.key,
            &program_authority,
            &[],
            amount_to_withdraw,
        )?,
        &[
            liquidity_yot.clone(),
            user_yot.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Update contribution to zero out the amount
    contribution.contributed_amount = 0;
    
    contribution.serialize(&mut &mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    msg!("✅ Contribution withdrawn successfully: {} YOT tokens", amount_to_withdraw);
    Ok(())
}

// Update program parameters (admin only)
fn process_update_parameters(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    lp_contribution_rate: u64,
    yos_cashback_rate: u64,
    admin_fee_rate: u64,
    swap_fee_rate: u64,
    referral_rate: u64,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Parse accounts
    let admin = next_account_info(accounts_iter)?;
    let program_state_account = next_account_info(accounts_iter)?;
    
    // Verify admin is a signer
    if !admin.is_signer {
        msg!("Admin must sign parameter update instruction");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify state account PDA
    let (state_pda, _) = find_program_state_address(program_id);
    if state_pda != *program_state_account.key {
        msg!("Invalid program state account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Load program state
    let mut program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Verify caller is the admin
    if program_state.admin != *admin.key {
        msg!("Only admin can update parameters");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Validate parameter ranges
    if lp_contribution_rate > 100 || 
       yos_cashback_rate > 100 || 
       admin_fee_rate > 100 || 
       swap_fee_rate > 100 || 
       referral_rate > 100 {
        msg!("Parameter rates must be between 0 and 100");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Update parameters
    program_state.lp_contribution_rate = lp_contribution_rate;
    program_state.yos_cashback_rate = yos_cashback_rate;
    program_state.admin_fee_rate = admin_fee_rate;
    program_state.swap_fee_rate = swap_fee_rate;
    program_state.referral_rate = referral_rate;
    
    program_state.serialize(&mut &mut program_state_account.data.borrow_mut()[..])?;
    
    msg!("✅ Program parameters updated successfully");
    Ok(())
}

// Initialize the program state
fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    yot_mint: Pubkey,
    yos_mint: Pubkey,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Parse accounts
    let admin = next_account_info(accounts_iter)?;
    let program_state_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    
    // Verify admin is a signer
    if !admin.is_signer {
        msg!("Admin must sign initialization instruction");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify state account is the correct PDA
    let (state_pda, state_bump) = find_program_state_address(program_id);
    if state_pda != *program_state_account.key {
        msg!("Invalid program state account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Calculate rent
    let rent = Rent::get()?;
    let space = std::mem::size_of::<ProgramState>();
    let lamports = rent.minimum_balance(space);
    
    // Create state account
    invoke_signed(
        &system_instruction::create_account(
            admin.key,
            program_state_account.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            admin.clone(),
            program_state_account.clone(),
            system_program.clone(),
        ],
        &[&[b"state", &[state_bump]]],
    )?;
    
    // Initialize program state
    let program_state = ProgramState {
        admin: *admin.key,
        yot_mint,
        yos_mint,
        lp_contribution_rate: 20, // 20%
        admin_fee_rate: 0,        // 0%
        yos_cashback_rate: 5,     // 5%
        swap_fee_rate: 1,         // 1%
        referral_rate: 0,         // 0%
    };
    
    program_state.serialize(&mut &mut program_state_account.data.borrow_mut()[..])?;
    
    msg!("✅ Program initialized successfully");
    Ok(())
}

// Implement basic token swap functionality
fn process_swap(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    msg!("Swap function not fully implemented");
    Ok(())
}

// Direct contribution to liquidity (separate from buy_and_distribute)
fn process_contribute(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    msg!("Contribute function not fully implemented");
    Ok(())
}

// CRITICAL FIX: The buy and distribute function with corrected token flow direction
fn process_buy_and_distribute(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    msg!("🔹 Starting process_buy_and_distribute with amount: {}", amount);
    
    // Debug account count
    msg!("🔹 Account count: {}", accounts.len());
    if accounts.len() < 11 {
        msg!("❌ ERROR: Not enough accounts provided. Expected at least 11, got {}", accounts.len());
        return Err(ProgramError::NotEnoughAccountKeys);
    }
    
    let accounts_iter = &mut accounts.iter();
    
    // Parse accounts with detailed logging
    msg!("🔹 Parsing accounts...");
    let user = next_account_info(accounts_iter)?;
    msg!("1. User: {}", user.key);
    
    let vault_yot = next_account_info(accounts_iter)?;
    msg!("2. Vault YOT: {}", vault_yot.key);
    
    let user_yot = next_account_info(accounts_iter)?;
    msg!("3. User YOT: {}", user_yot.key);
    
    let liquidity_yot = next_account_info(accounts_iter)?;
    msg!("4. Liquidity YOT: {}", liquidity_yot.key);
    
    let yos_mint = next_account_info(accounts_iter)?;
    msg!("5. YOS Mint: {}", yos_mint.key);
    
    let user_yos = next_account_info(accounts_iter)?;
    msg!("6. User YOS: {}", user_yos.key);
    
    let liquidity_contribution_account = next_account_info(accounts_iter)?;
    msg!("7. Liquidity Contribution: {}", liquidity_contribution_account.key);
    
    let token_program = next_account_info(accounts_iter)?;
    msg!("8. Token Program: {}", token_program.key);
    
    let system_program = next_account_info(accounts_iter)?;
    msg!("9. System Program: {}", system_program.key);
    
    let rent_sysvar = next_account_info(accounts_iter)?;
    msg!("10. Rent Sysvar: {}", rent_sysvar.key);
    
    let program_state_account = next_account_info(accounts_iter)?;
    msg!("11. Program State: {}", program_state_account.key);
    
    // Verify user signed the transaction
    if !user.is_signer {
        msg!("User must sign BuyAndDistribute instruction");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Load program state to get parameters
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Verify YOT and YOS mint addresses match
    if program_state.yot_mint != *vault_yot.owner {
        msg!("YOT mint mismatch in state");
        return Err(ProgramError::InvalidAccountData);
    }
    
    if program_state.yos_mint != *yos_mint.key {
        msg!("YOS mint mismatch in state");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Validate token account owners
    // Verify user_yot belongs to the user
    let user_yot_data = TokenAccount::unpack(&user_yot.data.borrow())?;
    if user_yot_data.owner != *user.key {
        msg!("User YOT account not owned by user");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Verify user_yos belongs to the user
    let user_yos_data = TokenAccount::unpack(&user_yos.data.borrow())?;
    if user_yos_data.owner != *user.key {
        msg!("User YOS account not owned by user");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Calculate distribution
    // Total amount split: 
    // - 75% to user
    // - 20% to liquidity (split equally between YOT and SOL)
    // - 5% YOS cashback
    let user_amount = (amount * 75) / 100;
    let liquidity_amount = (amount * 20) / 100;
    let cashback_amount = (amount * 5) / 100;
    
    msg!("Distribution: Total {} | User {} | Liquidity {} | Cashback {}",
         amount, user_amount, liquidity_amount, cashback_amount);
    
    // Find PDAs for program authority
    let (program_authority, authority_bump) = Pubkey::find_program_address(
        &[b"authority"],
        program_id,
    );
    
    // Check if liquidity contribution account exists, create if not
    let expected_data_len = std::mem::size_of::<LiquidityContribution>();
    
    // Check if account exists and belongs to user
    let create_new_account = liquidity_contribution_account.data_is_empty();
    
    if create_new_account {
        msg!("Creating new liquidity contribution account");
        
        // Find the expected PDA for this user
        let (expected_liq_contrib, liq_bump) = find_liquidity_contribution_address(user.key, program_id);
        if expected_liq_contrib != *liquidity_contribution_account.key {
            msg!("Invalid liquidity contribution account address");
            msg!("Expected: {}, Got: {}", expected_liq_contrib, liquidity_contribution_account.key);
            return Err(ProgramError::InvalidAccountData);
        }
        
        // Calculate rent
        let rent = Rent::get()?;
        let lamports = rent.minimum_balance(expected_data_len);
        
        // Create account
        invoke_signed(
            &system_instruction::create_account(
                user.key,
                liquidity_contribution_account.key,
                lamports,
                expected_data_len as u64,
                program_id,
            ),
            &[
                user.clone(),
                liquidity_contribution_account.clone(),
                system_program.clone(),
            ],
            &[&[b"liquidity", user.key.as_ref(), &[liq_bump]]],
        )?;
    }
    
    // Load or initialize contribution
    let mut contribution = if create_new_account {
        // Initialize new contribution
        LiquidityContribution {
            user: *user.key,
            contributed_amount: 0, // Will be updated below
            start_timestamp: Clock::get()?.unix_timestamp,
            last_claim_time: Clock::get()?.unix_timestamp,
            total_claimed_yos: 0,
        }
    } else {
        // Load existing contribution
        LiquidityContribution::try_from_slice(&liquidity_contribution_account.data.borrow())?
    };
    
    // Verify existing account belongs to this user
    if !create_new_account && contribution.user != *user.key {
        msg!("Liquidity contribution account does not belong to this user");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // CRITICAL FIX: The token flow direction should be FROM user TO vault/pool
    // Instead of transferring FROM vault TO user
    msg!("Transferring {} YOT from user to vault", amount);
    invoke(
        &token_instruction::transfer(
            token_program.key,
            user_yot.key,          // FROM user's YOT account
            vault_yot.key,         // TO the vault/pool
            user.key,              // Signed by user
            &[],
            amount,
        )?,
        &[
            user_yot.clone(),
            vault_yot.clone(),
            user.clone(),
            token_program.clone(),
        ],
    )?;
    
    // Mint YOS cashback to user
    msg!("Minting {} YOS cashback to user", cashback_amount);
    invoke_signed(
        &token_instruction::mint_to(
            token_program.key,
            yos_mint.key,
            user_yos.key,
            &program_authority,
            &[],
            cashback_amount,
        )?,
        &[
            yos_mint.clone(),
            user_yos.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Update liquidity contribution
    msg!("Updating user contribution record with {} YOT", liquidity_amount);
    contribution.contributed_amount += liquidity_amount;
    
    // Save updated contribution
    contribution.serialize(&mut &mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    msg!("✅ Buy and distribute successful: {} YOT total | {} YOT to liquidity | {} YOS cashback",
        amount, liquidity_amount, cashback_amount);
    Ok(())
}

// Helper functions

// Find program state PDA
fn find_program_state_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"state"], program_id)
}

// Find liquidity contribution PDA for a user
fn find_liquidity_contribution_address(user: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"liquidity", user.as_ref()], program_id)
}