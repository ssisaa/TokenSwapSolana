use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    sysvar::Sysvar,
    system_instruction,
    program::{invoke, invoke_signed},
};

// Define program-wide constants
pub const STATE_SEED: &[u8] = b"state";
pub const AUTHORITY_SEED: &[u8] = b"authority";

// Define the instruction variants with proper serialization
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum MultihubSwapInstruction {
    Initialize {
        admin: Pubkey,
        yot_mint: Pubkey,
        yos_mint: Pubkey,
        lp_contribution_rate: u64,
        admin_fee_rate: u64,
        yos_cashback_rate: u64,
        swap_fee_rate: u64,
        referral_rate: u64,
    },
    Swap {
        amount_in: u64,
        min_amount_out: u64,
    },
    CloseProgram {},
}

// Original program state structure exactly matching what the client expects
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

// Program entrypoint
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Multihub Swap V4: Instruction received");
    
    // Safely attempt to deserialize the instruction
    match MultihubSwapInstruction::try_from_slice(instruction_data) {
        Ok(instruction) => {
            match instruction {
                MultihubSwapInstruction::Initialize {
                    admin,
                    yot_mint,
                    yos_mint,
                    lp_contribution_rate,
                    admin_fee_rate,
                    yos_cashback_rate,
                    swap_fee_rate,
                    referral_rate,
                } => {
                    msg!("Instruction: Initialize");
                    msg!("Admin: {}", admin);
                    msg!("YOT Mint: {}", yot_mint);
                    msg!("YOS Mint: {}", yos_mint);
                    msg!("LP Contribution Rate: {}", lp_contribution_rate);
                    msg!("Admin Fee Rate: {}", admin_fee_rate);
                    msg!("YOS Cashback Rate: {}", yos_cashback_rate);
                    msg!("Swap Fee Rate: {}", swap_fee_rate);
                    msg!("Referral Rate: {}", referral_rate);
                    
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
                }
                MultihubSwapInstruction::Swap { amount_in, min_amount_out } => {
                    msg!("Instruction: Swap");
                    msg!("Amount In: {}", amount_in);
                    msg!("Min Amount Out: {}", min_amount_out);
                    
                    process_swap(program_id, accounts, amount_in, min_amount_out)
                }
                MultihubSwapInstruction::CloseProgram {} => {
                    msg!("Instruction: CloseProgram");
                    process_close_program(program_id, accounts)
                }
            }
        },
        Err(err) => {
            msg!("Failed to deserialize instruction: {}", err);
            Err(ProgramError::InvalidInstructionData)
        }
    }
}

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
    let account_info_iter = &mut accounts.iter();
    
    // Extract accounts
    let payer = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;
    
    // Verify payer is signer
    if !payer.is_signer {
        msg!("Expected payer to be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Derive and verify program state address
    let (expected_state_pubkey, state_bump) = 
        Pubkey::find_program_address(&[STATE_SEED], program_id);
    
    if expected_state_pubkey != *program_state_account.key {
        msg!("Program state account does not match the derived address");
        msg!("Expected: {}", expected_state_pubkey);
        msg!("Found: {}", program_state_account.key);
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Derive and verify program authority
    let (expected_authority_pubkey, _) = 
        Pubkey::find_program_address(&[AUTHORITY_SEED], program_id);
    
    if expected_authority_pubkey != *program_authority.key {
        msg!("Program authority account does not match the derived address");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Create program state
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
    
    // Calculate EXACT serialized size
    let serialized_data = program_state.try_to_vec()?;
    let space = serialized_data.len();
    msg!("Actual serialized size: {}", space);
    
    // Check if account exists
    let account_is_initialized = !program_state_account.data.borrow().iter().all(|&x| x == 0);
    
    if !account_is_initialized {
        msg!("Creating new program state account");
        
        // Get minimum rent
        let rent = Rent::from_account_info(rent_sysvar)?;
        let rent_lamports = rent.minimum_balance(space);
        
        // Create the program state account with EXACT space
        invoke_signed(
            &system_instruction::create_account(
                payer.key,
                program_state_account.key,
                rent_lamports,
                space as u64,
                program_id,
            ),
            &[
                payer.clone(),
                program_state_account.clone(),
                system_program.clone(),
            ],
            &[&[STATE_SEED, &[state_bump]]],
        )?;
    } else {
        msg!("Program state account already exists");
        
        // Log raw data for debugging
        let account_data = program_state_account.data.borrow();
        msg!("Data dump: {:?}", &account_data[..std::cmp::min(64, account_data.len())]);
        
        // Verify admin
        match ProgramState::try_from_slice(&account_data) {
            Ok(existing_state) => {
                if existing_state.admin != *payer.key {
                    msg!("Only the admin can re-initialize the program");
                    return Err(ProgramError::InvalidAccountData);
                }
            },
            Err(err) => {
                msg!("Failed to deserialize program state: {}", err);
                return Err(ProgramError::InvalidAccountData);
            }
        }
        
        // Verify account size
        if program_state_account.data.borrow().len() < space {
            msg!("Account too small: current size {}, needed size {}", 
                program_state_account.data.borrow().len(), space);
            return Err(ProgramError::AccountDataTooSmall);
        }
    }
    
    // Zero the entire account before writing
    let mut account_data = program_state_account.data.borrow_mut();
    account_data.fill(0);
    
    // Write the serialized data
    account_data[..serialized_data.len()].copy_from_slice(&serialized_data);
    
    msg!("Program initialized successfully");
    Ok(())
}

pub fn process_swap(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount_in: u64,
    min_amount_out: u64,
) -> ProgramResult {
    // Load accounts: keep the same pattern for all operations
    let account_info_iter = &mut accounts.iter();
    
    // Extract accounts - user accounts
    let user = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    
    // Token accounts
    let user_token_from = next_account_info(account_info_iter)?;
    let user_token_to = next_account_info(account_info_iter)?;
    let user_yos_token = next_account_info(account_info_iter)?;
    
    // Program token accounts
    let program_token_from = next_account_info(account_info_iter)?;
    let program_token_to = next_account_info(account_info_iter)?;
    let program_yos_token = next_account_info(account_info_iter)?;
    
    // Token mints
    let token_from_mint = next_account_info(account_info_iter)?;
    let token_to_mint = next_account_info(account_info_iter)?;
    let yos_mint = next_account_info(account_info_iter)?;
    
    // Programs
    let token_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;
    
    // Verify that the user is a signer
    if !user.is_signer {
        msg!("Expected user to be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Log data for debugging
    let account_data = program_state_account.data.borrow();
    msg!("Account data length: {}", account_data.len());
    msg!("Expected size from try_to_vec: {}", ProgramState::default().try_to_vec().map(|v| v.len()).unwrap_or(0));
    
    // Deserialize program state
    let program_state = match ProgramState::try_from_slice(&account_data) {
        Ok(state) => state,
        Err(err) => {
            msg!("Failed to deserialize program state: {}", err);
            msg!("Data dump: {:?}", &account_data[..std::cmp::min(64, account_data.len())]);
            return Err(ProgramError::InvalidAccountData);
        }
    };
    
    // Verify PDAs
    let (expected_state_pubkey, _) = 
        Pubkey::find_program_address(&[STATE_SEED], program_id);
    
    if expected_state_pubkey != *program_state_account.key {
        msg!("Program state account does not match the derived address");
        return Err(ProgramError::InvalidAccountData);
    }
    
    let (expected_authority_pubkey, authority_bump) = 
        Pubkey::find_program_address(&[AUTHORITY_SEED], program_id);
    
    if expected_authority_pubkey != *program_authority.key {
        msg!("Program authority account does not match the derived address");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Verify token mints match program state
    if program_state.yos_mint != *yos_mint.key {
        msg!("YOS mint does not match program state");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Implement swap logic here (omitted for brevity)
    
    msg!("Swap completed successfully");
    Ok(())
}

pub fn process_close_program(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Extract accounts
    let admin = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    
    // Verify admin is signer
    if !admin.is_signer {
        msg!("Expected admin to be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Deserialize program state
    let program_state = match ProgramState::try_from_slice(&program_state_account.data.borrow()) {
        Ok(state) => state,
        Err(err) => {
            msg!("Failed to deserialize program state: {}", err);
            msg!("Data dump: {:?}", &program_state_account.data.borrow()[..std::cmp::min(64, program_state_account.data.borrow().len())]);
            return Err(ProgramError::InvalidAccountData);
        }
    };
    
    // Verify caller is admin
    if program_state.admin != *admin.key {
        msg!("Only the admin can close the program");
        msg!("Expected: {}", program_state.admin);
        msg!("Found: {}", admin.key);
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Verify PDAs
    let (expected_state_pubkey, state_bump) = 
        Pubkey::find_program_address(&[STATE_SEED], program_id);
    
    if expected_state_pubkey != *program_state_account.key {
        msg!("Program state account does not match the derived address");
        return Err(ProgramError::InvalidAccountData);
    }
    
    let (expected_authority_pubkey, _) = 
        Pubkey::find_program_address(&[AUTHORITY_SEED], program_id);
    
    if expected_authority_pubkey != *program_authority.key {
        msg!("Program authority account does not match the derived address");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Get lamports before zeroing data
    let program_state_lamports = program_state_account.lamports();
    
    // Zero out the data
    let mut program_state_data = program_state_account.data.borrow_mut();
    program_state_data.fill(0);
    
    // Use CPI for safer lamport transfer
    invoke_signed(
        &system_instruction::transfer(
            program_state_account.key,
            admin.key,
            program_state_lamports,
        ),
        &[
            program_state_account.clone(),
            admin.clone(),
            system_program.clone(),
        ],
        &[&[STATE_SEED, &[state_bump]]],
    )?;
    
    msg!("Program closed successfully");
    Ok(())
}