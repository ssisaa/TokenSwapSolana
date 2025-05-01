use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::IsInitialized,
    pubkey::Pubkey,
    sysvar::Sysvar,
};
use borsh::{BorshDeserialize, BorshSerialize};
use spl_token::instruction as token_instruction;

// Program ID: Must match the ID in Cargo.toml
solana_program::declare_id!("3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps");

// Define swap fee constants
const LIQUIDITY_CONTRIBUTION_PERCENT: u8 = 20; // 20% goes to liquidity
const ADMIN_FEE_PERCENT: u8 = 1;               // 0.1% SOL commission to admin
const YOS_CASHBACK_PERCENT: u8 = 30;           // 3% cashback in YOS tokens
const SWAP_FEE_PERCENT: u8 = 3;                // 0.3% swap fee
const REFERRAL_PERCENT: u8 = 5;                // 0.5% referral rewards
const LP_TOKEN_APR: u16 = 10000;               // 100% APR for liquidity providers

// Custom error codes for better error handling
#[derive(Debug)]
pub enum MultiHubSwapError {
    InvalidInstruction = 0,
    NotInitialized = 1,
    AlreadyInitialized = 2,
    InvalidAuthority = 3,
    SlippageExceeded = 4,
    InvalidTokenAccount = 5,
    InsufficientFunds = 6,
    PoolNotFound = 7,
    InvalidPool = 8,
    MathOverflow = 9,
    NoRewardsAvailable = 10,
    InvalidParameter = 11,
    EmergencyPaused = 12,
    InvalidReferrer = 13,
}

