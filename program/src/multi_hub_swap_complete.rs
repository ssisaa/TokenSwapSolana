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
use arrayref::{array_ref, array_refs, array_mut_ref, mut_array_refs};

// Define the program's entrypoint
entrypoint!(process_instruction);

// Program state with manual serialization
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

impl ProgramState {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8; // 3 pubkeys + 5 u64s
    
    // Manual deserialization
    pub fn unpack(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() < ProgramState::LEN {
            msg!("Program state data too short");
            return Err(ProgramError::InvalidAccountData);
        }

        let data_array = array_ref![data, 0, ProgramState::LEN];
        let (
            admin,
            yot_mint,
            yos_mint,
            lp_contribution_rate,
            admin_fee_rate,
            yos_cashback_rate,
            swap_fee_rate,
            referral_rate,
        ) = array_refs![data_array, 32, 32, 32, 8, 8, 8, 8, 8];

        Ok(Self {
            admin: Pubkey::new_from_array(*admin),
            yot_mint: Pubkey::new_from_array(*yot_mint),
            yos_mint: Pubkey::new_from_array(*yos_mint),
            lp_contribution_rate: u64::from_le_bytes(*lp_contribution_rate),
            admin_fee_rate: u64::from_le_bytes(*admin_fee_rate),
            yos_cashback_rate: u64::from_le_bytes(*yos_cashback_rate),
            swap_fee_rate: u64::from_le_bytes(*swap_fee_rate),
            referral_rate: u64::from_le_bytes(*referral_rate),
        })
    }

    // Manual serialization
    pub fn pack(&self, dst: &mut [u8]) -> Result<(), ProgramError> {
        if dst.len() < ProgramState::LEN {
            msg!("Destination buffer too small for ProgramState");
            return Err(ProgramError::InvalidAccountData);
        }

        let dst_array = array_mut_ref![dst, 0, ProgramState::LEN];
        let (
            admin_dst,
            yot_mint_dst,
            yos_mint_dst,
            lp_contribution_rate_dst,
            admin_fee_rate_dst,
            yos_cashback_rate_dst,
            swap_fee_rate_dst,
            referral_rate_dst,
        ) = mut_array_refs![dst_array, 32, 32, 32, 8, 8, 8, 8, 8];

        admin_dst.copy_from_slice(self.admin.as_ref());
        yot_mint_dst.copy_from_slice(self.yot_mint.as_ref());
        yos_mint_dst.copy_from_slice(self.yos_mint.as_ref());
        *lp_contribution_rate_dst = self.lp_contribution_rate.to_le_bytes();
        *admin_fee_rate_dst = self.admin_fee_rate.to_le_bytes();
        *yos_cashback_rate_dst = self.yos_cashback_rate.to_le_bytes();
        *swap_fee_rate_dst = self.swap_fee_rate.to_le_bytes();
        *referral_rate_dst = self.referral_rate.to_le_bytes();

        Ok(())
    }
}

// Liquidity contribution tracking with manual serialization
pub struct LiquidityContribution {
    pub user: Pubkey,
    pub contributed_amount: u64,
    pub start_timestamp: i64,
    pub last_claim_time: i64,
    pub total_claimed_yos: u64,
}

impl LiquidityContribution {
    pub const LEN: usize = 32 + 8 + 8 + 8 + 8; // pubkey + u64 + i64 + i64 + u64
    
    // Manual deserialization
    pub fn unpack(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() < LiquidityContribution::LEN {
            msg!("Liquidity contribution data too short");
            return Err(ProgramError::InvalidAccountData);
        }

        let data_array = array_ref![data, 0, LiquidityContribution::LEN];
        let (
            user,
            contributed_amount,
            start_timestamp,
            last_claim_time,
            total_claimed_yos,
        ) = array_refs![data_array, 32, 8, 8, 8, 8];

        Ok(Self {
            user: Pubkey::new_from_array(*user),
            contributed_amount: u64::from_le_bytes(*contributed_amount),
            start_timestamp: i64::from_le_bytes(*start_timestamp),
            last_claim_time: i64::from_le_bytes(*last_claim_time),
            total_claimed_yos: u64::from_le_bytes(*total_claimed_yos),
        })
    }

