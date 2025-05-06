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
use spl_token::{instruction as token_instruction, state::Account as TokenAccount};

// Define utility functions
fn find_program_state_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"state"], program_id)
}

fn find_program_authority(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"authority"], program_id)
}

// Program state structure (same as in original implementation)
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
    pub liquidity_wallet: Pubkey,
    pub liquidity_threshold: u64,
}

// Implement serialization helpers for ProgramState
impl ProgramState {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 32 + 8;
    
    pub fn unpack(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() < Self::LEN {
            msg!("Program state data too short");
            return Err(ProgramError::InvalidAccountData);
        }
        
        Self::try_from_slice(data).map_err(|_| {
            msg!("Failed to deserialize program state");
            ProgramError::InvalidAccountData
        })
    }
    
    pub fn pack(&self, dst: &mut [u8]) -> Result<(), ProgramError> {
        if dst.len() < Self::LEN {
            msg!("Program state destination buffer too small");
            return Err(ProgramError::InvalidAccountData);
        }
        
        let data = self.try_to_vec().map_err(|_| {
            msg!("Failed to serialize program state");
            ProgramError::InvalidAccountData
        })?;
        
        dst[..data.len()].copy_from_slice(&data);
        Ok(())
    }
}

// Simplified SOL to YOT swap function that doesn't rely on liquidity contribution accounts
pub fn process_simplified_sol_to_yot_swap(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount_in: u64,
    min_amount_out: u64,
) -> ProgramResult {
    msg!("Processing simplified SOL to YOT swap");
    msg!("Amount in: {} lamports", amount_in);
    msg!("Minimum amount out: {} YOT", min_amount_out);
    
    let accounts_iter = &mut accounts.iter();
    
    // Parse accounts - simplified version without liquidity contribution
    let user_account = next_account_info(accounts_iter)?;                 // User's wallet
    let program_state_account = next_account_info(accounts_iter)?;        // Program state
    let program_authority = next_account_info(accounts_iter)?;            // Program authority PDA
    let sol_pool_account = next_account_info(accounts_iter)?;             // SOL pool account
    let yot_pool_account = next_account_info(accounts_iter)?;             // YOT token pool account
    let user_yot_account = next_account_info(accounts_iter)?;             // User's YOT token account
    let central_liquidity_wallet = next_account_info(accounts_iter)?;     // Central liquidity wallet
    let yos_mint = next_account_info(accounts_iter)?;                     // YOS mint
    let user_yos_account = next_account_info(accounts_iter)?;             // User's YOS token account
    let system_program = next_account_info(accounts_iter)?;               // System program
    let token_program = next_account_info(accounts_iter)?;                // Token program
    
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
    
    // Step 1: Transfer SOL from user to pool (80% goes to the pool)
    let pool_amount = amount_in * 80 / 100;
    msg!("Transferring {} lamports SOL (80%) from user to pool", pool_amount);
    invoke(
        &system_instruction::transfer(
            user_account.key,
            sol_pool_account.key,
            pool_amount,
        ),
        &[
            user_account.clone(),
            sol_pool_account.clone(),
            system_program.clone(),
        ],
    )?;
    
    // Step 2: Transfer SOL from user to central liquidity wallet (20%)
    let liquidity_amount = amount_in - pool_amount; // remaining 20%
    msg!("Transferring {} lamports SOL (20%) from user to central liquidity wallet", liquidity_amount);
    invoke(
        &system_instruction::transfer(
            user_account.key,
            central_liquidity_wallet.key,
            liquidity_amount,
        ),
        &[
            user_account.clone(),
            central_liquidity_wallet.clone(),
            system_program.clone(),
        ],
    )?;
    
    // Step 3: Calculate YOT amount to return
    let sol_pool_balance = sol_pool_account.lamports();
    let mut yot_pool_data = yot_pool_account.data.borrow();
    let yot_pool_token_account = spl_token::state::Account::unpack(&yot_pool_data)?;
    let yot_pool_balance = yot_pool_token_account.amount;
    
    // Simple pool-based price calculation with the default AMM formula
    let sol_balance_before = sol_pool_balance.checked_sub(pool_amount).unwrap_or(1);
    let yot_amount_out = (pool_amount as u128)
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
    let user_portion = yot_amount_out * 95 / 100;  // 95% to user directly
    let yos_cashback = yot_amount_out * 5 / 100;   // 5% equivalent as YOS tokens
    
    msg!("Distribution: User: {} YOT, YOS Cashback: {}", 
        user_portion, yos_cashback);
    
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
    
    msg!("Simplified SOL to YOT swap completed successfully!");
    msg!("User received: {} YOT + {} YOS cashback", user_portion, yos_cashback);
    msg!("Central liquidity wallet received: {} SOL", liquidity_amount);
    
    Ok(())
}