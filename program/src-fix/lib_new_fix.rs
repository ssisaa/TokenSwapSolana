use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::{clock::Clock, Sysvar},
};
use spl_token::state::{Account as TokenAccount};

// Define the program entrypoint
entrypoint!(process_instruction);

// Define Instruction types
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum StakingInstruction {
    Initialize {
        yot_mint: Pubkey,
        yos_mint: Pubkey,
        stake_rate_per_second: u64,
        harvest_threshold: u64,
        stake_threshold: u64,
        unstake_threshold: u64,
    },
    Stake { amount: u64 },
    Unstake { amount: u64 },
    Harvest,
    UpdateParameters {
        stake_rate_per_second: u64,
        harvest_threshold: u64,
        stake_threshold: u64,
        unstake_threshold: u64,
    },
}

// Program State
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct ProgramState {
    pub admin: Pubkey,
    pub yot_mint: Pubkey,
    pub yos_mint: Pubkey,
    pub stake_rate_per_second: u64,
    pub harvest_threshold: u64,
    pub stake_threshold: u64,
    pub unstake_threshold: u64,
}

// User Staking Account
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct StakingAccount {
    pub owner: Pubkey,
    pub staked_amount: u64,
    pub last_harvest_time: i64,
    pub last_stake_time: i64,
}

// CRITICAL NEW ADDITION: YOS token decimal adjustment function
// This function divides the raw token amount by 10^9 to normalize for YOS token's 9 decimals
pub fn get_wallet_adjusted_yos_amount(amount: u64) -> u64 {
    // Adjust for YOS token decimals (divide by 10^9)
    amount / 10u64.pow(9) // Adjust for 9 decimals in YOS token
}

// Program logic
fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    yot_mint: Pubkey,
    yos_mint: Pubkey,
    stake_rate_per_second: u64,
    harvest_threshold: u64,
    stake_threshold: u64,
    unstake_threshold: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let admin_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;

    // Verify admin signature
    if !admin_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Initialize program state
    let program_state = ProgramState {
        admin: *admin_account.key,
        yot_mint,
        yos_mint,
        stake_rate_per_second,
        harvest_threshold,
        stake_threshold,
        unstake_threshold,
    };
    
    // Serialize and save program state
    program_state.serialize(&mut *program_state_account.data.borrow_mut())?;
    
    msg!("Program initialized successfully");
    Ok(())
}

fn process_stake(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get all required accounts
    let user_account = next_account_info(account_info_iter)?;
    let user_yot_token_account = next_account_info(account_info_iter)?;
    let program_yot_token_account = next_account_info(account_info_iter)?;
    let user_staking_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let clock = next_account_info(account_info_iter)?;
    
    // Verify user signature
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Load program state
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Check if amount meets stake threshold
    if amount < program_state.stake_threshold {
        return Err(ProgramError::InvalidArgument);
    }
    
    // Get current timestamp
    let clock_data = Clock::from_account_info(clock)?;
    let current_time = clock_data.unix_timestamp;
    
    // Initialize or update staking account
    let mut staking_account = if user_staking_account.data_is_empty() {
        StakingAccount {
            owner: *user_account.key,
            staked_amount: 0,
            last_harvest_time: current_time,
            last_stake_time: current_time,
        }
    } else {
        StakingAccount::try_from_slice(&user_staking_account.data.borrow())?
    };
    
    // Update staking information
    staking_account.staked_amount = staking_account.staked_amount.saturating_add(amount);
    staking_account.last_stake_time = current_time;
    
    // Serialize and save staking account data
    staking_account.serialize(&mut *user_staking_account.data.borrow_mut())?;
    
    // Transfer YOT tokens from user to program
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
    
    msg!("Successfully staked {} YOT tokens", amount);
    Ok(())
}

fn process_unstake(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get all required accounts
    let user_account = next_account_info(account_info_iter)?;
    let user_yot_token_account = next_account_info(account_info_iter)?;
    let program_yot_token_account = next_account_info(account_info_iter)?;
    let user_staking_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    
    // Verify user signature
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Load program state
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Check if amount meets unstake threshold
    if amount < program_state.unstake_threshold {
        return Err(ProgramError::InvalidArgument);
    }
    
    // Load staking account
    let mut staking_account = StakingAccount::try_from_slice(&user_staking_account.data.borrow())?;
    
    // Check if user has enough staked
    if staking_account.staked_amount < amount {
        return Err(ProgramError::InsufficientFunds);
    }
    
    // Update staking information
    staking_account.staked_amount = staking_account.staked_amount.saturating_sub(amount);
    
    // Serialize and save staking account data
    staking_account.serialize(&mut *user_staking_account.data.borrow_mut())?;
    
    // Get authority PDA bump seed for signing
    let (authority_pda, bump_seed) = Pubkey::find_program_address(
        &[b"authority"],
        program_id
    );
    
    // Verify the derived address matches our expected authority
    if authority_pda != *program_authority.key {
        return Err(ProgramError::InvalidArgument);
    }
    
    // Transfer YOT tokens from program to user
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
        &[&[b"authority", &[bump_seed]]],
    )?;
    
    msg!("Successfully unstaked {} YOT tokens", amount);
    Ok(())
}

