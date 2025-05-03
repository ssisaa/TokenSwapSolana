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
const initializeSchema = new Map([
  [
    Initialize,
    {
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
    },
  ],
]);

const swapSchema = new Map([
  [
    Swap,
    {
      kind: 'struct',
      fields: [
        ['tag', 'u8'],
        ['amountIn', 'u64'],
        ['minAmountOut', 'u64'],
      ],
    },
  ],
]);

const updateParametersSchema = new Map([
  [
    UpdateParameters,
    {
      kind: 'struct',
      fields: [
        ['tag', 'u8'],
        ['lpContributionRate', { kind: 'option', type: 'u64' }],
        ['adminFeeRate', { kind: 'option', type: 'u64' }],
        ['yosCashbackRate', { kind: 'option', type: 'u64' }],
        ['swapFeeRate', { kind: 'option', type: 'u64' }],
        ['referralRate', { kind: 'option', type: 'u64' }],
      ],
    },
  ],
]);

const setAdminSchema = new Map([
  [
    SetAdmin,
    {
      kind: 'struct',
      fields: [
        ['tag', 'u8'],
        ['newAdmin', [32]],
      ],
    },
  ],
]);

const closeProgramSchema = new Map([
  [
    CloseProgram,
    {
      kind: 'struct',
      fields: [['tag', 'u8']],
    },
  ],
]);

// Serialize instruction using Borsh
export function serializeInitializeInstruction(instruction: Initialize): Buffer {
  return Buffer.from(borsh.serialize(initializeSchema, instruction));
}

export function serializeSwapInstruction(instruction: Swap): Buffer {
  return Buffer.from(borsh.serialize(swapSchema, instruction));
}

export function serializeUpdateParametersInstruction(instruction: UpdateParameters): Buffer {
  return Buffer.from(borsh.serialize(updateParametersSchema, instruction));
}

export function serializeSetAdminInstruction(instruction: SetAdmin): Buffer {
  return Buffer.from(borsh.serialize(setAdminSchema, instruction));
}

export function serializeCloseProgramInstruction(instruction: CloseProgram): Buffer {
  return Buffer.from(borsh.serialize(closeProgramSchema, instruction));
}