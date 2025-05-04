# Program Derived Address (PDA) Account Handling Guide

## The Problem: InvalidAccountData Error in Solana Programs

When working with Solana programs that use PDAs (Program Derived Addresses), a common error is `InvalidAccountData`. This often occurs when:

1. A program tries to deserialize or access data from a PDA that is only meant to be used as a signer
2. The PDA either has no data or has data in a different format than expected
3. Token accounts referenced in the transaction are not properly initialized

## Root Cause: Incorrect PDA Data Access

PDAs are often used in two distinct ways:

1. **PDA as data account**: Storing program state, created with space allocation and properly initialized
2. **PDA as signer**: Acting as a signature authority, with no data (empty account)

The error occurs when trying to deserialize token data from either:
- A PDA that's only meant for signing, not storing data
- A token account that hasn't been properly initialized

## Fixed Program Code Example

### Rust Side Fix:

```rust
// For authority PDAs that only act as signers:
// 1. Only check the key matches, don't access data
let (expected_authority, authority_bump) = find_program_authority_address(program_id);

// Add debug logs
msg!("Account[2] key: {}", program_authority_account.key);
msg!("Expected PDA: {}", expected_authority);

if *program_authority_account.key != expected_authority {
    msg!("❌ Invalid program authority");
    return Err(ProgramError::InvalidAccountData);
}

// 2. Only use program_authority_account in invoke_signed calls like:
invoke_signed(
    &some_instruction,
    &[
        account1.clone(),
        account2.clone(),
        program_authority_account.clone(),
    ],
    &[&[b"authority", &[authority_bump]]],
)?;
```

### TypeScript Side Fix:

```typescript
// Make sure PDA derivation matches exactly between client and program
const [authorityPDA, authorityBump] = PublicKey.findProgramAddressSync(
  [Buffer.from("authority")],
  new PublicKey(PROGRAM_ID)
);

// Ensure account ordering matches exactly
transaction.add({
  keys: [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },      // [0]
    { pubkey: programStateAddress, isSigner: false, isWritable: true },  // [1]
    { pubkey: authorityPDA, isSigner: false, isWritable: true },         // [2]
    // Other accounts...
  ],
  programId: new PublicKey(PROGRAM_ID),
  data: instructionData
});
```

## Common Mistakes to Avoid

1. Don't try to deserialize data from authority PDAs (`program_authority_account.data.borrow()`)
2. Don't attempt to read token account data until you've verified the account exists and is initialized
3. Never assume token accounts exist - always check and create if needed
4. Add proper error handling when token accounts fail to deserialize 
5. Use debug messages in Rust to see what's happening with account data

## Before Deployment Checklist

- [ ] PDAs used only as signers have no data access code
- [ ] Token accounts are properly initialized before first use
- [ ] Account ordering matches exactly between client and program
- [ ] Debug logging is in place for troubleshooting
- [ ] Error handling gracefully addresses missing or invalid accounts