impl From<MultiHubSwapError> for ProgramError {
    fn from(e: MultiHubSwapError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

// Define program instructions
#[derive(BorshSerialize, BorshDeserialize, Debug, PartialEq)]
pub enum MultiHubSwapInstruction {
    /// Initialize swap program state
    /// Accounts expected:
    /// 0. `[signer]` Admin account that controls the program
    /// 1. `[writable]` Program state account
    /// 2. `[]` YOT token mint
    /// 3. `[]` YOS token mint
    /// 4. `[]` SOL-YOT liquidity pool 
    /// 5. `[]` Rent sysvar
    Initialize {
        // Bump seed for program authority
        authority_bump: u8,
    },

    /// Execute a swap from input token to output token with auto-contribution to liquidity
    /// Accounts expected:
    /// 0. `[signer]` User's wallet
    /// 1. `[writable]` User's token account for input token
    /// 2. `[writable]` User's token account for output token
    /// 3. `[writable]` User's YOS token account for cashback
    /// 4. `[writable]` Program state account
    /// 5. `[writable]` SOL-YOT liquidity pool account
    /// 6. `[writable]` Admin fee account
    /// 7. `[]` Token program
    /// 8. `[writable]` (Optional) Referrer's account
    SwapToken {
        // Amount of input token to swap
        amount_in: u64,
        // Minimum amount of output token to receive
        minimum_amount_out: u64,
        // Input token mint
        input_token_mint: Pubkey,
        // Output token mint
        output_token_mint: Pubkey,
        // Optional referrer
        referrer: Option<Pubkey>,
    },

    /// Add liquidity to a pool and receive LP tokens
    /// Accounts expected:
    /// 0. `[signer]` User's wallet
    /// 1. `[writable]` User's token A account
    /// 2. `[writable]` User's token B account
    /// 3. `[writable]` User's LP token account
    /// 4. `[writable]` Pool token A account
    /// 5. `[writable]` Pool token B account
    /// 6. `[writable]` LP token mint
    /// 7. `[writable]` Program state account
    /// 8. `[]` Token program
    /// 9. `[]` Program authority (PDA)
    AddLiquidity {
        // Amount of token A to deposit
        amount_a: u64,
        // Amount of token B to deposit
        amount_b: u64,
        // Minimum LP tokens to receive
        minimum_lp_tokens: u64,
    },
    
    /// Remove liquidity from a pool
    /// Accounts expected:
    /// 0. `[signer]` User's wallet
    /// 1. `[writable]` User's LP token account
    /// 2. `[writable]` User's token A account
    /// 3. `[writable]` User's token B account
    /// 4. `[writable]` Pool token A account
    /// 5. `[writable]` Pool token B account
    /// 6. `[writable]` LP token mint
    /// 7. `[writable]` Program state account
    /// 8. `[]` Token program
    /// 9. `[]` Program authority (PDA)
    RemoveLiquidity {
        // Amount of LP tokens to burn
        lp_amount: u64,
        // Minimum amount of token A to receive
        minimum_a_amount: u64,
        // Minimum amount of token B to receive
        minimum_b_amount: u64,
    },

    /// Claim accumulated YOS rewards
    /// Accounts expected:
    /// 0. `[signer]` User's wallet
    /// 1. `[writable]` User's YOS token account
    /// 2. `[writable]` User's rewards account (PDA)
    /// 3. `[writable]` Program YOS treasury account
    /// 4. `[]` Program authority (PDA)
    /// 5. `[]` Token program
    ClaimRewards {},
    
    /// Claim LP yield farming rewards
    /// Accounts expected:
    /// 0. `[signer]` User's wallet
    /// 1. `[writable]` User's YOS token account
    /// 2. `[writable]` User's LP staking account (PDA)
    /// 3. `[writable]` Program YOS treasury account
    /// 4. `[]` Program authority (PDA)
    /// 5. `[]` Token program
    /// 6. `[]` Clock sysvar
    ClaimYieldRewards {},
    
    /// Stake LP tokens for yield farming
    /// Accounts expected:
    /// 0. `[signer]` User's wallet
    /// 1. `[writable]` User's LP token account
    /// 2. `[writable]` Program LP token vault
    /// 3. `[writable]` User's LP staking account (PDA)
    /// 4. `[]` Token program
    /// 5. `[]` Clock sysvar
    StakeLpTokens {
        // Amount of LP tokens to stake
        amount: u64,
    },
    
    /// Unstake LP tokens from yield farming
    /// Accounts expected:
    /// 0. `[signer]` User's wallet
    /// 1. `[writable]` User's LP token account
    /// 2. `[writable]` Program LP token vault
    /// 3. `[writable]` User's LP staking account (PDA)
    /// 4. `[]` Program authority (PDA)
    /// 5. `[]` Token program
    /// 6. `[]` Clock sysvar
    UnstakeLpTokens {
        // Amount of LP tokens to unstake
        amount: u64,
    },
    
    /// Register a new affiliate/referrer
    /// Accounts expected:
    /// 0. `[signer]` User's wallet (new referrer)
    /// 1. `[writable]` Referrer account (PDA)
    /// 2. `[]` Rent sysvar
    RegisterReferrer {},
    
    /// Update program parameters (admin only)
    /// Accounts expected:
    /// 0. `[signer]` Admin account
    /// 1. `[writable]` Program state account
    UpdateParameters {
        // New liquidity contribution percentage (optional)
        liquidity_contribution_percent: Option<u8>,
        // New admin fee percentage (optional)
        admin_fee_percent: Option<u8>,
        // New YOS cashback percentage (optional)
        yos_cashback_percent: Option<u8>,
        // New referral percentage (optional)
        referral_percent: Option<u8>,
        // New LP APR (optional)
        lp_apr: Option<u16>,
        // New admin account (optional)
        new_admin: Option<Pubkey>,
    },
    
    /// Emergency pause/unpause the program (admin only)
    /// Accounts expected:
    /// 0. `[signer]` Admin account
    /// 1. `[writable]` Program state account
    EmergencyPause {
        // True to pause, false to unpause
        pause: bool,
    },
}

/// Program state containing configuration and statistics
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct ProgramState {
    // Is the program initialized
    pub is_initialized: bool,
    // Is the program paused for emergency
    pub is_paused: bool,
    // Admin account
    pub admin: Pubkey,
    // YOT token mint
    pub yot_mint: Pubkey,
    // YOS token mint
    pub yos_mint: Pubkey,
    // SOL-YOT liquidity pool
    pub sol_yot_pool: Pubkey,
    // Authority PDA
    pub authority: Pubkey,
    // Authority bump seed
    pub authority_bump: u8,
    // Liquidity contribution percentage
    pub liquidity_contribution_percent: u8,
    // Admin fee percentage
    pub admin_fee_percent: u8,
    // YOS cashback percentage
    pub yos_cashback_percent: u8,
    // Referral rewards percentage
    pub referral_percent: u8,
    // LP token APR (in basis points, 10000 = 100%)
    pub lp_apr: u16,
    // Total swap volume
    pub total_swap_volume: u64,
    // Total liquidity contributed
    pub total_liquidity_contributed: u64,
    // Total YOS rewards distributed
    pub total_yos_rewards: u64,
    // Total referral rewards paid
    pub total_referral_rewards: u64,
    // Total LP rewards paid
    pub total_lp_rewards: u64,
    // Total users count
    pub total_users: u32,
    // Total pools count
    pub total_pools: u16,
    // Last update timestamp
    pub last_update_time: u64,
}

impl IsInitialized for ProgramState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

/// Liquidity pool data
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct LiquidityPool {
    // Pool ID
    pub pool_id: u16,
    // Token A mint
    pub token_a_mint: Pubkey,
    // Token B mint
    pub token_b_mint: Pubkey,
    // Token A account
    pub token_a_account: Pubkey,
    // Token B account
    pub token_b_account: Pubkey,
    // LP token mint
    pub lp_mint: Pubkey,
    // Pool type (0 = Constant Product AMM, 1 = Stable AMM)
    pub pool_type: u8,
    // Pool fee (in basis points)
    pub fee: u16,
    // Is pool active
    pub is_active: bool,
    // Total value locked (in USD)
    pub tvl: u64,
    // Token A reserve
    pub token_a_reserve: u64,
    // Token B reserve
    pub token_b_reserve: u64,
    // Last update timestamp
    pub last_update_time: u64,
}

/// User rewards data
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct UserRewards {
    // User wallet
    pub user: Pubkey,
    // Pending YOS rewards from swaps
    pub pending_yos_rewards: u64,
    // Pending YOS rewards from referrals
    pub pending_referral_rewards: u64,
    // Total YOS rewards claimed
    pub total_claimed: u64,
    // Total swap volume
    pub total_swap_volume: u64,
    // Last update timestamp
    pub last_update_time: u64,
}

/// LP staking data for yield farming
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct LpStaking {
    // User wallet
    pub user: Pubkey,
    // LP token mint
    pub lp_mint: Pubkey,
    // Amount of LP tokens staked
    pub staked_amount: u64,
    // Accumulated rewards
    pub accumulated_rewards: u64,
    // Last harvest timestamp
    pub last_harvest_time: u64,
    // Stake start timestamp
    pub stake_start_time: u64,
}

/// Referrer data
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Referrer {
    // Referrer wallet
    pub referrer: Pubkey,
    // Total referred users
    pub total_referred_users: u32,
    // Total volume generated
    pub total_volume: u64,
    // Total earned rewards
    pub total_rewards: u64,
    // Creation timestamp
    pub created_at: u64,
}

// Program entrypoint
entrypoint!(process_instruction);

/// Program entrypoint implementation
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = MultiHubSwapInstruction::try_from_slice(instruction_data)
        .map_err(|_| MultiHubSwapError::InvalidInstruction)?;

    match instruction {
        MultiHubSwapInstruction::Initialize { authority_bump } => {
            process_initialize(program_id, accounts, authority_bump)
        }
        MultiHubSwapInstruction::SwapToken {
            amount_in,
            minimum_amount_out,
            input_token_mint,
            output_token_mint,
            referrer,
        } => process_swap(
            program_id,
            accounts,
            amount_in,
            minimum_amount_out,
            input_token_mint,
            output_token_mint,
            referrer,
        ),
        MultiHubSwapInstruction::AddLiquidity { 
            amount_a, 
            amount_b, 
            minimum_lp_tokens 
        } => process_add_liquidity(
            program_id,
            accounts,
            amount_a,
            amount_b,
            minimum_lp_tokens,
        ),
        MultiHubSwapInstruction::RemoveLiquidity { 
            lp_amount, 
            minimum_a_amount, 
            minimum_b_amount 
        } => process_remove_liquidity(
            program_id,
            accounts,
            lp_amount,
            minimum_a_amount,
            minimum_b_amount,
        ),
        MultiHubSwapInstruction::ClaimRewards {} => process_claim_rewards(program_id, accounts),
        MultiHubSwapInstruction::ClaimYieldRewards {} => process_claim_yield_rewards(program_id, accounts),
        MultiHubSwapInstruction::StakeLpTokens { amount } => process_stake_lp_tokens(
            program_id,
            accounts,
            amount,
        ),
        MultiHubSwapInstruction::UnstakeLpTokens { amount } => process_unstake_lp_tokens(
            program_id,
            accounts,
            amount,
        ),
        MultiHubSwapInstruction::RegisterReferrer {} => process_register_referrer(program_id, accounts),
        MultiHubSwapInstruction::UpdateParameters {
            liquidity_contribution_percent,
            admin_fee_percent,
            yos_cashback_percent,
            referral_percent,
            lp_apr,
            new_admin,
        } => process_update_parameters(
            program_id,
            accounts,
            liquidity_contribution_percent,
            admin_fee_percent,
            yos_cashback_percent,
            referral_percent,
            lp_apr,
            new_admin,
        ),
        MultiHubSwapInstruction::EmergencyPause { pause } => process_emergency_pause(
            program_id,
            accounts,
            pause,
        ),
    }
}

/// Check if program is paused
fn check_program_paused(program_state: &ProgramState) -> ProgramResult {
    if program_state.is_paused {
        return Err(MultiHubSwapError::EmergencyPaused.into());
    }
    Ok(())
}

/// Process Initialize instruction
fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    authority_bump: u8,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let admin_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let yot_mint_account = next_account_info(account_info_iter)?;
    let yos_mint_account = next_account_info(account_info_iter)?;
    let sol_yot_pool_account = next_account_info(account_info_iter)?;
    let _rent_account = next_account_info(account_info_iter)?;

