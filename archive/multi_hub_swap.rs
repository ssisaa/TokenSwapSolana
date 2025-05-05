// Updated multi_hub_swap.rs with enhanced debugging and manual serialization
// Version 1.2 - May 5, 2025
// This file contains manual serialization to replace Borsh
// and improved logging for buy_and_distribute and other functions

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
use arrayref::{array_ref, array_refs, array_mut_ref, mut_array_refs};
use spl_token::{instruction as token_instruction, state::Account as TokenAccount};

// Define the program ID here (will be replaced during deployment)
solana_program::declare_id!("SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE");

// Program state stored in a PDA
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

impl ProgramState {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8; // 3 pubkeys + 5 u64s

    // Deserialize from account data
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

        Ok(ProgramState {
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

    // Serialize to account data
    pub fn pack(&self, dst: &mut [u8]) -> Result<(), ProgramError> {
        if dst.len() < ProgramState::LEN {
            msg!("Target buffer too small for program state");
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

// Liquidity contribution account stores:
// - User public key
// - Contribution amount
// - Start timestamp
// - Last claim timestamp
// - Total claimed YOS
pub struct LiquidityContribution {
    pub user: Pubkey,
    pub contributed_amount: u64,
    pub start_timestamp: i64,
    pub last_claim_time: i64,
    pub total_claimed_yos: u64,
}

impl LiquidityContribution {
    pub const LEN: usize = 32 + 8 + 8 + 8 + 8; // pubkey + u64 + i64 + i64 + u64

    // Deserialize from account data
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

        Ok(LiquidityContribution {
            user: Pubkey::new_from_array(*user),
            contributed_amount: u64::from_le_bytes(*contributed_amount),
            start_timestamp: i64::from_le_bytes(*start_timestamp),
            last_claim_time: i64::from_le_bytes(*last_claim_time),
            total_claimed_yos: u64::from_le_bytes(*total_claimed_yos),
        })
    }

    // Serialize to account data
    pub fn pack(&self, dst: &mut [u8]) -> Result<(), ProgramError> {
        if dst.len() < LiquidityContribution::LEN {
            msg!("Target buffer too small for liquidity contribution");
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
        msg!("No liquidity contribution to distribute rewards from");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check 7-day waiting period
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    let elapsed = now - contribution.last_claim_time;
    
    const SECONDS_PER_WEEK: i64 = 604800; // 7 days
    if elapsed < SECONDS_PER_WEEK {
        msg!("Too early to distribute rewards. Must wait 7 days between distributions.");
        msg!("Last distribution: {}, Now: {}, Elapsed: {}/{} seconds", 
            contribution.last_claim_time, now, elapsed, SECONDS_PER_WEEK);
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Calculate weekly reward (1/52 of yearly reward - 100% APR)
    // 100% APR means weekly rate is ~1.92%
    let weekly_reward = (contribution.contributed_amount * 192) / 10000; // 1.92%
    msg!("Calculating weekly reward: {} * 1.92% = {}", 
        contribution.contributed_amount, weekly_reward);
    
    // Find PDA for mint authority
    let (mint_authority, mint_authority_bump) = Pubkey::find_program_address(
        &[b"authority"],
        program_id,
    );
    
    // Mint YOS rewards directly to user's account
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
    
    // Verify liquidity contribution account
    let (expected_liq_contrib, _) = find_liquidity_contribution_address(user.key, program_id);
    if expected_liq_contrib != *liquidity_contribution_account.key {
        msg!("Invalid liquidity contribution account");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Deserialize contribution account
    let contribution = LiquidityContribution::unpack(
        &liquidity_contribution_account.data.borrow()
    )?;
    
    // Verify user owns this contribution
    if contribution.user != *user.key {
        msg!("You don't own this liquidity contribution");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check if there's anything to withdraw
    if contribution.contributed_amount == 0 {
        msg!("No liquidity contribution to withdraw");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Find PDA for program authority
    let (program_authority, authority_bump) = Pubkey::find_program_address(
        &[b"authority"],
        program_id,
    );
    
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
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Reset contribution account (zero out everything)
    let mut zeroed_contribution = LiquidityContribution {
        user: *user.key,
        contributed_amount: 0,
        start_timestamp: 0,
        last_claim_time: 0,
        total_claimed_yos: contribution.total_claimed_yos, // keep track of total claimed
    };
    
    // Serialize the zeroed contribution data
    zeroed_contribution.serialize(&mut &mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    msg!("Liquidity contribution of {} YOT withdrawn successfully", contribution.contributed_amount);
    Ok(())
}

// Helper: Find liquidity contribution PDA for a specific user
pub fn find_liquidity_contribution_address(
    user_key: &Pubkey,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"liquidity", user_key.as_ref()],
        program_id,
    )
}

// Helper: Find program state PDA
pub fn find_program_state_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"state"],
        program_id,
    )
}

// Buy and distribute YOT tokens with liquidity contribution and YOS cashback
// Implements buy_and_distribute from the Anchor smart contract
fn process_buy_and_distribute(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    msg!("🔹 Starting process_buy_and_distribute with amount: {}", amount);
    
    // Debug account count
    msg!("🔹 Account count: {}", accounts.len());
    if accounts.len() < 11 {
        msg!("❌ ERROR: Not enough accounts provided. Expected at least 11, got {}", accounts.len());
        return Err(ProgramError::NotEnoughAccountKeys);
    }
    
    let accounts_iter = &mut accounts.iter();
    
    // Parse accounts with detailed logging
    msg!("🔹 Parsing accounts...");
    let user = next_account_info(accounts_iter)?;
    msg!("1. User: {}", user.key);
    
    let vault_yot = next_account_info(accounts_iter)?;
    msg!("2. Vault YOT: {}", vault_yot.key);
    
    let user_yot = next_account_info(accounts_iter)?;
    msg!("3. User YOT: {}", user_yot.key);
    
    let liquidity_yot = next_account_info(accounts_iter)?;
    msg!("4. Liquidity YOT: {}", liquidity_yot.key);
    
    let yos_mint = next_account_info(accounts_iter)?;
    msg!("5. YOS Mint: {}", yos_mint.key);
    
    let user_yos = next_account_info(accounts_iter)?;
    msg!("6. User YOS: {}", user_yos.key);
    
    let liquidity_contribution_account = next_account_info(accounts_iter)?;
    msg!("7. Liquidity Contribution: {}", liquidity_contribution_account.key);
    
    let token_program = next_account_info(accounts_iter)?;
    msg!("8. Token Program: {}", token_program.key);
    
    let system_program = next_account_info(accounts_iter)?;
    msg!("9. System Program: {}", system_program.key);
    
    let rent_sysvar = next_account_info(accounts_iter)?;
    msg!("10. Rent Sysvar: {}", rent_sysvar.key);
    
    let program_state_account = next_account_info(accounts_iter)?;
    msg!("11. Program State: {}", program_state_account.key);
    
    // Verify user signed the transaction
    if !user.is_signer {
        msg!("User must sign BuyAndDistribute instruction");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Load program state to get parameters
    let program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Verify YOT and YOS mint addresses match
    if program_state.yot_mint != *vault_yot.owner {
        msg!("YOT mint mismatch in state");
        return Err(ProgramError::InvalidAccountData);
    }
    
    if program_state.yos_mint != *yos_mint.key {
        msg!("YOS mint mismatch in state");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Validate token account owners
    // Verify user_yot belongs to the user
    let user_yot_data = TokenAccount::unpack(&user_yot.data.borrow())?;
    if user_yot_data.owner != *user.key {
        msg!("User YOT account not owned by user");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Verify user_yos belongs to the user
    let user_yos_data = TokenAccount::unpack(&user_yos.data.borrow())?;
    if user_yos_data.owner != *user.key {
        msg!("User YOS account not owned by user");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Calculate distribution
    // Total amount split: 
    // - 75% to user
    // - 20% to liquidity (split equally between YOT and SOL)
    // - 5% YOS cashback
    let user_amount = (amount * 75) / 100;
    let liquidity_amount = (amount * 20) / 100;
    let cashback_amount = (amount * 5) / 100;
    
    msg!("Distribution: Total {} | User {} | Liquidity {} | Cashback {}",
         amount, user_amount, liquidity_amount, cashback_amount);
    
    // Find PDAs for program authority
    let (program_authority, authority_bump) = Pubkey::find_program_address(
        &[b"authority"],
        program_id,
    );
    
    // Check if liquidity contribution account exists, create if not
    let expected_data_len = std::mem::size_of::<LiquidityContribution>();
    
    // Check if account exists and belongs to user
    let create_new_account = liquidity_contribution_account.data_is_empty();
    
    if create_new_account {
        msg!("Creating new liquidity contribution account");
        
        // Find the expected PDA for this user
        let (expected_liq_contrib, liq_bump) = find_liquidity_contribution_address(user.key, program_id);
        if expected_liq_contrib != *liquidity_contribution_account.key {
            msg!("Invalid liquidity contribution account address");
            msg!("Expected: {}, Got: {}", expected_liq_contrib, liquidity_contribution_account.key);
            return Err(ProgramError::InvalidAccountData);
        }
        
        // Calculate rent
        let rent = Rent::get()?;
        let lamports = rent.minimum_balance(expected_data_len);
        
        // Create account
        invoke_signed(
            &system_instruction::create_account(
                user.key,
                liquidity_contribution_account.key,
                lamports,
                expected_data_len as u64,
                program_id,
            ),
            &[
                user.clone(),
                liquidity_contribution_account.clone(),
                system_program.clone(),
            ],
            &[&[b"liquidity", user.key.as_ref(), &[liq_bump]]],
        )?;
    }
    
    // Load or initialize contribution
    let mut contribution = if create_new_account {
        // Initialize new contribution
        LiquidityContribution {
            user: *user.key,
            contributed_amount: 0, // Will be updated below
            start_timestamp: Clock::get()?.unix_timestamp,
            last_claim_time: Clock::get()?.unix_timestamp,
            total_claimed_yos: 0,
        }
    } else {
        // Load existing contribution
        LiquidityContribution::try_from_slice(&liquidity_contribution_account.data.borrow())?
    };
    
    // Verify existing account belongs to this user
    if !create_new_account && contribution.user != *user.key {
        msg!("Liquidity contribution account does not belong to this user");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Transfer YOT from vault to user
    invoke_signed(
        &token_instruction::transfer(
            token_program.key,
            vault_yot.key,
            user_yot.key,
            &program_authority,
            &[],
            user_amount,
        )?,
        &[
            vault_yot.clone(),
            user_yot.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Transfer YOT from vault to liquidity
    invoke_signed(
        &token_instruction::transfer(
            token_program.key,
            vault_yot.key,
            liquidity_yot.key,
            &program_authority,
            &[],
            liquidity_amount,
        )?,
        &[
            vault_yot.clone(),
            liquidity_yot.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Mint YOS cashback to user
    invoke_signed(
        &token_instruction::mint_to(
            token_program.key,
            yos_mint.key,
            user_yos.key,
            &program_authority,
            &[],
            cashback_amount,
        )?,
        &[
            yos_mint.clone(),
            user_yos.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Update liquidity contribution
    contribution.contributed_amount += liquidity_amount;
    
    // Save updated contribution
    contribution.serialize(&mut &mut liquidity_contribution_account.data.borrow_mut()[..])?;
    
    msg!("✅ Buy and distribute successful: {} YOT total | {} YOT to user | {} YOT to liquidity | {} YOS cashback",
        amount, user_amount, liquidity_amount, cashback_amount);
    Ok(())
}