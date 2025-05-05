import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  SYSVAR_RENT_PUBKEY, 
  TransactionInstruction 
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount
} from '@solana/spl-token';
import { connectionManager } from './connection-manager';

// Hardcoded values to avoid config issues
const MULTIHUB_SWAP_PROGRAM_ID = "SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE";
const YOT_TOKEN_MINT = "2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF";
const YOS_TOKEN_MINT = "GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n";
const POOL_AUTHORITY = "7xXdF9GUs3T8kCsfLkaQ72fJtu137vwzQAyRd9zE7dHS";

// Fixed seeds for PDAs
const PROGRAM_STATE_SEED = "state";
const PROGRAM_AUTHORITY_SEED = "authority";

// Helper functions for finding PDAs
function findProgramStateAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PROGRAM_STATE_SEED)],
    new PublicKey(MULTIHUB_SWAP_PROGRAM_ID)
  );
}

function findProgramAuthorityAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PROGRAM_AUTHORITY_SEED)],
    new PublicKey(MULTIHUB_SWAP_PROGRAM_ID)
  );
}

// Helper to build swap instruction data
function buildSwapInstructionData(
  amountIn: number | bigint,
  minAmountOut: number | bigint
): Buffer {
  // Convert amounts to BigInt if they're not already
  const amountInBigInt = typeof amountIn === 'bigint' ? amountIn : BigInt(Math.floor(Number(amountIn) * 1e9));
  const minAmountOutBigInt = typeof minAmountOut === 'bigint' ? minAmountOut : BigInt(Math.floor(Number(minAmountOut) * 1e9));
  
  // Allocate a buffer:
  // 1 byte for instruction enum variant (PerformSwap = 1)
  // 8 bytes for amountIn (u64)
  // 8 bytes for minAmountOut (u64)
  const buffer = Buffer.alloc(1 + 8 + 8);
  
  // Write instruction enum variant (PerformSwap = 1)
  buffer.writeUInt8(1, 0);
  
  // Write amountIn as little-endian u64
  writeU64ToBuffer(buffer, amountInBigInt, 1);
  
  // Write minAmountOut as little-endian u64
  writeU64ToBuffer(buffer, minAmountOutBigInt, 9);
  
  return buffer;
}

// Helper to write u64 to buffer as little-endian
function writeU64ToBuffer(buffer: Buffer, value: bigint, offset: number): void {
  const view = new DataView(new ArrayBuffer(8));
  // Split into high and low 32 bits and write as little-endian
  const low = Number(value & BigInt(0xffffffff));
  const high = Number(value >> BigInt(32));
  view.setUint32(0, low, true); // true for little-endian
  view.setUint32(4, high, true);
  // Copy to the buffer
  buffer.set(new Uint8Array(view.buffer), offset);
}

/**
 * Simple, hardcoded swap function as a fallback solution
 */
