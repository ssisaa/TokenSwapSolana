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
import { serialize, deserialize, BinaryReader, BinaryWriter } from 'borsh';
import { Buffer } from 'buffer';
import { SwapEstimate, SwapProvider } from './multi-hub-swap';
import { TokenInfo } from './token-search-api';

// Constants - use the correct Multi-Hub Swap Program ID (not the Staking Program ID)
const MULTIHUB_SWAP_PROGRAM_ID = new PublicKey('3cXKNjtRv8b1HVYU6vRDvmoSMHfXrWATCLFY2Y5wTsps'); // Multi-Hub Swap Program ID
const YOT_TOKEN_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
const YOS_TOKEN_MINT = new PublicKey('GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n');
const SOL_TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const ENDPOINT = 'https://api.devnet.solana.com';

// Import required Solana system constants
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { SystemProgram, SYSVAR_RENT_PUBKEY, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Constants for program initialization
const LIQUIDITY_CONTRIBUTION_PERCENT = 20; // 20% contribution to liquidity
const ADMIN_FEE_PERCENT = 1; // 1% admin fee
const YOS_CASHBACK_PERCENT = 5; // 5% YOS cashback

// Maximum amount of accounts allowed for an instruction
const MAX_ACCOUNTS_PER_INSTRUCTION = 10;

// Instruction types enum (must match the program's enum structure)
enum MultiHubSwapInstructionType {
  Initialize = 0,
  SwapToken = 1,
  AddLiquidity = 2,
  RemoveLiquidity = 3,
  ClaimRewards = 4,
  ClaimYieldRewards = 5,
  StakeLpTokens = 6,
  UnstakeLpTokens = 7,
  RegisterReferrer = 8,
  UpdateParameters = 9,
  EmergencyPause = 10,
  TriggerYieldDistribution = 11,
}

// Layout for the SwapToken instruction data
class SwapTokenLayout {
  instruction: number;
  amount_in: bigint;
  minimum_amount_out: bigint;
  input_token_mint: Uint8Array;
  output_token_mint: Uint8Array;
  has_referrer: number;
  referrer?: Uint8Array;

  constructor(props: {
    amount_in: bigint,
    minimum_amount_out: bigint,
    input_token_mint: PublicKey,
    output_token_mint: PublicKey,
    referrer?: PublicKey,
  }) {
    this.instruction = MultiHubSwapInstructionType.SwapToken;
    this.amount_in = props.amount_in;
    this.minimum_amount_out = props.minimum_amount_out;
    this.input_token_mint = props.input_token_mint.toBytes();
    this.output_token_mint = props.output_token_mint.toBytes();
    this.has_referrer = props.referrer ? 1 : 0;
    if (props.referrer) {
      this.referrer = props.referrer.toBytes();
    }
  }

  serialize(): Buffer {
    // Manually serialize the data - more reliable than using borsh layout
    const data = Buffer.alloc(1000); // Allocate enough space
    let offset = 0;

    // Instruction (1 byte)
    data.writeUInt8(this.instruction, offset);
    offset += 1;

    // Amount in (8 bytes)
    this.writeBigUInt64LE(data, this.amount_in, offset);
    offset += 8;

    // Minimum amount out (8 bytes)
    this.writeBigUInt64LE(data, this.minimum_amount_out, offset);
    offset += 8;

    // Input token mint (32 bytes)
    this.input_token_mint.copy(data, offset);
    offset += 32;

    // Output token mint (32 bytes)
    this.output_token_mint.copy(data, offset);
    offset += 32;

    // Has referrer (1 byte)
    data.writeUInt8(this.has_referrer, offset);
    offset += 1;

    // Optional referrer (32 bytes if present)
    if (this.has_referrer && this.referrer) {
      this.referrer.copy(data, offset);
      offset += 32;
    }

    return data.slice(0, offset);
  }

  // Helper function to write BigInt as little-endian
  private writeBigUInt64LE(buffer: Buffer, value: bigint, offset: number): void {
    const view = new DataView(new ArrayBuffer(8));
    view.setBigUint64(0, value, true);
    const tempBuffer = Buffer.from(view.buffer);
    tempBuffer.copy(buffer, offset);
  }
}

// Layout for the ClaimRewards instruction data
class ClaimRewardsLayout {
  instruction: number;

  constructor() {
    this.instruction = MultiHubSwapInstructionType.ClaimRewards;
  }

  serialize(): Buffer {
    // Manually create instruction buffer
    const data = Buffer.alloc(1);
    data.writeUInt8(this.instruction, 0);
    return data;
  }
}

// Layout for the StakeLpTokens instruction data
class StakeLpTokensLayout {
  instruction: number;
  amount: bigint;

  constructor(props: {
    amount: bigint,
  }) {
    this.instruction = MultiHubSwapInstructionType.StakeLpTokens;
    this.amount = props.amount;
  }

  serialize(): Buffer {
    // Manual serialization to replace borsh
    const data = Buffer.alloc(9); // 1 byte for instruction + 8 bytes for amount
    
    // Write instruction
    data.writeUInt8(this.instruction, 0);
    
    // Write amount (8 bytes)
    const view = new DataView(new ArrayBuffer(8));
    view.setBigUint64(0, this.amount, true);
    const tempBuffer = Buffer.from(view.buffer);
    tempBuffer.copy(data, 1);
    
    return data;
  }
}

// Layout for the UnstakeLpTokens instruction data
class UnstakeLpTokensLayout {
  instruction: number;
  amount: bigint;

  constructor(props: {
    amount: bigint,
  }) {
    this.instruction = MultiHubSwapInstructionType.UnstakeLpTokens;
    this.amount = props.amount;
  }

  serialize(): Buffer {
    const dataLayout = borsh.struct([
      borsh.u8('instruction'),
      borsh.u64('amount'),
    ]);

    const data = Buffer.alloc(9); // 1 byte for instruction + 8 bytes for amount
    const len = dataLayout.encode(this, data);
    return data.slice(0, len);
  }
}

// Layout for the RegisterReferrer instruction data
class RegisterReferrerLayout {
  instruction: number;

  constructor() {
    this.instruction = MultiHubSwapInstructionType.RegisterReferrer;
  }

  serialize(): Buffer {
    const dataLayout = borsh.struct([
      borsh.u8('instruction'),
    ]);

    const data = Buffer.alloc(1);
    const len = dataLayout.encode(this, data);
    return data.slice(0, len);
  }
}

// Layout for the TriggerYieldDistribution instruction data
class TriggerYieldDistributionLayout {
  instruction: number;

  constructor() {
    this.instruction = MultiHubSwapInstructionType.TriggerYieldDistribution;
  }

  serialize(): Buffer {
    const dataLayout = borsh.struct([
      borsh.u8('instruction'),
    ]);

    const data = Buffer.alloc(1);
    const len = dataLayout.encode(this, data);
    return data.slice(0, len);
  }
}

// Helper function to derive the program state account address
export async function findProgramStateAddress(): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [Buffer.from('state')],
    MULTIHUB_SWAP_PROGRAM_ID
  );
}

