//! Simplified SOL to YOT swap program
//! This program provides a direct way to swap SOL for YOT tokens without the complexity
//! of managing individual liquidity contribution accounts.

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    system_instruction,
    sysvar::{rent::Rent, Sysvar, clock::Clock},
};
use spl_token::state::{Account as TokenAccount, Mint};
use borsh::{BorshDeserialize, BorshSerialize};

// Program ID will be replaced during deployment
solana_program::declare_id!("SimpleSwapPDCsXVzAi7i2UmXt3VY6K79Po4wY3zLGwu");

// Program entrypoint
entrypoint!(process_instruction);

/// Program instruction types
#[derive(BorshSerialize, BorshDeserialize, Debug, PartialEq)]
pub enum SwapInstruction {
    /// Initialize the program state
    /// 0. [signer] Admin account (payer)
    /// 1. [writable] Program state account
    /// 2. [] Program authority
    /// 3. [] YOT mint
    /// 4. [] YOS mint 
    /// 5. [] Central liquidity wallet
    /// 6. [] System program
    Initialize {
        // The ratio for distributing SOL: 80% to pool, 20% to liquidity wallet
        sol_distribution_ratio: u8,
        // The ratio for distributing YOT: 95% to user, 5% as YOS cashback
        yot_distribution_ratio: u8,
        // Minimum SOL amount for swap (protect against dust attacks)
        min_sol_amount: u64,
    },

    /// Swap SOL for YOT tokens
    /// 0. [signer] User account
    /// 1. [writable] Program state account
    /// 2. [] Program authority
    /// 3. [writable] SOL pool account
    /// 4. [writable] YOT pool account
    /// 5. [writable] User YOT account
    /// 6. [writable] Central liquidity wallet
    /// 7. [writable] YOS mint
    /// 8. [writable] User YOS account
    /// 9. [] System program
    /// 10. [] Token program
    Swap {
        // Amount of SOL to swap (in lamports)
        sol_amount: u64,
        // Minimum YOT amount to receive (slippage protection)
        min_yot_amount: u64,
    },
}

/// Program state
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct ProgramState {
    /// Admin account
    pub admin: Pubkey,
    /// YOT mint
    pub yot_mint: Pubkey,
    /// YOS mint
    pub yos_mint: Pubkey,
    /// Central liquidity wallet
    pub liquidity_wallet: Pubkey,
    /// SOL distribution ratio (80% to pool, 20% to liquidity wallet)
    pub sol_distribution_ratio: u8,
    /// YOT distribution ratio (95% to user, 5% as YOS cashback)
    pub yot_distribution_ratio: u8,
    /// Minimum SOL amount for swap
    pub min_sol_amount: u64,
}

impl ProgramState {
    /// Size of program state account
    pub const SIZE: usize = 32 + 32 + 32 + 32 + 1 + 1 + 8;
}

/// Find program state address
pub fn find_program_state_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"state"], program_id)
}

/// Find program authority address
pub fn find_program_authority(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"authority"], program_id)
}

/// Processor to handle instructions
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = SwapInstruction::try_from_slice(instruction_data)
        .map_err(|_| {
            msg!("Failed to deserialize instruction data");
            ProgramError::InvalidInstructionData
        })?;

    match instruction {
        SwapInstruction::Initialize { 
            sol_distribution_ratio,
            yot_distribution_ratio,
            min_sol_amount,
        } => {
            process_initialize(
                program_id,
                accounts,
                sol_distribution_ratio,
                yot_distribution_ratio,
                min_sol_amount,
            )
        }
        SwapInstruction::Swap { 
            sol_amount,
            min_yot_amount,
        } => {
            process_swap(
                program_id,
                accounts,
                sol_amount,
                min_yot_amount,
            )
        }
    }
}

/// Initialize the program
pub fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    sol_distribution_ratio: u8,
    yot_distribution_ratio: u8,
    min_sol_amount: u64,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Extract accounts
    let admin_account = next_account_info(accounts_iter)?;
    let program_state_account = next_account_info(accounts_iter)?;
    let program_authority = next_account_info(accounts_iter)?;
    let yot_mint_account = next_account_info(accounts_iter)?;
    let yos_mint_account = next_account_info(accounts_iter)?;
    let central_liquidity_wallet = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    
    // Validate accounts
    if !admin_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify PDAs
    let (expected_program_state, program_state_bump) = find_program_state_address(program_id);
    if expected_program_state != *program_state_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    let (expected_program_authority, _) = find_program_authority(program_id);
    if expected_program_authority != *program_authority.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Validate distribution ratios
    if sol_distribution_ratio > 100 || yot_distribution_ratio > 100 {
        return Err(ProgramError::InvalidArgument);
    }
    
    // Create the program state account if it doesn't exist
    if program_state_account.data_is_empty() {
        let rent = Rent::get()?;
        let rent_lamports = rent.minimum_balance(ProgramState::SIZE);
        
        invoke_signed(
            &system_instruction::create_account(
                admin_account.key,
                program_state_account.key,
                rent_lamports,
                ProgramState::SIZE as u64,
                program_id,
            ),
            &[
                admin_account.clone(),
                program_state_account.clone(),
                system_program.clone(),
            ],
            &[&[b"state", &[program_state_bump]]],
        )?;
    }
    
    // Initialize the program state
    let program_state = ProgramState {
        admin: *admin_account.key,
        yot_mint: *yot_mint_account.key,
        yos_mint: *yos_mint_account.key,
        liquidity_wallet: *central_liquidity_wallet.key,
        sol_distribution_ratio,
        yot_distribution_ratio,
        min_sol_amount,
    };
    
    // Serialize the program state
    program_state.serialize(&mut &mut program_state_account.data.borrow_mut()[..])?;
    
    msg!("Program initialized successfully");
    Ok(())
}

