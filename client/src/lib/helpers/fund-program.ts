import { PublicKey, Transaction, Connection } from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID 
} from '@solana/spl-token';
import { STAKING_PROGRAM_ID, YOS_TOKEN_ADDRESS, ENDPOINT } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { connection } from '@/lib/completeSwap';

/**
 * Funds the program's YOS token account with the specified amount
 * @param wallet The connected wallet
 * @param amountToSend Amount of YOS tokens to send
 * @returns The transaction signature
 */
export async function fundProgramYosAccount(wallet: any, amountToSend = 3.0) {
  if (!wallet || !wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  // Get program authority PDA
  const [programAuthorityAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(STAKING_PROGRAM_ID)
  );
  
  console.log('Program authority address (PDA signer):', programAuthorityAddress.toString());
  
  // Get sender's YOS token account
  const senderTokenAccount = await getAssociatedTokenAddress(
    new PublicKey(YOS_TOKEN_ADDRESS),
    wallet.publicKey
  );
  
  // Get program's YOS token account
  // CRITICAL: This MUST match the same derivation used in solana-staking.ts
  // This ensures we're using the token account that the program's authority actually owns
  const programYosTokenAccount = await getAssociatedTokenAddress(
    new PublicKey(YOS_TOKEN_ADDRESS),
    programAuthorityAddress,
    true // allowOwnerOffCurve - required for PDAs
  );
  
  console.log('Program YOS token account:', programYosTokenAccount.toString());
  
  // Check if program token account exists
  const programAccountInfo = await connection.getAccountInfo(programYosTokenAccount);
  
  // Create transaction
  const transaction = new Transaction();
  
  // If program token account doesn't exist, add instruction to create it
  if (!programAccountInfo) {
    console.log('Program YOS token account does not exist. Creating it...');
    
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        programYosTokenAccount,
        programAuthorityAddress,
        new PublicKey(YOS_TOKEN_ADDRESS)
      )
    );
  } else {
    console.log('Program YOS token account exists');
    try {
      const balance = await connection.getTokenAccountBalance(programYosTokenAccount);
      console.log('Current program YOS balance:', balance.value.uiAmount || 0);
    } catch (e) {
      console.error('Error checking program YOS balance:', e);
    }
  }
  
  // Calculate amount with decimals
  const amount = amountToSend * 1e9; // YOS has 9 decimals
  
  // Add transfer instruction
  transaction.add(
    createTransferInstruction(
      senderTokenAccount,
      programYosTokenAccount,
      wallet.publicKey,
      amount
    )
  );
  
  // Sign and send transaction
  transaction.feePayer = wallet.publicKey;
  let blockhashResponse = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhashResponse.blockhash;
  
  try {
    // Get initial balance for comparison if account exists
    let initialBalance = 0;
    if (programAccountInfo) {
      try {
        const balanceInfo = await connection.getTokenAccountBalance(programYosTokenAccount);
        initialBalance = balanceInfo.value.uiAmount || 0;
      } catch (e) {
        console.error('Error getting initial balance:', e);
      }
    }
    
    let signed = await wallet.signTransaction(transaction);
    let signature = await connection.sendRawTransaction(signed.serialize());
    
    console.log('Transaction sent:', signature);
    
    // Confirm transaction
    await connection.confirmTransaction({
      signature,
      blockhash: blockhashResponse.blockhash,
      lastValidBlockHeight: blockhashResponse.lastValidBlockHeight
    });
    
    console.log('Transaction confirmed');
    
    // Check new balance
    try {
      const newBalanceInfo = await connection.getTokenAccountBalance(programYosTokenAccount);
      const newBalance = newBalanceInfo.value.uiAmount || 0;
      
      return {
        success: true,
        signature,
        previousBalance: initialBalance,
        newBalance,
        programYosTokenAccount: programYosTokenAccount.toString()
      };
    } catch (e) {
      console.error('Error getting new balance:', e);
      return {
        success: true,
        signature,
        programYosTokenAccount: programYosTokenAccount.toString(),
        error: 'Could not check new balance'
      };
    }
  } catch (error) {
    console.error('Error funding program account:', error);
    throw error;
  }
}

/**
 * Checks the balance of the program's YOS token account
 * @returns Account address and balance
 */
export async function checkProgramYosBalance() {
  // Get program authority
  const [programAuthorityAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    new PublicKey(STAKING_PROGRAM_ID)
  );
  
  // Get program YOS token account
  const programYosTokenAccount = await getAssociatedTokenAddress(
    new PublicKey(YOS_TOKEN_ADDRESS),
    programAuthorityAddress,
    true // allowOwnerOffCurve
  );
  
  // Check if account exists
  const accountInfo = await connection.getAccountInfo(programYosTokenAccount);
  
  if (!accountInfo) {
    return {
      exists: false,
      address: programYosTokenAccount.toString(),
      balance: 0
    };
  }
  
  // Get token balance
  const balance = await connection.getTokenAccountBalance(programYosTokenAccount);
  
  return {
    exists: true,
    address: programYosTokenAccount.toString(),
    balance: balance.value.uiAmount || 0
  };
}