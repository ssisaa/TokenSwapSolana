import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  getAccount,
} from '@solana/spl-token';
import { serialize, deserialize } from 'borsh';
import { Buffer } from 'buffer';
import { SwapEstimate, SwapProvider } from './multi-hub-swap';
import { TokenInfo } from './token-search-api';

// Constants - Updated with the new Multi-Hub Swap Program ID
const MULTIHUB_SWAP_PROGRAM_ID = new PublicKey('J66SY1YNFyXt6jat8Ek8uAUshxBY2mLrubsMRN4wggt3'); // New Multi-Hub Swap Program ID
const YOT_TOKEN_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
const YOS_TOKEN_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');
const SOL_TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const ENDPOINT = 'https://api.devnet.solana.com';

// Import required Solana system constants
import { ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

// State structure that matches our Rust implementation
class ProgramState {
  is_initialized: boolean;
  admin: Uint8Array;
  yot_mint: Uint8Array;
  yos_mint: Uint8Array;
  sol_yot_pool: Uint8Array;
  liquidity_contribution_percentage: number;
  admin_fee_percentage: number;
  yos_cashback_percentage: number;
  fee_percentage: number;
  referral_percentage: number;

  constructor(fields: {
    is_initialized: boolean,
    admin: Uint8Array,
    yot_mint: Uint8Array,
    yos_mint: Uint8Array,
    sol_yot_pool: Uint8Array,
    liquidity_contribution_percentage: number,
    admin_fee_percentage: number,
    yos_cashback_percentage: number,
    fee_percentage: number,
    referral_percentage: number,
  }) {
    this.is_initialized = fields.is_initialized;
    this.admin = fields.admin;
    this.yot_mint = fields.yot_mint;
    this.yos_mint = fields.yos_mint;
    this.sol_yot_pool = fields.sol_yot_pool;
    this.liquidity_contribution_percentage = fields.liquidity_contribution_percentage;
    this.admin_fee_percentage = fields.admin_fee_percentage;
    this.yos_cashback_percentage = fields.yos_cashback_percentage;
    this.fee_percentage = fields.fee_percentage;
    this.referral_percentage = fields.referral_percentage;
  }

  static schema = new Map([
    [
      ProgramState,
      {
        kind: 'struct',
        fields: [
          ['is_initialized', 'bool'],
          ['admin', [32]],
          ['yot_mint', [32]],
          ['yos_mint', [32]],
          ['sol_yot_pool', [32]],
          ['liquidity_contribution_percentage', 'u8'],
          ['admin_fee_percentage', 'u8'],
          ['yos_cashback_percentage', 'u8'],
          ['fee_percentage', 'u8'],
          ['referral_percentage', 'u8'],
        ],
      },
    ],
  ]);
}

// SwapTokenInstruction structure
class SwapTokenInstruction {
  amount_in: bigint;
  minimum_amount_out: bigint;

  constructor(fields: {
    amount_in: bigint,
    minimum_amount_out: bigint,
  }) {
    this.amount_in = fields.amount_in;
    this.minimum_amount_out = fields.minimum_amount_out;
  }

  static schema = new Map([
    [
      SwapTokenInstruction,
      {
        kind: 'struct',
        fields: [
          ['amount_in', 'u64'],
          ['minimum_amount_out', 'u64'],
        ],
      },
    ],
  ]);
}

// Initialize multihub swap instruction type - this index must match our Rust program
const SWAP_TOKEN_IX = 1;

/**
 * Get the program's state address
 * @returns [PublicKey, number] - The PDA and bump seed
 */
export function findProgramStateAddress(): [PublicKey, number] {
  const [pda, bumpSeed] = PublicKey.findProgramAddressSync(
    [Buffer.from('state_v4', 'utf-8')], // Using v4 seed to avoid conflicts with existing program
    MULTIHUB_SWAP_PROGRAM_ID
  );
  return [pda, bumpSeed];
}

/**
 * Get the program's authority address for token operations
 * @returns [PublicKey, number] - The PDA and bump seed
 */
export function findProgramAuthorityAddress(): [PublicKey, number] {
  const [pda, bumpSeed] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority', 'utf-8')],
    MULTIHUB_SWAP_PROGRAM_ID
  );
  return [pda, bumpSeed];
}