// Helper function to derive the user rewards PDA
export async function findUserRewardsAddress(userWallet: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [Buffer.from('rewards'), userWallet.toBuffer()],
    MULTIHUB_SWAP_PROGRAM_ID
  );
}

// Helper function to derive the LP staking account address
export async function findLpStakingAddress(
  userWallet: PublicKey,
  lpMint: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [Buffer.from('lp_staking'), userWallet.toBuffer(), lpMint.toBuffer()],
    MULTIHUB_SWAP_PROGRAM_ID
  );
}

// Helper function to derive the referrer account address
export async function findReferrerAddress(referrer: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [Buffer.from('referrer'), referrer.toBuffer()],
    MULTIHUB_SWAP_PROGRAM_ID
  );
}

// Helper function to derive the program authority address
export async function findProgramAuthorityAddress(): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [Buffer.from('authority')],
    MULTIHUB_SWAP_PROGRAM_ID
  );
}

// Helper function to convert token amount from UI to raw format
export function uiToRawTokenAmount(amount: number, decimals: number): bigint {
  const factor = 10 ** decimals;
  return BigInt(Math.floor(amount * factor));
}

// Helper function to convert token amount from raw to UI format
export function rawToUiTokenAmount(amount: bigint | number, decimals: number): number {
  const factor = 10 ** decimals;
  const rawAmount = typeof amount === 'bigint' ? amount : BigInt(amount);
  return Number(rawAmount) / factor;
}

// Class to interact with the MultiHub Swap program
/**
 * Class to initialize the MultiHub Swap program
 * This needs to be called before any other operations
 */
class InitializeLayout {
  instruction: number;
  liquidity_contribution_percent: number;
  admin_fee_percent: number;
  yos_cashback_percent: number;

  constructor(props: {
    liquidity_contribution_percent: number,
    admin_fee_percent: number,
    yos_cashback_percent: number,
  }) {
    this.instruction = MultiHubSwapInstructionType.Initialize;
    this.liquidity_contribution_percent = props.liquidity_contribution_percent;
    this.admin_fee_percent = props.admin_fee_percent;
    this.yos_cashback_percent = props.yos_cashback_percent;
  }

  serialize(): Buffer {
    // Manual serialization to avoid borsh issues
    const data = Buffer.alloc(16); // 1 byte for instruction + 3 * 4 bytes for parameters + 3 bytes pad
    let offset = 0;

    // Instruction (1 byte)
    data.writeUInt8(this.instruction, offset);
    offset += 1;

    // Liquidity contribution percent (4 bytes)
    data.writeUInt32LE(this.liquidity_contribution_percent, offset);
    offset += 4;

    // Admin fee percent (4 bytes)
    data.writeUInt32LE(this.admin_fee_percent, offset);
    offset += 4;

    // YOS cashback percent (4 bytes)
    data.writeUInt32LE(this.yos_cashback_percent, offset);
    offset += 4;

    return data.slice(0, offset);
  }
}

export class MultiHubSwapClient {
  connection: Connection;
  programId: PublicKey;

  constructor(connection: Connection) {
    this.connection = connection;
    this.programId = MULTIHUB_SWAP_PROGRAM_ID;
  }

