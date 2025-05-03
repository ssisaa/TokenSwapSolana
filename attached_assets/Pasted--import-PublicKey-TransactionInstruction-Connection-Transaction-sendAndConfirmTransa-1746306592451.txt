
import {
  PublicKey,
  TransactionInstruction,
  Connection,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
} from "@solana/web3.js";
import { serialize } from "borsh";

class InitializeInstruction {
  admin: Uint8Array;
  yot_mint: Uint8Array;
  yos_mint: Uint8Array;
  lp_contribution_rate: bigint;
  admin_fee_rate: bigint;
  yos_cashback_rate: bigint;
  swap_fee_rate: bigint;
  referral_rate: bigint;

  constructor(fields: {
    admin: Uint8Array;
    yot_mint: Uint8Array;
    yos_mint: Uint8Array;
    lp_contribution_rate: bigint;
    admin_fee_rate: bigint;
    yos_cashback_rate: bigint;
    swap_fee_rate: bigint;
    referral_rate: bigint;
  }) {
    this.admin = fields.admin;
    this.yot_mint = fields.yot_mint;
    this.yos_mint = fields.yos_mint;
    this.lp_contribution_rate = fields.lp_contribution_rate;
    this.admin_fee_rate = fields.admin_fee_rate;
    this.yos_cashback_rate = fields.yos_cashback_rate;
    this.swap_fee_rate = fields.swap_fee_rate;
    this.referral_rate = fields.referral_rate;
  }
}

const InitializeInstructionSchema = new Map([
  [
    InitializeInstruction,
    {
      kind: "struct",
      fields: [
        ["admin", [32]],
        ["yot_mint", [32]],
        ["yos_mint", [32]],
        ["lp_contribution_rate", "u64"],
        ["admin_fee_rate", "u64"],
        ["yos_cashback_rate", "u64"],
        ["swap_fee_rate", "u64"],
        ["referral_rate", "u64"],
      ],
    },
  ],
]);

export async function initializeProgram({
  connection,
  programId,
  payer,
  programState,
  programAuthority,
  admin,
  yotMint,
  yosMint,
}: {
  connection: Connection;
  programId: PublicKey;
  payer: PublicKey;
  programState: PublicKey;
  programAuthority: PublicKey;
  admin: PublicKey;
  yotMint: PublicKey;
  yosMint: PublicKey;
}) {
  const instructionData = Buffer.concat([
    Buffer.from([0]), // discriminator for Initialize variant
    serialize(
      InitializeInstructionSchema,
      new InitializeInstruction({
        admin: admin.toBytes(),
        yot_mint: yotMint.toBytes(),
        yos_mint: yosMint.toBytes(),
        lp_contribution_rate: BigInt(5000),
        admin_fee_rate: BigInt(1000),
        yos_cashback_rate: BigInt(500),
        swap_fee_rate: BigInt(300),
        referral_rate: BigInt(200),
      })
    ),
  ]);

  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: programState, isSigner: false, isWritable: true },
    { pubkey: programAuthority, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: Rent.sysvarId, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({
    programId,
    keys,
    data: instructionData,
  });

  const tx = new Transaction().add(ix);

  return await sendAndConfirmTransaction(connection, tx, [payer]);
}