/// Swap SOL for YOT tokens
pub fn process_swap(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    sol_amount: u64,
    min_yot_amount: u64,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Extract accounts
    let user_account = next_account_info(accounts_iter)?;
    let program_state_account = next_account_info(accounts_iter)?;
    let program_authority = next_account_info(accounts_iter)?;
    let sol_pool_account = next_account_info(accounts_iter)?;
    let yot_pool_account = next_account_info(accounts_iter)?;
    let user_yot_account = next_account_info(accounts_iter)?;
    let central_liquidity_wallet = next_account_info(accounts_iter)?;
    let yos_mint_account = next_account_info(accounts_iter)?;
    let user_yos_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    
    // Validate accounts
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify PDAs
    let (expected_program_state, _) = find_program_state_address(program_id);
    if expected_program_state != *program_state_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    let (expected_program_authority, authority_bump) = find_program_authority(program_id);
    if expected_program_authority != *program_authority.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Deserialize the program state
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Verify token accounts
    if program_state.yot_mint != Mint::unpack(&yot_pool_account.data.borrow())?.mint {
        return Err(ProgramError::InvalidAccountData);
    }
    
    if program_state.yos_mint != *yos_mint_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    if program_state.liquidity_wallet != *central_liquidity_wallet.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Verify minimum SOL amount
    if sol_amount < program_state.min_sol_amount {
        return Err(ProgramError::InvalidArgument);
    }
    
    // Calculate distribution amounts
    let pool_amount = sol_amount * program_state.sol_distribution_ratio as u64 / 100;
    let liquidity_amount = sol_amount - pool_amount;
    
    msg!("Distribution: {} lamports ({}%) to pool, {} lamports ({}%) to central wallet", 
        pool_amount, program_state.sol_distribution_ratio, 
        liquidity_amount, 100 - program_state.sol_distribution_ratio);
    
    // Transfer SOL to pool (80%)
    invoke(
        &system_instruction::transfer(
            user_account.key,
            sol_pool_account.key,
            pool_amount,
        ),
        &[
            user_account.clone(),
            sol_pool_account.clone(),
            system_program.clone(),
        ],
    )?;
    
    // Transfer SOL to central liquidity wallet (20%)
    invoke(
        &system_instruction::transfer(
            user_account.key,
            central_liquidity_wallet.key,
            liquidity_amount,
        ),
        &[
            user_account.clone(),
            central_liquidity_wallet.clone(),
            system_program.clone(),
        ],
    )?;
    
    // Calculate YOT amount to send to user using constant product formula
    let sol_pool_balance = sol_pool_account.lamports();
    let yot_pool_data = TokenAccount::unpack(&yot_pool_account.data.borrow())?;
    let yot_pool_balance = yot_pool_data.amount;
    
    // Simple constant-product AMM formula: (x * y) / (x + dx) - y
    let sol_balance_before = sol_pool_balance.checked_sub(pool_amount).unwrap_or(1);
    let yot_amount_raw = (pool_amount as u128)
        .checked_mul(yot_pool_balance as u128).unwrap_or(0)
        .checked_div(sol_balance_before as u128).unwrap_or(0) as u64;
    
    // Apply distribution - 95% to user as YOT, 5% as YOS cashback
    let user_yot_amount = yot_amount_raw * program_state.yot_distribution_ratio as u64 / 100;
    let yos_cashback_amount = yot_amount_raw * (100 - program_state.yot_distribution_ratio) as u64 / 100;
    
    msg!("Calculated amounts: {} YOT for user ({}%), {} YOS as cashback ({}%)", 
        user_yot_amount, program_state.yot_distribution_ratio,
        yos_cashback_amount, 100 - program_state.yot_distribution_ratio);
    
    // Verify minimum YOT amount
    if user_yot_amount < min_yot_amount {
        return Err(ProgramError::InvalidArgument);
    }
    
    // Transfer YOT tokens to user
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            yot_pool_account.key,
            user_yot_account.key,
            program_authority.key,
            &[],
            user_yot_amount,
        )?,
        &[
            yot_pool_account.clone(),
            user_yot_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Mint YOS cashback tokens to user
    invoke_signed(
        &spl_token::instruction::mint_to(
            token_program.key,
            yos_mint_account.key,
            user_yos_account.key,
            program_authority.key,
            &[],
            yos_cashback_amount,
        )?,
        &[
            yos_mint_account.clone(),
            user_yos_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    msg!("Swap completed successfully");
    msg!("User received: {} YOT + {} YOS cashback", user_yot_amount, yos_cashback_amount);
    
    Ok(())
}