/**
 * Encode the instruction data for swapping tokens
 * @param amountIn Amount of input tokens
 * @param minimumAmountOut Minimum amount of output tokens to accept
 * @returns Serialized instruction data
 */
function encodeSwapTokenInstruction(amountIn: number, minimumAmountOut: number): Buffer {
  try {
    const instruction = new SwapTokenInstruction({
      amount_in: BigInt(amountIn),
      minimum_amount_out: BigInt(minimumAmountOut),
    });
    
    // Create a buffer for the instruction type
    const instructionTypeBuffer = Buffer.alloc(1);
    instructionTypeBuffer.writeUInt8(SWAP_TOKEN_IX, 0);
    
    // Serialize the instruction data
    const instructionDataBuffer = Buffer.from(serialize(SwapTokenInstruction.schema, instruction));
    
    // Concatenate the instruction type with the instruction data
    return Buffer.concat([instructionTypeBuffer, instructionDataBuffer]);
  } catch (error) {
    console.error('Error encoding swap token instruction:', error);
    throw error;
  }
}

/**
 * Verify that a YOS token account exists, or add an instruction to create it
 * @param connection Solana connection
 * @param wallet User's wallet
 * @param transaction Transaction to add create instruction to, if needed
 * @returns The user's YOS token account public key
 */
export async function verifyYosTokenAccount(
  connection: Connection,
  wallet: any,
  transaction: Transaction
): Promise<PublicKey> {
  try {
    // Get the associated token address for YOS
    const yosTokenAccount = await getAssociatedTokenAddress(
      YOS_TOKEN_MINT,
      wallet.publicKey
    );
    
    // Check if the account exists
    const accountInfo = await connection.getAccountInfo(yosTokenAccount);
    
    // If the account doesn't exist, add an instruction to create it
    if (!accountInfo) {
      console.log('YOS token account not found. Adding instruction to create it.');
      const createAtaIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        yosTokenAccount, // associated token account
        wallet.publicKey, // owner
        YOS_TOKEN_MINT // mint
      );
      transaction.add(createAtaIx);
    } else {
      console.log('YOS token account exists.');
    }
    
    return yosTokenAccount;
  } catch (error) {
    console.error('Error verifying YOS token account:', error);
    throw error;
  }
}

/**
 * Validate all accounts needed for swapping
 * @param connection Solana connection
 * @param wallet User's wallet
 * @param inputTokenMint Input token mint
 * @param outputTokenMint Output token mint
 * @returns Object with all required account public keys and status
 */
export async function validateSwapAccounts(
  connection: Connection,
  wallet: any,
  inputTokenMint: PublicKey,
  outputTokenMint: PublicKey
): Promise<{
  inputTokenAccount: PublicKey;
  outputTokenAccount: PublicKey;
  yosTokenAccount: PublicKey;
  hasAllAccounts: boolean;
  missingAccounts: string[];
  transaction: Transaction;
}> {
  try {
    const missingAccounts: string[] = [];
    const transaction = new Transaction();
    
    // Get input token account
    const inputTokenAccount = await getAssociatedTokenAddress(
      inputTokenMint,
      wallet.publicKey
    );
    
    // Check if input token account exists
    const inputAccountInfo = await connection.getAccountInfo(inputTokenAccount);
    if (!inputAccountInfo) {
      missingAccounts.push('Input token account');
      const createInputAtaIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        inputTokenAccount,
        wallet.publicKey,
        inputTokenMint
      );
      transaction.add(createInputAtaIx);
    }
    
    // Get output token account
    const outputTokenAccount = await getAssociatedTokenAddress(
      outputTokenMint,
      wallet.publicKey
    );
    
    // Check if output token account exists
    const outputAccountInfo = await connection.getAccountInfo(outputTokenAccount);
    if (!outputAccountInfo) {
      missingAccounts.push('Output token account');
      const createOutputAtaIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        outputTokenAccount,
        wallet.publicKey,
        outputTokenMint
      );
      transaction.add(createOutputAtaIx);
    }
    
    // Verify YOS token account
    const yosTokenAccount = await verifyYosTokenAccount(connection, wallet, transaction);
    
    return {
      inputTokenAccount,
      outputTokenAccount,
      yosTokenAccount,
      hasAllAccounts: missingAccounts.length === 0,
      missingAccounts,
      transaction,
    };
  } catch (error) {
    console.error('Error validating swap accounts:', error);
    throw error;
  }
}