    // Verify admin signature
    if !admin_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Check if already initialized
    if program_state_account.data.borrow()[0] != 0 {
        return Err(MultiHubSwapError::AlreadyInitialized.into());
    }

    // Calculate program authority address (PDA)
    let (authority_address, _) = Pubkey::find_program_address(
        &[b"authority"],
        program_id,
    );

    // Create the program state
    let program_state = ProgramState {
        is_initialized: true,
        is_paused: false,
        admin: *admin_account.key,
        yot_mint: *yot_mint_account.key,
        yos_mint: *yos_mint_account.key,
        sol_yot_pool: *sol_yot_pool_account.key,
        authority: authority_address,
        authority_bump,
        liquidity_contribution_percent: LIQUIDITY_CONTRIBUTION_PERCENT,
        admin_fee_percent: ADMIN_FEE_PERCENT,
        yos_cashback_percent: YOS_CASHBACK_PERCENT,
        referral_percent: REFERRAL_PERCENT,
        lp_apr: LP_TOKEN_APR,
        total_swap_volume: 0,
        total_liquidity_contributed: 0,
        total_yos_rewards: 0,
        total_referral_rewards: 0,
        total_lp_rewards: 0,
        total_users: 0,
        total_pools: 0,
        last_update_time: Clock::get()?.unix_timestamp as u64,
    };

    // Serialize and store the program state
    program_state.serialize(&mut *program_state_account.data.borrow_mut())?;

    msg!("Multi-Hub Swap program initialized successfully");
    Ok(())
}