export async function performSimpleSwap(
  connection: Connection,
  wallet: any,
  tokenFromMint: PublicKey,
  tokenToMint: PublicKey,
  amountIn: number | bigint,
  minAmountOut: number | bigint
): Promise<string> {
  console.log("STARTING SIMPLIFIED SWAP FUNCTION");
  console.log(`From: ${tokenFromMint.toString()}`);
  console.log(`To: ${tokenToMint.toString()}`);
  console.log(`Amount In: ${amountIn}`);
  console.log(`Min Amount Out: ${minAmountOut}`);
  
  try {
    // Create a new transaction
    const transaction = new Transaction();
    
    // Set fee payer
    transaction.feePayer = wallet.publicKey;
    
    // Add a recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Get program PDAs
    const [programStateAddress] = findProgramStateAddress();
    const [programAuthorityAddress] = findProgramAuthorityAddress();
    const poolAuthorityAddress = new PublicKey(POOL_AUTHORITY);
    
    console.log(`Program State: ${programStateAddress.toString()}`);
    console.log(`Program Authority: ${programAuthorityAddress.toString()}`);
    console.log(`Pool Authority: ${poolAuthorityAddress.toString()}`);
    
    // SOL transfer to fund the Program Authority with SOL
    console.log("Adding SOL funding for program operations");
    const fundingInstruction = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: programAuthorityAddress,
      lamports: 1_000_000, // 0.001 SOL for token operations
    });
    transaction.add(fundingInstruction);
    
    // Get the user's token accounts
    // For FROM token:
    let userFromTokenAccount;
    if (tokenFromMint.toString() === "So11111111111111111111111111111111111111112") {
      // For SOL, use wallet directly
      userFromTokenAccount = wallet.publicKey;
      console.log(`User From (SOL): ${userFromTokenAccount.toString()}`);
    } else {
      // For other tokens, get ATA
      userFromTokenAccount = await getAssociatedTokenAddress(
        tokenFromMint,
        wallet.publicKey,
        false, // allowOwnerOffCurve
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      console.log(`User From (Token): ${userFromTokenAccount.toString()}`);
      
      // Check if it exists, create if needed
      const fromAccountInfo = await connection.getAccountInfo(userFromTokenAccount);
      if (!fromAccountInfo) {
        console.log("Creating user FROM token account");
        const createFromAtaIx = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userFromTokenAccount,
          wallet.publicKey,
          tokenFromMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        transaction.add(createFromAtaIx);
      }
    }
    
    // For TO token:
    const userToTokenAccount = await getAssociatedTokenAddress(
      tokenToMint,
      wallet.publicKey,
      false, // allowOwnerOffCurve
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    console.log(`User To: ${userToTokenAccount.toString()}`);
    
    // Check if it exists, create if needed
    const toAccountInfo = await connection.getAccountInfo(userToTokenAccount);
    if (!toAccountInfo) {
      console.log("Creating user TO token account");
      const createToAtaIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userToTokenAccount,
        wallet.publicKey,
        tokenToMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      transaction.add(createToAtaIx);
    }
    
    // For YOS (cashback):
    const yosMint = new PublicKey(YOS_TOKEN_MINT);
    const userYosTokenAccount = await getAssociatedTokenAddress(
      yosMint,
      wallet.publicKey,
      false, // allowOwnerOffCurve
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    console.log(`User YOS: ${userYosTokenAccount.toString()}`);
    
    // Check if it exists, create if needed
    const yosAccountInfo = await connection.getAccountInfo(userYosTokenAccount);
    if (!yosAccountInfo) {
      console.log("Creating user YOS token account");
      const createYosAtaIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userYosTokenAccount,
        wallet.publicKey,
        yosMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      transaction.add(createYosAtaIx);
    }
    
    // Get program's token accounts
    // For FROM token:
    const programFromTokenAccount = await getAssociatedTokenAddress(
      tokenFromMint,
      poolAuthorityAddress,
      true, // allowOwnerOffCurve
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    console.log(`Program From: ${programFromTokenAccount.toString()}`);
    
    // For TO token:
    const programToTokenAccount = await getAssociatedTokenAddress(
      tokenToMint,
      poolAuthorityAddress,
      true, // allowOwnerOffCurve
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    console.log(`Program To: ${programToTokenAccount.toString()}`);
    
    // For YOS:
    const programYosTokenAccount = await getAssociatedTokenAddress(
      yosMint,
      poolAuthorityAddress,
      true, // allowOwnerOffCurve
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    console.log(`Program YOS: ${programYosTokenAccount.toString()}`);
    
    // Create and verify program's token accounts if needed
    const accounts = [
      {name: "Program From", address: programFromTokenAccount, mint: tokenFromMint},
      {name: "Program To", address: programToTokenAccount, mint: tokenToMint},
      {name: "Program YOS", address: programYosTokenAccount, mint: yosMint}
    ];
    
    for (const {name, address, mint} of accounts) {
      const accountInfo = await connection.getAccountInfo(address);
      if (!accountInfo) {
        console.log(`Creating ${name} token account`);
        const createAtaIx = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          address,
          poolAuthorityAddress,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        transaction.add(createAtaIx);
      }
    }
    
    // Build the swap instruction data
    const swapData = buildSwapInstructionData(amountIn, minAmountOut);
    console.log('Swap instruction data length:', swapData.length);
    console.log('Swap instruction data bytes:', Array.from(new Uint8Array(swapData)));
    
    // Create the program ID - hardcoded for maximum reliability
    const programId = new PublicKey("SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE");
    
    // Create account keys array for the swap instruction
    const keys = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // User wallet [0]
      { pubkey: programStateAddress, isSigner: false, isWritable: true }, // Program state [1]
      { pubkey: programAuthorityAddress, isSigner: false, isWritable: true }, // Program Authority [2]
      { pubkey: poolAuthorityAddress, isSigner: false, isWritable: true }, // Pool Authority [3]
      
      // Special handling for SOL as source token
      { 
        pubkey: userFromTokenAccount, 
        isSigner: tokenFromMint.toString() === "So11111111111111111111111111111111111111112", 
        isWritable: true 
      }, // User FROM token [4]
      { pubkey: userToTokenAccount, isSigner: false, isWritable: true }, // User TO token [5]
      { pubkey: userYosTokenAccount, isSigner: false, isWritable: true }, // User YOS token [6]
      
      { pubkey: programFromTokenAccount, isSigner: false, isWritable: true }, // Program FROM token [7]
      { pubkey: programToTokenAccount, isSigner: false, isWritable: true }, // Program TO token [8]
      { pubkey: programYosTokenAccount, isSigner: false, isWritable: true }, // Program YOS token [9]
      
      // Token mints
      { pubkey: tokenFromMint, isSigner: false, isWritable: false }, // FROM mint [10]
      { pubkey: tokenToMint, isSigner: false, isWritable: false }, // TO mint [11]
      { pubkey: new PublicKey(YOS_TOKEN_MINT), isSigner: false, isWritable: false }, // YOS mint [12]
      
      // System programs
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // SPL Token [13]
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System Program [14]
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // Rent sysvar [15]
    ];
    
    // Create the swap instruction
    const swapInstruction = new TransactionInstruction({
      keys: keys,
      programId: programId,
      data: swapData
    });
    
    // Verify the instruction
    console.log(`Swap instruction created. Program ID: ${swapInstruction.programId.toString()}`);
    console.log(`Program ID valid: ${swapInstruction.programId !== undefined}`);
    
    // Add the instruction to the transaction
    transaction.add(swapInstruction);
    
    // Simulate the transaction
    console.log('Simulating swap transaction...');
    const simulation = await connection.simulateTransaction(transaction, undefined, true);
    
    // Check for errors
    if (simulation.value.err) {
      console.error('Swap simulation failed:', simulation.value.err);
      throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }
    
    // Send the transaction
    console.log('Sending swap transaction...');
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log('Swap transaction sent:', signature);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    console.log('Swap transaction confirmed');
    
    return signature;
  } catch (error) {
    console.error('Error in simplified swap function:', error);
    throw error;
  }
}