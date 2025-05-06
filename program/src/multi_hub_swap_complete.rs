use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack, // Added Pack trait
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
    pub lp_contribution_rate: u64,     // Rate for liquidity contribution (20%)
    pub admin_fee_rate: u64,           // Admin fee rate (0%)
    pub yos_cashback_rate: u64,        // YOS cashback rate (5%)
    pub swap_fee_rate: u64,            // Swap fee rate (1%)
    pub referral_rate: u64,            // Referral rate (0%)
    pub liquidity_wallet: Pubkey,      // Central liquidity wallet
    pub liquidity_threshold: u64,      // Threshold for auto LP addition (in lamports, e.g., 0.1 SOL = 100,000,000 lamports)
}

impl ProgramState {
    // Updated LEN to account for the additional Pubkey and u64
    pub const LEN: usize = 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 32 + 8; // 4 pubkeys + 6 u64s
    
    // Manual deserialization with backward compatibility handling
    pub fn unpack(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() < Self::LEN {
            // Handle older program state format (backward compatibility)
            msg!("Program state data too short (old format detected)");
            
            // Check if it's a valid older format (without liquidity_wallet and liquidity_threshold)
            let old_len = 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8; // 3 pubkeys + 5 u64s
            
            if data.len() < old_len {
                msg!("ERROR: Data too short even for old format: {} bytes", data.len());
                return Err(ProgramError::InvalidAccountData);
            }
            
            let data_old = array_ref![data, 0, old_len];
            let (
                admin, 
                yot_mint, 
                yos_mint,
                lp_contribution_rate,
                admin_fee_rate,
                yos_cashback_rate,
                swap_fee_rate,
                referral_rate
            ) = array_refs![data_old, 32, 32, 32, 8, 8, 8, 8, 8];
            
            // Return a default program state with old data + default values for new fields
            msg!("Using old format data + default values for new fields");
            return Ok(Self {
                admin: Pubkey::new_from_array(*admin),
                yot_mint: Pubkey::new_from_array(*yot_mint),
                yos_mint: Pubkey::new_from_array(*yos_mint),
                lp_contribution_rate: u64::from_le_bytes(*lp_contribution_rate),
                admin_fee_rate: u64::from_le_bytes(*admin_fee_rate),
                yos_cashback_rate: u64::from_le_bytes(*yos_cashback_rate),
                swap_fee_rate: u64::from_le_bytes(*swap_fee_rate),
                referral_rate: u64::from_le_bytes(*referral_rate),
                // Default values for new fields
                liquidity_wallet: Pubkey::default(), // Will be updated in process_repair_program_state
                liquidity_threshold: 100000000,      // Default 0.1 SOL
            });
        }

        // Normal unpacking for current version
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
            liquidity_wallet,
            liquidity_threshold,
        ) = array_refs![data_array, 32, 32, 32, 8, 8, 8, 8, 8, 32, 8];

