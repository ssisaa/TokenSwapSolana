# MultiHub Swap Debugging Guide

This guide provides troubleshooting steps for common issues with the MultiHub Swap functionality.

## Common Error Messages

### 1. "Transaction simulation failed: Error: InstructionError(1, Custom(0))"

**Likely Cause**: The YOS token account for the user doesn't exist or has not been properly initialized.

**Solution**:
- Use the fixed implementation which ensures the YOS token account exists before calling the swap function
- If using the original implementation, manually create a YOS token account for the user before swapping

### 2. "Failed to unpack YOS token account data"

**Likely Cause**: The contract is trying to access a non-existent YOS token account.

**Solution**:
- Create the YOS token account before calling the swap function:
```javascript
const userYosAta = await getOrCreateAssociatedTokenAccount(
  connection,
  wallet,
  yosMintAddress,
  wallet.publicKey
);
```

### 3. "Program returned error: InvalidAccountData"

**Likely Cause**: One of the token accounts has invalid or unexpected data structure.

**Solution**:
- Ensure all token accounts are created with the correct SPL Token program
- Check that the accounts belong to the correct owners
- Verify the account is initialized with the correct mint address

## Debugging Process

### Step 1: Check Token Accounts

Check if the necessary token accounts exist:

```bash
# Check YOT token account
solana spl-token account-info 2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF --owner <WALLET_ADDRESS>

# Check YOS token account
solana spl-token account-info GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n --owner <WALLET_ADDRESS>
```

### Step 2: Simulate the Transaction

Simulate the transaction to see detailed logs:

```typescript
const transaction = await createSwapTransaction(...);
const simulation = await connection.simulateTransaction(transaction);
console.log(simulation.logs);
```

Look for specific error messages in the logs.

### Step 3: Create Missing Accounts

Create any missing token accounts:

```typescript
// Create YOS token account if it doesn't exist
await getOrCreateAssociatedTokenAccount(
  connection,
  wallet, 
  new PublicKey("GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n"), // YOS mint
  wallet.publicKey
);
```

### Step 4: Check Program State

Verify the program state is correctly initialized:

```typescript
const [statePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("state")],
  new PublicKey("3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps") // Program ID
);

const stateAccount = await connection.getAccountInfo(statePDA);
// Parse stateAccount.data to check the program state
```

## Advanced Debugging

### Transaction Log Analysis

When a transaction fails, the Solana runtime provides detailed logs. Look for messages like:

```
Program log: ⭐ MULTIHUB SWAP: Starting swap operation with Solana Devnet
Program log: User account: <pubkey>, is_signer: true, is_writable: true
Program log: User input token account: <pubkey>, is_writable: true
Program log: User output token account: <pubkey>, is_writable: true
Program log: User YOS token account: <pubkey>, is_writable: true
Program log: ❌ ERROR: Failed to unpack YOS token account data
Program returned error: InvalidAccountData
```

### Fix Verification

To verify the fix has been properly applied:

1. Check that `process_swap_token` in the contract now uses the correct token account validation
2. Verify the client code creates any missing token accounts before sending the transaction
3. Test with a wallet that has never received YOS tokens

## Common Edge Cases

### 1. Ledger Hardware Wallets

Ledger wallets sometimes have issues with certain PDAs. Use the `allowOwnerOffCurve` option:

```javascript
await getOrCreateAssociatedTokenAccount(
  connection,
  wallet,
  mintAddress,
  wallet.publicKey,
  true // allowOwnerOffCurve
);
```

### 2. Token Account Rent Exemption

Ensure token accounts have enough SOL for rent exemption:

```javascript
const rentExemptionAmount = await connection.getMinimumBalanceForRentExemption(
  AccountLayout.span
);
```

### 3. Transaction Size Limit

If a transaction exceeds Solana's size limit (1232 bytes), split it into multiple transactions.

## Solana Explorer Tools

For detailed transaction investigation:
- https://explorer.solana.com/tx/[TRANSACTION_SIGNATURE]?cluster=devnet
- Click "Instruction" tab to see detailed logs
- Check "Program Message Logs" for error messages

## Contact Support

If issues persist after following this guide, please submit a support ticket with:
1. The transaction signature
2. Wallet public key
3. Input and output token mints
4. Exact error message and logs