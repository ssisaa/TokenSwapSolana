use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::IsInitialized,
    pubkey::Pubkey,
    sysvar::Sysvar,
    system_instruction,
    sysvar::{self, rent::Rent},
    program_option::COption,
};
use borsh::{BorshDeserialize, BorshSerialize};
use spl_token::state::{Account as TokenAccount, Mint};
use std::convert::TryInto;

// Program ID: Must match the ID in Cargo.toml
solana_program::declare_id!("3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps");

// Define swap fee constants
const LIQUIDITY_CONTRIBUTION_PERCENT: u8 = 20; // 20% goes to liquidity
const ADMIN_FEE_PERCENT: u8 = 1;               // 0.1% SOL commission to admin
const YOS_CASHBACK_PERCENT: u8 = 3;            // 3% cashback in YOS tokens

// Custom error codes for better error handling
#[derive(Debug)]
pub enum MultiHubSwapError {
    InvalidInstruction = 0,
    NotInitialized = 1,
    AlreadyInitialized = 2,
    InvalidAuthority = 3,
    SlippageExceeded = 4,
    InvalidTokenAccount = 5,
    InsufficientFunds = 6,
    PoolNotFound = 7,
    InvalidPool = 8,
    MathOverflow = 9,
    NoRewardsAvailable = 10,
    InvalidParameter = 11,
    EmergencyPaused = 12,
    InvalidReferrer = 13,
    DistributionTooSoon = 14,
}

impl From<MultiHubSwapError> for ProgramError {
    fn from(e: MultiHubSwapError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

// Define program instructions - SIMPLIFIED for fixing initialization issues
#[derive(BorshSerialize, BorshDeserialize, Debug, PartialEq)]
pub enum MultiHubSwapInstruction {
    /// Initialize swap program state
    /// Accounts expected:
    /// 0. `[signer]` Admin account that controls the program
    /// 1. `[writable]` Program state account (PDA)
    /// 2. `[]` YOT token mint
    /// 3. `[]` YOS token mint
    /// 4. `[]` SOL-YOT liquidity pool 
    /// 5. `[]` System program
    /// 6. `[]` Rent sysvar
    Initialize {
        // Bump seed for program authority
        authority_bump: u8,
    },

    /// Execute a swap from input token to output token with auto-contribution to liquidity
    /// (Simplified implementation for debugging)
    /// Accounts expected:
    /// 0. `[signer]` User's wallet
    /// 1. `[writable]` User's token account for input token
    /// 2. `[writable]` User's token account for output token
    /// 3. `[writable]` User's YOS token account for cashback
    /// 4. `[]` Program state account
    /// 5. `[]` Token program
    /// 6. `[]` Input token mint
    /// 7. `[]` Output token mint
    SwapToken {
        // Amount of input token to swap
        amount_in: u64,
        // Minimum amount of output token to receive
        minimum_amount_out: u64,
    },
}

// Program state account data structure - SIMPLIFIED for initialization issues
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct ProgramState {
    // Is the program initialized
    pub is_initialized: bool,
    // Admin account
    pub admin: Pubkey,
    // YOT token mint
    pub yot_mint: Pubkey,
    // YOS token mint
    pub yos_mint: Pubkey,
    // SOL-YOT liquidity pool
    pub sol_yot_pool: Pubkey,
    // Authority PDA
    pub authority: Pubkey,
    // Authority bump seed
    pub authority_bump: u8,
    // Liquidity contribution percentage
    pub liquidity_contribution_percent: u8,
    // Admin fee percentage
    pub admin_fee_percent: u8,
    // YOS cashback percentage
    pub yos_cashback_percent: u8,
    // Last update timestamp
    pub last_update_time: u64,
}

impl IsInitialized for ProgramState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

// Mark the entrypoint to be processed by program
entrypoint!(process_instruction);

// Instruction processor
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Detailed logging for debugging
    msg!("MultiHub Swap: Processing instruction");
    if instruction_data.is_empty() {
        msg!("Error: Empty instruction data");
        return Err(MultiHubSwapError::InvalidInstruction.into());
    }
    
    msg!("Instruction data length: {}", instruction_data.len());
    // Log first few bytes for debugging
    if instruction_data.len() >= 4 {
        msg!("First 4 bytes: {:?}", &instruction_data[0..4]);
    }
    
    // Decode instruction
    let instruction = match MultiHubSwapInstruction::try_from_slice(instruction_data) {
        Ok(instruction) => {
            msg!("Successfully decoded instruction");
            instruction
        },
        Err(error) => {
            msg!("Failed to decode instruction: {:?}", error);
            return Err(MultiHubSwapError::InvalidInstruction.into());
        }
    };
    
    // Process based on instruction type
    match instruction {
        MultiHubSwapInstruction::Initialize { authority_bump } => {
            msg!("Instruction: Initialize with authority bump {}", authority_bump);
            process_initialize(program_id, accounts, authority_bump)
        },
        MultiHubSwapInstruction::SwapToken {
            amount_in,
            minimum_amount_out,
        } => {
            msg!("Instruction: SwapToken with amount_in {} and minimum_amount_out {}", 
                amount_in, minimum_amount_out);
            process_swap_token(
                program_id,
                accounts,
                amount_in,
                minimum_amount_out,
            )
        },
    }
}

// Calculate PDA for program state
fn find_program_state_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"program_state"], program_id)
}