    // Manual serialization
    pub fn pack(&self, dst: &mut [u8]) -> Result<(), ProgramError> {
        if dst.len() < LiquidityContribution::LEN {
            msg!("Destination buffer too small for LiquidityContribution");
            return Err(ProgramError::InvalidAccountData);
        }

        let dst_array = array_mut_ref![dst, 0, LiquidityContribution::LEN];
        let (
            user_dst,
            contributed_amount_dst,
            start_timestamp_dst,
            last_claim_time_dst,
            total_claimed_yos_dst,
        ) = mut_array_refs![dst_array, 32, 8, 8, 8, 8];

        user_dst.copy_from_slice(self.user.as_ref());
        *contributed_amount_dst = self.contributed_amount.to_le_bytes();
        *start_timestamp_dst = self.start_timestamp.to_le_bytes();
        *last_claim_time_dst = self.last_claim_time.to_le_bytes();
        *total_claimed_yos_dst = self.total_claimed_yos.to_le_bytes();

        Ok(())
    }
}

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
    
    let yot_mint = Pubkey::from(<[u8; 32]>::try_from(&data[0..32]).unwrap());
    let yos_mint = Pubkey::from(<[u8; 32]>::try_from(&data[32..64]).unwrap());
    
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
    
    program_state.pack(&mut program_state_account.data.borrow_mut()[..])?;
    
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
    let _liquidity_yot = next_account_info(accounts_iter)?;
    let yos_mint = next_account_info(accounts_iter)?;
    let user_yos = next_account_info(accounts_iter)?;
    let liquidity_contribution_account = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    let _rent_sysvar = next_account_info(accounts_iter)?;
    let _program_state_account = next_account_info(accounts_iter)?;
    
    // Get optional program authority (if provided)
    let _program_authority_account = if accounts_iter.len() > 0 {
        next_account_info(accounts_iter)?
    } else {
        // If not provided, we'll derive it when needed
        user // Placeholder, won't be used directly
    };
    
    // Get optional pool authority (if provided)
    let _pool_authority = if accounts_iter.len() > 0 {
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
        let contribution_data = LiquidityContribution {
            user: *user.key,
            contributed_amount: 0,
            start_timestamp: Clock::get()?.unix_timestamp,
            last_claim_time: Clock::get()?.unix_timestamp,
            total_claimed_yos: 0,
        };
        contribution_data.pack(&mut liquidity_contribution_account.data.borrow_mut()[..])?;
    }

    // CRITICAL FIX 1: Use token instruction to transfer tokens
    // Transfer YOT from user to vault
    msg!("Transferring {} YOT from user to vault", amount);
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
    msg!("Updating liquidity contribution with {} YOT", liquidity_portion);
    let mut contribution_data = LiquidityContribution::unpack(&liquidity_contribution_account.data.borrow())?;
    contribution_data.contributed_amount += liquidity_portion;
    contribution_data.pack(&mut liquidity_contribution_account.data.borrow_mut()[..])?;

    // CRITICAL FIX 3: Mint YOS cashback tokens directly to user
    msg!("Minting {} YOS cashback tokens to user", yos_cashback);
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

    msg!("BuyAndDistribute completed successfully!");
    Ok(())
}

