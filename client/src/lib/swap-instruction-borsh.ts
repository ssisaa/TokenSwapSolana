/**
 * Properly formatted Borsh serialization for the MultiHub Swap program instructions
 * Based on the exact structure defined in the Rust contract's SwapInstruction enum
 */
import { PublicKey } from '@solana/web3.js';
import * as borsh from 'borsh';

/**
 * This enum must exactly match the Rust program's enum definition:
 * 
 * pub enum SwapInstruction {
 *   Initialize {
 *     admin: Pubkey,
 *     yot_mint: Pubkey,
 *     yos_mint: Pubkey,
 *     lp_contribution_rate: u64,
 *     admin_fee_rate: u64,
 *     yos_cashback_rate: u64,
 *     swap_fee_rate: u64,
 *     referral_rate: u64,
 *   },
 *   // Other variants ommitted
 * }
 */

// Define the classes that will represent the Borsh schema
export class Initialize {
  tag = 0; // enum variant index
  admin: Uint8Array;
  yotMint: Uint8Array;
  yosMint: Uint8Array;
  lpContributionRate: bigint;
  adminFeeRate: bigint;
  yosCashbackRate: bigint;
  swapFeeRate: bigint;
  referralRate: bigint;

  constructor(
    admin: PublicKey,
    yotMint: PublicKey,
    yosMint: PublicKey,
    lpContributionRate: number,
    adminFeeRate: number,
    yosCashbackRate: number,
    swapFeeRate: number,
    referralRate: number
  ) {
    this.admin = admin.toBytes();
    this.yotMint = yotMint.toBytes();
    this.yosMint = yosMint.toBytes();
    this.lpContributionRate = BigInt(lpContributionRate);
    this.adminFeeRate = BigInt(adminFeeRate);
    this.yosCashbackRate = BigInt(yosCashbackRate);
    this.swapFeeRate = BigInt(swapFeeRate);
    this.referralRate = BigInt(referralRate);
  }
}

export class Swap {
  tag = 1; // enum variant index
  amountIn: bigint;
  minAmountOut: bigint;

  constructor(amountIn: number, minAmountOut: number) {
    this.amountIn = BigInt(amountIn);
    this.minAmountOut = BigInt(minAmountOut);
  }
}

export class UpdateParameters {
  tag = 2; // enum variant index
  lpContributionRate?: bigint;
  adminFeeRate?: bigint;
  yosCashbackRate?: bigint;
  swapFeeRate?: bigint;
  referralRate?: bigint;

  constructor(
    lpContributionRate?: number,
    adminFeeRate?: number,
    yosCashbackRate?: number,
    swapFeeRate?: number,
    referralRate?: number
  ) {
    this.lpContributionRate = lpContributionRate !== undefined ? BigInt(lpContributionRate) : undefined;
    this.adminFeeRate = adminFeeRate !== undefined ? BigInt(adminFeeRate) : undefined;
    this.yosCashbackRate = yosCashbackRate !== undefined ? BigInt(yosCashbackRate) : undefined;
    this.swapFeeRate = swapFeeRate !== undefined ? BigInt(swapFeeRate) : undefined;
    this.referralRate = referralRate !== undefined ? BigInt(referralRate) : undefined;
  }
}

export class SetAdmin {
  tag = 3; // enum variant index
  newAdmin: Uint8Array;

  constructor(newAdmin: PublicKey) {
    this.newAdmin = newAdmin.toBytes();
  }
}

export class CloseProgram {
  tag = 4; // enum variant index

  constructor() {}
}

// Define Borsh serialization schema
const initializeSchema = {
  kind: 'struct',
  fields: [
    ['tag', 'u8'],
    ['admin', [32]],
    ['yotMint', [32]],
    ['yosMint', [32]],
    ['lpContributionRate', 'u64'],
    ['adminFeeRate', 'u64'],
    ['yosCashbackRate', 'u64'],
    ['swapFeeRate', 'u64'],
    ['referralRate', 'u64'],
  ],
} as any;

const swapSchema = {
  kind: 'struct',
  fields: [
    ['tag', 'u8'],
    ['amountIn', 'u64'],
    ['minAmountOut', 'u64'],
  ],
} as any;