/**
 * Initialize a multihub swap program
 * @param wallet The connected wallet
 * @param yotMint YOT token mint
 * @param yosMint YOS token mint
 * @param solYotPool SOL-YOT pool address
 * @param liquidityContributionPercentage Percentage of input amount to contribute to liquidity (e.g., 20)
 * @param adminFeePercentage Admin fee percentage (e.g., 1 for 0.1%)
 * @param yosCashbackPercentage YOS cashback percentage (e.g., 5)
 * @param feePercentage Fee percentage (e.g., 3 for 0.3%)
 * @param referralPercentage Referral percentage (e.g., 5 for 0.5%)
 * @returns Transaction signature
 */
export async function initializeMultihubSwap(
  wallet: any,
  yotMint: PublicKey = YOT_TOKEN_MINT,
  yosMint: PublicKey = YOS_TOKEN_MINT,
  solYotPool: PublicKey,
  liquidityContributionPercentage: number = 20,
  adminFeePercentage: number = 1,
  yosCashbackPercentage: number = 5,
  feePercentage: number = 3,
  referralPercentage: number = 5
): Promise<string> {
  try {
    const connection = new Connection(ENDPOINT);
    
    // Find program state address
    const [programStateAddress, _] = findProgramStateAddress();
    
    // Instruction index for initialize (0)
    const instructionTypeBuffer = Buffer.alloc(1);
    instructionTypeBuffer.writeUInt8(0, 0);
    
    // Create the transaction
    const transaction = new Transaction();
    
    // Find the size of the program state
    const stateSize = 1 + // is_initialized
                    32 + // admin
                    32 + // yot_mint
                    32 + // yos_mint
                    32 + // sol_yot_pool
                    1 +  // liquidity_contribution_percentage
                    1 +  // admin_fee_percentage
                    1 +  // yos_cashback_percentage
                    1 +  // fee_percentage
                    1;   // referral_percentage
    
    // Create account instruction
    const lamports = await connection.getMinimumBalanceForRentExemption(stateSize);
    const createAccountIx = SystemProgram.createAccountWithSeed({
      fromPubkey: wallet.publicKey,
      basePubkey: wallet.publicKey,
      seed: 'state_v4',
      newAccountPubkey: programStateAddress,
      lamports,
      space: stateSize,
      programId: MULTIHUB_SWAP_PROGRAM_ID,
    });
    
    // Initialize instruction
    const initializeIx = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: true },
        { pubkey: yotMint, isSigner: false, isWritable: false },
        { pubkey: yosMint, isSigner: false, isWritable: false },
        { pubkey: solYotPool, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: MULTIHUB_SWAP_PROGRAM_ID,
      data: Buffer.concat([
        instructionTypeBuffer,
        Buffer.from([
          liquidityContributionPercentage,
          adminFeePercentage,
          yosCashbackPercentage,
          feePercentage,
          referralPercentage
        ])
      ]),
    });
    
    // Add instructions to transaction
    transaction.add(createAccountIx, initializeIx);
    
    // Sign and send transaction
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log('Multihub swap initialized. Signature:', signature);
    
    return signature;
  } catch (error) {
    console.error('Error initializing multihub swap:', error);
    throw error;
  }
}

/**
 * Swap tokens using the multihub swap program
 * @param wallet The connected wallet
 * @param inputTokenMint Input token mint
 * @param outputTokenMint Output token mint
 * @param amountIn Amount of input tokens
 * @param minimumAmountOut Minimum amount of output tokens to accept
 * @returns Transaction signature
 */
