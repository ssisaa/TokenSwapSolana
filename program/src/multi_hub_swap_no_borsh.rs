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
use arrayref::{array_ref, array_refs, array_mut_ref};

// Program state structure definition (manual serialization)
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
    // Size of the data structure in bytes
    pub const LEN: usize = 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8; // 3 pubkeys + 5 u64 rates

    // Manual deserialization from account data
    pub fn from_bytes(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() < Self::LEN {
            msg!("Data too short for ProgramState");
            return Err(ProgramError::InvalidAccountData);
        }

        let data_array = array_ref![data, 0, Self::LEN];
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

    // Manual serialization to account data
    pub fn to_bytes(&self, data: &mut [u8]) -> Result<(), ProgramError> {
        if data.len() < Self::LEN {
            msg!("Data buffer too small for ProgramState");
            return Err(ProgramError::InvalidAccountData);
        }

        let data_array = array_mut_ref![data, 0, Self::LEN];
        let (
            admin_dst,
            yot_mint_dst,
            yos_mint_dst,
            lp_contribution_rate_dst,
            admin_fee_rate_dst,
            yos_cashback_rate_dst,
            swap_fee_rate_dst,
            referral_rate_dst,
        ) = array_refs_mut![data_array, 32, 32, 32, 8, 8, 8, 8, 8];

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

// Liquidity contribution structure (manual serialization)
pub struct LiquidityContribution {
    pub user: Pubkey,
    pub contributed_amount: u64,
    pub start_timestamp: i64,
    pub last_claim_time: i64,
    pub total_claimed_yos: u64,
}

impl LiquidityContribution {
    // Size of the data structure in bytes
    pub const LEN: usize = 32 + 8 + 8 + 8 + 8; // pubkey + u64 + i64 + i64 + u64

    // Manual deserialization from account data
    pub fn from_bytes(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() < Self::LEN {
            msg!("Data too short for LiquidityContribution");
            return Err(ProgramError::InvalidAccountData);
        }

        let data_array = array_ref![data, 0, Self::LEN];
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

    // Manual serialization to account data
    pub fn to_bytes(&self, data: &mut [u8]) -> Result<(), ProgramError> {
        if data.len() < Self::LEN {
            msg!("Data buffer too small for LiquidityContribution");
            return Err(ProgramError::InvalidAccountData);
        }

        let data_array = array_mut_ref![data, 0, Self::LEN];
        let (
            user_dst,
            contributed_amount_dst,
            start_timestamp_dst,
            last_claim_time_dst,
            total_claimed_yos_dst,
        ) = array_refs_mut![data_array, 32, 8, 8, 8, 8];

        user_dst.copy_from_slice(self.user.as_ref());
        *contributed_amount_dst = self.contributed_amount.to_le_bytes();
        *start_timestamp_dst = self.start_timestamp.to_le_bytes();
        *last_claim_time_dst = self.last_claim_time.to_le_bytes();
        *total_claimed_yos_dst = self.total_claimed_yos.to_le_bytes();

        Ok(())
    }
}

// Function to find the program state PDA
pub fn find_program_state_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"state"], program_id)
}

// Function to find the program authority PDA
pub fn find_program_authority(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"authority"], program_id)
}