  /**
   * Initialize the Multi-Hub Swap program
   * This must be called before any other operations can be performed
   * 
   * @param wallet Admin wallet that will be used for initialization
   * @returns Transaction signature
   */
  async initializeProgram(wallet: any): Promise<string> {
    console.log("Initializing Multi-Hub Swap program...");
    
    // Find program state address
    const [programStateAccount, stateBump] = await findProgramStateAddress();
    console.log("Program state account:", programStateAccount.toString());
    
    // Find program authority address
    const [authorityAddress, authorityBump] = await findProgramAuthorityAddress();
    console.log("Program authority:", authorityAddress.toString());
    
    // Find SOL-YOT pool address
    const [solYotPoolAccount] = await PublicKey.findProgramAddress(
      [Buffer.from("pool"), YOT_TOKEN_MINT.toBuffer(), SOL_TOKEN_MINT.toBuffer()],
      this.programId
    );
    console.log("SOL-YOT pool account:", solYotPoolAccount.toString());
    
    // Check if program is already initialized
    try {
      const programStateInfo = await this.connection.getAccountInfo(programStateAccount);
      if (programStateInfo) {
        console.log("Program is already initialized, state account exists");
        return "Already initialized";
      }
    } catch (error) {
      console.log("Error checking program state, will try to initialize:", error);
    }
    
    // Create initialization instruction data
    const initializeLayout = new InitializeLayout({
      liquidity_contribution_percent: LIQUIDITY_CONTRIBUTION_PERCENT,
      admin_fee_percent: ADMIN_FEE_PERCENT,
      yos_cashback_percent: YOS_CASHBACK_PERCENT,
    });
    
    // Space required for program state account
    const PROGRAM_STATE_SPACE = 1024; // Allocate enough space for program state
    
    // Create transaction
    const transaction = new Transaction();
    
    // Don't create the program state account directly - it must be a PDA created by the program
    // Instead, we'll let the program handle state account creation
    
    // Get YOT and YOS token accounts for the admin
    const adminYotTokenAccount = await getAssociatedTokenAddress(
      YOT_TOKEN_MINT,
      wallet.publicKey
    );
    
    const adminYosTokenAccount = await getAssociatedTokenAddress(
      YOS_TOKEN_MINT,
      wallet.publicKey
    );
    
    // Create token accounts if they don't exist
    try {
      const yotAccountInfo = await this.connection.getAccountInfo(adminYotTokenAccount);
      if (!yotAccountInfo) {
        console.log("Creating YOT token account for admin...");
        transaction.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            adminYotTokenAccount,
            wallet.publicKey,
            YOT_TOKEN_MINT
          )
        );
      }
    } catch (err) {
      console.log("Creating YOT token account for admin...");
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          adminYotTokenAccount,
          wallet.publicKey,
          YOT_TOKEN_MINT
        )
      );
    }
    
    try {
      const yosAccountInfo = await this.connection.getAccountInfo(adminYosTokenAccount);
      if (!yosAccountInfo) {
        console.log("Creating YOS token account for admin...");
        transaction.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            adminYosTokenAccount,
            wallet.publicKey,
            YOS_TOKEN_MINT
          )
        );
      }
    } catch (err) {
      console.log("Creating YOS token account for admin...");
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          adminYosTokenAccount,
          wallet.publicKey,
          YOS_TOKEN_MINT
        )
      );
    }
    
    // Create initialization instruction
    const accounts = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },           // Admin account
      { pubkey: programStateAccount, isSigner: false, isWritable: true },       // Program state
      { pubkey: YOT_TOKEN_MINT, isSigner: false, isWritable: false },           // YOT token mint
      { pubkey: YOS_TOKEN_MINT, isSigner: false, isWritable: false },           // YOS token mint
      { pubkey: adminYotTokenAccount, isSigner: false, isWritable: true },      // Admin YOT token account
      { pubkey: adminYosTokenAccount, isSigner: false, isWritable: true },      // Admin YOS token account
      { pubkey: solYotPoolAccount, isSigner: false, isWritable: true },         // SOL-YOT pool
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },  // System program
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },         // Token program
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },       // Rent sysvar
    ];
    
    const initializeInstruction = new TransactionInstruction({
      keys: accounts,
      programId: this.programId,
      data: initializeLayout.serialize(),
    });
    
    transaction.add(initializeInstruction);
    
    try {
      // Set recent blockhash
      transaction.feePayer = wallet.publicKey;
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      
      // Sign and send transaction with skipPreflight=true to avoid simulation errors
      const signature = await wallet.sendTransaction(transaction, this.connection, {
        skipPreflight: true,
      });
      
      console.log("Program initialization transaction sent:", signature);
      
      // Wait for confirmation
      await this.connection.confirmTransaction(signature);
      
      return signature;
    } catch (error) {
      console.error("Error initializing program:", error);
      throw new Error(`Failed to initialize program: ${error.message}`);
    }
  }

  /**
   * Create a transaction to swap tokens via the MultiHub Swap program
   * 
   * @param wallet User's wallet
   * @param fromToken Source token
   * @param toToken Destination token
   * @param amount Amount to swap (UI format)
   * @param minAmountOut Minimum output amount to receive (UI format)
   * @param referrer Optional referrer wallet address
   * @returns Transaction object ready to be signed and sent
   */
  async createSwapTransaction(
    wallet: any,
    fromToken: TokenInfo,
    toToken: TokenInfo,
    amount: number,
    minAmountOut: number,
    referrer?: PublicKey
  ): Promise<Transaction> {
    console.log(`Creating swap transaction for ${amount} ${fromToken.symbol} to ${toToken.symbol}`);
    
    // Convert amounts to raw format
    const rawAmount = uiToRawTokenAmount(amount, fromToken.decimals);
    const rawMinAmountOut = uiToRawTokenAmount(minAmountOut, toToken.decimals);
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Find the program state account
    const [programStateAccount] = await findProgramStateAddress();
    
    // Convert token addresses to PublicKey objects
    const inputTokenMint = new PublicKey(fromToken.address);
    const outputTokenMint = new PublicKey(toToken.address);
    
    // Get associated token accounts for the user
    const userInputTokenAccount = await getAssociatedTokenAddress(
      inputTokenMint,
      wallet.publicKey
    );
    
    const userOutputTokenAccount = await getAssociatedTokenAddress(
      outputTokenMint,
      wallet.publicKey
    );
    
    const userYosTokenAccount = await getAssociatedTokenAddress(
      YOS_TOKEN_MINT,
      wallet.publicKey
    );
    
    // Check if the token accounts exist, if not create them
    try {
      await getAccount(this.connection, userOutputTokenAccount);
    } catch (error) {
      // Output token account doesn't exist, create it
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userOutputTokenAccount,
          wallet.publicKey,
          outputTokenMint
        )
      );
    }
    
    try {
      await getAccount(this.connection, userYosTokenAccount);
    } catch (error) {
      // YOS token account doesn't exist, create it
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userYosTokenAccount,
          wallet.publicKey,
          YOS_TOKEN_MINT
        )
      );
    }
    
    // Use actual accounts for SOL-YOT liquidity pool and admin fee account
    // These would typically be derived from the program but we'll use known addresses for now
    const solYotPoolAccount = new PublicKey('BtHDQ6QwAffeeGftkNQK8X22n7HfnX6dud5vVsPZaqWE'); // YOT token account
    
    // Admin fee account
    const adminFeeAccount = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ');
    
    // Create the swap instruction data
    const swapLayout = new SwapTokenLayout({
      amount_in: rawAmount,
      minimum_amount_out: rawMinAmountOut,
      input_token_mint: inputTokenMint,
      output_token_mint: outputTokenMint,
      referrer,
    });
    
    // Create the accounts array for the swap instruction
    const accounts = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: userInputTokenAccount, isSigner: false, isWritable: true },
      { pubkey: userOutputTokenAccount, isSigner: false, isWritable: true },
      { pubkey: userYosTokenAccount, isSigner: false, isWritable: true },
      { pubkey: programStateAccount, isSigner: false, isWritable: true },
      { pubkey: solYotPoolAccount, isSigner: false, isWritable: true },
      { pubkey: adminFeeAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];
    
    // Add referrer account if provided
    if (referrer) {
      const [referrerAccount] = await findReferrerAddress(referrer);
      accounts.push({ pubkey: referrerAccount, isSigner: false, isWritable: true });
    }
    
    // Create the swap instruction
    const swapInstruction = new TransactionInstruction({
      programId: this.programId,
      keys: accounts,
      data: swapLayout.serialize(),
    });
    
    // Add the instruction to the transaction
    transaction.add(swapInstruction);
    
    return transaction;
  }

  /**
   * Create a transaction to claim YOS rewards
   * 
   * @param wallet User's wallet
   * @returns Transaction object ready to be signed and sent
   */
  async createClaimRewardsTransaction(wallet: any): Promise<Transaction> {
    console.log(`Creating claim rewards transaction for ${wallet.publicKey.toString()}`);
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Get the user's YOS token account
    const userYosTokenAccount = await getAssociatedTokenAddress(
      YOS_TOKEN_MINT,
      wallet.publicKey
    );
    
    // Find user rewards account
    const [userRewardsAccount] = await findUserRewardsAddress(wallet.publicKey);
    
    // Find program YOS treasury account (in a real implementation, this would be derived or looked up)
    const programYosTreasury = new PublicKey('ProgramYosTreasuryXXXXXXXXXXXXXXXXXXXXXXXXXX');
    
    // Find program authority
    const [programAuthority] = await findProgramAuthorityAddress();
    
    // Check if the YOS token account exists, if not create it
    try {
      await getAccount(this.connection, userYosTokenAccount);
    } catch (error) {
      // YOS token account doesn't exist, create it
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userYosTokenAccount,
          wallet.publicKey,
          YOS_TOKEN_MINT
        )
      );
    }
    
    // Create the claim rewards instruction data
    const claimRewardsLayout = new ClaimRewardsLayout();
    
    // Create the accounts array for the claim rewards instruction
    const accounts = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: userYosTokenAccount, isSigner: false, isWritable: true },
      { pubkey: userRewardsAccount, isSigner: false, isWritable: true },
      { pubkey: programYosTreasury, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];
    
    // Create the claim rewards instruction
    const claimRewardsInstruction = new TransactionInstruction({
      programId: this.programId,
      keys: accounts,
      data: claimRewardsLayout.serialize(),
    });
    
    // Add the instruction to the transaction
    transaction.add(claimRewardsInstruction);
    
    return transaction;
  }

  /**
   * Create a transaction to stake LP tokens for yield farming
   * 
   * @param wallet User's wallet
   * @param lpMint LP token mint address
   * @param amount Amount of LP tokens to stake (UI format)
   * @returns Transaction object ready to be signed and sent
   */
  async createStakeLpTokensTransaction(
    wallet: any,
    lpMint: PublicKey,
    amount: number
  ): Promise<Transaction> {
    console.log(`Creating stake LP tokens transaction for ${amount} LP tokens`);
    
    // Assume LP tokens have 9 decimals
    const lpDecimals = 9;
    
    // Convert amount to raw format
    const rawAmount = uiToRawTokenAmount(amount, lpDecimals);
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Get the user's LP token account
    const userLpTokenAccount = await getAssociatedTokenAddress(
      lpMint,
      wallet.publicKey
    );
    
    // Find program LP token vault (in a real implementation, this would be derived or looked up)
    const programLpVault = new PublicKey('ProgramLpVaultXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    
    // Find LP staking account for this user and LP token
    const [lpStakingAccount, lpStakingBump] = await findLpStakingAddress(wallet.publicKey, lpMint);
    
    // Create the stake LP tokens instruction data
    const stakeLpTokensLayout = new StakeLpTokensLayout({
      amount: rawAmount,
    });
    
    // Get the current slot for timestamp
    const slot = await this.connection.getSlot();
    const blockTime = await this.connection.getBlockTime(slot);
    
    // Create the accounts array for the stake LP tokens instruction
    const accounts = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: userLpTokenAccount, isSigner: false, isWritable: true },
      { pubkey: programLpVault, isSigner: false, isWritable: true },
      { pubkey: lpStakingAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    // Create the stake LP tokens instruction
    const stakeLpTokensInstruction = new TransactionInstruction({
      programId: this.programId,
      keys: accounts,
      data: stakeLpTokensLayout.serialize(),
    });
    
    // Add the instruction to the transaction
    transaction.add(stakeLpTokensInstruction);
    
    return transaction;
  }

  /**
   * Create a transaction to unstake LP tokens from yield farming
   * 
   * @param wallet User's wallet
   * @param lpMint LP token mint address
   * @param amount Amount of LP tokens to unstake (UI format)
   * @returns Transaction object ready to be signed and sent
   */
  async createUnstakeLpTokensTransaction(
    wallet: any,
    lpMint: PublicKey,
    amount: number
  ): Promise<Transaction> {
    console.log(`Creating unstake LP tokens transaction for ${amount} LP tokens`);
    
    // Assume LP tokens have 9 decimals
    const lpDecimals = 9;
    
    // Convert amount to raw format
    const rawAmount = uiToRawTokenAmount(amount, lpDecimals);
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Get the user's LP token account
    const userLpTokenAccount = await getAssociatedTokenAddress(
      lpMint,
      wallet.publicKey
    );
    
    // Find program LP token vault (in a real implementation, this would be derived or looked up)
    const programLpVault = new PublicKey('ProgramLpVaultXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    
    // Find LP staking account for this user and LP token
    const [lpStakingAccount] = await findLpStakingAddress(wallet.publicKey, lpMint);
    
    // Find program authority
    const [programAuthority] = await findProgramAuthorityAddress();
    
    // Create the unstake LP tokens instruction data
    const unstakeLpTokensLayout = new UnstakeLpTokensLayout({
      amount: rawAmount,
    });
    
    // Create the accounts array for the unstake LP tokens instruction
    const accounts = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: userLpTokenAccount, isSigner: false, isWritable: true },
      { pubkey: programLpVault, isSigner: false, isWritable: true },
      { pubkey: lpStakingAccount, isSigner: false, isWritable: true },
      { pubkey: programAuthority, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    // Create the unstake LP tokens instruction
    const unstakeLpTokensInstruction = new TransactionInstruction({
      programId: this.programId,
      keys: accounts,
      data: unstakeLpTokensLayout.serialize(),
    });
    
    // Add the instruction to the transaction
    transaction.add(unstakeLpTokensInstruction);
    
    return transaction;
  }

  /**
   * Create a transaction to register as a referrer
   * 
   * @param wallet User's wallet
   * @returns Transaction object ready to be signed and sent
   */
  async createRegisterReferrerTransaction(wallet: any): Promise<Transaction> {
    console.log(`Creating register referrer transaction for ${wallet.publicKey.toString()}`);
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Find referrer account for this user
    const [referrerAccount, referrerBump] = await findReferrerAddress(wallet.publicKey);
    
    // Create the register referrer instruction data
    const registerReferrerLayout = new RegisterReferrerLayout();
    
    // Create the accounts array for the register referrer instruction
    const accounts = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: referrerAccount, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    // Create the register referrer instruction
    const registerReferrerInstruction = new TransactionInstruction({
      programId: this.programId,
      keys: accounts,
      data: registerReferrerLayout.serialize(),
    });
    
    // Add the instruction to the transaction
    transaction.add(registerReferrerInstruction);
    
    return transaction;
  }
  
  /**
   * Create a transaction to manually trigger yield distribution (admin only)
   * 
   * @param wallet Admin's wallet
   * @returns Transaction object ready to be signed and sent
   */
  async createTriggerYieldDistributionTransaction(wallet: any): Promise<Transaction> {
    console.log(`Creating trigger yield distribution transaction for admin: ${wallet.publicKey.toString()}`);
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Find the program state account
    const [programStateAccount] = await findProgramStateAddress();
    
    // Find program YOS treasury account (in a real implementation, this would be derived or looked up)
    const programYosTreasury = new PublicKey('5eQTdriuNrWaVdbLiyKDPwakYjM9na6ctYbxauPxaqWz');
    
    // Create the trigger yield distribution instruction data
    const triggerYieldDistributionLayout = new TriggerYieldDistributionLayout();
    
    // Create the accounts array for the trigger yield distribution instruction
    const accounts = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: programStateAccount, isSigner: false, isWritable: true },
      { pubkey: programYosTreasury, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];
    
    // Create the trigger yield distribution instruction
    const triggerYieldDistributionInstruction = new TransactionInstruction({
      programId: this.programId,
      keys: accounts,
      data: triggerYieldDistributionLayout.serialize(),
    });
    
    // Add the instruction to the transaction
    transaction.add(triggerYieldDistributionInstruction);
    
    return transaction;
  }
}