// Calculate PDA for program authority
fn find_authority_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"authority"], program_id)
}

// Initialize the program
fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    authority_bump: u8,
) -> ProgramResult {
    msg!("Processing initialize instruction");
    
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let admin_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let yot_mint_account = next_account_info(account_info_iter)?;
    let yos_mint_account = next_account_info(account_info_iter)?;
    let sol_yot_pool_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;

    msg!("Admin: {}", admin_account.key);
    msg!("Program state: {}", program_state_account.key);
    msg!("YOT mint: {}", yot_mint_account.key);
    msg!("YOS mint: {}", yos_mint_account.key);
    msg!("SOL-YOT pool: {}", sol_yot_pool_account.key);
    
    // Verify admin signature (must be signed)
    if !admin_account.is_signer {
        msg!("Error: Admin must sign the transaction");
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Calculate program state PDA
    let (expected_state_address, state_bump) = find_program_state_address(program_id);
    if expected_state_address != *program_state_account.key {
        msg!("Error: Program state account doesn't match PDA");
        msg!("Expected: {}, Got: {}", expected_state_address, program_state_account.key);
        return Err(MultiHubSwapError::InvalidAuthority.into());
    }
    
    // Calculate authority PDA
    let (authority_address, _) = find_authority_address(program_id);
    msg!("Authority PDA: {}", authority_address);

    // Check if account already exists and is initialized
    if !program_state_account.data_is_empty() {
        // If account has data, try to deserialize it
        if let Ok(state) = ProgramState::try_from_slice(&program_state_account.data.borrow()) {
            if state.is_initialized {
                msg!("Error: Program is already initialized");
                return Err(MultiHubSwapError::AlreadyInitialized.into());
            }
        }
    }

    // Create program state account if it doesn't exist
    msg!("Creating program state account");
    let rent = Rent::from_account_info(rent_sysvar)?;
    let space = std::mem::size_of::<ProgramState>();
    let lamports = rent.minimum_balance(space);
    
    // Create the account
    invoke_signed(
        &system_instruction::create_account(
            admin_account.key,
            &expected_state_address,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            admin_account.clone(),
            program_state_account.clone(),
            system_program.clone(),
        ],
        &[&[b"program_state", &[state_bump]]],
    )?;
    
    // Get current time
    let current_time = Clock::get()?.unix_timestamp as u64;
    
    // Initialize program state
    let program_state = ProgramState {
        is_initialized: true,
        admin: *admin_account.key,
        yot_mint: *yot_mint_account.key,
        yos_mint: *yos_mint_account.key,
        sol_yot_pool: *sol_yot_pool_account.key,
        authority: authority_address,
        authority_bump,
        liquidity_contribution_percent: LIQUIDITY_CONTRIBUTION_PERCENT,
        admin_fee_percent: ADMIN_FEE_PERCENT,
        yos_cashback_percent: YOS_CASHBACK_PERCENT,
        last_update_time: current_time,
    };
    
    // Serialize program state to account data
    program_state.serialize(&mut &mut program_state_account.data.borrow_mut()[..])?;
    
    msg!("MultiHub Swap program initialized successfully");
    
    Ok(())
}

// Process swap token instruction (simplified for testing)
fn process_swap_token(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount_in: u64,
    minimum_amount_out: u64,
) -> ProgramResult {
    msg!("Processing swap token instruction");
    
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let user_account = next_account_info(account_info_iter)?;
    let user_input_token_account = next_account_info(account_info_iter)?;
    let user_output_token_account = next_account_info(account_info_iter)?;
    let user_yos_token_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let input_token_mint = next_account_info(account_info_iter)?;
    let output_token_mint = next_account_info(account_info_iter)?;
    
    // Verify user signature
    if !user_account.is_signer {
        msg!("Error: User must sign the transaction");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Get program state
    let program_state = match ProgramState::try_from_slice(&program_state_account.data.borrow()) {
        Ok(state) => {
            if !state.is_initialized {
                msg!("Error: Program is not initialized");
                return Err(MultiHubSwapError::NotInitialized.into());
            }
            state
        },
        Err(error) => {
            msg!("Error deserializing program state: {:?}", error);
            return Err(MultiHubSwapError::InvalidParameter.into());
        }
    };
    
    // In a simplified implementation, we just log what would happen
    msg!("Swap operation would execute with following parameters:");
    msg!("- Input token: {}", input_token_mint.key);
    msg!("- Output token: {}", output_token_mint.key);
    msg!("- Amount in: {}", amount_in);
    msg!("- Minimum amount out: {}", minimum_amount_out);
    msg!("- Liquidity contribution: {}%", program_state.liquidity_contribution_percent);
    msg!("- YOS cashback: {}%", program_state.yos_cashback_percent);
    
    // Return success without actually executing the swap
    // This is just for testing the instruction parsing
    msg!("Swap simulation completed successfully");
    
    Ok(())
}