/// Process Swap instruction
fn process_swap(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount_in: u64,
    minimum_amount_out: u64,
    input_token_mint: Pubkey,
    output_token_mint: Pubkey,
    referrer: Option<Pubkey>,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let user_wallet = next_account_info(account_info_iter)?;
    let user_input_token_account = next_account_info(account_info_iter)?;
    let user_output_token_account = next_account_info(account_info_iter)?;
    let user_yos_token_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let _sol_yot_pool_account = next_account_info(account_info_iter)?;
    let _admin_fee_account = next_account_info(account_info_iter)?;
    let _token_program = next_account_info(account_info_iter)?;
    
    // Optional referrer account
    let referrer_account = if referrer.is_some() && !matches!(accounts.get(8), None) {
        Some(next_account_info(account_info_iter)?)
    } else {
        None
    };

    // Check signer
    if !user_wallet.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Load program state
    let mut program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Check if program is paused
    check_program_paused(&program_state)?;

    // Verify token accounts belong to correct mints
    // For real implementation we would do additional verification
    
    // Find or create user rewards account
    let (_user_rewards_pda, _user_rewards_bump) = Pubkey::find_program_address(
        &[b"rewards", user_wallet.key.as_ref()],
        program_id,
    );
    
    // Determine if multi-hop swap is needed
    let (is_multi_hop, through_sol) = should_use_multi_hop(&input_token_mint, &output_token_mint);

    // Calculate the output amount and execute swap
    let (total_amount_out, _pools_used) = if is_multi_hop {
        // Multi-hop swap: token -> SOL -> YOT or YOT -> SOL -> token
        if through_sol {
            // For token -> SOL -> YOT or YOT -> SOL -> token
            let intermediate_amount = calculate_output_amount(
                amount_in, 
                &input_token_mint, 
                &get_sol_mint(),
            )?;
            
            let final_amount = calculate_output_amount(
                intermediate_amount, 
                &get_sol_mint(), 
                &output_token_mint,
            )?;
            
            (final_amount, vec![get_sol_mint()])
        } else {
            // For token -> YOT -> token (less common)
            let intermediate_amount = calculate_output_amount(
                amount_in, 
                &input_token_mint, 
                &get_yot_mint(),
            )?;
            
            let final_amount = calculate_output_amount(
                intermediate_amount, 
                &get_yot_mint(), 
                &output_token_mint,
            )?;
            
            (final_amount, vec![get_yot_mint()])
        }
    } else {
        // Direct swap
        let amount_out = calculate_output_amount(
            amount_in, 
            &input_token_mint, 
            &output_token_mint,
        )?;
        
        (amount_out, vec![])
    };
    
    // Check slippage tolerance
    if total_amount_out < minimum_amount_out {
        msg!("Slippage exceeded: expected at least {}, got {}", minimum_amount_out, total_amount_out);
        return Err(MultiHubSwapError::SlippageExceeded.into());
    }

    // Calculate fee amounts based on program state
    let swap_fee = amount_in.saturating_mul(SWAP_FEE_PERCENT as u64).saturating_div(1000); // 0.3% fee
    let liquidity_amount = amount_in.saturating_mul(program_state.liquidity_contribution_percent as u64).saturating_div(100); // 20%
    let admin_fee = amount_in.saturating_mul(program_state.admin_fee_percent as u64).saturating_div(1000); // 0.1% fee
    let yos_cashback = calculate_yos_cashback(amount_in, &program_state.yos_cashback_percent)?;
    
    // Calculate referral reward if applicable
    let referral_reward = if let Some(referrer_pubkey) = referrer {
        if referrer_pubkey == *user_wallet.key {
            // Can't refer yourself
            0
        } else {
            // Calculate referral reward - 0.5% of input amount
            amount_in.saturating_mul(program_state.referral_percent as u64).saturating_div(1000)
        }
    } else {
        0
    };
    
    // Actual amount after fees and contributions
    let actual_swap_amount = amount_in
        .saturating_sub(liquidity_amount)
        .saturating_sub(admin_fee)
        .saturating_sub(swap_fee);
    
    // In a production implementation, we would now:
    // 1. Execute the token transfers through the Token program
    // 2. Handle the actual swap logic through chosen AMM
    // 3. Distribute the liquidity contribution
    // 4. Track the YOS cashback for later claiming
    // 5. Track referral rewards if applicable
    
    // Update program statistics
    program_state.total_swap_volume = program_state.total_swap_volume.saturating_add(amount_in);
    program_state.total_liquidity_contributed = program_state.total_liquidity_contributed.saturating_add(liquidity_amount);
    program_state.total_yos_rewards = program_state.total_yos_rewards.saturating_add(yos_cashback);
    
    if referral_reward > 0 {
        program_state.total_referral_rewards = program_state.total_referral_rewards.saturating_add(referral_reward);
    }
    
    program_state.last_update_time = Clock::get()?.unix_timestamp as u64;
    
    // Save updated program state
    program_state.serialize(&mut *program_state_account.data.borrow_mut())?;

    msg!("Swap executed: {} -> {}", amount_in, total_amount_out);
    msg!("Liquidity contribution: {}", liquidity_amount);
    msg!("YOS cashback earned: {}", yos_cashback);
    if referral_reward > 0 {
        msg!("Referral reward: {}", referral_reward);
    }
    
    Ok(())
}

