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
    sysvar::{clock::Clock, Sysvar},
};
use spl_token::state::{Account as TokenAccount, Mint};
use std::convert::TryInto;

// Declare program entrypoint
entrypoint!(process_instruction);

// Instruction types
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum StakingInstruction {
    // Initialize staking program with YOT and YOS token addresses
    // Requires admin signature
    Initialize {
        // YOT token mint address
        yot_mint: Pubkey,
        // YOS token mint address
        yos_mint: Pubkey,
        // Staking rate in basis points (1/100 of 1%)
        stake_rate_per_second: u64,
        // Minimum YOS for harvest in basis points
        harvest_threshold: u64,
    },
    
    // Stake YOT tokens
    // Requires user signature
    Stake {
        amount: u64,
    },
    
    // Unstake YOT tokens
    // Requires user signature
    Unstake {
        amount: u64,
    },
    
    // Harvest YOS rewards
    // Requires user signature
    Harvest,
    
    // Update staking parameters
    // Requires admin signature
    UpdateParameters {
        stake_rate_per_second: u64,
        harvest_threshold: u64,
    },
}

// Program state stored in a PDA
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct ProgramState {
    // Admin public key that can update parameters
    pub admin: Pubkey,
    // YOT token mint address
    pub yot_mint: Pubkey,
    // YOS token mint address
    pub yos_mint: Pubkey,
    // Staking rate in basis points (1/100 of 1%)
    pub stake_rate_per_second: u64,
    // Minimum YOS for harvest in basis points
    pub harvest_threshold: u64,
}

// Staking account data for each user
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct StakingAccount {
    // User's wallet address
    pub owner: Pubkey,
    // Amount of YOT staked
    pub staked_amount: u64,
    // Timestamp when staking began (in seconds)
    pub start_timestamp: i64,
    // Last time rewards were harvested
    pub last_harvest_time: i64,
    // Total rewards harvested so far
    pub total_harvested: u64,
}

// Program logic
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Decode instruction data
    let instruction = StakingInstruction::try_from_slice(instruction_data)?;
    
    match instruction {
        StakingInstruction::Initialize {
            yot_mint,
            yos_mint,
            stake_rate_per_second,
            harvest_threshold,
        } => {
            process_initialize(
                program_id,
                accounts,
                yot_mint,
                yos_mint,
                stake_rate_per_second,
                harvest_threshold,
            )
        }
        
        StakingInstruction::Stake { amount } => {
            process_stake(program_id, accounts, amount)
        }
        
        StakingInstruction::Unstake { amount } => {
            process_unstake(program_id, accounts, amount)
        }
        
        StakingInstruction::Harvest => {
            process_harvest(program_id, accounts)
        }
        
        StakingInstruction::UpdateParameters {
            stake_rate_per_second,
            harvest_threshold,
        } => {
            process_update_parameters(
                program_id,
                accounts,
                stake_rate_per_second,
                harvest_threshold,
            )
        }
    }
}

// Initialize the staking program
fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    yot_mint: Pubkey,
    yos_mint: Pubkey,
    stake_rate_per_second: u64,
    harvest_threshold: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let admin_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    
    // Verify admin signature (mandatory signature verification)
    if !admin_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Calculate PDA for program state account
    let (pda, bump_seed) = Pubkey::find_program_address(&[b"program_state"], program_id);
    if pda != *program_state_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Create program state account
    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(std::mem::size_of::<ProgramState>());
    
    // Create account
    invoke_signed(
        &system_instruction::create_account(
            admin_account.key,
            program_state_account.key,
            rent_lamports,
            std::mem::size_of::<ProgramState>() as u64,
            program_id,
        ),
        &[
            admin_account.clone(),
            program_state_account.clone(),
            system_program.clone(),
        ],
        &[&[b"program_state", &[bump_seed]]],
    )?;
    
    // Initialize program state
    let program_state = ProgramState {
        admin: *admin_account.key,
        yot_mint,
        yos_mint,
        stake_rate_per_second,
        harvest_threshold,
    };
    
    // Save program state
    program_state.serialize(&mut *program_state_account.try_borrow_mut_data()?)?;
    
    msg!("Staking program initialized successfully");
    
    Ok(())
}

