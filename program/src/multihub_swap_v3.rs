use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
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
use spl_token::{instruction as token_instruction, state::Account as TokenAccount};
use std::convert::TryInto;

// Define the program ID here (will be replaced during deployment)
solana_program::declare_id!("Cohae9agySEgC9gyJL1QHCJWw4q58R7Wshr3rpPJHU7L");

// Instructions supported by this program
#[derive(BorshSerialize, BorshDeserialize, Debug, PartialEq)]
pub enum SwapInstruction {
    // Initialize the program state with admin and token addresses
    Initialize {
        // Admin who can manage the program
        admin: Pubkey,
        // YOT token mint address
        yot_mint: Pubkey,
        // YOS token mint address
        yos_mint: Pubkey,
        // Contribution rate to liquidity pool (e.g., 20%)
        lp_contribution_rate: u64,
        // Admin fee rate (e.g., 0.1%)
        admin_fee_rate: u64,
        // YOS cashback rate (e.g., 5%)
        yos_cashback_rate: u64,
        // Swap fee rate (e.g., 0.3%)
        swap_fee_rate: u64,
        // Referral payment rate (e.g., 0.5%)
        referral_rate: u64,
    },
    // Swap tokens with cashback and liquidity contribution
    Swap {
        // Amount of input tokens to swap
        amount_in: u64,
        // Minimum amount of output tokens to receive
        min_amount_out: u64,
    },
    // Update program parameters (admin only)
    UpdateParameters {
        // New contribution rate to liquidity pool
        lp_contribution_rate: Option<u64>,
        // New admin fee rate
        admin_fee_rate: Option<u64>,
        // New YOS cashback rate
        yos_cashback_rate: Option<u64>,
        // New swap fee rate
        swap_fee_rate: Option<u64>,
        // New referral payment rate
        referral_rate: Option<u64>,
    },
    // Change the admin (admin only)
    SetAdmin {
        // New admin public key
        new_admin: Pubkey,
    },
    // Close and reset program state (admin only)
    CloseProgram {},
}

// Program state data stored in the first account
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct ProgramState {
    // Admin who can manage the program
    pub admin: Pubkey,
    // YOT token mint address
    pub yot_mint: Pubkey,
    // YOS token mint address
    pub yos_mint: Pubkey,
    // Contribution rate to liquidity pool (in basis points, 1% = 100)
    pub lp_contribution_rate: u64,
    // Admin fee rate (in basis points, 0.1% = 10)
    pub admin_fee_rate: u64,
    // YOS cashback rate (in basis points, 5% = 500)
    pub yos_cashback_rate: u64,
    // Swap fee rate (in basis points, 0.3% = 30)
    pub swap_fee_rate: u64,
    // Referral payment rate (in basis points, 0.5% = 50)
    pub referral_rate: u64,
    // Is this program state initialized?
    pub is_initialized: bool,
}

// Program authority - PDA that can sign for transactions
fn find_program_authority(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"authority"], program_id)
}

// Program state address - PDA where state is stored
fn find_program_state_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"state"], program_id)
}

// Entry point for the program
entrypoint!(process_instruction);

// Process the program instruction
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Deserialize the instruction
    let instruction = SwapInstruction::try_from_slice(instruction_data)?;

    // Match the instruction to the appropriate handler
    match instruction {
        SwapInstruction::Initialize {
            admin,
            yot_mint,
            yos_mint,
            lp_contribution_rate,
            admin_fee_rate,
            yos_cashback_rate,
            swap_fee_rate,
            referral_rate,
        } => process_initialize(
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
        ),
        SwapInstruction::Swap {
            amount_in,
            min_amount_out,
        } => process_swap(program_id, accounts, amount_in, min_amount_out),
        SwapInstruction::UpdateParameters {
            lp_contribution_rate,
            admin_fee_rate,
            yos_cashback_rate,
            swap_fee_rate,
            referral_rate,
        } => process_update_parameters(
            program_id,
            accounts,
            lp_contribution_rate,
            admin_fee_rate,
            yos_cashback_rate,
            swap_fee_rate,
            referral_rate,
        ),
        SwapInstruction::SetAdmin { new_admin } => process_set_admin(program_id, accounts, new_admin),
        SwapInstruction::CloseProgram {} => process_close_program(program_id, accounts),
    }
}