// The main buy_and_distribute function using manual serialization
pub fn process_buy_and_distribute(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    // Extract accounts
    let user = next_account_info(accounts_iter)?;
    let user_yot = next_account_info(accounts_iter)?;
    let vault_yot = next_account_info(accounts_iter)?;
    let user_yos = next_account_info(accounts_iter)?;
    let program_yos = next_account_info(accounts_iter)?;
    let liquidity_contribution_account = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    let rent_sysvar = next_account_info(accounts_iter)?;
    let program_state_account = next_account_info(accounts_iter)?;
    let authority_account = next_account_info(accounts_iter)?;
    let pool_authority = next_account_info(accounts_iter)?;

    // Verify user is a signer
    if !user.is_signer {
        msg!("User must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify program state PDA
    let (state_pda, _) = find_program_state_address(program_id);
    if state_pda != *program_state_account.key {
        msg!("Invalid program state account");
        return Err(ProgramError::InvalidAccountData);
    }

    // Verify program authority PDA
    let (authority_pda, authority_bump) = find_program_authority(program_id);
    if authority_pda != *authority_account.key {
        msg!("Invalid program authority account");
        return Err(ProgramError::InvalidAccountData);
    }

    // Verify liquidity contribution PDA
    let (contribution_pda, contribution_bump) = Pubkey::find_program_address(
        &[b"liq", user.key.as_ref()],
        program_id
    );

    if contribution_pda != *liquidity_contribution_account.key {
        msg!("Invalid liquidity contribution account");
        return Err(ProgramError::InvalidAccountData);
    }

    // Get program state data
    let program_state = ProgramState::from_bytes(&program_state_account.data.borrow())?;

    // Calculate distribution amounts
    let lp_contribution_rate = program_state.lp_contribution_rate;
    let yos_cashback_rate = program_state.yos_cashback_rate;
    
    msg!("Distribution parameters - LP rate: {}, YOS rate: {}", lp_contribution_rate, yos_cashback_rate);
    
    // Calculate the portion for liquidity contribution (20%)
    let liquidity_portion = (amount * lp_contribution_rate) / 10000;
    
    // Calculate YOS cashback amount (5%)
    let yos_cashback = (amount * yos_cashback_rate) / 10000;
    
    msg!("For {} YOT - Liquidity: {}, YOS cashback: {}", amount, liquidity_portion, yos_cashback);

    // Check if liquidity contribution account exists and create if needed
    if liquidity_contribution_account.data_is_empty() {
        msg!("Creating new liquidity contribution account");
        
        // Get rent exemption amount
        let rent = Rent::get()?;
        let required_lamports = rent.minimum_balance(LiquidityContribution::LEN);
        
        // Create the account
        invoke_signed(
            &system_instruction::create_account(
                user.key,
                liquidity_contribution_account.key,
                required_lamports,
                LiquidityContribution::LEN as u64,
                program_id,
            ),
            &[
                user.clone(),
                liquidity_contribution_account.clone(),
                system_program.clone(),
            ],
            &[&[b"liq", user.key.as_ref(), &[contribution_bump]]],
        )?;

        // Initialize contribution data
        let contribution_data = LiquidityContribution {
            user: *user.key,
            contributed_amount: 0,
            start_timestamp: Clock::get()?.unix_timestamp,
            last_claim_time: Clock::get()?.unix_timestamp,
            total_claimed_yos: 0,
        };
        
        // Serialize the data into the account
        contribution_data.to_bytes(&mut liquidity_contribution_account.data.borrow_mut())?;
    }

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

    // Update contribution data
    msg!("Updating liquidity contribution with {} YOT", liquidity_portion);
    let mut contribution_data = LiquidityContribution::from_bytes(&liquidity_contribution_account.data.borrow())?;
    contribution_data.contributed_amount += liquidity_portion;
    contribution_data.to_bytes(&mut liquidity_contribution_account.data.borrow_mut())?;

    // Mint YOS cashback tokens to user if amount is greater than zero
    if yos_cashback > 0 {
        msg!("Minting {} YOS cashback tokens to user", yos_cashback);
        invoke_signed(
            &spl_token::instruction::transfer(
                token_program.key,
                program_yos.key,
                user_yos.key,
                &authority_pda,
                &[],
                yos_cashback,
            )?,
            &[
                program_yos.clone(),
                user_yos.clone(),
                authority_account.clone(),
                token_program.clone(),
            ],
            &[&[b"authority", &[authority_bump]]],
        )?;
    }

    msg!("Buy and distribute completed successfully");
    Ok(())
}

// Function to claim weekly YOS rewards
pub fn process_claim_weekly_reward(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Extract accounts
    let user = next_account_info(accounts_iter)?;
    let user_yos_account = next_account_info(accounts_iter)?;
    let program_yos_account = next_account_info(accounts_iter)?;
    let liquidity_contribution_account = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    let program_state_account = next_account_info(accounts_iter)?;
    let authority_account = next_account_info(accounts_iter)?;
    
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
    
    // Verify program authority PDA
    let (authority_pda, authority_bump) = find_program_authority(program_id);
    if authority_pda != *authority_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Read contribution data
    let mut contribution_data = LiquidityContribution::from_bytes(
        &liquidity_contribution_account.data.borrow()
    )?;
    
    // Make sure user matches the contribution account
    if contribution_data.user != *user.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Get current time
    let current_time = Clock::get()?.unix_timestamp;
    
    // Check if one week has passed since last claim (7 days = 604800 seconds)
    const SECONDS_IN_WEEK: i64 = 604800;
    
    if current_time - contribution_data.last_claim_time < SECONDS_IN_WEEK {
        msg!("Cannot claim rewards yet: one week has not passed");
        return Err(ProgramError::Custom(100)); // Custom error for time check
    }
    
    // Check that there's a contribution amount
    if contribution_data.contributed_amount == 0 {
        msg!("No contribution to claim rewards on");
        return Err(ProgramError::Custom(101)); // Custom error for no contribution
    }
    
    // Calculate reward: 2% of contribution per week
    const WEEKLY_REWARD_RATE: u64 = 200; // 2% = 200 basis points
    let reward_amount = (contribution_data.contributed_amount * WEEKLY_REWARD_RATE) / 10000;
    
    msg!("Calculating weekly reward: {} * {}% = {} YOS", 
         contribution_data.contributed_amount, 
         WEEKLY_REWARD_RATE as f64 / 100.0,
         reward_amount);
    
    // Transfer YOS tokens to user
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            program_yos_account.key,
            user_yos_account.key,
            &authority_pda,
            &[],
            reward_amount,
        )?,
        &[
            program_yos_account.clone(),
            user_yos_account.clone(),
            authority_account.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Update contribution data
    contribution_data.last_claim_time = current_time;
    contribution_data.total_claimed_yos += reward_amount;
    contribution_data.to_bytes(&mut liquidity_contribution_account.data.borrow_mut())?;
    
    msg!("Weekly rewards claimed successfully: {} YOS", reward_amount);
    Ok(())
}

// Function to withdraw liquidity
pub fn process_withdraw_contribution(
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
    let authority_account = next_account_info(accounts_iter)?;
    
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
    
    // Verify program authority PDA
    let (authority_pda, authority_bump) = find_program_authority(program_id);
    if authority_pda != *authority_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Read contribution data
    let mut contribution_data = LiquidityContribution::from_bytes(
        &liquidity_contribution_account.data.borrow()
    )?;
    
    // Make sure user matches the contribution account
    if contribution_data.user != *user.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Make sure there's a contribution amount
    if contribution_data.contributed_amount == 0 {
        return Err(ProgramError::Custom(102)); // Custom error for no contribution
    }
    
    // Get withdraw amount (full contribution)
    let withdraw_amount = contribution_data.contributed_amount;
    
    // Transfer YOT back to user
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            vault_yot.key,
            user_yot.key,
            &authority_pda,
            &[],
            withdraw_amount,
        )?,
        &[
            vault_yot.clone(),
            user_yot.clone(),
            authority_account.clone(),
            token_program.clone(),
        ],
        &[&[b"authority", &[authority_bump]]],
    )?;
    
    // Update contribution data
    contribution_data.contributed_amount = 0;
    contribution_data.to_bytes(&mut liquidity_contribution_account.data.borrow_mut())?;
    
    msg!("Liquidity contribution withdrawn successfully: {} YOT", withdraw_amount);
    Ok(())
}

