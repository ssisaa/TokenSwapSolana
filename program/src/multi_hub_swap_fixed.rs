use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction,
    sysvar::{rent::Rent, Sysvar, clock::Clock},
};
use borsh::{BorshDeserialize, BorshSerialize};

// Define instruction types
#[derive(BorshSerialize, BorshDeserialize, Debug, PartialEq)]
pub enum MultiHubSwapInstruction {
    Initialize,
    Swap { amount: u64 },
    Contribute { amount: u64 },
    ClaimRewards,
    WithdrawLiquidity,
    UpdateParameters { lp_rate: u64, cashback_rate: u64, admin_fee: u64, swap_fee: u64, referral_rate: u64 },
}

// Program state
#[derive(BorshSerialize, BorshDeserialize, Debug)]
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

impl LiquidityContribution {
    pub const LEN: usize = 32 + 8 + 8 + 8 + 8; // pubkey + u64 + i64 + i64 + u64
}

// Program entrypoint
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    if instruction_data.is_empty() {
        return Err(ProgramError::InvalidInstructionData);
    }

    // Parse instruction type from the first byte
    match instruction_data[0] {
        0 => process_initialize(program_id, accounts, &instruction_data[1..]),
        1 => {
            msg!("Swap Instruction");
            // Extract u64 amount from remaining bytes (must be at least 8 bytes)
            if instruction_data.len() < 9 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let amount = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            process_swap(program_id, accounts, amount)
        },
        2 => {
            msg!("Contribute Instruction");
            if instruction_data.len() < 9 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let amount = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            process_contribute(program_id, accounts, amount)
        },
        3 => process_claim_rewards(program_id, accounts),
        4 => {
            msg!("BuyAndDistribute Instruction");
            if instruction_data.len() < 9 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let amount = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            msg!("BuyAndDistribute amount: {}", amount);
            process_buy_and_distribute(program_id, accounts, amount)
        },
        5 => process_withdraw_liquidity(program_id, accounts),
        6 => {
            if instruction_data.len() < 41 { // 1 + 5 * 8 = 41
                return Err(ProgramError::InvalidInstructionData);
            }
            let lp_rate = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            let cashback_rate = u64::from_le_bytes(instruction_data[9..17].try_into().unwrap());
            let admin_fee = u64::from_le_bytes(instruction_data[17..25].try_into().unwrap());
            let swap_fee = u64::from_le_bytes(instruction_data[25..33].try_into().unwrap());
            let referral_rate = u64::from_le_bytes(instruction_data[33..41].try_into().unwrap());
            
            process_update_parameters(
                program_id, accounts, lp_rate, cashback_rate, admin_fee, swap_fee, referral_rate
            )
        },
        _ => {
            msg!("Error: Unknown instruction");
            Err(ProgramError::InvalidInstructionData)
        }
    }
}

fn find_program_state_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"state"], program_id)
}

fn find_program_authority(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"authority"], program_id)
}

pub fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let admin = next_account_info(accounts_iter)?;
    let program_state_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    
    // Verify admin is a signer
    if !admin.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Check that state PDA is correct
    let (state_pda, state_bump) = find_program_state_address(program_id);
    if state_pda != *program_state_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Parse YOT and YOS mint from data
    if data.len() < 64 {
        return Err(ProgramError::InvalidInstructionData);
    }
    
    let yot_mint = Pubkey::new(&data[0..32]);
    let yos_mint = Pubkey::new(&data[32..64]);
    
    // Create the program state account
    invoke_signed(
        &system_instruction::create_account(
            admin.key,
            program_state_account.key,
            Rent::get()?.minimum_balance(std::mem::size_of::<ProgramState>()),
            std::mem::size_of::<ProgramState>() as u64,
            program_id,
        ),
        &[
            admin.clone(),
            program_state_account.clone(),
            system_program.clone(),
        ],
        &[&[b"state", &[state_bump]]],
    )?;
    
    // Initialize the program state with default values
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
    
    program_state.serialize(&mut *program_state_account.data.borrow_mut())?;
    
    msg!("MultiHubSwap program initialized successfully!");
    Ok(())
}

