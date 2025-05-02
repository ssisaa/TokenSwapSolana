# Multi-Hub Swap Deployment Guide

This guide outlines the process for deploying the Multi-Hub Swap program on Solana. It covers both deployment options and recommended configuration settings.

## Program ID

The currently deployed program ID is:
```
3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps
```

## Deployment Options

### Option 1: Solana Playground (Recommended for Initial Deployments)

1. **Upload Source Files**:
   - Upload `lib.rs`, `multihub_swap_fixed_new.rs`, and other necessary files to Solana Playground
   - Ensure `Cargo.toml` is correctly configured with dependencies

2. **Set Program ID**:
   - In Solana Playground, set the Program ID to `3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps`

3. **Build and Deploy**:
   - Click "Build" to compile the program
   - Click "Deploy" to deploy the program to Solana devnet

### Option 2: Command Line Deployment (Recommended for Updates)

For established programs that need updates:

1. **Install Solana CLI Tools**:
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/v1.16.15/install)"
   ```

2. **Setup Environment**:
   ```bash
   solana config set --url devnet
   ```

3. **Compile Program**:
   ```bash
   cd program
   cargo build-bpf
   ```

4. **Deploy With Force Option**:
   ```bash
   solana program deploy --program-id 3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps --keypair path/to/multihub-keypair.json target/deploy/multihub_swap.so --force
   ```

### Option 3: New Program ID (Last Resort)

If neither option above works due to persistent account data conflicts:

1. **Generate New Keypair**:
   ```bash
   solana-keygen new -o multihub-swap-v2-keypair.json
   ```

2. **Extract Program ID**:
   ```bash
   solana-keygen pubkey multihub-swap-v2-keypair.json
   ```

3. **Update Program ID in Code**:
   - Modify the program ID in your Rust file
   - Update client code to reference new program ID

4. **Deploy as New Program**:
   ```bash
   solana program deploy --program-id NEW_PROGRAM_ID --keypair multihub-swap-v2-keypair.json target/deploy/multihub_swap.so
   ```

## Client-Side Deployment Fixes

The most reliable approach for immediate fixes is to enhance the client-side code:

1. **YOS Token Account Verification**:
   Add explicit checks to verify if YOS token accounts exist and create them if they don't:

   ```typescript
   // Check if YOS token account exists
   const yosTokenAccount = await getAssociatedTokenAddress(
     new PublicKey(YOS_MINT_ADDRESS),
     wallet.publicKey
   );
   
   // Verify account existence
   const accountInfo = await connection.getAccountInfo(yosTokenAccount);
   
   // If account doesn't exist, create it
   if (!accountInfo) {
     console.log("Creating YOS token account...");
     const createAtaIx = createAssociatedTokenAccountInstruction(
       wallet.publicKey,
       yosTokenAccount,
       wallet.publicKey,
       new PublicKey(YOS_MINT_ADDRESS)
     );
     
     // Add to transaction
     transaction.add(createAtaIx);
   }
   ```

2. **Pre-Transaction Checks**:
   Always validate all necessary accounts before attempting transactions:

   ```typescript
   // Create a helper function to validate all required accounts
   async function validateRequiredAccounts(wallet, requiredMints) {
     const missingAccounts = [];
     
     for (const mint of requiredMints) {
       const tokenAccount = await getAssociatedTokenAddress(
         new PublicKey(mint),
         wallet.publicKey
       );
       
       const accountInfo = await connection.getAccountInfo(tokenAccount);
       if (!accountInfo) {
         missingAccounts.push({ mint, tokenAccount });
       }
     }
     
     return missingAccounts;
   }
   ```

3. **Robust Error Handling**:
   Add comprehensive error handling to detect and provide user-friendly messages:

   ```typescript
   try {
     // Transaction code here
   } catch (error) {
     if (error.message.includes("invalid account data")) {
       console.error("Account structure mismatch. This usually means the token accounts aren't properly set up.");
       // Create missing accounts
     } else if (error.message.includes("insufficient funds")) {
       console.error("Insufficient balance to complete transaction");
     } else {
       console.error("Transaction failed:", error);
     }
   }
   ```

## Troubleshooting Common Deployment Issues

### Invalid Account Data for Instruction

This error typically occurs when:
1. The program has already been initialized with a different account structure
2. Required token accounts don't exist

**Solution**:
- Use the `--force` flag when deploying via command line
- Ensure all token accounts exist before sending transactions
- Consider creating a new program ID as a last resort

### Transaction Simulation Failed

This usually indicates issues with:
1. Insufficient SOL for transaction fees
2. Missing token accounts
3. Incorrect account permissions

**Solution**:
- Check wallet SOL balance
- Verify all token accounts exist
- Use transaction simulation before sending to debug issues

## Best Practices for Future Deployments

1. **Always simulate transactions** before sending to catch errors early
2. **Create essential token accounts** before attempting any swap
3. **Use unique PDA seeds** when updating program logic to avoid conflicts
4. **Implement thorough client-side validation** to prevent common errors
5. **Document changes extensively** to maintain knowledge of the system

---

By following this guide, you can effectively deploy and maintain the Multi-Hub Swap program, even when faced with common deployment challenges.