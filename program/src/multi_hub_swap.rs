// Updated multi_hub_swap.rs with enhanced debugging
// Version 1.1 - May 5, 2025
// This file contains fixes for the "Unknown instruction discriminator" error
// and improved logging for buy_and_distribute and other functions

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
    let contribution = LiquidityContribution::try_from_slice(
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