// Process stake instruction
fn process_stake(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let user_account = next_account_info(account_info_iter)?;
    let user_yot_token_account = next_account_info(account_info_iter)?;
    let program_yot_token_account = next_account_info(account_info_iter)?;
    let user_staking_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let clock = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    
    // Verify user signature (mandatory signature verification)
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Get program state
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Verify token accounts
    let user_token_account = TokenAccount::unpack(&user_yot_token_account.data.borrow())?;
    if user_token_account.owner != *user_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    if user_token_account.mint != program_state.yot_mint {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Ensure user has enough tokens
    if user_token_account.amount < amount {
        return Err(ProgramError::InsufficientFunds);
    }
    
    // Get clock for timestamp
    let clock = Clock::from_account_info(clock)?;
    let current_time = clock.unix_timestamp;
    
    // Calculate staking account PDA
    let seeds = [
        b"staking", 
        user_account.key.as_ref(),
    ];
    let (staking_pda, bump_seed) = Pubkey::find_program_address(&seeds, program_id);
    
    // Check if staking account exists, if not create it
    if user_staking_account.data_is_empty() {
        let rent = Rent::get()?;
        let rent_lamports = rent.minimum_balance(std::mem::size_of::<StakingAccount>());
        
        // Create staking account
        invoke_signed(
            &system_instruction::create_account(
                user_account.key,
                &staking_pda,
                rent_lamports,
                std::mem::size_of::<StakingAccount>() as u64,
                program_id,
            ),
            &[
                user_account.clone(),
                user_staking_account.clone(),
                system_program.clone(),
            ],
            &[&[b"staking", user_account.key.as_ref(), &[bump_seed]]],
        )?;
        
        // Initialize new staking account
        let staking_data = StakingAccount {
            owner: *user_account.key,
            staked_amount: amount,
            start_timestamp: current_time,
            last_harvest_time: current_time,
            total_harvested: 0,
        };
        
        staking_data.serialize(&mut *user_staking_account.try_borrow_mut_data()?)?;
    } else {
        // Update existing staking account
        let mut staking_data = StakingAccount::try_from_slice(&user_staking_account.data.borrow())?;
        
        // Verify the owner
        if staking_data.owner != *user_account.key {
            return Err(ProgramError::InvalidAccountData);
        }
        
        // Update staked amount
        staking_data.staked_amount = staking_data.staked_amount.checked_add(amount)
            .ok_or(ProgramError::InvalidArgument)?; // Use InvalidArgument instead of ArithmeticOverflow
        
        staking_data.serialize(&mut *user_staking_account.try_borrow_mut_data()?)?;
    }
    
    // Transfer tokens from user to program
    invoke(
        &spl_token::instruction::transfer(
            token_program.key,
            user_yot_token_account.key,
            program_yot_token_account.key,
            user_account.key,
            &[],
            amount,
        )?,
        &[
            user_yot_token_account.clone(),
            program_yot_token_account.clone(),
            user_account.clone(),
            token_program.clone(),
        ],
    )?;
    
    msg!("Staked {} YOT tokens", amount);
    
    Ok(())
}

// Process unstake instruction with improved reward and error handling
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
    
    // CRITICAL FIX FOR DECIMAL TRANSFER ISSUE:
    // REMOVED incorrect division by 10^9 - SPL tokens already account for decimals
    // Raw amount already has 9 decimal places (e.g., 10 YOT = 10,000,000,000 raw units)
    // Use the raw amount directly without division
    let transfer_amount = amount; // No division - use raw amount directly
    
    // Transfer YOT tokens back to user (this should ALWAYS happen)
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            program_yot_token_account.key,
            user_yot_token_account.key,
            program_authority.key,
            &[],
            transfer_amount, // No division - use the raw amount directly
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
            // CRITICAL FIX FOR DECIMAL TRANSFER ISSUE: 
            // REMOVED incorrect division by 10^9 - SPL tokens already account for decimals
            // Raw amount already has 9 decimal places (e.g., 10 YOS = 10,000,000,000 raw units)
            // Use the raw amount directly without division
            
            // Only attempt to transfer rewards if the program has enough YOS tokens
            let transfer_result = invoke_signed(
                &spl_token::instruction::transfer(
                    token_program.key,
                    program_yos_token_account.key,
                    user_yos_token_account.key,
                    program_authority.key,
                    &[],
                    raw_rewards, // FIXED: Use raw amount directly instead of dividing
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

// Process harvest instruction with improved decimal handling
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
    
    // Calculate rewards using CURRENT rate from program state
    let time_staked_seconds = current_time.checked_sub(staking_data.last_harvest_time)
        .ok_or(ProgramError::InvalidArgument)?;
    
    // CRITICAL FIX FOR DECIMAL OVERFLOW
    // Convert staking rate from basis points to decimal (12000 basis points = 0.00000125%)
    // We need much more precision here to avoid huge overflow
    let rate_decimal = (program_state.stake_rate_per_second as f64) / 1_000_000.0;
    
    // Calculate rewards in token units first (e.g., 3.5 YOS)
    let rewards_token_units = (staking_data.staked_amount as f64 / 1_000_000_000.0) * 
                             (time_staked_seconds as f64) * 
                             rate_decimal;
    
    // Convert token units to raw units for storage and transfer
    let raw_rewards = (rewards_token_units * 1_000_000_000.0) as u64;
    
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
    
    // CRITICAL FIX FOR DECIMAL TRANSFER ISSUE:
    // REMOVED incorrect division by 10^9 - SPL tokens already account for decimals
    // Raw amount already has 9 decimal places (e.g., 10 YOS = 10,000,000,000 raw units)
    // Use the raw amount directly without division
    
    // Transfer YOS rewards to user (using the FULL raw amount)
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            program_yos_token_account.key,
            user_yos_token_account.key,
            program_authority.key,
            &[],
            raw_rewards, // FIXED: Use raw amount directly instead of dividing
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

// Update program parameters (admin only)
fn process_update_parameters(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    stake_rate_per_second: u64,
    harvest_threshold: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let admin_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    
    // Verify admin signature (mandatory signature verification)
    if !admin_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Get program state
    let mut program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Verify admin authority
    if program_state.admin != *admin_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Update parameters
    program_state.stake_rate_per_second = stake_rate_per_second;
    program_state.harvest_threshold = harvest_threshold;
    
    // Save updated program state
    program_state.serialize(&mut *program_state_account.try_borrow_mut_data()?)?;
    
    msg!("Updated staking parameters: rate={}, threshold={}", 
         stake_rate_per_second, 
         harvest_threshold);
    
    Ok(())
}

// Helper function to calculate rewards
fn calculate_rewards(
    staked_amount: u64,
    time_staked_seconds: i64,
    stake_rate_per_second: u64
) -> u64 {
    // Convert staking rate from basis points to decimal
    let rate_decimal = (stake_rate_per_second as f64) / 10000.0;
    
    // Calculate rewards using compound interest formula (APY)
    // Formula: principal * ((1 + rate)^time - 1)
    let compound_rewards = (staked_amount as f64 * ((1.0 + rate_decimal).powf(time_staked_seconds as f64) - 1.0)) as u64;
    
    // Return the compound interest result
    compound_rewards
}