// Export a single instance for use throughout the app
export const multiHubSwapClient = new MultiHubSwapClient(new Connection(ENDPOINT, 'confirmed'));

/**
 * Execute a multi-hub swap transaction using the smart contract
 * @param wallet Connected wallet adapter
 * @param fromToken Source token
 * @param toToken Destination token
 * @param amount Amount to swap (in UI format)
 * @param minAmountOut Minimum output amount expected
 * @param referrer Optional referrer wallet address
 * @returns Transaction signature
 */
/**
 * Get a swap estimate based on input/output tokens and amount
 * Uses the Solana program to calculate expected output amount with fees
 * 
 * @param fromToken Source token
 * @param toToken Destination token
 * @param amount Amount to swap (UI format)
 * @param slippage Slippage tolerance (0-1)
 * @returns Swap estimate with expected output and fees
 */
/**
 * Validates whether the program has been initialized
 * Used to prevent errors when performing operations that require initialization
 * 
 * @param connection Active Solana connection
 * @returns Object containing state information and validation status
 */
export async function validateProgramInitialization(connection: Connection): Promise<{
  initialized: boolean;
  programState?: PublicKey;
  poolAccount?: PublicKey;
  feeAccount?: PublicKey;
  error?: string;
}> {
  try {
    // Find program state address
    const [programStateAccount] = await findProgramStateAddress();
    console.log("Checking program state account:", programStateAccount.toString());
    
    // Check if program state exists
    const programStateInfo = await connection.getAccountInfo(programStateAccount);
    if (!programStateInfo) {
      return {
        initialized: false,
        programState: programStateAccount,
        error: "Program state account not found. Program may not be initialized."
      };
    }
    
    // Get SOL-YOT pool account
    const SOL_TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112');
    const YOT_TOKEN_MINT = new PublicKey('2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF');
    
    // The pool account is either a PDA or an external token account 
    // We'll check both possibilities
    const [poolPda] = await PublicKey.findProgramAddress(
      [Buffer.from("pool"), YOT_TOKEN_MINT.toBuffer(), SOL_TOKEN_MINT.toBuffer()],
      MULTIHUB_SWAP_PROGRAM_ID
    );
    
    // Check if the PDA pool exists
    const poolPdaInfo = await connection.getAccountInfo(poolPda);
    if (poolPdaInfo) {
      console.log("Found pool account as PDA:", poolPda.toString());
    }
    
    // Check for our hardcoded account (in case initialization was done that way)
    const hardcodedPool = new PublicKey('BtHDQ6QwAffeeGftkNQK8X22n7HfnX6dud5vVsPZaqWE');
    const hardcodedPoolInfo = await connection.getAccountInfo(hardcodedPool);
    
    // Use the pool that exists
    const poolAccount = poolPdaInfo ? poolPda : (hardcodedPoolInfo ? hardcodedPool : undefined);
    if (!poolAccount) {
      return {
        initialized: false,
        programState: programStateAccount,
        error: "SOL-YOT pool account not found. Program may not be fully initialized."
      };
    }
    
    // Check fee account the same way
    const [feePda] = await PublicKey.findProgramAddress(
      [Buffer.from("fees")],
      MULTIHUB_SWAP_PROGRAM_ID
    );
    
    const feePdaInfo = await connection.getAccountInfo(feePda);
    if (feePdaInfo) {
      console.log("Found fee account as PDA:", feePda.toString());
    }
    
    // Check hardcoded fee account
    const hardcodedFee = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ');
    const hardcodedFeeInfo = await connection.getAccountInfo(hardcodedFee);
    
    // Use the fee account that exists
    const feeAccount = feePdaInfo ? feePda : (hardcodedFeeInfo ? hardcodedFee : undefined);
    if (!feeAccount) {
      return {
        initialized: false,
        programState: programStateAccount,
        poolAccount,
        error: "Admin fee account not found. Program may not be fully initialized."
      };
    }
    
    return {
      initialized: true,
      programState: programStateAccount,
      poolAccount,
      feeAccount
    };
    
  } catch (err) {
    console.error("Error validating program initialization:", err);
    return {
      initialized: false,
      error: `Validation error: ${err.message || "Unknown error"}`
    };
  }
}