fn process_harvest(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get all required accounts
    let user_account = next_account_info(account_info_iter)?;
    let user_yos_token_account = next_account_info(account_info_iter)?;
    let program_yos_token_account = next_account_info(account_info_iter)?;
    let user_staking_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let clock = next_account_info(account_info_iter)?;
    
    // Verify user signature
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Load program state and staking account
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    let mut staking_account = StakingAccount::try_from_slice(&user_staking_account.data.borrow())?;
    
    // Get current timestamp
    let clock_data = Clock::from_account_info(clock)?;
    let current_time = clock_data.unix_timestamp;
    
    // Calculate time staked (in seconds)
    let time_staked = current_time.saturating_sub(staking_account.last_harvest_time);
    
    // Calculate rewards: staked_amount * rate_per_second * time_staked
    let rewards = (staking_account.staked_amount as u128)
        .checked_mul(program_state.stake_rate_per_second as u128).unwrap_or(0)
        .checked_mul(time_staked as u128).unwrap_or(0)
        .checked_div(1_000_000).unwrap_or(0) as u64;
    
    // Check if rewards meet threshold
    if rewards < program_state.harvest_threshold {
        return Err(ProgramError::InvalidArgument);
    }
    
    // Update last harvest time
    staking_account.last_harvest_time = current_time;
    
    // Serialize and save staking account data
    staking_account.serialize(&mut *user_staking_account.data.borrow_mut())?;
    
    // Get authority PDA bump seed for signing
    let (authority_pda, bump_seed) = Pubkey::find_program_address(
        &[b"authority"],
        program_id
    );
    
    // Verify the derived address matches our expected authority
    if authority_pda != *program_authority.key {
        return Err(ProgramError::InvalidArgument);
    }
    
    // CRITICAL NEW CODE: Adjust YOS amount using our decimal adjustment function
    // This will make the wallet display the correct amount with 9 decimal places
    let adjusted_rewards = get_wallet_adjusted_yos_amount(rewards);
    
    msg!("Original rewards amount: {} YOS tokens", rewards);
    msg!("Adjusted for wallet display: {} YOS tokens", adjusted_rewards);
    
    // Transfer adjusted YOS rewards from program to user
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            program_yos_token_account.key,
            user_yos_token_account.key,
            program_authority.key,
            &[],
            adjusted_rewards, // CHANGED: Use adjusted amount for proper wallet display
        )?,
        &[
            program_yos_token_account.clone(),
            user_yos_token_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[bump_seed]]],
    )?;
    
    msg!("Successfully harvested {} YOS tokens (display adjusted)", adjusted_rewards);
    Ok(())
}

fn process_update_parameters(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    stake_rate_per_second: u64,
    harvest_threshold: u64,
    stake_threshold: u64,
    unstake_threshold: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get admin and program state accounts
    let admin_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    
    // Verify admin signature
    if !admin_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Load program state
    let mut program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Verify admin is authorized
    if program_state.admin != *admin_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Update parameters
    program_state.stake_rate_per_second = stake_rate_per_second;
    program_state.harvest_threshold = harvest_threshold;
    program_state.stake_threshold = stake_threshold;
    program_state.unstake_threshold = unstake_threshold;
    
    // Serialize and save updated program state
    program_state.serialize(&mut *program_state_account.data.borrow_mut())?;
    
    msg!("Parameters updated successfully");
    Ok(())
}

// Program entrypoint (handles instruction dispatch)
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = StakingInstruction::try_from_slice(instruction_data)?;

    match instruction {
        StakingInstruction::Initialize { 
            yot_mint, 
            yos_mint, 
            stake_rate_per_second, 
            harvest_threshold,
            stake_threshold,
            unstake_threshold,
        } => {
            process_initialize(
                program_id, 
                accounts, 
                yot_mint, 
                yos_mint, 
                stake_rate_per_second, 
                harvest_threshold,
                stake_threshold,
                unstake_threshold,
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
            stake_threshold,
            unstake_threshold,
        } => {
            process_update_parameters(
                program_id, 
                accounts, 
                stake_rate_per_second, 
                harvest_threshold,
                stake_threshold,
                unstake_threshold,
            )
        }
    }
}