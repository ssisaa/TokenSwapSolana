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

// Define the program ID here (will be replaced during deployment)
solana_program::declare_id!("Cohae9agySEgC9gyJL1QHCJWw4q58R7Wshr3rpPJHU7L");

// We still need these structs for storing program state and instruction parameters
// but we don't use Borsh for instruction deserialization anymore
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum SwapInstruction {
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
    CloseProgram,
}

// Program state stored in a PDA (still uses Borsh for storage)
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

// Entrypoint is defined in lib.rs but we declare it here for standalone testing
entrypoint!(process_instruction);

// Direct manual parsing of instruction data without intermediate Borsh deserialization
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // First byte is the instruction discriminator
    match instruction_data.first() {
        Some(0) => {
            msg!("Manual Initialize Instruction");
            let mut offset = 1;
            if instruction_data.len() < 1 + 32*3 + 8*5 {
                msg!("Instruction too short for Initialize: {} bytes", instruction_data.len());
                return Err(ProgramError::InvalidInstructionData);
            }

            // Extract public keys using newer method instead of deprecated Pubkey::new
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

            // Call the initialize handler with the parsed parameters
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
        
        Some(1) => {
            msg!("Manual Swap Instruction");
            if instruction_data.len() < 1 + 8 + 8 {
                msg!("Instruction too short for Swap: {} bytes", instruction_data.len());
                return Err(ProgramError::InvalidInstructionData);
            }
            
            // Extract swap parameters
            let amount_in = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            let min_amount_out = u64::from_le_bytes(instruction_data[9..17].try_into().unwrap());
            
            msg!("Swap params: Amount In: {}, Min Out: {}", amount_in, min_amount_out);
            
            // Call the swap handler with the parsed parameters
            process_swap(program_id, accounts, amount_in, min_amount_out)
        },
        
        Some(2) => {
            msg!("Manual CloseProgram Instruction");
            // Call the close program handler
            process_close_program(program_id, accounts)
        },
        
        _ => {
            msg!("Unknown instruction discriminator");
            Err(ProgramError::InvalidInstructionData)
        }
    }
}

// Find program state PDA address
pub fn find_program_state_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"state"], program_id)
}

// Find program authority PDA address
pub fn find_program_authority_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"authority"], program_id)
}

// Initialize the swap program with token accounts and parameters
// This version uses direct field initialization with buffer parsing
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
    let (expected_program_authority, program_authority_bump) = find_program_authority_address(program_id);
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

