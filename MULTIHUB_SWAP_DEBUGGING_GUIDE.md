# MultiHub Swap Debugging Guide

## Current Error Analysis

We're encountering an error when trying to execute the MultiHub swap functionality. The specific error from transaction simulation is:

```
Simulation failed: {"InstructionError":[3,{"Custom":11}]}
```

This shows:
- The error is happening in instruction index 3 of the transaction
- The custom error code is 11, which typically represents **InvalidMint** in the SPL Token program

## Understanding InvalidMint Error (Custom Code 11)

According to the SPL Token program, Custom Error 11 (InvalidMint) occurs when:
1. A token account is being created with an invalid mint address
2. A token account's mint doesn't match the expected mint for an operation
3. There's a mismatch between token accounts and the mints they're supposed to belong to

## Account Structure Requirements

For correct operation, our MultiHub Swap requires the following accounts (in this exact order):

1. **User (Signer)**: The wallet initiating the transaction (must be signer)
2. **User Input Token Account**: Account holding the tokens to be swapped from
3. **User Output Token Account**: Account where swapped tokens will be sent
4. **User YOS Token Account**: Account where cashback YOS tokens will be sent
5. **Program State Account**: Account storing the MultiHub Swap program's state
6. **Token Program**: The SPL Token program ID
7. **Input Token Mint**: Mint address of the input token
8. **Output Token Mint**: Mint address of the output token

## Common Account Structure Issues

1. **Incorrect Account Order**: Accounts must be provided in exactly the order listed above
2. **Missing Accounts**: All 8 accounts must be provided, even if some are only used conditionally
3. **Token Account Mismatch**: The user's token accounts must be associated with the correct mint addresses
4. **YOS Token Account Issue**: Most commonly, the YOS token account may not exist yet

## Detailed Debugging Steps

### 1. Verify Token Accounts Exist

For SOL-to-YOT or YOT-to-SOL swaps, ensure these token accounts exist for your wallet:

```javascript
// Check YOT token account
const yotTokenAccount = await getAssociatedTokenAddress(
  new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF'),
  wallet.publicKey
);
console.log("YOT token account:", yotTokenAccount.toString());

// Check YOS token account (needed for cashback)
const yosTokenAccount = await getAssociatedTokenAddress(
  new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n'),
  wallet.publicKey
);
console.log("YOS token account:", yosTokenAccount.toString());
```

### 2. Create Missing Token Accounts

If the YOS token account doesn't exist, you need to create it before making the swap:

```javascript
// Create instructions to create YOS token account if it doesn't exist
const createYosAccountInstructions = [];
if (!(await connection.getAccountInfo(yosTokenAccount))) {
  console.log("YOS token account doesn't exist, creating it...");
  createYosAccountInstructions.push(
    createAssociatedTokenAccountInstruction(
      wallet.publicKey, // payer
      yosTokenAccount, // associated token account
      wallet.publicKey, // owner
      new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n') // YOS mint
    )
  );
}

// Add these instructions to the transaction before the swap instructions
```

### 3. Fixing the InvalidMint Error

Since we're seeing a Custom Error 11 (InvalidMint) in instruction index 3, this likely means:

1. The token accounts are being created correctly (instructions 0-2)
2. The swap instruction (index 3) is failing due to invalid mint associations

Possible fixes:

```javascript
// Ensure we're using the correct mint addresses
const SOL_TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const YOT_TOKEN_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
const YOS_TOKEN_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');

// Make sure the token accounts match these mints
// For example, when swapping SOL to YOT:
//   - Input token mint should be SOL_TOKEN_MINT
//   - Output token mint should be YOT_TOKEN_MINT
//   - Cashback token mint should be YOS_TOKEN_MINT
```

## Enhanced Logging Setup

Add these logging statements in your Rust code to get more detailed information:

```rust
// Near the token mint verification:
msg!("Input token mint: {}, expected to match user input account mint", input_token_mint.key);
msg!("Output token mint: {}, expected to match user output account mint", output_token_mint.key);
msg!("YOS mint (for cashback): {}", program_state.yos_mint);

// After unpacking token accounts:
if let Ok(input_token_account) = Account::unpack(&user_input_token_account.data.borrow()) {
    msg!("Input token account mint: {}", input_token_account.mint);
    if input_token_account.mint != *input_token_mint.key {
        msg!("❌ ERROR: Input token account mint {} doesn't match expected mint {}", 
             input_token_account.mint, input_token_mint.key);
        return Err(ProgramError::InvalidArgument);
    }
}
```

## JavaScript Client Improvements

Update your client code to explicitly check token accounts:

```javascript
// Add explicit checks for token accounts
console.log("From token mint:", fromAddress.toString());  
console.log("To token mint:", toAddress.toString());

// Get associated token accounts for these mints
const fromTokenAccount = await getAssociatedTokenAddress(
  fromAddress,
  wallet.publicKey
);

const toTokenAccount = await getAssociatedTokenAddress(
  toAddress,
  wallet.publicKey
);

console.log("From token account:", fromTokenAccount.toString());
console.log("To token account:", toTokenAccount.toString());

// Check if accounts exist
const fromAccountInfo = await connection.getAccountInfo(fromTokenAccount);
const toAccountInfo = await connection.getAccountInfo(toTokenAccount);

console.log("From token account exists:", !!fromAccountInfo);
console.log("To token account exists:", !!toAccountInfo);

// Create missing accounts if needed
// ...
```

## Conclusion

The error "Custom Error 11 (InvalidMint)" in the MultiHub Swap program is typically caused by:

1. Missing token accounts
2. Token accounts associated with the wrong mints
3. Incorrect account order in the transaction

By following the debugging steps above, you should be able to identify and fix the specific issue in your implementation.