pub fn process_claim_rewards(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Extract necessary accounts
    let caller = next_account_info(accounts_iter)?;
    let user = next_account_info(accounts_iter)?;
    let liquidity_contribution_account = next_account_info(accounts_iter)?;
    let yos_mint = next_account_info(accounts_iter)?;
    let user_yos = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    
    // Verify caller is signer
    if !caller.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify liquidity contribution PDA
    let (contribution_pda, _) = Pubkey::find_program_address(
        &[b"liq", user.key.as_ref()],
        program_id
    );
    
    if contribution_pda != *liquidity_contribution_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Read contribution data
    let mut contribution_data = LiquidityContribution::unpack(
        &liquidity_contribution_account.data.borrow()
    )?;
    
    // Make sure user matches the contribution account
    if contribution_data.user != *user.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Make sure there's a contribution amount
    if contribution_data.contributed_amount == 0 {
        return Err(ProgramError::InsufficientFunds);
    }
    
    // Check if enough time has passed for rewards (7 days = 604,800 seconds)
    let current_time = Clock::get()?.unix_timestamp;
    let time_since_last_claim = current_time - contribution_data.last_claim_time;
    
    if time_since_last_claim < 604_800 {
        msg!("Cannot claim rewards yet. Must wait 7 days between claims.");
        return Err(ProgramError::InvalidArgument);
    }
    
    // Calculate rewards: roughly 2% weekly (100% APR / 52 weeks)
    let weekly_rate = 2;  // 2% weekly
    let reward_amount = contribution_data.contributed_amount * weekly_rate / 100;
    
    // Find program authority
    let (authority_pda, authority_bump) = find_program_authority(program_id);
    
    // Mint YOS rewards to user
    invoke_signed(
        &spl_token::instruction::mint_to(
            token_program.key,
            yos_mint.key,
            user_yos.key,
            &authority_pda,
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
    
    // Update contribution data
    contribution_data.last_claim_time = current_time;
    contribution_data.total_claimed_yos += reward_amount;
    contribution_data.pack(&mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    msg!("Weekly rewards claimed successfully: {} YOS", reward_amount);
    Ok(())
}

pub fn process_withdraw_liquidity(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Extract accounts
    let user = next_account_info(accounts_iter)?;
    let liquidity_contribution_account = next_account_info(accounts_iter)?;
    let vault_yot = next_account_info(accounts_iter)?;
    let user_yot = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    
    // Verify user is signer
    if !user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify liquidity contribution PDA
    let (contribution_pda, _) = Pubkey::find_program_address(
        &[b"liq", user.key.as_ref()],
        program_id
    );
    
    if contribution_pda != *liquidity_contribution_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Read contribution data
    let mut contribution_data = LiquidityContribution::unpack(
        &liquidity_contribution_account.data.borrow()
    )?;
    
    // Make sure user matches the contribution account
    if contribution_data.user != *user.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Make sure there's a contribution amount
    if contribution_data.contributed_amount == 0 {
        return Err(ProgramError::InsufficientFunds);
    }
    
    let amount_to_withdraw = contribution_data.contributed_amount;
    
    // Get program authority
    let (authority_pda, authority_bump) = find_program_authority(program_id);
    
    // Transfer YOT from vault back to user
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            vault_yot.key,
            user_yot.key,
            &authority_pda,
            &[],
            amount_to_withdraw,
        )?,
        &[
            vault_yot.clone(),
            user_yot.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Reset contribution amount
    contribution_data.contributed_amount = 0;
    contribution_data.pack(&mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    msg!("Liquidity withdrawn successfully: {} YOT", amount_to_withdraw);
    Ok(())
}

// Basic implementation of token swap
pub fn process_swap(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Parse accounts
    let user = next_account_info(accounts_iter)?;
    let source_token = next_account_info(accounts_iter)?;
    let destination_token = next_account_info(accounts_iter)?;
    let user_source = next_account_info(accounts_iter)?;
    let user_destination = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    
    // Verify user is a signer
    if !user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Find program authority
    let (program_authority, authority_bump) = Pubkey::find_program_address(
        &[b"authority"], program_id
    );
    
    // Transfer user's tokens to the source pool
    invoke(
        &spl_token::instruction::transfer(
            token_program.key,
            user_source.key,
            source_token.key,
            user.key,
            &[],
            amount,
        )?,
        &[
            user_source.clone(),
            source_token.clone(),
            user.clone(),
            token_program.clone(),
        ],
    )?;
    
    // Simple 1:1 swap for demonstration
    // In a real implementation, this would use price oracle or pool ratio
    let swap_amount = amount;
    
    // Transfer tokens from destination pool to user
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            destination_token.key,
            user_destination.key,
            &program_authority,
            &[],
            swap_amount,
        )?,
        &[
            destination_token.clone(),
            user_destination.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    msg!("Swap successful: {} tokens", amount);
    Ok(())
}

// Direct contribution to liquidity pool
pub fn process_contribute(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Parse accounts
    let user = next_account_info(accounts_iter)?;
    let user_token = next_account_info(accounts_iter)?;
    let liquidity_token = next_account_info(accounts_iter)?;
    let liquidity_contribution_account = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    
    // Verify user is a signer
    if !user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify liquidity contribution account
    let (expected_liq_contrib, bump_seed) = Pubkey::find_program_address(
        &[b"liq", user.key.as_ref()],
        program_id
    );
    
    if expected_liq_contrib != *liquidity_contribution_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Create account if it doesn't exist
    if liquidity_contribution_account.data_is_empty() {
        msg!("Creating new liquidity contribution account");
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
        let contribution = LiquidityContribution {
            user: *user.key,
            contributed_amount: 0,
            start_timestamp: Clock::get()?.unix_timestamp,
            last_claim_time: Clock::get()?.unix_timestamp,
            total_claimed_yos: 0,
        };
        contribution.pack(&mut liquidity_contribution_account.data.borrow_mut()[..])?;
    }
    
    // Load contribution data
    let mut contribution = LiquidityContribution::unpack(&liquidity_contribution_account.data.borrow())?;
    
    // Verify user ownership
    if contribution.user != *user.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Transfer tokens from user to liquidity pool
    invoke(
        &spl_token::instruction::transfer(
            token_program.key,
            user_token.key,
            liquidity_token.key,
            user.key,
            &[],
            amount,
        )?,
        &[
            user_token.clone(),
            liquidity_token.clone(),
            user.clone(),
            token_program.clone(),
        ],
    )?;
    
    // Update contribution amount
    contribution.contributed_amount += amount;
    contribution.pack(&mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    msg!("Contribution successful: {} tokens", amount);
    Ok(())
}

pub fn process_update_parameters(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    lp_rate: u64,
    cashback_rate: u64,
    admin_fee: u64,
    swap_fee: u64,
    referral_rate: u64,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Parse accounts
    let admin = next_account_info(accounts_iter)?;
    let program_state_account = next_account_info(accounts_iter)?;
    
    // Verify admin is a signer
    if !admin.is_signer {
        msg!("Error: Admin must sign parameter update instruction");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify program state account
    let (state_pda, _) = Pubkey::find_program_address(&[b"state"], program_id);
    if state_pda != *program_state_account.key {
        msg!("Error: Invalid program state account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Load existing program state
    let mut state = ProgramState::unpack(&program_state_account.data.borrow())?;
    
    // Verify caller is admin
    if state.admin != *admin.key {
        msg!("Error: Only admin can update parameters");
        return Err(ProgramError::InvalidArgument);
    }
    
    // Validate parameters
    if lp_rate > 100 || cashback_rate > 100 || admin_fee > 100 || 
       swap_fee > 100 || referral_rate > 100 {
        msg!("Error: All rates must be between 0-100 (percentage)");
        return Err(ProgramError::InvalidArgument);
    }
    
    // Check that total doesn't exceed 100%
    if lp_rate + cashback_rate + admin_fee > 100 {
        msg!("Error: Total of lp_rate + cashback_rate + admin_fee cannot exceed 100%");
        return Err(ProgramError::InvalidArgument);
    }
    
    // Update parameters
    state.lp_contribution_rate = lp_rate;
    state.yos_cashback_rate = cashback_rate;
    state.admin_fee_rate = admin_fee;
    state.swap_fee_rate = swap_fee;
    state.referral_rate = referral_rate;
    
    // Save updated state
    state.pack(&mut program_state_account.data.borrow_mut()[..])?;
    
    // Log successful update
    msg!("✅ Program parameters updated successfully:");
    msg!("- LP contribution rate: {}%", lp_rate);
    msg!("- YOS cashback rate: {}%", cashback_rate);
    msg!("- Admin fee rate: {}%", admin_fee);
    msg!("- Swap fee rate: {}%", swap_fee);
    msg!("- Referral rate: {}%", referral_rate);
    
    Ok(())
}