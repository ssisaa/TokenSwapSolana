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

// Define the program's entrypoint
entrypoint!(process_instruction);

// Program state - manual serialization
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
    
    pub fn serialize(&self, dst: &mut [u8]) -> Result<(), ProgramError> {
        if dst.len() < Self::LEN {
            return Err(ProgramError::AccountDataTooSmall);
        }
        
        let dst = &mut dst[..Self::LEN];
        dst[0..32].copy_from_slice(&self.admin.to_bytes());
        dst[32..64].copy_from_slice(&self.yot_mint.to_bytes());
        dst[64..96].copy_from_slice(&self.yos_mint.to_bytes());
        
        dst[96..104].copy_from_slice(&self.lp_contribution_rate.to_le_bytes());
        dst[104..112].copy_from_slice(&self.admin_fee_rate.to_le_bytes());
        dst[112..120].copy_from_slice(&self.yos_cashback_rate.to_le_bytes());
        dst[120..128].copy_from_slice(&self.swap_fee_rate.to_le_bytes());
        dst[128..136].copy_from_slice(&self.referral_rate.to_le_bytes());
        
        Ok(())
    }
    
    pub fn deserialize(src: &[u8]) -> Result<Self, ProgramError> {
        if src.len() < Self::LEN {
            return Err(ProgramError::AccountDataTooSmall);
        }
        
        let admin = Pubkey::new(&src[0..32]);
        let yot_mint = Pubkey::new(&src[32..64]);
        let yos_mint = Pubkey::new(&src[64..96]);
        
        let lp_contribution_rate = u64::from_le_bytes(src[96..104].try_into().unwrap());
        let admin_fee_rate = u64::from_le_bytes(src[104..112].try_into().unwrap());
        let yos_cashback_rate = u64::from_le_bytes(src[112..120].try_into().unwrap());
        let swap_fee_rate = u64::from_le_bytes(src[120..128].try_into().unwrap());
        let referral_rate = u64::from_le_bytes(src[128..136].try_into().unwrap());
        
        Ok(Self {
            admin,
            yot_mint,
            yos_mint,
            lp_contribution_rate,
            admin_fee_rate,
            yos_cashback_rate,
            swap_fee_rate,
            referral_rate,
        })
    }
}

// Liquidity contribution tracking - manual serialization
pub struct LiquidityContribution {
    pub user: Pubkey,
    pub contributed_amount: u64,
    pub start_timestamp: i64,
    pub last_claim_time: i64,
    pub total_claimed_yos: u64,
}

impl LiquidityContribution {
    pub const LEN: usize = 32 + 8 + 8 + 8 + 8; // pubkey + u64 + i64 + i64 + u64
    
    pub fn serialize(&self, dst: &mut [u8]) -> Result<(), ProgramError> {
        if dst.len() < Self::LEN {
            return Err(ProgramError::AccountDataTooSmall);
        }
        
        let dst = &mut dst[..Self::LEN];
        dst[0..32].copy_from_slice(&self.user.to_bytes());
        dst[32..40].copy_from_slice(&self.contributed_amount.to_le_bytes());
        dst[40..48].copy_from_slice(&self.start_timestamp.to_le_bytes());
        dst[48..56].copy_from_slice(&self.last_claim_time.to_le_bytes());
        dst[56..64].copy_from_slice(&self.total_claimed_yos.to_le_bytes());
        
        Ok(())
    }
    
    pub fn deserialize(src: &[u8]) -> Result<Self, ProgramError> {
        if src.len() < Self::LEN {
            msg!("Account data too small for LiquidityContribution: {} < {}", src.len(), Self::LEN);
            return Err(ProgramError::AccountDataTooSmall);
        }
        
        let user = Pubkey::new(&src[0..32]);
        let contributed_amount = u64::from_le_bytes(src[32..40].try_into().unwrap());
        let start_timestamp = i64::from_le_bytes(src[40..48].try_into().unwrap());
        let last_claim_time = i64::from_le_bytes(src[48..56].try_into().unwrap());
        let total_claimed_yos = u64::from_le_bytes(src[56..64].try_into().unwrap());
        
        Ok(Self {
            user,
            contributed_amount,
            start_timestamp,
            last_claim_time,
            total_claimed_yos,
        })
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
    
    let yot_mint = Pubkey::new(&data[0..32]);
    let yos_mint = Pubkey::new(&data[32..64]);
    
    // Create the program state account
    invoke_signed(
        &system_instruction::create_account(
            admin.key,
            program_state_account.key,
            Rent::get()?.minimum_balance(ProgramState::LEN),
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
        lp_contribution_rate: 20, // 20%
        admin_fee_rate: 0,        // 0%
        yos_cashback_rate: 5,     // 5%
        swap_fee_rate: 1,         // 1%
        referral_rate: 0,         // 0%
    };
    
    program_state.serialize(&mut program_state_account.data.borrow_mut())?;
    
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
    
    // Get program authority
    let program_authority_account = if accounts_iter.len() > 0 {
        next_account_info(accounts_iter)?
    } else {
        user // Placeholder, won't be used directly
    };
    
    // Get pool authority if provided
    let _pool_authority = if accounts_iter.len() > 0 {
        next_account_info(accounts_iter)?
    } else {
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
        msg!("Expected contribution PDA: {}", contribution_pda);
        msg!("Provided account: {}", liquidity_contribution_account.key);
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
        let timestamp = Clock::get()?.unix_timestamp;
        let contribution_data = LiquidityContribution {
            user: *user.key,
            contributed_amount: 0, // Will update below
            start_timestamp: timestamp,
            last_claim_time: timestamp,
            total_claimed_yos: 0,
        };
        
        // Use manual serialization
        msg!("Initializing liquidity contribution account with manual serialization");
        contribution_data.serialize(&mut liquidity_contribution_account.data.borrow_mut())?;
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

    // Update contribution data with amount added to liquidity
    msg!("Updating liquidity contribution with {} YOT", liquidity_portion);
    
    // Use manual deserialization and serialization
    let mut contribution_data = LiquidityContribution::deserialize(&liquidity_contribution_account.data.borrow())?;
    contribution_data.contributed_amount += liquidity_portion;
    contribution_data.serialize(&mut liquidity_contribution_account.data.borrow_mut())?;

    // Mint YOS cashback tokens directly to user
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

// Add implementations for other instructions using similar manual serialization approach
pub fn process_swap(program_id: &Pubkey, accounts: &[AccountInfo], amount: u64) -> ProgramResult {
    msg!("Swap functionality not implemented in this version");
    Ok(())
}

pub fn process_contribute(program_id: &Pubkey, accounts: &[AccountInfo], amount: u64) -> ProgramResult {
    msg!("Contribute functionality not implemented in this version");
    Ok(())
}

pub fn process_claim_rewards(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
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
    
    // Read contribution data using manual deserialization
    let mut contribution_data = LiquidityContribution::deserialize(
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
    
    // Update contribution data using manual serialization
    contribution_data.last_claim_time = current_time;
    contribution_data.total_claimed_yos += reward_amount;
    contribution_data.serialize(&mut liquidity_contribution_account.data.borrow_mut())?;
    
    msg!("Weekly rewards claimed successfully: {} YOS", reward_amount);
    Ok(())
}

pub fn process_withdraw_liquidity(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    msg!("Withdraw functionality not implemented in this version");
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
    msg!("UpdateParameters functionality not implemented in this version");
    Ok(())
}