// Perform a token swap through multihub
pub fn process_swap(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount_in: u64,
    min_amount_out: u64,
) -> ProgramResult {
    msg!("Starting token swap");
    msg!("Amount in: {}", amount_in);
    msg!("Min amount out: {}", min_amount_out);
    
    // Get accounts
    let accounts_iter = &mut accounts.iter();
    
    // Extract all required accounts
    let user_account = next_account_info(accounts_iter)?;
    let program_state_account = next_account_info(accounts_iter)?;
    let program_authority_account = next_account_info(accounts_iter)?;
    
    // User token accounts
    let user_token_from_account = next_account_info(accounts_iter)?;
    let user_token_to_account = next_account_info(accounts_iter)?;
    let user_yos_token_account = next_account_info(accounts_iter)?;
    
    // Program token accounts
    let program_token_from_account = next_account_info(accounts_iter)?;
    let program_token_to_account = next_account_info(accounts_iter)?;
    let program_yos_token_account = next_account_info(accounts_iter)?;
    
    // Token mints
    let _token_from_mint = next_account_info(accounts_iter)?;
    let _token_to_mint = next_account_info(accounts_iter)?;
    let _yos_token_mint = next_account_info(accounts_iter)?;
    
    // System accounts
    let token_program = next_account_info(accounts_iter)?;
    let _system_program = next_account_info(accounts_iter)?;
    let _rent_sysvar = next_account_info(accounts_iter)?;
    
    // Validate accounts
    if !user_account.is_signer {
        msg!("User account must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify program state PDA
    let (expected_program_state, _program_state_bump) = find_program_state_address(program_id);
    if expected_program_state != *program_state_account.key {
        msg!("Invalid program state account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Verify program authority PDA - FIXED: Only check the key matches, don't access data
    let (expected_program_authority, program_authority_bump) = find_program_authority_address(program_id);
    
    // Add debug logs to help troubleshooting
    msg!("Account[2] key: {}", program_authority_account.key);
    msg!("Expected PDA: {}", expected_program_authority);
    
    if expected_program_authority != *program_authority_account.key {
        msg!("❌ Invalid program authority");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Deserialize program state
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // ***** SAFE TOKEN ACCOUNT HANDLING *****
    // Only deserialize token accounts with proper error handling
    let user_token_from = match TokenAccount::unpack(&user_token_from_account.data.borrow()) {
        Ok(account) => account,
        Err(err) => {
            msg!("Error unpacking user_token_from_account: {:?}", err);
            return Err(ProgramError::InvalidAccountData);
        }
    };
    
    let program_token_from = match TokenAccount::unpack(&program_token_from_account.data.borrow()) {
        Ok(account) => account,
        Err(err) => {
            msg!("Error unpacking program_token_from_account: {:?}", err);
            return Err(ProgramError::InvalidAccountData);
        }
    };
    
    let program_token_to = match TokenAccount::unpack(&program_token_to_account.data.borrow()) {
        Ok(account) => account,
        Err(err) => {
            msg!("Error unpacking program_token_to_account: {:?}", err);
            return Err(ProgramError::InvalidAccountData);
        }
    };
    
    // Calculate amounts
    // LP contribution: 20% of amount_in goes to LP
    let lp_contribution_amount = (amount_in * program_state.lp_contribution_rate) / 10000;
    
    // Admin fee: 0.1% of amount_in
    let admin_fee_amount = (amount_in * program_state.admin_fee_rate) / 10000;
    
    // YOS cashback: 5% of amount_in
    let yos_cashback_amount = (amount_in * program_state.yos_cashback_rate) / 10000;
    
    // Swap fee: 0.3% of amount_in
    let swap_fee_amount = (amount_in * program_state.swap_fee_rate) / 10000;
    
    // Referral payment: 0.5% of amount_in (not implemented yet)
    let referral_amount = (amount_in * program_state.referral_rate) / 10000;
    
    // Net amount for swap
    let net_swap_amount = amount_in - lp_contribution_amount - admin_fee_amount - swap_fee_amount - referral_amount;
    
    msg!("Swap calculations:");
    msg!("LP contribution: {} ({} basis points)", lp_contribution_amount, program_state.lp_contribution_rate);
    msg!("Admin fee: {} ({} basis points)", admin_fee_amount, program_state.admin_fee_rate);
    msg!("YOS cashback: {} ({} basis points)", yos_cashback_amount, program_state.yos_cashback_rate);
    msg!("Swap fee: {} ({} basis points)", swap_fee_amount, program_state.swap_fee_rate);
    msg!("Referral amount: {} ({} basis points)", referral_amount, program_state.referral_rate);
    msg!("Net amount for swap: {}", net_swap_amount);
    
    // Verify token amounts
    if user_token_from.amount < amount_in {
        msg!("Insufficient token balance for swap");
        return Err(ProgramError::InsufficientFunds);
    }
    
    // Transfer tokens from user to program (full amount)
    invoke(
        &token_instruction::transfer(
            token_program.key,
            user_token_from_account.key,
            program_token_from_account.key,
            user_account.key,
            &[],
            amount_in,
        )?,
        &[
            user_token_from_account.clone(),
            program_token_from_account.clone(),
            user_account.clone(),
            token_program.clone(),
        ],
    )?;
    
    // Send tokens back to user (output tokens)
    // For simplicity in this example, let's assume the output amount 
    // is 90% of the input (minus fees)
    let amount_out = (net_swap_amount * 90) / 100;
    
    // Verify min amount out
    if amount_out < min_amount_out {
        msg!("Output amount {} less than minimum {}", amount_out, min_amount_out);
        return Err(ProgramError::InvalidArgument);
    }
    
    // Transfer output tokens from program to user
    invoke_signed(
        &token_instruction::transfer(
            token_program.key,
            program_token_to_account.key,
            user_token_to_account.key,
            program_authority_account.key,
            &[],
            amount_out,
        )?,
        &[
            program_token_to_account.clone(),
            user_token_to_account.clone(),
            program_authority_account.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[program_authority_bump]]],
    )?;
    
    // Send YOS cashback to user
    invoke_signed(
        &token_instruction::transfer(
            token_program.key,
            program_yos_token_account.key,
            user_yos_token_account.key,
            program_authority_account.key,
            &[],
            yos_cashback_amount,
        )?,
        &[
            program_yos_token_account.clone(),
            user_yos_token_account.clone(),
            program_authority_account.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[program_authority_bump]]],
    )?;
    
    msg!("Swap successful");
    msg!("Amount in: {}", amount_in);
    msg!("Amount out: {}", amount_out);
    msg!("YOS cashback: {}", yos_cashback_amount);
    
    Ok(())
}

// Close the program and reclaim rent
pub fn process_close_program(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    // Get accounts
    let accounts_iter = &mut accounts.iter();
    
    // Extract accounts
    let admin_account = next_account_info(accounts_iter)?;
    let program_state_account = next_account_info(accounts_iter)?;
    let program_authority_account = next_account_info(accounts_iter)?;
    let _system_program = next_account_info(accounts_iter)?;  // Prefixed with underscore since it's unused
    
    // Verify program state PDA
    let (expected_program_state, program_state_bump) = find_program_state_address(program_id);
    if expected_program_state != *program_state_account.key {
        msg!("Invalid program state account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Verify program authority PDA - FIXED: Only check the key matches, don't access data
    let (expected_program_authority, _program_authority_bump) = find_program_authority_address(program_id);
    
    // Add debug logs to help troubleshooting
    msg!("Account[2] key: {}", program_authority_account.key);
    msg!("Expected PDA: {}", expected_program_authority);
    
    if expected_program_authority != *program_authority_account.key {
        msg!("❌ Invalid program authority");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Deserialize program state
    let program_state = match ProgramState::try_from_slice(&program_state_account.data.borrow()) {
        Ok(state) => state,
        Err(err) => {
            msg!("Error deserializing program state: {:?}", err);
            return Err(ProgramError::InvalidAccountData);
        }
    };
    
    // Verify admin signature
    if !admin_account.is_signer {
        msg!("Admin account must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Only admin can close the program
    if program_state.admin != *admin_account.key {
        msg!("Only the admin can close the program");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Transfer lamports from program state to admin (reclaim rent)
    let state_lamports = program_state_account.lamports();
    **program_state_account.lamports.borrow_mut() = 0;
    **admin_account.lamports.borrow_mut() += state_lamports;
    
    msg!("Program closed successfully");
    msg!("Transferred {} lamports back to admin", state_lamports);
    
    Ok(())
}