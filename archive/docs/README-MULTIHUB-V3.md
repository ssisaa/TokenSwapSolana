# MultihubSwap V3 - Direct Buffer Serialization

This README documents the improvements made to the MultihubSwap contract implementation, focusing on the new direct buffer serialization approach that replaced Borsh in the JavaScript client.

## The Problem

The previous implementation encountered persistent serialization errors when communicating with the Solana program:

- Vague `BorshIoError: Unknown` errors that were difficult to debug
- Schema misalignment between JavaScript and Rust
- Inconsistent behavior between Borsh-JS and Borsh-Rust
- Silent failures when handling `enum` variants

## The Solution

We've completely replaced Borsh serialization with direct byte-buffer manipulation, which gives us:

1. Complete control over the exact byte layout
2. Perfect alignment with the Rust-side struct and enum definitions
3. More predictable behavior
4. Better error handling and debugging

## Key Improvements

- Created three reusable buffer encoding functions for each instruction type:
  - `buildInitializeInstruction`
  - `buildSwapInstruction`
  - `buildCloseProgramInstruction`
- Precise memory management with explicit buffer allocation of exact size
- Careful offset tracking for writing fields in the correct positions
- Proper handling of enum discriminants that match Rust-side definitions

## Usage Example

```typescript
// Initialize instruction
const instructionData = buildInitializeInstruction({
  admin: wallet.publicKey,
  yotMint: new PublicKey(YOT_TOKEN_MINT),
  yosMint: new PublicKey(YOS_TOKEN_MINT),
  rates: {
    lp: BigInt(2000),      // 20% LP contribution 
    fee: BigInt(10),       // 0.1% admin fee
    cashback: BigInt(300), // 3% YOS cashback
    swap: BigInt(30),      // 0.3% swap fee
    referral: BigInt(50)   // 0.5% referral fee
  }
});

// Swap instruction
const swapData = buildSwapInstruction({
  amountIn: BigInt(100000000),     // 0.1 tokens (9 decimals)
  minAmountOut: BigInt(90000000)   // 0.09 min output tokens
});

// Close program instruction
const closeData = buildCloseProgramInstruction();
```

## Buffer Serialization Details

Each buffer serialization function creates a buffer with an exact byte layout matching the Rust-side structs:

### Initialize Instruction

```
[discriminator(1)][admin(32)][yot_mint(32)][yos_mint(32)][lp(8)][fee(8)][cashback(8)][swap(8)][referral(8)]
```

Total size: 1 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 = 137 bytes

### Swap Instruction

```
[discriminator(1)][amount_in(8)][min_amount_out(8)]
```

Total size: 1 + 8 + 8 = 17 bytes

### Close Program Instruction

```
[discriminator(1)]
```

Total size: 1 byte

## Testing Scripts

We've provided three testing scripts in the `scripts/` directory:

1. `initialize-program-test.ts` - Tests program initialization
2. `swap-tokens-test.ts` - Tests token swapping
3. `close-program-test.ts` - Tests program closure

These scripts demonstrate how to use the new buffer serialization approach in a programmatic context.

## Implementation Highlights

- **Explicit discriminators**: The first byte of each instruction buffer is the enum variant discriminator (0, 1, or 2)
- **Fixed-size buffers**: We allocate exactly the right amount of memory for each instruction type
- **Sequential writing**: Fields are written sequentially with careful offset tracking
- **No dependencies**: The implementation has no external serialization dependencies

## Benefits

1. More robust client-program communication
2. Easier debugging with explicit buffer layout
3. Better maintainability without complex serialization schemas
4. Future-proof against Borsh changes or deprecation