        Ok(Self {
            admin: Pubkey::new_from_array(*admin),
            yot_mint: Pubkey::new_from_array(*yot_mint),
            yos_mint: Pubkey::new_from_array(*yos_mint),
            lp_contribution_rate: u64::from_le_bytes(*lp_contribution_rate),
            admin_fee_rate: u64::from_le_bytes(*admin_fee_rate),
            yos_cashback_rate: u64::from_le_bytes(*yos_cashback_rate),
            swap_fee_rate: u64::from_le_bytes(*swap_fee_rate),
            referral_rate: u64::from_le_bytes(*referral_rate),
            liquidity_wallet: Pubkey::new_from_array(*liquidity_wallet),
            liquidity_threshold: u64::from_le_bytes(*liquidity_threshold),
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
            liquidity_wallet_dst,
            liquidity_threshold_dst,
        ) = mut_array_refs![dst_array, 32, 32, 32, 8, 8, 8, 8, 8, 32, 8];

        admin_dst.copy_from_slice(self.admin.as_ref());
        yot_mint_dst.copy_from_slice(self.yot_mint.as_ref());
        yos_mint_dst.copy_from_slice(self.yos_mint.as_ref());
        *lp_contribution_rate_dst = self.lp_contribution_rate.to_le_bytes();
        *admin_fee_rate_dst = self.admin_fee_rate.to_le_bytes();
        *yos_cashback_rate_dst = self.yos_cashback_rate.to_le_bytes();
        *swap_fee_rate_dst = self.swap_fee_rate.to_le_bytes();
        *referral_rate_dst = self.referral_rate.to_le_bytes();
        liquidity_wallet_dst.copy_from_slice(self.liquidity_wallet.as_ref());
        *liquidity_threshold_dst = self.liquidity_threshold.to_le_bytes();

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
        6 => {
            msg!("Repair Program State Instruction");
            if instruction_data.len() < 41 { // 1 + 5 * 8 = 41
                return Err(ProgramError::InvalidInstructionData);
            }
            
            // Extract parameters for repairing the program state
            let lp_rate = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            let cashback_rate = u64::from_le_bytes(instruction_data[9..17].try_into().unwrap());
            let admin_fee = u64::from_le_bytes(instruction_data[17..25].try_into().unwrap());
            let swap_fee = u64::from_le_bytes(instruction_data[25..33].try_into().unwrap());
            let yos_display = u64::from_le_bytes(instruction_data[33..41].try_into().unwrap());
            
            // If there are additional 8 bytes, extract liquidity threshold
            let threshold = if instruction_data.len() >= 49 {
                u64::from_le_bytes(instruction_data[41..49].try_into().unwrap())
            } else {
                100000000 // Default 0.1 SOL if not provided
            };
            
            process_repair_program_state(
                program_id, accounts, lp_rate, cashback_rate, admin_fee, swap_fee, yos_display, threshold
            )
        },
        7 => {
            msg!("Create Liquidity Account Instruction");
            // This instruction only creates the liquidity contribution account to avoid the "account already borrowed" error
            // Will be used as a first step before any swap instruction that requires the account
            process_create_liquidity_account(program_id, accounts)
        },
        8 => {
            msg!("SOL to YOT Swap Instruction (One Step)");
            if instruction_data.len() < 17 {
                msg!("Error: Instruction data too short for SOL to YOT swap");
                return Err(ProgramError::InvalidInstructionData);
            }
            
            let amount_in = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            let min_amount_out = u64::from_le_bytes(instruction_data[9..17].try_into().unwrap());
            
            msg!("SOL amount in: {}, Min YOT out: {}", amount_in, min_amount_out);
            // Call a modified version of SOL to YOT swap that doesn't recreate the account
            process_sol_to_yot_swap_immediate(program_id, accounts, amount_in, min_amount_out)
        },
        9 => {
            msg!("YOT to SOL Swap Instruction (One Step)");
            if instruction_data.len() < 17 {
                msg!("Error: Instruction data too short for YOT to SOL swap");
                return Err(ProgramError::InvalidInstructionData);
            }
            
            let amount_in = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            let min_amount_out = u64::from_le_bytes(instruction_data[9..17].try_into().unwrap());
            
            msg!("YOT amount in: {}, Min SOL out: {}", amount_in, min_amount_out);
            process_yot_to_sol_swap_immediate(program_id, accounts, amount_in, min_amount_out)
        },
        10 => {
            msg!("SOL to YOT Swap Instruction (Original)");
            // We need amount_in and min_amount_out (2 u64s = 16 bytes)
            if instruction_data.len() < 17 { // 1 + 8 + 8 = 17 bytes
                msg!("Error: Instruction data too short for SOL to YOT swap");
                return Err(ProgramError::InvalidInstructionData);
            }
            
            let amount_in = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            let min_amount_out = u64::from_le_bytes(instruction_data[9..17].try_into().unwrap());
            
            msg!("SOL amount in: {}, Min YOT out: {}", amount_in, min_amount_out);
            process_sol_to_yot_swap(program_id, accounts, amount_in, min_amount_out)
        },
        11 => {
            msg!("Add Liquidity From Central Wallet Instruction");
            process_add_liquidity_from_central_wallet(program_id, accounts)
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
    let liquidity_wallet = next_account_info(accounts_iter)?;  // New: central liquidity wallet
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
            Rent::get()?.minimum_balance(ProgramState::LEN), // Use the updated LEN
            ProgramState::LEN as u64,
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
        lp_contribution_rate: 20,        // 20%
        admin_fee_rate: 0,               // 0%
        yos_cashback_rate: 5,            // 5%
        swap_fee_rate: 1,                // 1%
        referral_rate: 0,                // 0%
        liquidity_wallet: *liquidity_wallet.key, // Use provided liquidity wallet
        liquidity_threshold: 100_000_000, // Default: 0.1 SOL (100,000,000 lamports)
    };
    
    program_state.pack(&mut program_state_account.data.borrow_mut()[..])?;
    
    msg!("MultiHubSwap program initialized successfully!");
    msg!("Central liquidity wallet: {}", liquidity_wallet.key);
    msg!("Liquidity threshold: {} lamports", program_state.liquidity_threshold);
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

// New function to handle SOL to YOT swap
pub fn process_sol_to_yot_swap(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount_in: u64,
    min_amount_out: u64,
) -> ProgramResult {
    msg!("Processing SOL to YOT swap");
    msg!("Amount in: {} lamports", amount_in);
    msg!("Minimum amount out: {} YOT", min_amount_out);
    
    let accounts_iter = &mut accounts.iter();
    
    // Parse accounts
    let user_account = next_account_info(accounts_iter)?;                 // User's wallet
    let program_state_account = next_account_info(accounts_iter)?;        // Program state
    let program_authority = next_account_info(accounts_iter)?;            // Program authority PDA
    let sol_pool_account = next_account_info(accounts_iter)?;             // SOL pool account
    let yot_pool_account = next_account_info(accounts_iter)?;             // YOT token pool account
    let user_yot_account = next_account_info(accounts_iter)?;             // User's YOT token account
    let liquidity_contribution_account = next_account_info(accounts_iter)?; // Liquidity contribution account
    let yos_mint = next_account_info(accounts_iter)?;                     // YOS mint
    let user_yos_account = next_account_info(accounts_iter)?;             // User's YOS token account
    let system_program = next_account_info(accounts_iter)?;               // System program
    let token_program = next_account_info(accounts_iter)?;                // Token program
    let _rent = next_account_info(accounts_iter)?;                        // Rent sysvar
    
    // Verify user is a signer
    if !user_account.is_signer {
        msg!("Error: User must sign the transaction");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify PDAs
    let (expected_program_state, _) = find_program_state_address(program_id);
    if expected_program_state != *program_state_account.key {
        msg!("Error: Invalid program state account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    let (expected_program_authority, authority_bump) = find_program_authority(program_id);
    if expected_program_authority != *program_authority.key {
        msg!("Error: Invalid program authority account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Load program state
    let program_state = ProgramState::unpack(&program_state_account.data.borrow())?;
    
    // Verify YOT mint in program state matches the pool's YOT token mint
    // This would require accessing the token account's mint, omitted for brevity
    
    // Step 1: Transfer SOL from user to pool
    msg!("Transferring {} lamports SOL from user to pool", amount_in);
    invoke(
        &system_instruction::transfer(
            user_account.key,
            sol_pool_account.key,
            amount_in,
        ),
        &[
            user_account.clone(),
            sol_pool_account.clone(),
            system_program.clone(),
        ],
    )?;
    
    // Step 2: Calculate YOT amount to return
    // For real implementation, use actual pool balances or oracle price
    // For now, using a simple approximation (can be enhanced with actual AMM formula)
    let sol_pool_balance = sol_pool_account.lamports();
    let mut yot_pool_data = yot_pool_account.data.borrow();
    let yot_pool_token_account = spl_token::state::Account::unpack(&yot_pool_data)?;
    let yot_pool_balance = yot_pool_token_account.amount;
    
    // Simple pool-based price calculation (modify with your desired formula)
    // This is a simplified constant product AMM formula
    let sol_balance_before = sol_pool_balance.checked_sub(amount_in).unwrap_or(1);
    let yot_amount_out = (amount_in as u128)
        .checked_mul(yot_pool_balance as u128).unwrap_or(0)
        .checked_div(sol_balance_before as u128).unwrap_or(0) as u64;
    
    msg!("Calculated YOT output: {}", yot_amount_out);
    
    // Ensure we meet minimum amount out
    if yot_amount_out < min_amount_out {
        msg!("Error: Insufficient output amount. Expected at least {}, got {}", 
            min_amount_out, yot_amount_out);
        return Err(ProgramError::InvalidArgument);
    }
    
    // Apply distribution rates
    let user_portion = yot_amount_out * 75 / 100;  // 75% to user directly
    let liquidity_portion = yot_amount_out * 20 / 100;  // 20% to liquidity contribution
    let yos_cashback = yot_amount_out * 5 / 100;  // 5% equivalent as YOS tokens
    
    msg!("Distribution: User: {}, Liquidity: {}, YOS Cashback: {}", 
        user_portion, liquidity_portion, yos_cashback);
    
    // Step 3: Create or update liquidity contribution account
    let (expected_liq_contrib, liq_bump) = Pubkey::find_program_address(
        &[b"liq", user_account.key.as_ref()],
        program_id
    );
    
    if expected_liq_contrib != *liquidity_contribution_account.key {
        msg!("Error: Invalid liquidity contribution account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Create account if it doesn't exist
    if liquidity_contribution_account.data_is_empty() {
        msg!("Creating new liquidity contribution account");
        invoke_signed(
            &system_instruction::create_account(
                user_account.key,
                liquidity_contribution_account.key,
                Rent::get()?.minimum_balance(LiquidityContribution::LEN),
                LiquidityContribution::LEN as u64,
                program_id,
            ),
            &[
                user_account.clone(),
                liquidity_contribution_account.clone(),
                system_program.clone(),
            ],
            &[&[b"liq", user_account.key.as_ref(), &[liq_bump]]],
        )?;
        
        // Initialize contribution data
        let contribution = LiquidityContribution {
            user: *user_account.key,
            contributed_amount: 0,
            start_timestamp: Clock::get()?.unix_timestamp,
            last_claim_time: Clock::get()?.unix_timestamp,
            total_claimed_yos: 0,
        };
        contribution.pack(&mut liquidity_contribution_account.data.borrow_mut()[..])?;
    }
    
    // Update contribution amount
    let mut contribution = LiquidityContribution::unpack(&liquidity_contribution_account.data.borrow())?;
    contribution.contributed_amount = contribution.contributed_amount.checked_add(liquidity_portion).unwrap_or(contribution.contributed_amount);
    contribution.pack(&mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    // Step 4: Transfer YOT tokens to user (use PDA authority)
    msg!("Transferring {} YOT tokens to user", user_portion);
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            yot_pool_account.key,
            user_yot_account.key,
            program_authority.key,
            &[],
            user_portion,
        )?,
        &[
            yot_pool_account.clone(),
            user_yot_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Step 5: Mint YOS cashback tokens to user
    msg!("Minting {} YOS tokens as cashback", yos_cashback);
    invoke_signed(
        &spl_token::instruction::mint_to(
            token_program.key,
            yos_mint.key,
            user_yos_account.key,
            program_authority.key,
            &[],
            yos_cashback,
        )?,
        &[
            yos_mint.clone(),
            user_yos_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    msg!("SOL to YOT swap completed successfully!");
    msg!("User received: {} YOT + {} YOS cashback", user_portion, yos_cashback);
    msg!("Liquidity contribution: {} YOT", liquidity_portion);
    
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

/// Calculate token balance from a token account
/// This simple helper reduces boilerplate when checking token balances
pub fn get_token_balance(token_account: &AccountInfo) -> Result<u64, ProgramError> {
    let data = token_account.data.borrow();
    let token_account = spl_token::state::Account::unpack(&data)?;
    Ok(token_account.amount)
}

/// Create liquidity contribution account only
/// This is a separate instruction to avoid the "account already borrowed" error
/// Call this before attempting a swap if the user doesn't have a liquidity contribution account yet
pub fn process_create_liquidity_account(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    msg!("Processing create liquidity contribution account");
    
    let accounts_iter = &mut accounts.iter();
    
    // Parse accounts
    let user_account = next_account_info(accounts_iter)?;                 // User's wallet
    let liquidity_contribution_account = next_account_info(accounts_iter)?; // Liquidity contribution account
    let system_program = next_account_info(accounts_iter)?;               // System program
    
    // Verify user is a signer
    if !user_account.is_signer {
        msg!("Error: User must sign the transaction");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Check if the account is already created
    if !liquidity_contribution_account.data_is_empty() {
        msg!("Liquidity contribution account already exists");
        return Ok(());
    }
    
    // Verify PDA is correct
    let (expected_liq_contrib, liq_bump) = Pubkey::find_program_address(
        &[b"liq", user_account.key.as_ref()],
        program_id
    );
    
    if expected_liq_contrib != *liquidity_contribution_account.key {
        msg!("Error: Invalid liquidity contribution account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Create account
    msg!("Creating new liquidity contribution account");
    invoke_signed(
        &system_instruction::create_account(
            user_account.key,
            liquidity_contribution_account.key,
            Rent::get()?.minimum_balance(LiquidityContribution::LEN),
            LiquidityContribution::LEN as u64,
            program_id,
        ),
        &[
            user_account.clone(),
            liquidity_contribution_account.clone(),
            system_program.clone(),
        ],
        &[&[b"liq", user_account.key.as_ref(), &[liq_bump]]],
    )?;
    
    // Initialize contribution data
    let contribution = LiquidityContribution {
        user: *user_account.key,
        contributed_amount: 0,
        start_timestamp: Clock::get()?.unix_timestamp,
        last_claim_time: Clock::get()?.unix_timestamp,
        total_claimed_yos: 0,
    };
    contribution.pack(&mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    msg!("Liquidity contribution account created successfully!");
    Ok(())
}

/// Process SOL to YOT swap with pre-created liquidity contribution account
/// This version assumes the liquidity contribution account was already created
/// in a separate transaction to avoid the "account already borrowed" error
pub fn process_sol_to_yot_swap_immediate(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount_in: u64,
    min_amount_out: u64,
) -> ProgramResult {
    msg!("Processing SOL to YOT swap (immediate version)");
    msg!("Amount in: {} lamports", amount_in);
    msg!("Minimum amount out: {} YOT", min_amount_out);
    
    let accounts_iter = &mut accounts.iter();
    
    // Parse accounts - with new central liquidity wallet
    let user_account = next_account_info(accounts_iter)?;                 // User's wallet
    let program_state_account = next_account_info(accounts_iter)?;        // Program state
    let program_authority = next_account_info(accounts_iter)?;            // Program authority PDA
    let sol_pool_account = next_account_info(accounts_iter)?;             // SOL pool account
    let yot_pool_account = next_account_info(accounts_iter)?;             // YOT token pool account
    let user_yot_account = next_account_info(accounts_iter)?;             // User's YOT token account
    let central_liquidity_wallet = next_account_info(accounts_iter)?;     // Central liquidity wallet
    let liquidity_contribution_account = next_account_info(accounts_iter)?; // Liquidity contribution account (for tracking)
    let yos_mint = next_account_info(accounts_iter)?;                     // YOS mint
    let user_yos_account = next_account_info(accounts_iter)?;             // User's YOS token account
    let system_program = next_account_info(accounts_iter)?;               // System program
    let token_program = next_account_info(accounts_iter)?;                // Token program
    let _rent = next_account_info(accounts_iter)?;                        // Rent sysvar
    
    // Verify user is a signer
    if !user_account.is_signer {
        msg!("Error: User must sign the transaction");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify PDAs
    let (expected_program_state, _) = find_program_state_address(program_id);
    if expected_program_state != *program_state_account.key {
        msg!("Error: Invalid program state account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    let (expected_program_authority, authority_bump) = find_program_authority(program_id);
    if expected_program_authority != *program_authority.key {
        msg!("Error: Invalid program authority account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Load program state
    let program_state = ProgramState::unpack(&program_state_account.data.borrow())?;
    
    // Verify central liquidity wallet matches program state
    if program_state.liquidity_wallet != *central_liquidity_wallet.key {
        msg!("Error: Invalid central liquidity wallet account");
        msg!("Expected: {}", program_state.liquidity_wallet);
        msg!("Provided: {}", central_liquidity_wallet.key);
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Verify the liquidity contribution account is the correct PDA
    let (expected_liq_contrib, liq_contrib_bump) = Pubkey::find_program_address(
        &[b"liq", user_account.key.as_ref()],
        program_id
    );
    
    if expected_liq_contrib != *liquidity_contribution_account.key {
        msg!("Error: Invalid liquidity contribution account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Step 1: Transfer SOL from user to pool
    msg!("Transferring {} lamports SOL from user to pool", amount_in);
    invoke(
        &system_instruction::transfer(
            user_account.key,
            sol_pool_account.key,
            amount_in,
        ),
        &[
            user_account.clone(),
            sol_pool_account.clone(),
            system_program.clone(),
        ],
    )?;
    
    // Step 2: Calculate YOT amount to return (using the same AMM formula)
    let sol_pool_balance = sol_pool_account.lamports();
    let mut yot_pool_data = yot_pool_account.data.borrow();
    let yot_pool_token_account = spl_token::state::Account::unpack(&yot_pool_data)?;
    let yot_pool_balance = yot_pool_token_account.amount;
    
    // Simple pool-based price calculation (constant product AMM formula)
    let sol_balance_before = sol_pool_balance.checked_sub(amount_in).unwrap_or(1);
    let yot_amount_out = (amount_in as u128)
        .checked_mul(yot_pool_balance as u128).unwrap_or(0)
        .checked_div(sol_balance_before as u128).unwrap_or(0) as u64;
    
    msg!("Calculated YOT output: {}", yot_amount_out);
    
    // Ensure we meet minimum amount out
    if yot_amount_out < min_amount_out {
        msg!("Error: Insufficient output amount. Expected at least {}, got {}", 
            min_amount_out, yot_amount_out);
        return Err(ProgramError::InvalidArgument);
    }
    
    // Apply distribution rates 
    let user_portion = yot_amount_out * 80 / 100;  // 80% to user directly
    let liquidity_portion = yot_amount_out * 20 / 100;  // 20% to central liquidity wallet
    let yos_cashback = yot_amount_out * 5 / 100;  // 5% equivalent as YOS tokens
    
    msg!("Distribution: User: {}, Liquidity: {}, YOS Cashback: {}", 
        user_portion, liquidity_portion, yos_cashback);
    
    // Step 3: Create liquidity contribution account if needed for tracking
    if liquidity_contribution_account.data_is_empty() {
        msg!("Creating new liquidity contribution account for tracking");
        
        // Create account with system program
        invoke_signed(
            &system_instruction::create_account(
                user_account.key,
                liquidity_contribution_account.key,
                Rent::get()?.minimum_balance(LiquidityContribution::LEN),
                LiquidityContribution::LEN as u64,
                program_id,
            ),
            &[
                user_account.clone(),
                liquidity_contribution_account.clone(),
                system_program.clone(),
            ],
            &[&[b"liq", user_account.key.as_ref(), &[liq_contrib_bump]]],
        )?;
        
        // Initialize contribution data
        let contribution_data = LiquidityContribution {
            user: *user_account.key,
            contributed_amount: 0,
            start_timestamp: Clock::get()?.unix_timestamp,
            last_claim_time: Clock::get()?.unix_timestamp,
            total_claimed_yos: 0,
        };
        contribution_data.pack(&mut liquidity_contribution_account.data.borrow_mut()[..])?;
    }
    
    // Step 4: Update contribution tracking
    let mut contribution = LiquidityContribution::unpack(&liquidity_contribution_account.data.borrow())?;
    contribution.contributed_amount = contribution.contributed_amount.checked_add(liquidity_portion).unwrap_or(contribution.contributed_amount);
    contribution.pack(&mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    // Step 5: Transfer 80% YOT tokens to user
    msg!("Transferring {} YOT tokens to user (80%)", user_portion);
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            yot_pool_account.key,
            user_yot_account.key,
            program_authority.key,
            &[],
            user_portion,
        )?,
        &[
            yot_pool_account.clone(),
            user_yot_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Step 6: Transfer 20% YOT tokens to central liquidity wallet
    msg!("Transferring {} YOT tokens to central liquidity wallet (20%)", liquidity_portion);
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            yot_pool_account.key,
            central_liquidity_wallet.key,
            program_authority.key,
            &[],
            liquidity_portion,
        )?,
        &[
            yot_pool_account.clone(),
            central_liquidity_wallet.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Step 7: Mint YOS cashback tokens to user
    msg!("Minting {} YOS tokens as cashback", yos_cashback);
    invoke_signed(
        &spl_token::instruction::mint_to(
            token_program.key,
            yos_mint.key,
            user_yos_account.key,
            program_authority.key,
            &[],
            yos_cashback,
        )?,
        &[
            yos_mint.clone(),
            user_yos_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Check if liquidity threshold is reached
    let central_liquidity_balance = spl_token::state::Account::unpack(&central_liquidity_wallet.data.borrow())?;
    if central_liquidity_balance.amount >= program_state.liquidity_threshold {
        msg!("Liquidity threshold reached! Current balance: {}, Threshold: {}", 
             central_liquidity_balance.amount, program_state.liquidity_threshold);
        msg!("Consider calling add-liquidity instruction to add paired tokens to the liquidity pool");
    }
    
    msg!("SOL to YOT swap (immediate version) completed successfully!");
    msg!("User received: {} YOT + {} YOS cashback", user_portion, yos_cashback);
    msg!("Liquidity contribution to central wallet: {} YOT", liquidity_portion);
    
    Ok(())
}

/// Process YOT to SOL swap with pre-created liquidity contribution account
/// This version assumes the liquidity contribution account was already created
/// in a separate transaction to avoid the "account already borrowed" error
pub fn process_yot_to_sol_swap_immediate(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount_in: u64,
    min_amount_out: u64,
) -> ProgramResult {
    msg!("Processing YOT to SOL swap (immediate version)");
    msg!("Amount in: {} YOT", amount_in);
    msg!("Minimum amount out: {} SOL lamports", min_amount_out);
    
    let accounts_iter = &mut accounts.iter();
    
    // Parse accounts - now with central liquidity wallet
    let user_account = next_account_info(accounts_iter)?;                 // User's wallet
    let program_state_account = next_account_info(accounts_iter)?;        // Program state
    let program_authority = next_account_info(accounts_iter)?;            // Program authority PDA
    let sol_pool_account = next_account_info(accounts_iter)?;             // SOL pool account
    let yot_pool_account = next_account_info(accounts_iter)?;             // YOT token pool account
    let user_yot_account = next_account_info(accounts_iter)?;             // User's YOT token account
    let central_liquidity_wallet = next_account_info(accounts_iter)?;     // Central liquidity wallet
    let liquidity_contribution_account = next_account_info(accounts_iter)?; // Liquidity contribution account (tracking)
    let yos_mint = next_account_info(accounts_iter)?;                     // YOS mint
    let user_yos_account = next_account_info(accounts_iter)?;             // User's YOS token account
    let system_program = next_account_info(accounts_iter)?;               // System program
    let token_program = next_account_info(accounts_iter)?;                // Token program
    let _rent = next_account_info(accounts_iter)?;                        // Rent sysvar
    
    // Verify user is a signer
    if !user_account.is_signer {
        msg!("Error: User must sign the transaction");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify PDAs
    let (expected_program_state, _) = find_program_state_address(program_id);
    if expected_program_state != *program_state_account.key {
        msg!("Error: Invalid program state account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    let (expected_program_authority, authority_bump) = find_program_authority(program_id);
    if expected_program_authority != *program_authority.key {
        msg!("Error: Invalid program authority account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Load program state
    let program_state = ProgramState::unpack(&program_state_account.data.borrow())?;
    
    // Verify central liquidity wallet matches program state
    if program_state.liquidity_wallet != *central_liquidity_wallet.key {
        msg!("Error: Invalid central liquidity wallet account");
        msg!("Expected: {}", program_state.liquidity_wallet);
        msg!("Provided: {}", central_liquidity_wallet.key);
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Verify the liquidity contribution account is the correct PDA
    let (expected_liq_contrib, liq_contrib_bump) = Pubkey::find_program_address(
        &[b"liq", user_account.key.as_ref()],
        program_id
    );
    
    if expected_liq_contrib != *liquidity_contribution_account.key {
        msg!("Error: Invalid liquidity contribution account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Step 1: Transfer YOT from user to pool
    msg!("Transferring {} YOT tokens from user to pool", amount_in);
    invoke(
        &spl_token::instruction::transfer(
            token_program.key,
            user_yot_account.key,
            yot_pool_account.key,
            user_account.key,
            &[],
            amount_in,
        )?,
        &[
            user_yot_account.clone(),
            yot_pool_account.clone(),
            user_account.clone(),
            token_program.clone(),
        ],
    )?;
    
    // Step 2: Calculate SOL amount to return (reverse of SOL to YOT formula)
    let sol_pool_balance = sol_pool_account.lamports();
    let yot_pool_data = yot_pool_account.data.borrow();
    let yot_pool_token_account = spl_token::state::Account::unpack(&yot_pool_data)?;
    let yot_pool_balance = yot_pool_token_account.amount;
    
    // Adjust YOT pool balance since we already added the amount_in
    let yot_balance_before = yot_pool_balance.checked_sub(amount_in).unwrap_or(1);
    
    // Simple pool-based price calculation (reverse constant product AMM formula)
    let sol_amount_out = (amount_in as u128)
        .checked_mul(sol_pool_balance as u128).unwrap_or(0)
        .checked_div(yot_balance_before as u128).unwrap_or(0) as u64;
    
    msg!("Calculated SOL output: {}", sol_amount_out);
    
    // Ensure we meet minimum amount out
    if sol_amount_out < min_amount_out {
        msg!("Error: Insufficient output amount. Expected at least {}, got {}", 
            min_amount_out, sol_amount_out);
        return Err(ProgramError::InvalidArgument);
    }
    
    // Apply distribution rates
    let user_portion = sol_amount_out * 80 / 100;  // 80% to user directly
    let liquidity_portion = sol_amount_out * 20 / 100;  // 20% to central liquidity wallet
    let yos_cashback = amount_in * 5 / 100;  // 5% of YOT input as YOS tokens
    
    msg!("Distribution: User: {} SOL, Central Liquidity: {} SOL, YOS Cashback: {}", 
        user_portion, liquidity_portion, yos_cashback);
    
    // Step 3: Create or update liquidity contribution tracking account
    if liquidity_contribution_account.data_is_empty() {
        msg!("Creating new liquidity contribution account for tracking");
        
        // Create account with system program
        invoke_signed(
            &system_instruction::create_account(
                user_account.key,
                liquidity_contribution_account.key,
                Rent::get()?.minimum_balance(LiquidityContribution::LEN),
                LiquidityContribution::LEN as u64,
                program_id,
            ),
            &[
                user_account.clone(),
                liquidity_contribution_account.clone(),
                system_program.clone(),
            ],
            &[&[b"liq", user_account.key.as_ref(), &[liq_contrib_bump]]],
        )?;
        
        // Initialize contribution data
        let contribution_data = LiquidityContribution {
            user: *user_account.key,
            contributed_amount: 0,
            start_timestamp: Clock::get()?.unix_timestamp,
            last_claim_time: Clock::get()?.unix_timestamp,
            total_claimed_yos: 0,
        };
        contribution_data.pack(&mut liquidity_contribution_account.data.borrow_mut()[..])?;
    }
    
    // Update contribution tracking
    // When selling YOT, we convert the SOL amount to an equivalent YOT amount for tracking
    // This ensures consistency in contribution tracking regardless of swap direction
    let equivalent_yot_contribution = (liquidity_portion as u128)
        .checked_mul(yot_pool_balance as u128).unwrap_or(0)
        .checked_div(sol_pool_balance as u128).unwrap_or(0) as u64;
    
    let mut contribution = LiquidityContribution::unpack(&liquidity_contribution_account.data.borrow())?;
    contribution.contributed_amount = contribution.contributed_amount
        .checked_add(equivalent_yot_contribution / 10) // Track 10% of sell contribution (less than buy)
        .unwrap_or(contribution.contributed_amount);
    contribution.pack(&mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    // Step 4: Transfer 80% SOL to user
    msg!("Transferring {} SOL lamports to user (80%)", user_portion);
    invoke_signed(
        &system_instruction::transfer(
            sol_pool_account.key,
            user_account.key,
            user_portion,
        ),
        &[
            sol_pool_account.clone(),
            user_account.clone(),
            program_authority.clone(),
            system_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Step 5: Transfer 20% SOL to central liquidity wallet
    msg!("Transferring {} SOL lamports to central liquidity wallet (20%)", liquidity_portion);
    invoke_signed(
        &system_instruction::transfer(
            sol_pool_account.key,
            central_liquidity_wallet.key,
            liquidity_portion,
        ),
        &[
            sol_pool_account.clone(),
            central_liquidity_wallet.clone(),
            program_authority.clone(),
            system_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Step 6: Mint YOS cashback tokens to user
    msg!("Minting {} YOS tokens as cashback", yos_cashback);
    invoke_signed(
        &spl_token::instruction::mint_to(
            token_program.key,
            yos_mint.key,
            user_yos_account.key,
            program_authority.key,
            &[],
            yos_cashback,
        )?,
        &[
            yos_mint.clone(),
            user_yos_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Check if liquidity threshold is reached
    let central_liquidity_lamports = central_liquidity_wallet.lamports();
    if central_liquidity_lamports >= program_state.liquidity_threshold {
        msg!("Liquidity threshold reached! Current balance: {}, Threshold: {}", 
             central_liquidity_lamports, program_state.liquidity_threshold);
        msg!("Consider calling add-liquidity instruction to add paired tokens to the liquidity pool");
    }
    
    msg!("YOT to SOL swap (immediate version) completed successfully!");
    msg!("User received: {} SOL + {} YOS cashback", user_portion, yos_cashback);
    msg!("Liquidity contribution to central wallet: {} SOL (tracking equivalent: {} YOT)", 
         liquidity_portion, equivalent_yot_contribution / 10);
    
    Ok(())
}

/// Process a repair-program-state instruction
/// This instruction will update the program state with provided values
/// and ensure it has the correct format with all required fields
pub fn process_repair_program_state(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    lp_contribution_rate: u64,
    yos_cashback_rate: u64,
    admin_fee_rate: u64,
    swap_fee_rate: u64,
    referral_rate: u64,
    liquidity_threshold: u64,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let admin = next_account_info(accounts_iter)?;
    let program_state_account = next_account_info(accounts_iter)?;
    let liquidity_wallet = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    
    // Verify admin is a signer
    if !admin.is_signer {
        msg!("Error: Admin signature required");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify that the program_state_account is owned by this program
    if program_state_account.owner != program_id {
        msg!("Error: Program state not owned by program");
        return Err(ProgramError::InvalidAccountOwner);
    }
    
    // Check that state PDA is correct
    let (state_pda, _) = find_program_state_address(program_id);
    if state_pda != *program_state_account.key {
        msg!("Error: Invalid program state address");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Get the current data length
    let current_data_len = program_state_account.data_len();
    msg!("Current program state data length: {}", current_data_len);
    
    // Attempt to deserialize the existing state (which may be in old format)
    // The backward compatibility is handled in the unpack function
    let mut program_state = ProgramState::unpack(&program_state_account.data.borrow())?;
    
    // Verify admin
    if program_state.admin != *admin.key {
        msg!("Error: Only admin can repair program state");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Preserve existing mint addresses
    let yot_mint = program_state.yot_mint;
    let yos_mint = program_state.yos_mint;
    
    // Update the program state with all values to ensure it's complete
    program_state = ProgramState {
        admin: *admin.key,
        yot_mint,
        yos_mint,
        lp_contribution_rate,
        admin_fee_rate,
        yos_cashback_rate,
        swap_fee_rate,
        referral_rate,
        liquidity_wallet: *liquidity_wallet.key,
        liquidity_threshold,
    };
    
    // Check if we need to resize the account
    if current_data_len < ProgramState::LEN {
        msg!("Need to resize program state from {} to {} bytes", 
            current_data_len, ProgramState::LEN);
            
        // For PDA accounts, we would need to add rent to cover the larger size
        let rent = Rent::get()?;
        let new_minimum_balance = rent.minimum_balance(ProgramState::LEN);
        let current_balance = program_state_account.lamports();
        
        if current_balance < new_minimum_balance {
            let lamports_diff = new_minimum_balance - current_balance;
            msg!("Transferring {} lamports to cover rent", lamports_diff);
            
            // Transfer additional lamports from admin
            invoke(
                &system_instruction::transfer(
                    admin.key,
                    program_state_account.key,
                    lamports_diff,
                ),
                &[
                    admin.clone(),
                    program_state_account.clone(),
                    system_program.clone(),
                ],
            )?;
        }
        
        // NOTE: In a production environment, resizing PDA accounts requires more complex logic
        // This may not be sufficient and may require recreating the account,
        // but we're keeping it simple for this example
    }
    
    // Pack the updated state to the account data
    program_state.pack(&mut program_state_account.data.borrow_mut()[..])?;
    
    msg!("Program state repaired successfully");
    msg!("Program parameters:");
    msg!("- LP contribution rate: {}%", lp_contribution_rate);
    msg!("- YOS cashback rate: {}%", yos_cashback_rate);
    msg!("- Admin fee rate: {}%", admin_fee_rate);
    msg!("- Swap fee rate: {}%", swap_fee_rate);
    msg!("- Referral rate: {}%", referral_rate);
    msg!("- Liquidity wallet: {}", liquidity_wallet.key);
    msg!("- Liquidity threshold: {} lamports", liquidity_threshold);
    
    Ok(())
}

/// Process add-liquidity-from-central-wallet instruction
/// When the central liquidity wallet has accumulated enough assets (reached threshold),
/// this instruction will take those assets and add them to the SOL-YOT liquidity pool
/// with a 50/50 ratio split
pub fn process_add_liquidity_from_central_wallet(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    msg!("Processing add-liquidity-from-central-wallet instruction");
    
    let accounts_iter = &mut accounts.iter();
    
    // Parse accounts
    let admin_account = next_account_info(accounts_iter)?;             // Admin wallet (must be signer)
    let program_state_account = next_account_info(accounts_iter)?;     // Program state
    let program_authority = next_account_info(accounts_iter)?;         // Program authority PDA
    let sol_pool_account = next_account_info(accounts_iter)?;          // SOL pool account
    let yot_pool_account = next_account_info(accounts_iter)?;          // YOT token pool account
    let central_liquidity_wallet = next_account_info(accounts_iter)?;  // Central liquidity wallet (contains accumulated SOL)
    let central_yot_account = next_account_info(accounts_iter)?;       // Central YOT account (contains accumulated YOT)
    let lp_mint = next_account_info(accounts_iter)?;                   // LP token mint
    let lp_token_account = next_account_info(accounts_iter)?;          // Admin's LP token account (to receive LP tokens)
    let system_program = next_account_info(accounts_iter)?;            // System program
    let token_program = next_account_info(accounts_iter)?;             // Token program
    let _rent = next_account_info(accounts_iter)?;                     // Rent sysvar
    
    // Verify admin is a signer
    if !admin_account.is_signer {
        msg!("Error: Admin must sign the transaction");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify PDAs
    let (expected_program_state, _) = find_program_state_address(program_id);
    if expected_program_state != *program_state_account.key {
        msg!("Error: Invalid program state account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    let (expected_program_authority, authority_bump) = find_program_authority(program_id);
    if expected_program_authority != *program_authority.key {
        msg!("Error: Invalid program authority account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Load program state
    let program_state = ProgramState::unpack(&program_state_account.data.borrow())?;
    
    // Verify admin is authorized
    if program_state.admin != *admin_account.key {
        msg!("Error: Only the admin can call this instruction");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Verify central liquidity wallet matches program state
    if program_state.liquidity_wallet != *central_liquidity_wallet.key {
        msg!("Error: Invalid central liquidity wallet account");
        msg!("Expected: {}", program_state.liquidity_wallet);
        msg!("Provided: {}", central_liquidity_wallet.key);
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Get balances
    let central_sol_balance = central_liquidity_wallet.lamports();
    let central_yot_data = central_yot_account.data.borrow();
    let central_yot_token_account = spl_token::state::Account::unpack(&central_yot_data)?;
    let central_yot_balance = central_yot_token_account.amount;
    
    // Check if threshold is reached
    if central_sol_balance < program_state.liquidity_threshold {
        msg!("Error: Liquidity threshold not reached");
        msg!("Current balance: {}, Threshold: {}", central_sol_balance, program_state.liquidity_threshold);
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Calculate amounts to add to liquidity (50% of available balance)
    let sol_amount_to_add = central_sol_balance / 2;
    
    // Calculate equivalent YOT amount for AMM ratio
    let sol_pool_balance = sol_pool_account.lamports();
    let yot_pool_data = yot_pool_account.data.borrow();
    let yot_pool_token_account = spl_token::state::Account::unpack(&yot_pool_data)?;
    let yot_pool_balance = yot_pool_token_account.amount;
    
    // Calculate YOT amount needed to maintain pool ratio
    let yot_amount_to_add = (sol_amount_to_add as u128)
        .checked_mul(yot_pool_balance as u128).unwrap_or(0)
        .checked_div(sol_pool_balance as u128).unwrap_or(0) as u64;
    
    // Verify we have enough YOT in central wallet
    if central_yot_balance < yot_amount_to_add {
        msg!("Error: Not enough YOT in central liquidity wallet");
        msg!("Required: {}, Available: {}", yot_amount_to_add, central_yot_balance);
        return Err(ProgramError::InsufficientFunds);
    }
    
    msg!("Adding liquidity to SOL-YOT pool:");
    msg!("SOL amount: {} lamports", sol_amount_to_add);
    msg!("YOT amount: {} tokens", yot_amount_to_add);
    
    // Step 1: Transfer SOL from central wallet to pool
    invoke_signed(
        &system_instruction::transfer(
            central_liquidity_wallet.key,
            sol_pool_account.key,
            sol_amount_to_add,
        ),
        &[
            central_liquidity_wallet.clone(),
            sol_pool_account.clone(),
            system_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Step 2: Transfer YOT from central wallet to pool
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            central_yot_account.key,
            yot_pool_account.key,
            program_authority.key,
            &[],
            yot_amount_to_add,
        )?,
        &[
            central_yot_account.clone(),
            yot_pool_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Step 3: Mint LP tokens to admin's LP token account
    // The amount of LP tokens minted should be proportional to the liquidity added
    // For simplicity, we'll use the geometric mean of the two amounts
    let lp_amount = ((sol_amount_to_add as f64) * (yot_amount_to_add as f64)).sqrt() as u64;
    
    invoke_signed(
        &spl_token::instruction::mint_to(
            token_program.key,
            lp_mint.key,
            lp_token_account.key,
            program_authority.key,
            &[],
            lp_amount,
        )?,
        &[
            lp_mint.clone(),
            lp_token_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    msg!("Liquidity successfully added to SOL-YOT pool!");
    msg!("LP tokens minted: {}", lp_amount);
    
    Ok(())
}