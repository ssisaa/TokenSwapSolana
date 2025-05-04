pub mod multihub_swap_v3;
pub mod multihub_swap_v4;

use solana_program::{
    account_info::AccountInfo, entrypoint, entrypoint::ProgramResult, pubkey::Pubkey,
};

entrypoint!(process_instruction);

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // We're now using the v4 implementation with direct buffer parsing
    multihub_swap_v4::process_instruction(program_id, accounts, instruction_data)
}