pub fn process_buy_and_distribute(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Extract account information
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
    let program_state_account = next_account_info(accounts_iter)?;
    
    // Get optional program authority (if provided)
    let program_authority = if accounts_iter.len() > 0 {
        next_account_info(accounts_iter)?
    } else {
        // If not provided, we'll derive it when needed
        user // Placeholder, won't be used directly
    };
    
    // Verify user is a signer
    if !user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Calculate distribution amounts based on percentages
    let user_portion = amount * 75 / 100;  // 75% goes to user
    let liquidity_portion = amount * 20 / 100; // 20% goes to liquidity
    let yos_cashback = amount * 5 / 100;  // 5% goes to YOS cashback

    // Log the distribution amounts for debugging
    msg!("Distribution amounts:");
    msg!("Total: {}", amount);
    msg!("User portion: {}", user_portion);
    msg!("Liquidity portion: {}", liquidity_portion);
    msg!("YOS cashback: {}", yos_cashback);

    // Find the program PDA authority
    let (authority_pda, authority_bump) = find_program_authority(program_id);

    // Create or find liquidity contribution account
    let (contribution_pda, bump_seed) = Pubkey::find_program_address(
        &[b"liq", user.key.as_ref()],
        program_id
    );

    // Verify PDA matches the passed account
    if contribution_pda != *liquidity_contribution_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    // Check if account already exists
    if liquidity_contribution_account.data_is_empty() {
        msg!("Creating new liquidity contribution account");
        // Create account with system program
        invoke_signed(
            &system_instruction::create_account(
                user.key,
                liquidity_contribution_account.key,
                Rent::get()?.minimum_balance(LiquidityContribution::LEN),
                LiquidityContribution::LEN as u64,
                program_id,
            ),
            &[
                user.clone(),
                liquidity_contribution_account.clone(),
                system_program.clone(),
            ],
            &[&[b"liq", user.key.as_ref(), &[bump_seed]]],
        )?;

        // Initialize contribution data
        let mut contribution_data = LiquidityContribution {
            user: *user.key,
            contributed_amount: 0,
            start_timestamp: Clock::get()?.unix_timestamp,
            last_claim_time: Clock::get()?.unix_timestamp,
            total_claimed_yos: 0,
        };
        contribution_data.serialize(&mut *liquidity_contribution_account.data.borrow_mut())?;
    }

    // CRITICAL FIX 1: Use token instruction to transfer tokens
    // Transfer YOT from user to vault
    invoke(
        &spl_token::instruction::transfer(
            token_program.key,
            user_yot.key,
            vault_yot.key,
            user.key,
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

    // CRITICAL FIX 2: Update contribution data with amount added to liquidity
    let mut contribution_data = LiquidityContribution::try_from_slice(&liquidity_contribution_account.data.borrow())?;
    contribution_data.contributed_amount += liquidity_portion;
    contribution_data.serialize(&mut *liquidity_contribution_account.data.borrow_mut())?;

    // CRITICAL FIX 3: Mint YOS cashback tokens directly to user
    invoke_signed(
        &spl_token::instruction::mint_to(
            token_program.key,
            yos_mint.key,
            user_yos.key,
            &authority_pda,
            &[],
            yos_cashback,
        )?,
        &[
            yos_mint.clone(),
            user_yos.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;

    Ok(())
}

// Add stubs for the other functions to make it compile
pub fn process_swap(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
    _amount: u64,
) -> ProgramResult {
    Ok(())
}

pub fn process_contribute(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
    _amount: u64,
) -> ProgramResult {
    Ok(())
}

pub fn process_claim_rewards(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
) -> ProgramResult {
    Ok(())
}

pub fn process_withdraw_liquidity(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
) -> ProgramResult {
    Ok(())
}

pub fn process_update_parameters(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
    _lp_rate: u64,
    _cashback_rate: u64,
    _admin_fee: u64,
    _swap_fee: u64,
    _referral_rate: u64,
) -> ProgramResult {
    Ok(())
}