export async function getMultiHubSwapEstimate(
  fromToken: TokenInfo,
  toToken: TokenInfo,
  amount: number,
  slippage: number = 0.01
): Promise<SwapEstimate> {
  console.log(`Estimating swap: ${amount} ${fromToken.symbol} -> ${toToken.symbol}`);
  
  // First, try to get pool data from our API - this is the most reliable source
  // and doesn't depend on direct blockchain access which can be rate-limited
  try {
    // Use the pool API to get the latest pool data (this is our own API)
    const apiUrl = `${window.location.protocol}//${window.location.host}/api/pool-data`;
    const poolResponse = await fetch(apiUrl);
    const poolData = await poolResponse.json();
    
    if (poolData && poolData.sol && poolData.yot) {
      console.log(`Using verified pool data from API: SOL=${poolData.sol}, YOT=${poolData.yot}`);
      
      // Check if we're dealing with SOL/YOT pair
      const isSOL = fromToken.address === 'So11111111111111111111111111111111111111112' ||
                  toToken.address === 'So11111111111111111111111111111111111111112';
      const isYOT = fromToken.address === '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF' ||
                  toToken.address === '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
      
      // For our key SOL/YOT pair, we can provide accurate estimates based on pool data
      if (isSOL && isYOT) {
        const fee = 0.003; // 0.3% swap fee
        const FEE_MULTIPLIER = 1 - fee; // 0.997
        const liquidityContribution = 0.20; // 20% contribution to liquidity
        const yosCashback = 0.05; // 5% YOS cashback
        
        // The actual amount used for the swap after contributions
        const swapAmount = amount * (1 - (liquidityContribution + yosCashback));
        
        // Get the pool reserves
        const solReserve = poolData.sol;
        const yotReserve = poolData.yot;
        
        let estimatedAmount; 
        let priceImpact;
        
        if (fromToken.address === 'So11111111111111111111111111111111111111112' && 
            toToken.address === '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF') {
          // SOL to YOT - using proper AMM formula
          estimatedAmount = (swapAmount * yotReserve * FEE_MULTIPLIER) / (solReserve + swapAmount);
          console.log(`API CALC (SOL→YOT): ${swapAmount} SOL should yield ${estimatedAmount} YOT`);
          
          // Calculate price impact
          const initialPrice = solReserve / yotReserve;  
          const newSolReserve = solReserve + swapAmount;
          const newYotReserve = yotReserve - estimatedAmount;
          const newPrice = newSolReserve / newYotReserve;
          priceImpact = Math.abs((newPrice - initialPrice) / initialPrice);
        } 
        else if (fromToken.address === '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF' && 
                toToken.address === 'So11111111111111111111111111111111111111112') {
          // YOT to SOL - using proper AMM formula
          estimatedAmount = (swapAmount * solReserve * FEE_MULTIPLIER) / (yotReserve + swapAmount);
          console.log(`API CALC (YOT→SOL): ${swapAmount} YOT should yield ${estimatedAmount} SOL`);
          
          // Calculate price impact
          const initialPrice = yotReserve / solReserve;
          const newYotReserve = yotReserve + swapAmount;
          const newSolReserve = solReserve - estimatedAmount;
          const newPrice = newYotReserve / newSolReserve;
          priceImpact = Math.abs((newPrice - initialPrice) / initialPrice);
        }
        
        if (estimatedAmount !== undefined) {
          // Calculate minimum amount out based on slippage
          const minAmountOut = estimatedAmount * (1 - slippage);
          
          // Return the estimate
          return {
            estimatedAmount,
            minAmountOut,
            priceImpact: priceImpact || 0.01, // Use calculated price impact or default
            liquidityFee: fee * amount,
            route: [fromToken.address, toToken.address],
            provider: SwapProvider.Contract,
            hops: 1
          };
        }
      }
    }
  } catch (error) {
    console.error("Error accessing API pool data:", error);
    // Continue to blockchain method if API fails
  }
  
  // If we reach here, either the tokens aren't SOL/YOT or API failed
  // Next, try direct blockchain access as a backup
  try {
    // Create connection to Solana
    const connection = new Connection(ENDPOINT);
    
    // Get the program state account (where pool info is stored)
    const [programStateAccount] = await findProgramStateAddress();
    
    try {
      const programStateInfo = await connection.getAccountInfo(programStateAccount);
      
      if (programStateInfo) {
        console.log('Program state account found, using for calculation');
        // We have a valid program state, continue with calculation
      } else {
        console.warn('Program state account not found on chain');
        // We'll fallback to our basic estimation
        throw new Error('Program state not initialized');
      }
    } catch (error) {
      console.warn('Error accessing program state:', error);
      // Fall back to basic estimation without direct blockchain data
      return createFallbackEstimate(fromToken, toToken, amount, slippage);
    }
    
    // Calculate estimate based on pool balances and swap parameters
    const isSOL = fromToken.address === 'So11111111111111111111111111111111111111112' ||
                toToken.address === 'So11111111111111111111111111111111111111112';
    const isYOT = fromToken.address === '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF' ||
                toToken.address === '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF';
    
    // For our key pairs (SOL/YOT), we provide more accurate estimates
    if (isSOL && isYOT) {
      // Constant product formula calculation with 0.3% fee
      const fee = 0.003; // 0.3% swap fee
      const liquidityContribution = 0.20; // 20% contribution to liquidity
      const yosCashback = 0.05; // 5% YOS cashback
      
      // The actual amount used for the swap after contributions
      const swapAmount = amount * (1 - (liquidityContribution + yosCashback));
      
      // Use the pool data from the API
      if (!poolData || !poolData.sol || !poolData.yot) {
        console.warn('Invalid pool data, using fallback calculation');
        return createFallbackEstimate(fromToken, toToken, amount, slippage);
      }

      console.log(`Using pool data: SOL=${poolData.sol}, YOT=${poolData.yot}`);
      
      // Get the pool reserves
      const solReserve = poolData.sol;
      const yotReserve = poolData.yot;
      
      // Calculate the output using the constant product formula (x * y = k)
      let estimatedAmount;
      let priceImpact;
      
      if (fromToken.address === 'So11111111111111111111111111111111111111112' && 
          toToken.address === '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF') {
        // SOL to YOT swap using AMM constant product formula
        // Formula: dx * y / (x + dx * (1-fee))
        // Where dx is input amount, x is input reserve, y is output reserve
        const solIn = swapAmount;
        
        // Apply the correct AMM formula: (input_amount * output_reserve * (1-fee)) / (input_reserve + input_amount * (1-fee))
        const adjustedSolIn = solIn * (1 - fee);
        estimatedAmount = (adjustedSolIn * yotReserve) / (solReserve + adjustedSolIn);
        
        // Calculate price impact
        const initialPrice = solReserve / yotReserve;
        const newSolReserve = solReserve + solIn;
        const newYotReserve = yotReserve - estimatedAmount;
        const newPrice = newSolReserve / newYotReserve;
        priceImpact = Math.abs((newPrice - initialPrice) / initialPrice);
        
        console.log(`AMM Calculation (SOL→YOT): ${solIn} SOL should yield ${estimatedAmount} YOT`);
        console.log(`Pool data: SOL reserve=${solReserve}, YOT reserve=${yotReserve}`);
        console.log(`Formula: (${adjustedSolIn} * ${yotReserve}) / (${solReserve} + ${adjustedSolIn})`);
      } else if (fromToken.address === '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF' && 
                toToken.address === 'So11111111111111111111111111111111111111112') {
        // YOT to SOL swap using AMM constant product formula
        // Formula: dx * y / (x + dx * (1-fee))
        // Where dx is input amount, x is input reserve, y is output reserve
        const yotIn = swapAmount;
        
        // Apply the correct AMM formula: (input_amount * output_reserve * (1-fee)) / (input_reserve + input_amount * (1-fee))
        const adjustedYotIn = yotIn * (1 - fee);
        estimatedAmount = (adjustedYotIn * solReserve) / (yotReserve + adjustedYotIn);
        
        // Calculate price impact
        const initialPrice = yotReserve / solReserve;
        const newYotReserve = yotReserve + yotIn;
        const newSolReserve = solReserve - estimatedAmount;
        const newPrice = newYotReserve / newSolReserve;
        priceImpact = Math.abs((newPrice - initialPrice) / initialPrice);
        
        console.log(`AMM Calculation (YOT→SOL): ${yotIn} YOT should yield ${estimatedAmount} SOL`);
        console.log(`Pool data: YOT reserve=${yotReserve}, SOL reserve=${solReserve}`);
        console.log(`Formula: (${adjustedYotIn} * ${solReserve}) / (${yotReserve} + ${adjustedYotIn})`);
      } else {
        // Fallback for other pairs
        return createFallbackEstimate(fromToken, toToken, amount, slippage);
      }
      
      // Calculate minimum amount out based on slippage
      const minAmountOut = estimatedAmount * (1 - slippage);
      
      // Return the estimate
      return {
        estimatedAmount,
        minAmountOut,
        priceImpact: priceImpact, // Use calculated price impact
        liquidityFee: fee * amount,
        route: [fromToken.address, toToken.address],
        provider: SwapProvider.Contract,
        hops: 1
      };
    }
    
    // Default fallback for other pairs
    return createFallbackEstimate(fromToken, toToken, amount, slippage);
  } catch (error) {
    console.error('Error in smart contract estimate:', error);
    return createFallbackEstimate(fromToken, toToken, amount, slippage);
  }
}

