import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAccount } from '@solana/spl-token';

/**
 * Advanced token account validation to prevent InvalidAccountData errors
 * This function performs comprehensive validation of token accounts to ensure
 * they are valid for use in transactions.
 * 
 * @param connection Solana connection
 * @param accountAddress The account address to validate
 * @param expectedMint The expected mint address (optional)
 * @returns True if the account is valid, false otherwise
 */
export async function validateTokenAccount(
  connection: Connection,
  accountAddress: PublicKey,
  expectedMint?: PublicKey
): Promise<boolean> {
  try {
    console.log(`🔍 Validating token account ${accountAddress.toString()}`);
    if (expectedMint) {
      console.log(`🔍 Expected mint: ${expectedMint.toString()}`);
    }
    
    // Step 1: Get basic account info to check existence
    const accountInfo = await connection.getAccountInfo(accountAddress);
    
    if (!accountInfo) {
      console.error(`❌ Token account does not exist: ${accountAddress.toString()}`);
      return false;
    }
    
    // Step 2: Validate basic account properties
    if (!accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
      console.error(`❌ Account is not owned by Token Program: ${accountAddress.toString()}`);
      console.error(`   Owner: ${accountInfo.owner.toString()}`);
      console.error(`   Expected: ${TOKEN_PROGRAM_ID.toString()}`);
      return false;
    }
    
    // Step 3: Check minimum size for token accounts (165 bytes for token accounts)
    if (accountInfo.data.length < 165) {
      console.error(`❌ Account data is too small to be a token account: ${accountAddress.toString()}`);
      console.error(`   Size: ${accountInfo.data.length} bytes, Expected: at least 165 bytes`);
      return false;
    }
    
    // Step 4: Try to parse as token account - this is the most comprehensive check
    try {
      const tokenAccount = await getAccount(
        connection,
        accountAddress,
        'confirmed',
        TOKEN_PROGRAM_ID
      );
      
      // Step 5: If an expected mint was provided, verify it matches
      if (expectedMint && !tokenAccount.mint.equals(expectedMint)) {
        console.error(`❌ Token account mint mismatch for ${accountAddress.toString()}`);
        console.error(`   Expected: ${expectedMint.toString()}`);
        console.error(`   Actual: ${tokenAccount.mint.toString()}`);
        return false;
      }
      
      console.log(`✅ Valid SPL token account verified: ${accountAddress.toString()}`);
      console.log(`   Mint: ${tokenAccount.mint.toString()}`);
      console.log(`   Owner: ${tokenAccount.owner.toString()}`);
      console.log(`   Balance: ${tokenAccount.amount.toString()} lamports`);
      
      // Everything checks out!
      return true;
    } catch (tokenError) {
      console.error(`❌ Failed to parse as token account: ${accountAddress.toString()}`);
      console.error(`   Error: ${tokenError instanceof Error ? tokenError.message : String(tokenError)}`);
      console.error(`   This will cause "InvalidAccountData" error at index ${accountIndex} during transaction`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error validating token account ${accountAddress.toString()}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Validate user token account with quick connection retry
 * This wrapper adds connection resiliency for better validation results
 */
export async function validateUserTokenAccount(
  connection: Connection,
  accountAddress: PublicKey,
  expectedMint: PublicKey,
  accountType = "user token"
): Promise<boolean> {
  try {
    // First attempt
    return await validateTokenAccount(connection, accountAddress, expectedMint, 0, accountType);
  } catch (error) {
    console.warn(`⚠️ First validation attempt failed, retrying: ${error instanceof Error ? error.message : String(error)}`);
    
    // Short delay before retry
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // Second attempt
      return await validateTokenAccount(connection, accountAddress, expectedMint, 0, accountType);
    } catch (retryError) {
      console.error(`❌ Token account validation failed after retry: ${retryError instanceof Error ? retryError.message : String(retryError)}`);
      return false;
    }
  }
}