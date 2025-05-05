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
    pub lp_contribution_rate: u64, // 20% (2000 basis points)
    pub admin_fee_rate: u64,       // 0.1% (10 basis points)
    pub yos_cashback_rate: u64,    // 5% (500 basis points) 
    pub swap_fee_rate: u64,        // 0.3% (30 basis points)
    pub referral_rate: u64,        // 0.5% (50 basis points)
}

// Liquidity contribution account stores:
// - User public key
// - Contribution amount
// - Start timestamp
// - Last claim timestamp
// - Total claimed YOS
#[derive(BorshSerialize, BorshDeserialize, Debug, Default)]
pub struct LiquidityContribution {
    pub user: Pubkey,
    pub contributed_amount: u64,
    pub start_timestamp: i64,
    pub last_claim_time: i64,
    pub total_claimed_yos: u64,
}

// Instruction discriminators
const INITIALIZE_IX: u8 = 0;
const SWAP_IX: u8 = 1;
const CLOSE_PROGRAM_IX: u8 = 2;
const UPDATE_PARAMETERS_IX: u8 = 3;
const BUY_AND_DISTRIBUTE_IX: u8 = 4;
const CLAIM_WEEKLY_REWARD_IX: u8 = 5;
const WITHDRAW_CONTRIBUTION_IX: u8 = 6;

