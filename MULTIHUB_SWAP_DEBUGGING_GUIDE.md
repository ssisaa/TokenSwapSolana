# MultiHub Swap Program Debugging Guide

This document provides a step-by-step guide for implementing the enhanced debug functionality in the MultiHub Swap Solana program.

## Current Issue Analysis

The current error is:
```
Transaction simulation failed: {"InstructionError":[1,{"Custom":0}]}
```

This error indicates that instruction index 1 (the second instruction in the transaction) failed with a Custom error code 0, which in Solana programs typically represents an "InvalidInstruction" error.

The transaction logs show 11 accounts being provided:
```
Transaction accounts: 
(11) [
  0. signer
  1. input_token_account
  2. output_token_account
  3. yos_token_account
  4. program_state
  5. UNKNOWN? (qYXqPackMpHqoHsaMtr1Rj9EvWD29SshkJ2TrXMNVfx)
  6. UNKNOWN? (9qzenYajoPvBudNZPssg2jv21trPfNmmp4rg1VQgMjAh)
  7. token_program
  8. sol_mint
  9. yot_mint
 10. system_program
]
```

However, the contract expects exactly 8 accounts:
```
1. user_account (signer)
2. user_input_token_account 
3. user_output_token_account
4. user_yos_token_account
5. program_state_account
6. token_program
7. input_token_mint
8. output_token_mint
```

## Step 1: Update the `process_swap_token` function

Replace the existing `process_swap_token` function in your Solana program with the enhanced version we've provided in `enhanced_multihub_swap.rs`. This new implementation includes:

1. Detailed logging of all inputs and accounts
2. Comprehensive validation of token accounts
3. Explicit minting checking
4. Calculation logging for all financial operations
5. Error branch identification

## Step 2: Update the Instruction Data Parsing

Ensure the instruction data is properly decoded. Here's how it should be processed:

```rust
// In your processor.rs or lib.rs file
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = instruction_data[0];
    msg!("Processing instruction: {}", instruction);
    
    match instruction {
        0 => {
            // Initialize logic
            process_initialize(program_id, accounts, &instruction_data[1..])?;
        },
        1 => {
            // Updated Swap Token instruction handling
            msg!("SWAP TOKEN instruction detected");
            msg!("Instruction data length: {}", instruction_data.len());
            
            // Ensure the data has the correct length (1 + 8 + 8 = 17 bytes)
            if instruction_data.len() != 17 {
                msg!("❌ ERROR: Invalid instruction data length: {}, expected 17 bytes", instruction_data.len());
                msg!("Data format should be: [1, amount_in (8 bytes), minimum_amount_out (8 bytes)]");
                return Err(ProgramError::InvalidInstructionData);
            }
            
            // Parse the instruction data
            let amount_in = instruction_data[1..9].try_into()
                .map(u64::from_le_bytes)
                .map_err(|_| {
                    msg!("❌ ERROR: Failed to parse amount_in");
                    ProgramError::InvalidInstructionData
                })?;
                
            let minimum_amount_out = instruction_data[9..17].try_into()
                .map(u64::from_le_bytes)
                .map_err(|_| {
                    msg!("❌ ERROR: Failed to parse minimum_amount_out");
                    ProgramError::InvalidInstructionData
                })?;
            
            msg!("Decoded swap parameters: amount_in={}, minimum_amount_out={}", 
                amount_in, minimum_amount_out);
                
            process_swap_token(program_id, accounts, amount_in, minimum_amount_out)?;
        },
        // Other instruction types...
        _ => {
            msg!("❌ ERROR: Unrecognized instruction: {}", instruction);
            return Err(ProgramError::InvalidInstructionData);
        }
    }
    
    Ok(())
}
```

## Step 3: Build and Deploy the Updated Program

1. Build the program with the enhanced debugging:
   ```bash
   cargo build-bpf
   ```

2. Deploy the updated program to Solana devnet:
   ```bash
   solana program deploy --keypair your-keypair.json --program-id your-program-id.json target/deploy/your_program.so
   ```

## Step 4: Client-Side Updates

Update your client code to ensure it's sending exactly 8 accounts in the correct order:

```typescript
const finalSwapInstruction = new TransactionInstruction({
  keys: [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },             // 0. User wallet (signer)
    { pubkey: fromTokenAccount, isSigner: false, isWritable: true },            // 1. User's input token account
    { pubkey: toTokenAccount, isSigner: false, isWritable: true },              // 2. User's output token account
    { pubkey: yosTokenAccount, isSigner: false, isWritable: true },             // 3. User's YOS token account (for cashback)
    { pubkey: programStateAddress, isSigner: false, isWritable: true },         // 4. Program state account
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },           // 5. Token program
    { pubkey: fromMint, isSigner: false, isWritable: false },                   // 6. Input token mint
    { pubkey: toMint, isSigner: false, isWritable: false },                     // 7. Output token mint
  ],
  programId: MULTIHUB_SWAP_PROGRAM_ID,
  data: data
});
```

## Step 5: Debug Data Format

Ensure the instruction data is encoded properly:

```typescript
// Format: [1, amount_in (8 bytes), min_amount_out (8 bytes)]
const SWAP_TOKEN_INSTRUCTION = 1;
const data = Buffer.alloc(1 + 8 + 8);
data.writeUInt8(SWAP_TOKEN_INSTRUCTION, 0);
  
// Write the bigint values as little-endian 64-bit integers
const amountBuffer = Buffer.alloc(8);
const minAmountBuffer = Buffer.alloc(8);

// Convert BigInt to bytes (little-endian)
let tempBigInt = amountRaw;
for (let i = 0; i < 8; i++) {
  amountBuffer.writeUInt8(Number(tempBigInt & BigInt(0xFF)), i);
  tempBigInt = tempBigInt >> BigInt(8);
}

tempBigInt = minAmountOutRaw;
for (let i = 0; i < 8; i++) {
  minAmountBuffer.writeUInt8(Number(tempBigInt & BigInt(0xFF)), i);
  tempBigInt = tempBigInt >> BigInt(8);
}

// Copy the individual buffers into the main data buffer
amountBuffer.copy(data, 1);
minAmountBuffer.copy(data, 9);
```

## Step 6: Testing

When running a new transaction, look for the detailed logs in the Solana Explorer. If the transaction fails, you'll see specific error messages indicating the exact failure point:

- Token account validation errors
- Mint validation errors
- Arithmetic errors
- Ownership errors

## Common Issues and Solutions

1. **Account Count Mismatch**: If you see "Invalid number of accounts", ensure your client is providing exactly 8 accounts in the correct order.

2. **Token Account Mint Mismatch**: Check that the token accounts match the specified mints. You'll see "Input token account mint mismatch" or similar errors.

3. **Insufficient Funds**: Ensure the input token account has enough tokens for the swap.

4. **Invalid Instruction Data**: Check the format of the instruction data - it should be exactly 17 bytes with the correct structure.

5. **Owner Mismatch**: Ensure all token accounts are owned by the correct entities.

## Understanding the Program Logs

The enhanced logging will produce detailed information in this format:

```
⭐ MULTIHUB SWAP: Starting swap operation
Amount in: 1000000000, Minimum amount out: 950000000
Number of accounts provided: 8
User account: Addr123..., is_signer: true, is_writable: true
User input token account: Addr456..., is_writable: true
...
Input token account mint: Addr789..., expected: Addr789...
Input token account balance: 5000000000
...
```

Look for logs starting with "❌ ERROR:" which indicate the specific failure point.