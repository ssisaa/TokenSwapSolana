use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    system_instruction,
    sysvar::{rent::Rent, Sysvar, clock::Clock},
};
use spl_token::state::Account as TokenAccount;

// Use the existing ProgramState and helper functions from multi_hub_swap_complete.rs
use crate::multi_hub_swap_complete::{ProgramState, find_program_state_address, find_program_authority};

/**
 * A highly simplified SOL-to-YOT swap implementation
 * This version avoids user-specific liquidity contribution accounts
 * No errors with "insufficient account keys" should occur with this implementation
 */
pub fn process_direct_sol_to_yot_swap(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount_in: u64,
    min_amount_out: u64,
) -> ProgramResult {
    msg!("SIMPLIFIED: Processing direct SOL-to-YOT swap");
    msg!("Amount in: {} lamports", amount_in);
    msg!("Minimum amount out: {} YOT", min_amount_out);
    
    // Parse accounts - SIMPLIFIED VERSION WITH FEWER ACCOUNTS
    let accounts_iter = &mut accounts.iter();
    
    // User accounts
    let user_account = next_account_info(accounts_iter)?;
    
    // Program accounts
    let program_state_account = next_account_info(accounts_iter)?;
    let program_authority = next_account_info(accounts_iter)?;
    
    // Pool accounts
    let sol_pool_account = next_account_info(accounts_iter)?;
    let yot_pool_account = next_account_info(accounts_iter)?;
    
    // User token account
    let user_yot_account = next_account_info(accounts_iter)?;
    
    // Additional accounts
    let central_liquidity_wallet = next_account_info(accounts_iter)?;
    let yos_mint = next_account_info(accounts_iter)?;
    let user_yos_account = next_account_info(accounts_iter)?;
    
    // System accounts
    let system_program = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    
    // Basic validations
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
    
    // Step 1: Calculate distribution percentages
    let pool_amount = amount_in * 80 / 100; // 80% to the pool
    let liquidity_amount = amount_in - pool_amount; // 20% to central liquidity wallet
    
    msg!("Distribution: {} lamports (80%) to pool, {} lamports (20%) to central wallet", 
        pool_amount, liquidity_amount);
    
    // Step 2: Transfer SOL from user to pool (80%)
    msg!("Transferring {} lamports SOL from user to pool", pool_amount);
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
    
    // Step 3: Transfer SOL from user to central liquidity wallet (20%)
    msg!("Transferring {} lamports SOL from user to central liquidity wallet", liquidity_amount);
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
    
    // Step 4: Calculate YOT amount to send to user
    let sol_pool_balance = sol_pool_account.lamports();
    let yot_pool_info = TokenAccount::unpack(&yot_pool_account.data.borrow())?;
    let yot_pool_balance = yot_pool_info.amount;
    
    // Simple constant-product AMM formula
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
    
    // Step 5: Apply distribution rates
    let user_yot_amount = yot_amount_out * 95 / 100; // 95% to user
    let yos_cashback = yot_amount_out * 5 / 100;    // 5% as YOS cashback
    
    msg!("Distribution: {} YOT tokens to user, {} YOS tokens as cashback", 
        user_yot_amount, yos_cashback);
    
    // Step 6: Transfer YOT tokens to user
    msg!("Transferring {} YOT tokens to user", user_yot_amount);
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            yot_pool_account.key,
            user_yot_account.key,
            program_authority.key,
            &[],
            user_yot_amount,
        )?,
        &[
            yot_pool_account.clone(),
            user_yot_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Step 7: Mint YOS cashback tokens
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
    
    msg!("SIMPLIFIED: Direct SOL-to-YOT swap completed successfully!");
    msg!("User received: {} YOT and {} YOS cashback", user_yot_amount, yos_cashback);
    
    Ok(())
}