/// Process Add Liquidity instruction
fn process_add_liquidity(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount_a: u64,
    amount_b: u64,
    minimum_lp_tokens: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let user_wallet = next_account_info(account_info_iter)?;
    let _user_token_a_account = next_account_info(account_info_iter)?;
    let _user_token_b_account = next_account_info(account_info_iter)?;
    let _user_lp_token_account = next_account_info(account_info_iter)?;
    let _pool_token_a_account = next_account_info(account_info_iter)?;
    let _pool_token_b_account = next_account_info(account_info_iter)?;
    let _lp_token_mint = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let _token_program = next_account_info(account_info_iter)?;
    let _program_authority = next_account_info(account_info_iter)?;

    // Check signer
    if !user_wallet.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Load program state
    let mut program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Check if program is paused
    check_program_paused(&program_state)?;

    // Load pool data
    // In a real implementation, we would find the pool PDA and load it
    
    // Calculate LP tokens to mint
    // For a new pool (total supply = 0): sqrt(amount_a * amount_b)
    // For existing pool: min(amount_a * total_supply / reserve_a, amount_b * total_supply / reserve_b)
    
    // Placeholder calculation - in real implementation would use actual reserves and formula
    let lp_tokens_to_mint = (amount_a * amount_b).integer_sqrt();
    
    // Check minimum LP tokens
    if lp_tokens_to_mint < minimum_lp_tokens {
        return Err(MultiHubSwapError::SlippageExceeded.into());
    }
    
    // In a production implementation, we would now:
    // 1. Transfer token A from user to pool
    // 2. Transfer token B from user to pool
    // 3. Mint LP tokens to user
    
    // Update program state
    program_state.last_update_time = Clock::get()?.unix_timestamp as u64;
    
    // Save updated program state
    program_state.serialize(&mut *program_state_account.data.borrow_mut())?;

    msg!("Added liquidity: {} token A, {} token B", amount_a, amount_b);
    msg!("Received {} LP tokens", lp_tokens_to_mint);
    
    Ok(())
}

/// Process Remove Liquidity instruction
fn process_remove_liquidity(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    lp_amount: u64,
    minimum_a_amount: u64,
    minimum_b_amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let user_wallet = next_account_info(account_info_iter)?;
    let _user_lp_token_account = next_account_info(account_info_iter)?;
    let _user_token_a_account = next_account_info(account_info_iter)?;
    let _user_token_b_account = next_account_info(account_info_iter)?;
    let _pool_token_a_account = next_account_info(account_info_iter)?;
    let _pool_token_b_account = next_account_info(account_info_iter)?;
    let _lp_token_mint = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let _token_program = next_account_info(account_info_iter)?;
    let _program_authority = next_account_info(account_info_iter)?;

    // Check signer
    if !user_wallet.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Load program state
    let mut program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;
    
    // Check if program is paused
    check_program_paused(&program_state)?;

    // Load pool data
    // In a real implementation, we would find the pool PDA and load it
    
    // Calculate token amounts to return
    // amount_a = lp_amount * reserve_a / total_supply
    // amount_b = lp_amount * reserve_b / total_supply
    
    // Placeholder calculation - in real implementation would use actual reserves and formula
    let token_a_amount = lp_amount.saturating_div(2); // Simplified placeholder
    let token_b_amount = lp_amount.saturating_div(2); // Simplified placeholder
    
    // Check minimum amounts
    if token_a_amount < minimum_a_amount || token_b_amount < minimum_b_amount {
        return Err(MultiHubSwapError::SlippageExceeded.into());
    }
    
    // In a production implementation, we would now:
    // 1. Burn LP tokens from user
    // 2. Transfer token A from pool to user
    // 3. Transfer token B from pool to user
    
    // Update program state
    program_state.last_update_time = Clock::get()?.unix_timestamp as u64;
    
    // Save updated program state
    program_state.serialize(&mut *program_state_account.data.borrow_mut())?;

    msg!("Removed liquidity: {} LP tokens", lp_amount);
    msg!("Received {} token A, {} token B", token_a_amount, token_b_amount);
    
    Ok(())
}