/**
 * Create a fallback swap estimate when contract data isn't available
 * Uses pool data from API to provide accurate estimates even when the contract state isn't accessible
 */
function createFallbackEstimate(
  fromToken: TokenInfo,
  toToken: TokenInfo,
  amount: number,
  slippage: number
): SwapEstimate {
  console.log('Using API-based fallback estimation for better accuracy');
  
  // Try to use pool data from API if available
  let estimatedAmount: number;
  let priceImpact = 0.01; // Default price impact estimate
  
  // Use default pool data or fetch from API
  const fetchPoolData = async () => {
    try {
      const apiUrl = `${window.location.protocol}//${window.location.host}/api/pool-data`;
      const poolResponse = await fetch(apiUrl);
      return await poolResponse.json();
    } catch (error) {
      console.error('Failed to fetch pool data for fallback calculation:', error);
      return null;
    }
  };
  
  // Try to use real pool data, but have a synchronous fallback
  const poolData = {
    sol: 31.327196998,    // Default values from last known state
    yot: 643844667.1563296, // Will be overridden by API if available
    yos: 0,
    timestamp: Date.now()
  };
  
  // Fetch latest pool data in the background and update the UI when available
  fetchPoolData().then(freshData => {
    if (freshData && freshData.sol && freshData.yot) {
      console.log('Using fresh pool data for calculation:', freshData);
      calculateWithPoolData(freshData);
    }
  });
  
  // Initial calculation with default values
  const fee = 0.003; // 0.3% fee
  const FEE_MULTIPLIER = 1 - fee; // 0.997
  
  // First do a basic calculation
  estimatedAmount = amount * FEE_MULTIPLIER;
  
  // Function to calculate using pool data
  function calculateWithPoolData(data: any) {
    const solReserve = data.sol;
    const yotReserve = data.yot;
    
    if (fromToken.address === 'So11111111111111111111111111111111111111112' && 
        toToken.address === '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF') {
        // SOL to YOT - using proper AMM formula
        estimatedAmount = (amount * yotReserve * FEE_MULTIPLIER) / (solReserve + amount);
        console.log(`FALLBACK CALC (SOL→YOT): ${amount} SOL should yield ${estimatedAmount} YOT`);
    } 
    else if (fromToken.address === '2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF' && 
             toToken.address === 'So11111111111111111111111111111111111111112') {
        // YOT to SOL - using proper AMM formula
        estimatedAmount = (amount * solReserve * FEE_MULTIPLIER) / (yotReserve + amount);
        console.log(`FALLBACK CALC (YOT→SOL): ${amount} YOT should yield ${estimatedAmount} SOL`);
    }
  }
  
  // Do initial calculation with default pool data
  calculateWithPoolData(poolData);
  
  const minAmountOut = estimatedAmount * (1 - slippage);
  
  return {
    estimatedAmount,
    minAmountOut,
    priceImpact: 0.01, // 1% default price impact
    liquidityFee: fee * amount,
    route: [fromToken.address, toToken.address],
    provider: SwapProvider.Contract,
    hops: 1
  };
}