/// Initialize the program state with admin and token addresses
fn process_initialize(
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
    // Get account iterator
    let account_info_iter = &mut accounts.iter();

    // Extract accounts
    let payer_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let program_authority_account = next_account_info(account_info_iter)?;
    let system_program_account = next_account_info(account_info_iter)?;
    let rent_sysvar_account = next_account_info(account_info_iter)?;

    // Validate accounts
    if !payer_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Calculate PDAs
    let (program_state_address, program_state_bump) = find_program_state_address(program_id);
    let (program_authority_address, _) = find_program_authority(program_id);

    // Verify PDAs
    if program_state_address != *program_state_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    if program_authority_address != *program_authority_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    // Check if the program state account already exists
    if program_state_account.data_len() > 0 {
        // If it exists, check if it's already initialized
        let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
        if program_state.is_initialized {
            return Err(ProgramError::AccountAlreadyInitialized);
        }
    } else {
        // Create program state account
        let rent = Rent::get()?;
        let state_size = std::mem::size_of::<ProgramState>();
        let lamports = rent.minimum_balance(state_size);

        invoke_signed(
            &system_instruction::create_account(
                payer_account.key,
                program_state_account.key,
                lamports,
                state_size as u64,
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
        is_initialized: true,
    };

    // Serialize and store program state
    program_state.serialize(&mut *program_state_account.data.borrow_mut())?;

    msg!("Program initialized successfully");
    Ok(())
}

/// Process a token swap with cashback and liquidity contribution
fn process_swap(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount_in: u64,
    min_amount_out: u64,
) -> ProgramResult {
    // Get account iterator
    let account_info_iter = &mut accounts.iter();

    // Extract accounts
    let user_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let program_authority_account = next_account_info(account_info_iter)?;
    let user_token_in_account = next_account_info(account_info_iter)?;
    let user_token_out_account = next_account_info(account_info_iter)?;
    let user_yos_account = next_account_info(account_info_iter)?;
    let token_program_account = next_account_info(account_info_iter)?;

    // Validate accounts
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Load program state
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    if !program_state.is_initialized {
        return Err(ProgramError::UninitializedAccount);
    }

    // Verify the program authority
    let (program_authority_address, program_authority_bump) = find_program_authority(program_id);
    if program_authority_address != *program_authority_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    // Verify YOS token account
    // This is the critical part - we ensure the YOS token account exists and is valid
    if let Ok(user_yos_account_data) = TokenAccount::unpack(&user_yos_account.data.borrow()) {
        if user_yos_account_data.mint != program_state.yos_mint {
            msg!("YOS token account has incorrect mint");
            return Err(ProgramError::InvalidAccountData);
        }
        if user_yos_account_data.owner != *user_account.key {
            msg!("YOS token account has incorrect owner");
            return Err(ProgramError::InvalidAccountData);
        }
    } else {
        msg!("Invalid YOS token account - account may not exist");
        return Err(ProgramError::InvalidAccountData);
    }

    // Calculate token amounts
    // In a real implementation, this would interact with external liquidity pools
    // For this example, we'll just use a simplified estimation
    let lp_contribution_amount = (amount_in * program_state.lp_contribution_rate) / 10000;
    let admin_fee_amount = (amount_in * program_state.admin_fee_rate) / 10000;
    let swap_fee_amount = (amount_in * program_state.swap_fee_rate) / 10000;
    let referral_amount = (amount_in * program_state.referral_rate) / 10000;

    let net_amount_in = amount_in - lp_contribution_amount - admin_fee_amount - swap_fee_amount - referral_amount;
    let amount_out = net_amount_in; // Simplified 1:1 conversion
    
    // Apply YOS cashback
    let yos_cashback_amount = (amount_in * program_state.yos_cashback_rate) / 10000;

    // Ensure the swap meets the minimum output requirement
    if amount_out < min_amount_out {
        return Err(ProgramError::InvalidInstructionData);
    }

    // Transfer tokens from user to destination accounts
    // (simplified for example - real implementation would do the full multi-hub swap)
    
    // Transfer tokens from user account to program authority
    invoke(
        &token_instruction::transfer(
            token_program_account.key,
            user_token_in_account.key,
            program_authority_account.key,
            user_account.key,
            &[],
            amount_in,
        )?,
        &[
            user_token_in_account.clone(),
            program_authority_account.clone(),
            user_account.clone(),
            token_program_account.clone(),
        ],
    )?;

    // Transfer output tokens to user
    // (simplified - in real implementation, this would come from the actual swap)
    invoke_signed(
        &token_instruction::transfer(
            token_program_account.key,
            program_authority_account.key,
            user_token_out_account.key,
            program_authority_account.key,
            &[],
            amount_out,
        )?,
        &[
            program_authority_account.clone(),
            user_token_out_account.clone(),
            token_program_account.clone(),
        ],
        &[&[b"authority", &[program_authority_bump]]],
    )?;

    // Send YOS cashback to user
    invoke_signed(
        &token_instruction::mint_to(
            token_program_account.key,
            &program_state.yos_mint,
            user_yos_account.key,
            program_authority_account.key,
            &[],
            yos_cashback_amount,
        )?,
        &[
            user_yos_account.clone(),
            program_authority_account.clone(),
            token_program_account.clone(),
        ],
        &[&[b"authority", &[program_authority_bump]]],
    )?;

    msg!("Swap processed successfully");
    Ok(())
}

/// Update program parameters (admin only)
fn process_update_parameters(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    lp_contribution_rate: Option<u64>,
    admin_fee_rate: Option<u64>,
    yos_cashback_rate: Option<u64>,
    swap_fee_rate: Option<u64>,
    referral_rate: Option<u64>,
) -> ProgramResult {
    // Get account iterator
    let account_info_iter = &mut accounts.iter();

    // Extract accounts
    let admin_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;

    // Verify state address
    let (program_state_address, _) = find_program_state_address(program_id);
    if program_state_address != *program_state_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    // Load program state
    let mut program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    if !program_state.is_initialized {
        return Err(ProgramError::UninitializedAccount);
    }

    // Verify admin
    if program_state.admin != *admin_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    if !admin_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Update parameters that were provided
    if let Some(rate) = lp_contribution_rate {
        program_state.lp_contribution_rate = rate;
    }
    if let Some(rate) = admin_fee_rate {
        program_state.admin_fee_rate = rate;
    }
    if let Some(rate) = yos_cashback_rate {
        program_state.yos_cashback_rate = rate;
    }
    if let Some(rate) = swap_fee_rate {
        program_state.swap_fee_rate = rate;
    }
    if let Some(rate) = referral_rate {
        program_state.referral_rate = rate;
    }

    // Save updated state
    program_state.serialize(&mut *program_state_account.data.borrow_mut())?;

    msg!("Parameters updated successfully");
    Ok(())
}

/// Set a new admin (admin only)
fn process_set_admin(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    new_admin: Pubkey,
) -> ProgramResult {
    // Get account iterator
    let account_info_iter = &mut accounts.iter();

    // Extract accounts
    let admin_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;

    // Verify state address
    let (program_state_address, _) = find_program_state_address(program_id);
    if program_state_address != *program_state_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    // Load program state
    let mut program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    if !program_state.is_initialized {
        return Err(ProgramError::UninitializedAccount);
    }

    // Verify admin
    if program_state.admin != *admin_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    if !admin_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Update admin
    program_state.admin = new_admin;

    // Save updated state
    program_state.serialize(&mut *program_state_account.data.borrow_mut())?;

    msg!("Admin updated successfully");
    Ok(())
}

/// Close the program (admin only)
fn process_close_program(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    // Get account iterator
    let account_info_iter = &mut accounts.iter();

    // Extract accounts
    let admin_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    
    // Verify state address
    let (program_state_address, _) = find_program_state_address(program_id);
    if program_state_address != *program_state_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    // Load program state
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    if !program_state.is_initialized {
        return Err(ProgramError::UninitializedAccount);
    }

    // Verify admin
    if program_state.admin != *admin_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    if !admin_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Transfer lamports from program state account to admin (closing the account)
    let lamports = program_state_account.lamports();
    **program_state_account.lamports.borrow_mut() = 0;
    **admin_account.lamports.borrow_mut() += lamports;

    // Clear the data
    program_state_account.data.borrow_mut().fill(0);

    msg!("Program closed successfully");
    Ok(())
}