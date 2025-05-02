import {
  Connection,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  getAccount,
} from '@solana/spl-token';

/**
 * Important token mint constants
 */
export const YOT_TOKEN_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
export const YOS_TOKEN_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');
export const SOL_TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112');
export const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';

/**
 * Ensures a user has all the token accounts they need for a transaction
 * This function validates token accounts and creates them if they don't exist
 * 
 * @param connection The Solana connection
 * @param wallet The user's wallet
 * @param requiredMints Array of token mints that need accounts
 * @returns An object with transaction to create any missing accounts and details
 */
export async function ensureTokenAccounts(
  connection: Connection, 
  wallet: any,
  requiredMints: PublicKey[]
): Promise<{
  transaction: Transaction;
  tokenAccounts: Map<string, PublicKey>;
  missingAccounts: string[];
  allAccountsExist: boolean;
}> {
  console.log(`Validating ${requiredMints.length} token accounts for wallet ${wallet.publicKey.toString()}`);
  
  const transaction = new Transaction();
  const tokenAccounts = new Map<string, PublicKey>();
  const missingAccounts: string[] = [];
  
  // Check each mint's associated token account
  for (const mint of requiredMints) {
    const tokenAccount = await getAssociatedTokenAddress(mint, wallet.publicKey);
    tokenAccounts.set(mint.toString(), tokenAccount);
    
    try {
      // Try to get the account info to see if it exists
      const accountInfo = await connection.getAccountInfo(tokenAccount);
      
      if (!accountInfo) {
        console.log(`Token account for mint ${mint.toString()} doesn't exist, preparing to create it`);
        missingAccounts.push(mint.toString());
        
        // Create instruction to create the associated token account
        const createAtaIx = createAssociatedTokenAccountInstruction(
          wallet.publicKey, // payer
          tokenAccount,     // ATA address
          wallet.publicKey, // owner
          mint              // mint
        );
        transaction.add(createAtaIx);
      } else {
        console.log(`Token account for mint ${mint.toString()} exists: ${tokenAccount.toString()}`);
        
        // Double-check this is actually a token account
        try {
          await getAccount(connection, tokenAccount);
        } catch (error) {
          console.error(`Account exists but is not a valid token account: ${error}`);
          missingAccounts.push(`${mint.toString()} (invalid token account)`);
        }
      }
    } catch (error) {
      console.error(`Error checking token account for mint ${mint.toString()}: ${error}`);
      missingAccounts.push(`${mint.toString()} (error checking)`);
    }
  }
  
  return {
    transaction,
    tokenAccounts,
    missingAccounts,
    allAccountsExist: missingAccounts.length === 0
  };
}

/**
 * Special helper specifically to ensure YOS account exists
 * This is critical for all multihub swap operations
 */
export async function ensureYosTokenAccount(
  connection: Connection,
  wallet: any
): Promise<{
  transaction: Transaction;
  yosTokenAccount: PublicKey;
  exists: boolean;
}> {
  const yosTokenAccount = await getAssociatedTokenAddress(YOS_TOKEN_MINT, wallet.publicKey);
  const transaction = new Transaction();
  let exists = false;
  
  try {
    // Check if the YOS token account already exists
    const accountInfo = await connection.getAccountInfo(yosTokenAccount);
    exists = !!accountInfo;
    
    if (!exists) {
      console.log('YOS token account does not exist, preparing to create it:', yosTokenAccount.toString());
      
      // Add instruction to create the YOS token account
      const createYosAccountIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        yosTokenAccount,
        wallet.publicKey,
        YOS_TOKEN_MINT
      );
      transaction.add(createYosAccountIx);
    } else {
      console.log('YOS token account exists:', yosTokenAccount.toString());
    }
  } catch (error) {
    console.error('Error checking YOS token account:', error);
    
    // Conservatively assume it doesn't exist if there was an error
    const createYosAccountIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      yosTokenAccount,
      wallet.publicKey,
      YOS_TOKEN_MINT
    );
    transaction.add(createYosAccountIx);
  }
  
  return {
    transaction,
    yosTokenAccount,
    exists
  };
}

/**
 * Create a YOS token account in a separate transaction
 * This is useful when a user is performing their first swap
 */
export async function createYosTokenAccount(
  connection: Connection,
  wallet: any
): Promise<string> {
  const { transaction, yosTokenAccount, exists } = await ensureYosTokenAccount(
    connection,
    wallet
  );
  
  if (exists) {
    console.log('YOS token account already exists, no need to create it');
    return 'Account already exists';
  }
  
  if (transaction.instructions.length === 0) {
    console.log('No instructions needed for YOS token account');
    return 'No action required';
  }
  
  try {
    // Send the transaction
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log('YOS token account creation transaction sent:', signature);
    
    // Confirm the transaction
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    console.log('Transaction confirmed:', confirmation);
    
    return signature;
  } catch (error) {
    console.error('Error creating YOS token account:', error);
    throw new Error(`Failed to create YOS token account: ${error.message}`);
  }
}

/**
 * Create all required token accounts in a single transaction
 */
export async function createRequiredTokenAccounts(
  connection: Connection,
  wallet: any,
  requiredMints: PublicKey[]
): Promise<string> {
  const { transaction, missingAccounts } = await ensureTokenAccounts(
    connection,
    wallet,
    requiredMints
  );
  
  if (missingAccounts.length === 0) {
    console.log('All required token accounts already exist');
    return 'All accounts exist';
  }
  
  if (transaction.instructions.length === 0) {
    console.log('No instructions needed for token accounts');
    return 'No action required';
  }
  
  try {
    // Send the transaction
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log('Token account creation transaction sent:', signature);
    
    // Confirm the transaction
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    console.log('Transaction confirmed:', confirmation);
    
    return signature;
  } catch (error) {
    console.error('Error creating token accounts:', error);
    throw new Error(`Failed to create token accounts: ${error.message}`);
  }
}

/**
 * Create a helper object for easy imports
 */
export const AccountValidation = {
  YOT_TOKEN_MINT,
  YOS_TOKEN_MINT,
  SOL_TOKEN_MINT,
  ensureTokenAccounts,
  ensureYosTokenAccount,
  createYosTokenAccount,
  createRequiredTokenAccounts
};

export default AccountValidation;