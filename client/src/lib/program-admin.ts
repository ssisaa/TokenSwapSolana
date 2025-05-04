import { PublicKey, Connection, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  createTransferInstruction
} from '@solana/spl-token';
import { PROGRAM_ID, YOT_MINT, YOS_MINT, PROGRAM_STATE_SEED, PROGRAM_AUTHORITY_SEED } from './constants';
import { connection } from './solana';

/**
 * Finds the program authority PDA (Program Derived Address)
 * This address is used to hold tokens on behalf of the program
 * @returns [PublicKey, number] - The authority address and bump seed
 */
export function findProgramAuthorityAddress(): [PublicKey, number] {
  const [authority, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(PROGRAM_AUTHORITY_SEED)],
    new PublicKey(PROGRAM_ID)
  );
  return [authority, bump];
}

/**
 * Finds the program state PDA which stores program configuration
 * @returns [PublicKey, number] - The state address and bump seed
 */
export function findProgramStateAddress(): [PublicKey, number] {
  const [state, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(PROGRAM_STATE_SEED)],
    new PublicKey(PROGRAM_ID)
  );
  return [state, bump];
}

/**
 * Gets the token balance for any account
 * @param tokenAccount The token account to check the balance for
 * @returns The token balance as a number (UI amount)
 */
export async function getTokenBalance(tokenAccount: PublicKey): Promise<number> {
  try {
    const account = await getAccount(connection, tokenAccount);
    
    // Convert from raw amount to UI amount (considering decimals)
    const decimals = 9; // Both YOT and YOS have 9 decimals
    const rawAmount = account.amount;
    const uiAmount = Number(rawAmount) / Math.pow(10, decimals);
    
    return uiAmount;
  } catch (error) {
    console.error('Error getting token balance:', error);
    // Return 0 if the account doesn't exist or there's an error
    return 0;
  }
}

/**
 * Funds a program token account with tokens from the admin wallet
 * @param wallet The admin wallet
 * @param tokenMint The mint address of the token to fund
 * @param amount The amount of tokens to send (UI amount)
 * @returns The transaction signature
 */
export async function fundProgramTokenAccount(
  wallet: any,
  tokenMint: PublicKey,
  amount: number
): Promise<string> {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }
  
  const [programAuthority] = findProgramAuthorityAddress();
  
  // Calculate the token amount in raw units (considering decimals)
  const decimals = 9; // Both YOT and YOS have 9 decimals
  const rawAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));
  
  try {
    // Get the source token account (admin wallet's token account)
    const sourceTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      wallet.publicKey
    );
    
    // Check if the source account exists and has sufficient balance
    const sourceAccount = await getAccount(connection, sourceTokenAccount);
    if (sourceAccount.amount < rawAmount) {
      throw new Error(`Insufficient balance: ${Number(sourceAccount.amount) / Math.pow(10, decimals)} tokens available`);
    }
    
    // Get or create the destination token account (program authority's token account)
    const destinationTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      programAuthority,
      true // allowOwnerOffCurve
    );
    
    // Check if the destination token account exists
    let transaction = new Transaction();
    try {
      await getAccount(connection, destinationTokenAccount);
    } catch (error) {
      // If the account doesn't exist, create it first
      console.log('Creating token account for program authority...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey, // payer
          destinationTokenAccount, // associated token account address
          programAuthority, // owner
          tokenMint // mint
        )
      );
    }
    
    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        sourceTokenAccount, // source
        destinationTokenAccount, // destination
        wallet.publicKey, // owner
        rawAmount // amount
      )
    );
    
    // Send and confirm transaction
    const signature = await wallet.sendTransaction(transaction, connection);
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log(`Successfully funded ${tokenMint.toString()} with ${amount} tokens`);
    return signature;
  } catch (error) {
    console.error('Error funding program token account:', error);
    throw error;
  }
}

/**
 * Gets the current balances of all program token accounts
 * @returns Object containing token balances for YOT and YOS
 */
export async function getProgramTokenBalances(): Promise<{ yot: number; yos: number }> {
  const [programAuthority] = findProgramAuthorityAddress();
  
  try {
    // Get YOT token account address
    const yotTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(YOT_MINT),
      programAuthority,
      true // allowOwnerOffCurve
    );
    
    // Get YOS token account address
    const yosTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(YOS_MINT),
      programAuthority,
      true // allowOwnerOffCurve
    );
    
    // Get balances
    const [yotBalance, yosBalance] = await Promise.all([
      getTokenBalance(yotTokenAccount),
      getTokenBalance(yosTokenAccount)
    ]);
    
    return { yot: yotBalance, yos: yosBalance };
  } catch (error) {
    console.error('Error getting program token balances:', error);
    return { yot: 0, yos: 0 };
  }
}