// Update parameters function
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
    
    // Extract accounts
    let admin = next_account_info(accounts_iter)?;
    let program_state_account = next_account_info(accounts_iter)?;
    
    // Verify admin is signer
    if !admin.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify program state PDA
    let (state_pda, _) = find_program_state_address(program_id);
    if state_pda != *program_state_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Get program state
    let mut state = ProgramState::from_bytes(&program_state_account.data.borrow())?;
    
    // Validate admin
    if state.admin != *admin.key {
        msg!("Only the admin can update parameters");
        return Err(ProgramError::Custom(103)); // Custom error for unauthorized
    }
    
    // Validate parameters
    if lp_rate > 5000 { // Max 50%
        return Err(ProgramError::Custom(104));
    }
    
    if cashback_rate > 2000 { // Max 20%
        return Err(ProgramError::Custom(105));
    }
    
    if admin_fee > 1000 { // Max 10%
        return Err(ProgramError::Custom(106));
    }
    
    if swap_fee > 1000 { // Max 10%
        return Err(ProgramError::Custom(107));
    }
    
    if referral_rate > 1000 { // Max 10%
        return Err(ProgramError::Custom(108));
    }
    
    // Update parameters
    state.lp_contribution_rate = lp_rate;
    state.yos_cashback_rate = cashback_rate;
    state.admin_fee_rate = admin_fee;
    state.swap_fee_rate = swap_fee;
    state.referral_rate = referral_rate;
    
    // Save updated state
    state.to_bytes(&mut program_state_account.data.borrow_mut())?;
    
    // Log successful update
    msg!("✅ Program parameters updated successfully:");
    msg!("- LP contribution rate: {}", lp_rate);
    msg!("- YOS cashback rate: {}", cashback_rate);
    msg!("- Admin fee rate: {}", admin_fee);
    msg!("- Swap fee rate: {}", swap_fee);
    msg!("- Referral rate: {}", referral_rate);
    
    Ok(())
}