// Entrypoint is defined in lib.rs but we declare it here for standalone testing
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // First byte is the instruction discriminator
    msg!("📥 Received instruction_data: {:?}", instruction_data);
    
    if instruction_data.is_empty() {
        msg!("❌ No instruction data provided");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Log the discriminator byte for debugging
    msg!("📌 Discriminator byte received: {}", instruction_data[0]);
    
    match instruction_data.first() {
        Some(&INITIALIZE_IX) => {
            msg!("Initialize Instruction");
            let mut offset = 1;
            if instruction_data.len() < 1 + 32*3 + 8*5 {
                msg!("Instruction too short for Initialize: {} bytes", instruction_data.len());
                return Err(ProgramError::InvalidInstructionData);
            }

            // Extract public keys using newer method instead of deprecated Pubkey::new
            let admin = Pubkey::new(array_ref![instruction_data, offset, 32]);
            offset += 32;
            let yot_mint = Pubkey::new(array_ref![instruction_data, offset, 32]);
            offset += 32;
            let yos_mint = Pubkey::new(array_ref![instruction_data, offset, 32]);
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
        
        Some(&SWAP_IX) => {
            msg!("Swap Instruction");
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
        
        Some(&CLOSE_PROGRAM_IX) => {
            msg!("CloseProgram Instruction");
            // Call the close program handler
            process_close_program(program_id, accounts)
        },
        
        Some(&UPDATE_PARAMETERS_IX) => {
            msg!("UpdateParameters Instruction");
            if instruction_data.len() < 1 + 8*5 {
                msg!("Instruction too short for UpdateParameters: {} bytes", instruction_data.len());
                return Err(ProgramError::InvalidInstructionData);
            }
            
            let mut offset = 1;
            
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
            
            msg!("UpdateParameters: LP {} | Fee {} | Cashback {} | Swap {} | Referral {}",
                lp_contribution_rate,
                admin_fee_rate,
                yos_cashback_rate,
                swap_fee_rate,
                referral_rate);
                
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
        
        Some(&BUY_AND_DISTRIBUTE_IX) => {
            msg!("Matched: BUY_AND_DISTRIBUTE_IX ✅");
            if instruction_data.len() < 1 + 8 {
                msg!("Instruction too short for BuyAndDistribute: {} bytes", instruction_data.len());
                return Err(ProgramError::InvalidInstructionData);
            }
            
            // Extract amount parameter
            let amount = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            
            msg!("BuyAndDistribute amount: {}", amount);
            
            process_buy_and_distribute(program_id, accounts, amount)
        },
        
        Some(&CLAIM_WEEKLY_REWARD_IX) => {
            msg!("ClaimWeeklyReward Instruction");
            
            process_claim_weekly_reward(program_id, accounts)
        },
        
        Some(&WITHDRAW_CONTRIBUTION_IX) => {
            msg!("WithdrawContribution Instruction");
            
            process_withdraw_contribution(program_id, accounts)
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

// Find liquidity contribution account for a user
pub fn find_liquidity_contribution_address(
    user: &Pubkey,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"liq", user.as_ref()], program_id)
}

// Find vault token account for a token mint
pub fn find_vault_token_address(
    mint: &Pubkey,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"vault", mint.as_ref()], program_id)
}

// Find liquidity token account for a token mint
pub fn find_liquidity_token_address(
    mint: &Pubkey,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"liquidity", mint.as_ref()], program_id)
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

// Process swap instruction implementation (simplified for brevity)
fn process_swap(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
    _amount_in: u64,
    _min_amount_out: u64,
) -> ProgramResult {
    // Simplified implementation to focus on the new buy_and_distribute functionality
    msg!("Swap functionality not fully implemented in this version");
    Ok(())
}

// Close program implementation (admin only)
fn process_close_program(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    let admin_account = next_account_info(accounts_iter)?;
    let program_state_account = next_account_info(accounts_iter)?;
    
    // Verify admin signature
    if !admin_account.is_signer {
        msg!("Admin must sign CloseProgram instruction");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify program state PDA
    let (expected_program_state, _) = find_program_state_address(program_id);
    if expected_program_state != *program_state_account.key {
        msg!("Invalid program state account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Deserialize program state
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Verify admin authorization
    if program_state.admin != *admin_account.key {
        msg!("Only the admin can close the program");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Transfer lamports from program state account to admin
    let lamports = program_state_account.lamports();
    **program_state_account.lamports.borrow_mut() = 0;
    **admin_account.lamports.borrow_mut() += lamports;
    
    // Clear account data
    program_state_account.data.borrow_mut().fill(0);
    
    msg!("Program closed successfully");
    Ok(())
}

// Update program parameters (admin only)
fn process_update_parameters(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    lp_contribution_rate: u64,
    admin_fee_rate: u64,
    yos_cashback_rate: u64,
    swap_fee_rate: u64,
    referral_rate: u64,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    let admin_account = next_account_info(accounts_iter)?;
    let program_state_account = next_account_info(accounts_iter)?;
    
    // Verify admin signature
    if !admin_account.is_signer {
        msg!("Admin must sign UpdateParameters instruction");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify program state PDA
    let (expected_program_state, _) = find_program_state_address(program_id);
    if expected_program_state != *program_state_account.key {
        msg!("Invalid program state account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Deserialize program state
    let mut program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Verify admin authorization
    if program_state.admin != *admin_account.key {
        msg!("Only the admin can update parameters");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Validate parameters (basic validation only)
    let total_deductions = lp_contribution_rate + admin_fee_rate + yos_cashback_rate + swap_fee_rate + referral_rate;
    if total_deductions > 10000 {
        msg!("Total of all rates cannot exceed 100% (10000 basis points)");
        return Err(ProgramError::InvalidArgument);
    }
    
    // Update rates
    program_state.lp_contribution_rate = lp_contribution_rate;
    program_state.admin_fee_rate = admin_fee_rate;
    program_state.yos_cashback_rate = yos_cashback_rate;
    program_state.swap_fee_rate = swap_fee_rate;
    program_state.referral_rate = referral_rate;
    
    // Serialize updated program state
    program_state.serialize(&mut &mut program_state_account.data.borrow_mut()[..])?;
    
    msg!("Parameters updated successfully");
    Ok(())
}

// Buy and distribute tokens with YOS cashback
fn process_buy_and_distribute(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Parse accounts
    let user = next_account_info(accounts_iter)?;
    let vault_yot = next_account_info(accounts_iter)?;
    let user_yot = next_account_info(accounts_iter)?;
    let liquidity_yot = next_account_info(accounts_iter)?;
    let yos_mint = next_account_info(accounts_iter)?;
    let user_yos = next_account_info(accounts_iter)?;
    let liquidity_contribution_account = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    let rent_sysvar = next_account_info(accounts_iter)?;
    
    // Verify user is a signer
    if !user.is_signer {
        msg!("User must sign BuyAndDistribute instruction");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Get program state to access rates
    let program_state_account = next_account_info(accounts_iter)?;
    let (expected_program_state, _) = find_program_state_address(program_id);
    if expected_program_state != *program_state_account.key {
        msg!("Invalid program state account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Verify mint addresses
    if program_state.yos_mint != *yos_mint.key {
        msg!("Invalid YOS mint address");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Calculate distribution amounts using rates from program state
    // Default: 75% to user, 20% to liquidity, 5% to YOS cashback
    let liquidity_amount = (amount * program_state.lp_contribution_rate) / 10000; // 20%
    let cashback_amount = (amount * program_state.yos_cashback_rate) / 10000;     // 5%
    let user_amount = amount - liquidity_amount - cashback_amount;                // 75%
    
    msg!("Distribution amounts:");
    msg!("Total: {}", amount);
    msg!("User portion: {}", user_amount);
    msg!("Liquidity portion: {}", liquidity_amount);
    msg!("YOS cashback: {}", cashback_amount);
    
    // Check and initialize liquidity contribution account if needed
    let (expected_liq_contrib, liq_contrib_bump) = find_liquidity_contribution_address(user.key, program_id);
    if expected_liq_contrib != *liquidity_contribution_account.key {
        msg!("Invalid liquidity contribution account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Initialize liquidity contribution account if it doesn't exist
    if liquidity_contribution_account.data_is_empty() {
        msg!("Creating new liquidity contribution account");
        let space = 32 + 8 + 8 + 8 + 8; // pubkey + 4 u64/i64 fields
        let rent = Rent::get()?;
        let rent_lamports = rent.minimum_balance(space);
        
        invoke_signed(
            &system_instruction::create_account(
                user.key,
                liquidity_contribution_account.key,
                rent_lamports,
                space as u64,
                program_id,
            ),
            &[
                user.clone(),
                liquidity_contribution_account.clone(),
                system_program.clone(),
            ],
            &[&[b"liq", user.key.as_ref(), &[liq_contrib_bump]]],
        )?;
    }
    
    // Update liquidity contribution account
    let mut contribution = if liquidity_contribution_account.data_len() > 0 {
        LiquidityContribution::try_from_slice(&liquidity_contribution_account.data.borrow())?
    } else {
        LiquidityContribution::default()
    };
    
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    
    contribution.user = *user.key;
    contribution.contributed_amount += liquidity_amount;
    if contribution.start_timestamp == 0 {
        contribution.start_timestamp = now;
    }
    if contribution.last_claim_time == 0 {
        contribution.last_claim_time = now;
    }
    
    // Serialize the updated contribution data
    contribution.serialize(&mut &mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    // Transfer 75% to user (if needed)
    if user_amount > 0 {
        invoke(
            &token_instruction::transfer(
                token_program.key,
                vault_yot.key,
                user_yot.key,
                user.key,
                &[],
                user_amount,
            )?,
            &[
                vault_yot.clone(),
                user_yot.clone(),
                user.clone(),
                token_program.clone(),
            ],
        )?;
    }
    
    // Transfer 20% to liquidity pool
    if liquidity_amount > 0 {
        invoke(
            &token_instruction::transfer(
                token_program.key,
                vault_yot.key,
                liquidity_yot.key,
                user.key,
                &[],
                liquidity_amount,
            )?,
            &[
                vault_yot.clone(),
                liquidity_yot.clone(),
                user.clone(),
                token_program.clone(),
            ],
        )?;
    }
    
    // Find PDA for mint authority
    let (mint_authority, mint_authority_bump) = Pubkey::find_program_address(
        &[b"authority"],
        program_id,
    );
    
    // Mint 5% YOS as cashback
    if cashback_amount > 0 {
        invoke_signed(
            &token_instruction::mint_to(
                token_program.key,
                yos_mint.key,
                user_yos.key,
                &mint_authority,
                &[],
                cashback_amount,
            )?,
            &[
                yos_mint.clone(),
                user_yos.clone(),
                token_program.clone(),
            ],
            &[&[b"authority", &[mint_authority_bump]]],
        )?;
    }
    
    msg!("Buy and distribute completed successfully");
    Ok(())
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
    
    // Deserialize contribution account
    let mut contribution = LiquidityContribution::try_from_slice(
        &liquidity_contribution_account.data.borrow()
    )?;
    
    // Verify the contribution belongs to the specified user
    if contribution.user != *user_key.key {
        msg!("Contribution account doesn't match the specified user");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check if contribution amount is valid
    if contribution.contributed_amount == 0 {
        msg!("User has no liquidity contribution");
        return Err(ProgramError::InvalidArgument);
    }
    
    // Check if 7 days have passed since last claim
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    
    // 604800 seconds = 7 days
    if now - contribution.last_claim_time < 604800 {
        msg!("Cannot claim rewards yet. Wait 7 days between claims.");
        msg!("Last claim: {}, Now: {}, Diff: {}", 
            contribution.last_claim_time, 
            now, 
            now - contribution.last_claim_time);
        return Err(ProgramError::InvalidArgument);
    }
    
    // Calculate rewards (1/52 of yearly APR, which is 100%)
    // This assumes 100% APR distributed weekly (approximately 1.92% per week)
    // reward = contribution_amount * 0.0192
    let weekly_reward = (contribution.contributed_amount * 192) / 10000;
    
    // Find mint authority PDA for signing
    let (mint_authority, mint_authority_bump) = find_program_authority_address(program_id);
    
    // Mint YOS rewards to user
    invoke_signed(
        &token_instruction::mint_to(
            token_program.key,
            yos_mint.key,
            user_yos.key,
            &mint_authority,
            &[],
            weekly_reward,
        )?,
        &[
            yos_mint.clone(),
            user_yos.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[mint_authority_bump]]],
    )?;
    
    // Update contribution record
    contribution.last_claim_time = now;
    contribution.total_claimed_yos += weekly_reward;
    
    // Serialize the updated contribution data
    contribution.serialize(&mut &mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    msg!("Weekly reward of {} YOS automatically distributed to user {}", weekly_reward, user_key.key);
    Ok(())
}

// Withdraw liquidity contribution
fn process_withdraw_contribution(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
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
        msg!("User must sign WithdrawContribution instruction");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify liquidity contribution account belongs to the user
    let (expected_liq_contrib, _) = find_liquidity_contribution_address(user.key, program_id);
    if expected_liq_contrib != *liquidity_contribution_account.key {
        msg!("Invalid liquidity contribution account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Deserialize contribution account
    let contribution = LiquidityContribution::try_from_slice(
        &liquidity_contribution_account.data.borrow()
    )?;
    
    // Verify the contribution belongs to the user
    if contribution.user != *user.key {
        msg!("Contribution account doesn't match the signer");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check if there's anything to withdraw
    if contribution.contributed_amount == 0 {
        msg!("No contribution to withdraw");
        return Err(ProgramError::InvalidArgument);
    }
    
    // Find program authority PDA for signing
    let (program_authority, program_authority_bump) = find_program_authority_address(program_id);
    
    // Transfer liquidity back to user
    invoke_signed(
        &token_instruction::transfer(
            token_program.key,
            liquidity_yot.key,
            user_yot.key,
            &program_authority,
            &[],
            contribution.contributed_amount,
        )?,
        &[
            liquidity_yot.clone(),
            user_yot.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[program_authority_bump]]],
    )?;
    
    // Zero out the contribution account - don't actually delete it
    let mut zeroed_contribution = LiquidityContribution {
        user: *user.key,
        contributed_amount: 0,
        start_timestamp: contribution.start_timestamp,
        last_claim_time: contribution.last_claim_time,
        total_claimed_yos: contribution.total_claimed_yos,
    };
    
    // Serialize the zeroed contribution data
    zeroed_contribution.serialize(&mut &mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    msg!("Withdrew {} tokens from liquidity contribution", contribution.contributed_amount);
    Ok(())
}