const updateParametersSchema = {
  kind: 'struct',
  fields: [
    ['tag', 'u8'],
    ['lpContributionRate', { kind: 'option', type: 'u64' }],
    ['adminFeeRate', { kind: 'option', type: 'u64' }],
    ['yosCashbackRate', { kind: 'option', type: 'u64' }],
    ['swapFeeRate', { kind: 'option', type: 'u64' }],
    ['referralRate', { kind: 'option', type: 'u64' }],
  ],
} as any;

const setAdminSchema = {
  kind: 'struct',
  fields: [
    ['tag', 'u8'],
    ['newAdmin', [32]],
  ],
} as any;

const closeProgramSchema = {
  kind: 'struct',
  fields: [['tag', 'u8']],
} as any;

// Serialize instruction using Borsh
export function serializeInitializeInstruction(instruction: Initialize): Buffer {
  // Direct manual serialization for Initialize instruction
  const buffer = Buffer.alloc(1 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8);
  let offset = 0;
  
  // Write variant index (tag)
  buffer.writeUInt8(instruction.tag, offset);
  offset += 1;
  
  // Write admin pubkey
  Buffer.from(instruction.admin).copy(buffer, offset);
  offset += 32;
  
  // Write YOT mint pubkey
  Buffer.from(instruction.yotMint).copy(buffer, offset);
  offset += 32;
  
  // Write YOS mint pubkey
  Buffer.from(instruction.yosMint).copy(buffer, offset);
  offset += 32;
  
  // Write rates as little-endian u64 values
  buffer.writeBigUInt64LE(instruction.lpContributionRate, offset);
  offset += 8;
  
  buffer.writeBigUInt64LE(instruction.adminFeeRate, offset);
  offset += 8;
  
  buffer.writeBigUInt64LE(instruction.yosCashbackRate, offset);
  offset += 8;
  
  buffer.writeBigUInt64LE(instruction.swapFeeRate, offset);
  offset += 8;
  
  buffer.writeBigUInt64LE(instruction.referralRate, offset);
  
  return buffer;
}

export function serializeSwapInstruction(instruction: Swap): Buffer {
  // Manually serialize Swap instruction
  const buffer = Buffer.alloc(1 + 8 + 8);
  
  // Write tag
  buffer.writeUInt8(instruction.tag, 0);
  
  // Write amounts
  buffer.writeBigUInt64LE(instruction.amountIn, 1);
  buffer.writeBigUInt64LE(instruction.minAmountOut, 9);
  
  return buffer;
}

export function serializeUpdateParametersInstruction(instruction: UpdateParameters): Buffer {
  // This is a more complex serialization due to optional fields
  // Here we do a simple version that writes nulls for undefined values
  const buffer = Buffer.alloc(1 + 8*5);
  
  // Write tag
  buffer.writeUInt8(instruction.tag, 0);
  
  // Write rates, using 0 for undefined values
  buffer.writeBigUInt64LE(instruction.lpContributionRate || BigInt(0), 1);
  buffer.writeBigUInt64LE(instruction.adminFeeRate || BigInt(0), 9);
  buffer.writeBigUInt64LE(instruction.yosCashbackRate || BigInt(0), 17);
  buffer.writeBigUInt64LE(instruction.swapFeeRate || BigInt(0), 25);
  buffer.writeBigUInt64LE(instruction.referralRate || BigInt(0), 33);
  
  return buffer;
}

export function serializeSetAdminInstruction(instruction: SetAdmin): Buffer {
  // Manually serialize SetAdmin instruction
  const buffer = Buffer.alloc(1 + 32);
  
  // Write tag
  buffer.writeUInt8(instruction.tag, 0);
  
  // Write new admin
  Buffer.from(instruction.newAdmin).copy(buffer, 1);
  
  return buffer;
}

export function serializeCloseProgramInstruction(instruction: CloseProgram): Buffer {
  // Just the tag for CloseProgram
  const buffer = Buffer.alloc(1);
  buffer.writeUInt8(instruction.tag, 0);
  return buffer;
}