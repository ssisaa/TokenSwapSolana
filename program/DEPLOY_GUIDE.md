# Solana Program Deployment Guide

## Changes Made
We've updated the reward calculation in the staking program to use APY (compound interest) instead of APR (simple interest):

```rust
// Original APR calculation (simple interest):
(staked_amount as f64 * time_staked_seconds as f64 * rate_decimal) as u64

// New APY calculation (compound interest):
(staked_amount as f64 * ((1.0 + rate_decimal).powf(time_staked_seconds as f64) - 1.0)) as u64
```

## Build and Deployment Steps

### 1. Build the Updated Program

From the project root, run:

```bash
cd program
cargo build-bpf
```

This will compile your program into a BPF (Berkeley Packet Filter) file that can be deployed to the Solana blockchain.

### 2. Deploy to Solana Devnet

Once the build is complete, you'll deploy to Solana's devnet:

```bash
solana program deploy --program-id 6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6 --keypair <PATH_TO_DEPLOYER_KEYPAIR> target/deploy/staking_program.so
```

Replace `<PATH_TO_DEPLOYER_KEYPAIR>` with the path to the keypair that has authority to update the program.

### 3. Verification

After deployment, verify the program is working correctly:

```bash
solana program show --programs
```

Look for your program ID (`6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6`) in the list and check that it has been updated.

### 4. Testing

Test a small stake and harvest operation to verify that:

1. The rewards are calculated using compound interest (APY)
2. The rewards match what would be expected with the formula: `principal * ((1 + rate)^time - 1)`

## Important Notes

- The changes affect the reward calculation only - no other functionality is altered
- Users will now earn rewards based on compound interest, which will result in higher returns over time
- The UI already displays both APR and APY values, but the actual rewards now use the APY calculation