export async function swapToken(
  wallet: any,
  inputTokenMint: PublicKey,
  outputTokenMint: PublicKey,
  amountIn: number,
  minimumAmountOut: number
): Promise<string> {
  try {
    console.log(`Swapping ${amountIn} tokens from ${inputTokenMint.toString()} to ${outputTokenMint.toString()}`);
    console.log(`Minimum amount out: ${minimumAmountOut}`);
    
    const connection = new Connection(ENDPOINT);
    
    // Find program state address
    const [programStateAddress, _] = findProgramStateAddress();
    console.log('Program state address:', programStateAddress.toString());
    
    // Find program authority
    const [authorityPubkey, _bump] = findProgramAuthorityAddress();
    console.log('Program authority address:', authorityPubkey.toString());
    
    // Validate all accounts and create missing ones
    const {
      inputTokenAccount,
      outputTokenAccount,
      yosTokenAccount,
      transaction: setupTransaction,
      hasAllAccounts,
      missingAccounts,
    } = await validateSwapAccounts(
      connection,
      wallet,
      inputTokenMint,
      outputTokenMint
    );
    
    // Log account validation results
    console.log('Input token account:', inputTokenAccount.toString());
    console.log('Output token account:', outputTokenAccount.toString());
    console.log('YOS token account:', yosTokenAccount.toString());
    
    if (missingAccounts.length > 0) {
      console.log('Missing accounts:', missingAccounts.join(', '));
      console.log('Creating missing accounts...');
      
      // Send setup transaction if needed
      if (setupTransaction.instructions.length > 0) {
        const setupSignature = await wallet.sendTransaction(setupTransaction, connection);
        console.log('Setup transaction signature:', setupSignature);
        
        // Wait for the setup transaction to be confirmed
        await connection.confirmTransaction(setupSignature);
        console.log('Setup transaction confirmed');
      }
    }
    
    // Encode swap instruction data
    const swapInstructionData = encodeSwapTokenInstruction(amountIn, minimumAmountOut);
    
    // Create swap instruction
    const swapIx = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: inputTokenAccount, isSigner: false, isWritable: true },
        { pubkey: outputTokenAccount, isSigner: false, isWritable: true },
        { pubkey: yosTokenAccount, isSigner: false, isWritable: true },
        { pubkey: programStateAddress, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: inputTokenMint, isSigner: false, isWritable: false },
        { pubkey: outputTokenMint, isSigner: false, isWritable: false },
      ],
      programId: MULTIHUB_SWAP_PROGRAM_ID,
      data: swapInstructionData,
    });
    
    // Create the transaction for swap
    const swapTransaction = new Transaction().add(swapIx);
    
    // Sign and send transaction
    const signature = await wallet.sendTransaction(swapTransaction, connection);
    console.log('Swap transaction signature:', signature);
    
    return signature;
  } catch (error) {
    console.error('Error swapping tokens:', error);
    throw error;
  }
}

/**
 * Generic wrapper that chooses the appropriate method based on token parameters
 * This facilitates integration with the multi-provider swap system
 */
export async function performSwap(
  wallet: any, 
  tokenFrom: TokenInfo, 
  tokenTo: TokenInfo,
  amountIn: number,
  swapEstimate: SwapEstimate,
  provider: SwapProvider
): Promise<string> {
  console.log(`Using provider: ${provider}, For swap: ${tokenFrom.symbol} -> ${tokenTo.symbol}`);
  console.log(`Amount in: ${amountIn}, Estimated amount out: ${swapEstimate.outAmount}`);
  
  // Apply slippage to get minimum acceptable output amount
  const minimumAmountOut = Math.floor(swapEstimate.outAmount * 0.95); // 5% slippage
  
  // Check if either token is YOT
  const isYOT = (mint: string) => mint === YOT_TOKEN_MINT.toString();
  
  if (isYOT(tokenFrom.address) || isYOT(tokenTo.address)) {
    console.log('Using multihub swap for YOT transaction');
    return swapToken(
      wallet,
      new PublicKey(tokenFrom.address),
      new PublicKey(tokenTo.address),
      amountIn,
      minimumAmountOut
    );
  } else {
    console.log('Direct YOT swap not possible, using default Jupiter swap');
    throw new Error('Please use Jupiter for non-YOT swaps');
  }
}

/**
 * Exports to ensure compatibility with existing code
 */
export const MultihubSwapV2 = {
  PROGRAM_ID: MULTIHUB_SWAP_PROGRAM_ID.toString(),
  YOT_TOKEN_MINT: YOT_TOKEN_MINT.toString(),
  YOS_TOKEN_MINT: YOS_TOKEN_MINT.toString(),
  performSwap,
  swapToken,
  initializeMultihubSwap,
  validateSwapAccounts,
  verifyYosTokenAccount,
  findProgramStateAddress,
  findProgramAuthorityAddress,
};

export default MultihubSwapV2;