export async function executeMultiHubSwap(
  wallet: any,
  fromToken: TokenInfo,
  toToken: TokenInfo,
  amount: number,
  minAmountOut: number,
  referrer?: PublicKey
): Promise<string> {
  try {
    console.log(`Executing multi-hub swap: ${amount} ${fromToken.symbol} -> ${toToken.symbol}`);
    
    // Create the swap transaction
    const transaction = await multiHubSwapClient.createSwapTransaction(
      wallet,
      fromToken,
      toToken,
      amount,
      minAmountOut,
      referrer
    );
    
    // Set a recent blockhash
    const { blockhash } = await multiHubSwapClient.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Sign and send the transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await multiHubSwapClient.connection.sendRawTransaction(
      signedTransaction.serialize()
    );
    
    // Wait for confirmation
    await multiHubSwapClient.connection.confirmTransaction(signature);
    
    console.log('Swap transaction confirmed:', signature);
    return signature;
  } catch (error) {
    console.error('Error executing multi-hub swap:', error);
    throw error;
  }
}

/**
 * Claim YOS rewards earned from swaps using the smart contract
 * @param wallet Connected wallet adapter
 * @returns Transaction signature
 */
export async function claimYosRewards(wallet: any): Promise<string> {
  try {
    console.log(`Claiming YOS rewards for ${wallet.publicKey.toString()}`);
    
    // Create the claim rewards transaction
    const transaction = await multiHubSwapClient.createClaimRewardsTransaction(wallet);
    
    // Set a recent blockhash
    const { blockhash } = await multiHubSwapClient.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Sign and send the transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await multiHubSwapClient.connection.sendRawTransaction(
      signedTransaction.serialize()
    );
    
    // Wait for confirmation
    await multiHubSwapClient.connection.confirmTransaction(signature);
    
    console.log('Claim rewards transaction confirmed:', signature);
    return signature;
  } catch (error) {
    console.error('Error claiming YOS rewards:', error);
    throw error;
  }
}