/// Process Claim Rewards instruction
fn process_claim_rewards(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let user_wallet = next_account_info(account_info_iter)?;
    let user_yos_token_account = next_account_info(account_info_iter)?;
    let user_rewards_account = next_account_info(account_info_iter)?;
    let program_yos_treasury = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;

    // Check signer
    if !user_wallet.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify reward account ownership
    // In a real implementation, derive the PDA for the user reward account and verify it matches
    
    // Load user rewards
    let mut user_rewards = UserRewards::try_from_slice(&user_rewards_account.data.borrow())?;
    
    // Check if there are rewards to claim
    let total_pending_rewards = user_rewards.pending_yos_rewards
        .saturating_add(user_rewards.pending_referral_rewards);
    
    if total_pending_rewards == 0 {
        return Err(MultiHubSwapError::NoRewardsAvailable.into());
    }

    // Transfer YOS tokens from treasury to user
    // In a real implementation, we would:
    // 1. Create the transfer instruction using the token program
    // 2. Execute the instruction with the program authority as a signer
    // Here's a simplified version:
    
    let transfer_ix = token_instruction::transfer(
        token_program.key,
        program_yos_treasury.key,
        user_yos_token_account.key,
        program_authority.key,
        &[],
        total_pending_rewards,
    )?;

    // Get authority seeds for signing
    let (authority_key, authority_bump) = Pubkey::find_program_address(&[b"authority"], program_id);
    let authority_seeds = &[b"authority".as_ref(), &[authority_bump]];

    // Execute transfer with PDA as signer
    invoke_signed(
        &transfer_ix,
        &[
            program_yos_treasury.clone(),
            user_yos_token_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[authority_seeds],
    )?;

    // Update user rewards state
    user_rewards.total_claimed = user_rewards.total_claimed.saturating_add(total_pending_rewards);
    user_rewards.pending_yos_rewards = 0;
    user_rewards.pending_referral_rewards = 0;
    user_rewards.last_update_time = Clock::get()?.unix_timestamp as u64;
    
    // Save updated user rewards
    user_rewards.serialize(&mut *user_rewards_account.data.borrow_mut())?;

    msg!("Claimed {} YOS rewards", total_pending_rewards);
    
    Ok(())
}

/// Process Claim Yield Rewards instruction
fn process_claim_yield_rewards(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let user_wallet = next_account_info(account_info_iter)?;
    let user_yos_token_account = next_account_info(account_info_iter)?;
    let lp_staking_account = next_account_info(account_info_iter)?;
    let program_yos_treasury = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let clock_sysvar = next_account_info(account_info_iter)?;

    // Check signer
    if !user_wallet.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify staking account ownership
    // In a real implementation, derive the PDA for the user staking account and verify it matches
    
    // Load staking data
    let mut staking_data = LpStaking::try_from_slice(&lp_staking_account.data.borrow())?;
    
    // Calculate rewards
    let current_time = Clock::get()?.unix_timestamp as u64;
    let time_since_last_harvest = current_time.saturating_sub(staking_data.last_harvest_time);
    
    // Calculate APR rewards using the program state's LP APR
    // For 100% APR and weekly payouts, we need to calculate the weekly share
    // 100% APR is approximately 1.4% per week (100% / 52 weeks = ~1.92%)
    // Here we'll use a simplified calculation
    
    let staked_amount = staking_data.staked_amount;
    let rewards_rate = 192; // 1.92% per week in basis points
    
    // Check if a week has passed since last harvest
    let seconds_in_week = 7 * 24 * 60 * 60;
    
    if time_since_last_harvest < seconds_in_week {
        // Not ready for harvest yet
        return Err(MultiHubSwapError::NoRewardsAvailable.into());
    }
    
    // Calculate weeks elapsed (rounded down)
    let weeks_elapsed = time_since_last_harvest / seconds_in_week;
    
    // Calculate rewards: staked amount * rate * weeks elapsed
    let pending_rewards = staked_amount
        .saturating_mul(rewards_rate as u64)
        .saturating_mul(weeks_elapsed)
        .saturating_div(10000); // Convert from basis points
    
    if pending_rewards == 0 {
        return Err(MultiHubSwapError::NoRewardsAvailable.into());
    }

    // Transfer YOS tokens from treasury to user
    let transfer_ix = token_instruction::transfer(
        token_program.key,
        program_yos_treasury.key,
        user_yos_token_account.key,
        program_authority.key,
        &[],
        pending_rewards,
    )?;

    // Get authority seeds for signing
    let (authority_key, authority_bump) = Pubkey::find_program_address(&[b"authority"], program_id);
    let authority_seeds = &[b"authority".as_ref(), &[authority_bump]];

    // Execute transfer with PDA as signer
    invoke_signed(
        &transfer_ix,
        &[
            program_yos_treasury.clone(),
            user_yos_token_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[authority_seeds],
    )?;

    // Update staking data
    staking_data.accumulated_rewards = staking_data.accumulated_rewards.saturating_add(pending_rewards);
    staking_data.last_harvest_time = current_time;
    
    // Save updated staking data
    staking_data.serialize(&mut *lp_staking_account.data.borrow_mut())?;

    msg!("Claimed {} YOS yield farming rewards", pending_rewards);
    
    Ok(())
}

/// Process Stake LP Tokens instruction
fn process_stake_lp_tokens(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let user_wallet = next_account_info(account_info_iter)?;
    let user_lp_token_account = next_account_info(account_info_iter)?;
    let program_lp_vault = next_account_info(account_info_iter)?;
    let lp_staking_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let clock_sysvar = next_account_info(account_info_iter)?;

    // Check signer
    if !user_wallet.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Transfer LP tokens from user to program vault
    let transfer_ix = token_instruction::transfer(
        token_program.key,
        user_lp_token_account.key,
        program_lp_vault.key,
        user_wallet.key,
        &[],
        amount,
    )?;
    
    invoke(
        &transfer_ix,
        &[
            user_lp_token_account.clone(),
            program_lp_vault.clone(),
            user_wallet.clone(),
            token_program.clone(),
        ],
    )?;

    // Update or create staking account
    if lp_staking_account.data_is_empty() {
        // Create new staking account
        let current_time = Clock::get()?.unix_timestamp as u64;
        
        let lp_staking = LpStaking {
            user: *user_wallet.key,
            lp_mint: *user_lp_token_account.key, // In real implementation, get this from token account
            staked_amount: amount,
            accumulated_rewards: 0,
            last_harvest_time: current_time,
            stake_start_time: current_time,
        };
        
        lp_staking.serialize(&mut *lp_staking_account.data.borrow_mut())?;
    } else {
        // Update existing staking account
        let mut lp_staking = LpStaking::try_from_slice(&lp_staking_account.data.borrow())?;
        
        // Ensure account belongs to user
        if lp_staking.user != *user_wallet.key {
            return Err(ProgramError::InvalidAccountData);
        }
        
        lp_staking.staked_amount = lp_staking.staked_amount.saturating_add(amount);
        lp_staking.serialize(&mut *lp_staking_account.data.borrow_mut())?;
    }

    msg!("Staked {} LP tokens for yield farming", amount);
    
    Ok(())
}

/// Process Unstake LP Tokens instruction
fn process_unstake_lp_tokens(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let user_wallet = next_account_info(account_info_iter)?;
    let user_lp_token_account = next_account_info(account_info_iter)?;
    let program_lp_vault = next_account_info(account_info_iter)?;
    let lp_staking_account = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let clock_sysvar = next_account_info(account_info_iter)?;

    // Check signer
    if !user_wallet.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Load staking data
    let mut lp_staking = LpStaking::try_from_slice(&lp_staking_account.data.borrow())?;
    
    // Ensure account belongs to user
    if lp_staking.user != *user_wallet.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check sufficient staked amount
    if lp_staking.staked_amount < amount {
        return Err(MultiHubSwapError::InsufficientFunds.into());
    }

    // Transfer LP tokens from program vault to user
    let transfer_ix = token_instruction::transfer(
        token_program.key,
        program_lp_vault.key,
        user_lp_token_account.key,
        program_authority.key,
        &[],
        amount,
    )?;
    
    // Get authority seeds for signing
    let (authority_key, authority_bump) = Pubkey::find_program_address(&[b"authority"], program_id);
    let authority_seeds = &[b"authority".as_ref(), &[authority_bump]];
    
    invoke_signed(
        &transfer_ix,
        &[
            program_lp_vault.clone(),
            user_lp_token_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        &[authority_seeds],
    )?;

    // Update staking data
    lp_staking.staked_amount = lp_staking.staked_amount.saturating_sub(amount);
    
    // If fully unstaked, we could close the account but for now we'll keep it
    lp_staking.serialize(&mut *lp_staking_account.data.borrow_mut())?;

    msg!("Unstaked {} LP tokens from yield farming", amount);
    
    Ok(())
}

/// Process Register Referrer instruction
fn process_register_referrer(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let user_wallet = next_account_info(account_info_iter)?;
    let referrer_account = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;

    // Check signer
    if !user_wallet.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Create referrer data
    let referrer_data = Referrer {
        referrer: *user_wallet.key,
        total_referred_users: 0,
        total_volume: 0,
        total_rewards: 0,
        created_at: Clock::get()?.unix_timestamp as u64,
    };
    
    // Save referrer data
    referrer_data.serialize(&mut *referrer_account.data.borrow_mut())?;

    msg!("Registered new referrer: {}", user_wallet.key);
    
    Ok(())
}

/// Process Update Parameters instruction
fn process_update_parameters(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    liquidity_contribution_percent: Option<u8>,
    admin_fee_percent: Option<u8>,
    yos_cashback_percent: Option<u8>,
    referral_percent: Option<u8>,
    lp_apr: Option<u16>,
    new_admin: Option<Pubkey>,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let admin_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;

    // Load program state
    let mut program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;

    // Verify admin signature
    if !admin_account.is_signer || program_state.admin != *admin_account.key {
        return Err(MultiHubSwapError::InvalidAuthority.into());
    }

    // Update parameters if provided
    if let Some(percent) = liquidity_contribution_percent {
        if percent > 50 {
            return Err(MultiHubSwapError::InvalidParameter.into()); // Max 50%
        }
        program_state.liquidity_contribution_percent = percent;
    }

    if let Some(percent) = admin_fee_percent {
        if percent > 10 {
            return Err(MultiHubSwapError::InvalidParameter.into()); // Max 1%
        }
        program_state.admin_fee_percent = percent;
    }

    if let Some(percent) = yos_cashback_percent {
        if percent > 50 {
            return Err(MultiHubSwapError::InvalidParameter.into()); // Max 5%
        }
        program_state.yos_cashback_percent = percent;
    }
    
    if let Some(percent) = referral_percent {
        if percent > 10 {
            return Err(MultiHubSwapError::InvalidParameter.into()); // Max 1%
        }
        program_state.referral_percent = percent;
    }
    
    if let Some(apr) = lp_apr {
        if apr > 20000 {
            return Err(MultiHubSwapError::InvalidParameter.into()); // Max 200%
        }
        program_state.lp_apr = apr;
    }

    if let Some(admin) = new_admin {
        program_state.admin = admin;
    }

    // Save updated program state
    program_state.serialize(&mut *program_state_account.data.borrow_mut())?;

    msg!("Program parameters updated successfully");
    Ok(())
}

/// Process Emergency Pause instruction
fn process_emergency_pause(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    pause: bool,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let admin_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;

    // Load program state
    let mut program_state = ProgramState::try_from_slice(&program_state_account.data.borrow())?;

    // Verify admin signature
    if !admin_account.is_signer || program_state.admin != *admin_account.key {
        return Err(MultiHubSwapError::InvalidAuthority.into());
    }

    // Update pause state
    program_state.is_paused = pause;
    
    // Save updated program state
    program_state.serialize(&mut *program_state_account.data.borrow_mut())?;

    if pause {
        msg!("Program PAUSED for emergency");
    } else {
        msg!("Program UNPAUSED and operational");
    }
    
    Ok(())
}

/// Helper function to determine if multi-hop swap is needed
fn should_use_multi_hop(
    input_token_mint: &Pubkey,
    output_token_mint: &Pubkey,
) -> (bool, bool) {
    // Check if direct swap is possible
    let is_direct_possible = is_direct_swap_supported(input_token_mint, output_token_mint);
    
    if is_direct_possible {
        return (false, false);
    }
    
    // Determine if we should route through SOL
    let sol_mint = get_sol_mint();
    let yot_mint = get_yot_mint();
    
    let is_input_sol = *input_token_mint == sol_mint;
    let is_output_sol = *output_token_mint == sol_mint;
    let is_input_yot = *input_token_mint == yot_mint;
    let is_output_yot = *output_token_mint == yot_mint;
    
    // If neither input nor output is SOL or YOT, we need multi-hop
    if (!is_input_sol && !is_output_sol && !is_input_yot && !is_output_yot) {
        // Default to routing through SOL
        return (true, true);
    }
    
    // If one token is SOL and the other is not YOT, route through YOT
    if (is_input_sol && !is_output_yot) || (is_output_sol && !is_input_yot) {
        return (true, false);
    }
    
    // If one token is YOT and the other is not SOL, route through SOL
    if (is_input_yot && !is_output_sol) || (is_output_yot && !is_input_sol) {
        return (true, true);
    }
    
    // Default to direct swap (should not reach here)
    (false, false)
}

/// Helper function to check if direct swap is supported
fn is_direct_swap_supported(
    input_token_mint: &Pubkey,
    output_token_mint: &Pubkey,
) -> bool {
    // In a real implementation, we would check if a liquidity pool exists
    // For simplicity, let's assume common pairs are always supported directly
    
    let sol_mint = get_sol_mint();
    let yot_mint = get_yot_mint();
    let yos_mint = get_yos_mint();
    
    // SOL-YOT and YOT-YOS are always directly supported
    if (*input_token_mint == sol_mint && *output_token_mint == yot_mint) ||
       (*input_token_mint == yot_mint && *output_token_mint == sol_mint) ||
       (*input_token_mint == yot_mint && *output_token_mint == yos_mint) ||
       (*input_token_mint == yos_mint && *output_token_mint == yot_mint) {
        return true;
    }
    
    // For other pairs, we'd check our pools registry
    // For now, assume most direct swaps are not supported
    false
}

/// Helper function to calculate output amount based on input amount
/// A real implementation would use actual AMM pool reserves
fn calculate_output_amount(
    amount_in: u64,
    input_token_mint: &Pubkey,
    output_token_mint: &Pubkey,
) -> Result<u64, ProgramError> {
    // In a real implementation, you would:
    // 1. Find the appropriate liquidity pool for the token pair
    // 2. Get the reserves for each token
    // 3. Apply the constant product formula (x * y = k)
    // 4. Calculate the output amount after fees
    
    let sol_mint = get_sol_mint();
    let yot_mint = get_yot_mint();
    let yos_mint = get_yos_mint();
    
    // Sample rates for demonstration
    // SOL to YOT rate: 1 SOL = 500,000 YOT
    let sol_to_yot_rate: u64 = 500_000;
    
    // YOT to SOL rate: 500,000 YOT = 1 SOL
    let yot_to_sol_rate: u64 = 500_000;
    
    // YOT to YOS rate: 10 YOT = 1 YOS
    let yot_to_yos_rate: u64 = 10;
    
    // YOS to YOT rate: 1 YOS = 10 YOT
    let yos_to_yot_rate: u64 = 10;
    
    // Calculate based on token pair
    if *input_token_mint == sol_mint && *output_token_mint == yot_mint {
        // SOL → YOT
        let output_amount = amount_in.saturating_mul(sol_to_yot_rate);
        Ok(output_amount)
    } else if *input_token_mint == yot_mint && *output_token_mint == sol_mint {
        // YOT → SOL
        let output_amount = amount_in.saturating_div(yot_to_sol_rate);
        Ok(output_amount)
    } else if *input_token_mint == yot_mint && *output_token_mint == yos_mint {
        // YOT → YOS
        let output_amount = amount_in.saturating_div(yot_to_yos_rate);
        Ok(output_amount)
    } else if *input_token_mint == yos_mint && *output_token_mint == yot_mint {
        // YOS → YOT
        let output_amount = amount_in.saturating_mul(yos_to_yot_rate);
        Ok(output_amount)
    } else {
        // For other pairs we'd use the actual AMM formula
        // For this example, we'll use a simplified approximation
        let output_amount = amount_in.saturating_div(2); // Placeholder
        Ok(output_amount)
    }
}

/// Calculate YOS cashback amount based on input amount and percentage
fn calculate_yos_cashback(amount_in: u64, cashback_percent: &u8) -> Result<u64, ProgramError> {
    // Example: For 3% cashback, calculate 3% of the input amount
    let cashback = amount_in.saturating_mul(*cashback_percent as u64).saturating_div(1000);
    Ok(cashback)
}

/// Helper to get SOL mint address
fn get_sol_mint() -> Pubkey {
    solana_program::pubkey!("So11111111111111111111111111111111111111112")
}

/// Helper to get YOT mint address
fn get_yot_mint() -> Pubkey {
    solana_program::pubkey!("2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF")
}

/// Helper to get YOS mint address
fn get_yos_mint() -> Pubkey {
    solana_program::pubkey!("GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n")
}

/// Extension trait for u64 to calculate square root
trait Sqrt {
    fn integer_sqrt(self) -> Self;
}

impl Sqrt for u64 {
    fn integer_sqrt(self) -> Self {
        if self == 0 {
            return 0;
        }
        
        let mut x = self;
        let mut y = (x + 1) / 2;
        
        while y < x {
            x = y;
            y = (x + self / x) / 2;
        }
        
        x
    }
}