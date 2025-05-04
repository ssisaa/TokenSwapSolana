// MultihubSwap v4 - Dedicated entry point

use solana_program::{
    account_info::AccountInfo, entrypoint, entrypoint::ProgramResult, pubkey::Pubkey,
};

// Include the v4 implementation with manual byte parsing
pub mod multihub_swap_v4;

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Direct to the v4 implementation with manual buffer parsing
    multihub_swap_v4::process_instruction(program_id, accounts, instruction_data)
}