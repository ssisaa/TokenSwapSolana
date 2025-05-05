# MultihubSwap V4 - Manual Instruction Parsing

This README explains the improvements made to the MultihubSwap contract to solve persistent BorshIoError issues by switching from Borsh deserialization to direct byte buffer parsing.

## The Problem

The previous implementation (V3) was experiencing persistent serialization errors when communicating between JavaScript and Rust:

- JavaScript client uses manually constructed byte buffers 
- But Rust program still expected Borsh deserialization
- This mismatch led to `BorshIoError: Unknown` errors that were hard to debug

## The Solution: V4 Implementation

We've created a new version of the contract (V4) that replaces Borsh deserialization in Rust with direct byte buffer parsing:

1. JavaScript client continues to use the more reliable manual buffer serialization
2. Rust contract now manually parses incoming instructions instead of using Borsh's `try_from_slice`
3. This eliminates the schema mismatch entirely by having both sides use the same exact byte layout

## Key Changes in V4

1. **Manual Instruction Parsing**: Instead of `SwapInstruction::try_from_slice(instruction_data)?` we now use a custom `parse_instruction_data` function that:
   - Reads the first byte as a discriminator (0, 1, or 2)
   - Parses the remaining bytes based on the expected layout for each instruction type
   - Validates expected buffer lengths for each instruction variant
   - Reconstructs the instruction enum manually

2. **Buffer Layout Matching**: The parsing functions in Rust now exactly mirror how the JavaScript side constructs buffers:
   - Same field order
   - Same byte offsets
   - Same byte lengths and endianness

3. **Enhanced Error Handling**: More informative error messages when parsing fails, including:
   - Invalid discriminator values
   - Incorrect data length for instruction type
   - Detailed logging of extracted values

## Deployment Instructions

1. Deploy the updated Rust program to Solana DevNet:
   ```
   solana program deploy ./program/target/deploy/multihub_swap.so
   ```

2. JavaScript client code does not need changes as it already uses the correct buffer serialization approach

## Benefits

1. **Reliability**: Eliminates mysterious BorshIoError: Unknown errors
2. **Control**: Full control over byte layout and parsing
3. **Debugging**: Better error information when parsing fails
4. **Future-proof**: No dependency on Borsh for instruction deserialization

## Comparison with Other Approaches

| Approach | Pros | Cons |
|----------|------|------|
| **V3 (Borsh on both sides)** | Clean Rust code | Schema mismatches, JS Borsh quirks |
| **V3.5 (Manual on JS, Borsh on Rust)** | Simple Rust code | Prone to BorshIoError on minor mismatches |
| **V4 (Manual on both sides)** | 100% control, no Borsh errors | More verbose Rust parsing code |