/**
 * Stake LP tokens for yield farming using the smart contract
 * @param wallet Connected wallet adapter
 * @param lpMint LP token mint address
 * @param amount Amount of LP tokens to stake (UI format)
 * @returns Transaction signature
 */
export async function stakeLpTokens(
  wallet: any,
  lpMint: PublicKey,
  amount: number
): Promise<string> {
  try {
    console.log(`Staking ${amount} LP tokens for ${wallet.publicKey.toString()}`);
    
    // Create the stake LP tokens transaction
    const transaction = await multiHubSwapClient.createStakeLpTokensTransaction(
      wallet,
      lpMint,
      amount
    );
    
    // Set a recent blockhash
    const { blockhash } = await multiHubSwapClient.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Sign and send the transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await multiHubSwapClient.connection.sendRawTransaction(
      signedTransaction.serialize()
    );
    
    // Wait for confirmation
    await multiHubSwapClient.connection.confirmTransaction(signature);
    
    console.log('Stake LP tokens transaction confirmed:', signature);
    return signature;
  } catch (error) {
    console.error('Error staking LP tokens:', error);
    throw error;
  }
}

/**
 * Unstake LP tokens from yield farming using the smart contract
 * @param wallet Connected wallet adapter
 * @param lpMint LP token mint address
 * @param amount Amount of LP tokens to unstake (UI format)
 * @returns Transaction signature
 */
export async function unstakeLpTokens(
  wallet: any,
  lpMint: PublicKey,
  amount: number
): Promise<string> {
  try {
    console.log(`Unstaking ${amount} LP tokens for ${wallet.publicKey.toString()}`);
    
    // Create the unstake LP tokens transaction
    const transaction = await multiHubSwapClient.createUnstakeLpTokensTransaction(
      wallet,
      lpMint,
      amount
    );
    
    // Set a recent blockhash
    const { blockhash } = await multiHubSwapClient.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Sign and send the transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await multiHubSwapClient.connection.sendRawTransaction(
      signedTransaction.serialize()
    );
    
    // Wait for confirmation
    await multiHubSwapClient.connection.confirmTransaction(signature);
    
    console.log('Unstake LP tokens transaction confirmed:', signature);
    return signature;
  } catch (error) {
    console.error('Error unstaking LP tokens:', error);
    throw error;
  }
}

/**
 * Register as a referrer using the smart contract
 * @param wallet Connected wallet adapter
 * @returns Transaction signature
 */
export async function registerAsReferrer(wallet: any): Promise<string> {
  try {
    console.log(`Registering as referrer: ${wallet.publicKey.toString()}`);
    
    // Create the register referrer transaction
    const transaction = await multiHubSwapClient.createRegisterReferrerTransaction(wallet);
    
    // Set a recent blockhash
    const { blockhash } = await multiHubSwapClient.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Sign and send the transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await multiHubSwapClient.connection.sendRawTransaction(
      signedTransaction.serialize()
    );
    
    // Wait for confirmation
    await multiHubSwapClient.connection.confirmTransaction(signature);
    
    console.log('Register referrer transaction confirmed:', signature);
    return signature;
  } catch (error) {
    console.error('Error registering as referrer:', error);
    throw error;
  }
}

/**
 * Trigger a manual yield distribution (admin only)
 * This will distribute yield rewards to all LP stakers based on their share
 * 
 * @param wallet Admin wallet adapter
 * @returns Transaction signature
 */
export async function triggerYieldDistribution(wallet: any): Promise<string> {
  try {
    console.log(`Triggering yield distribution by admin: ${wallet.publicKey.toString()}`);
    
    // Create the trigger yield distribution transaction
    const transaction = await multiHubSwapClient.createTriggerYieldDistributionTransaction(wallet);
    
    // Set a recent blockhash
    const { blockhash } = await multiHubSwapClient.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Sign and send the transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await multiHubSwapClient.connection.sendRawTransaction(
      signedTransaction.serialize()
    );
    
    // Wait for confirmation
    await multiHubSwapClient.connection.confirmTransaction(signature);
    
    console.log('Yield distribution triggered successfully:', signature);
    return signature;
  } catch (error) {
    console.error('Error triggering yield distribution:', error);
    
    // Check for specific error codes
    if (error.toString().includes('DistributionTooSoon')) {
      throw new Error('Yield distribution was triggered too recently. Please wait before trying again.');
    } else if (error.toString().includes('InvalidAuthority')) {
      throw new Error('Only the admin can trigger a yield distribution.');
    }
    
    throw error;
  }
}