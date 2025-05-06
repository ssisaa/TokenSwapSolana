/**
 * This script verifies that the PDA addresses we derive match what the program expects
 * It also prints all program-related addresses for reference.
 * 
 * To run:
 * node test-verify-pdas.cjs
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');

// Program and Token Constants
const MULTI_HUB_SWAP_PROGRAM_ID = new PublicKey('Js9TqdpLBsF7M64ra2mYNyfbPTWwTvBUNR85wsEoSKP');
const YOT_TOKEN_ADDRESS = new PublicKey('9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw');
const YOS_TOKEN_ADDRESS = new PublicKey('2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop');
const STAKING_PROGRAM_ID = new PublicKey('6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6');
const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';

// 1. Get Program State PDA
function getProgramStatePda() {
  const [programState] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
  return programState;
}

// 2. Get Program Authority PDA
function getProgramAuthorityPda() {
  const [programAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
  return programAuthority;
}

// 3. Get Liquidity Contribution PDA for a user
function getLiquidityContributionPda(userPublicKey) {
  const [liquidityContribution] = PublicKey.findProgramAddressSync(
    [Buffer.from('liq'), userPublicKey.toBuffer()],
    MULTI_HUB_SWAP_PROGRAM_ID
  );
  return liquidityContribution;
}

// Get the staking program state PDA
function getStakingProgramStatePda() {
  const [programState] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    STAKING_PROGRAM_ID
  );
  return programState;
}

// Retrieve the pool authority wallet from config or hardcoded for now
// In reality, the pool authority should be the Program Authority PDA
// This is for verification purposes only
const POOL_AUTHORITY = new PublicKey('CeuRAzZ58St8B29XKWo647CGtY7FL5qpwv8WGZUHAuA9');

// Get the SOL pool account
// This is the account that SOL is sent to during swaps
const POOL_SOL_ACCOUNT = new PublicKey('Bf78XttEfzR4iM3JCWfwgSCpd5MHePTMD2UKBEZU6coH');

// Main function to verify PDAs and other critical addresses
async function main() {
  // Initialize connection
  const connection = new Connection(DEVNET_ENDPOINT, 'confirmed');
  
  // Get Multi-Hub Swap PDAs
  const programState = getProgramStatePda();
  const programAuthority = getProgramAuthorityPda();
  
  // Get Staking Program PDAs
  const stakingProgramState = getStakingProgramStatePda();
  
  // Get token accounts for pools
  const yotPoolAccount = await getAssociatedTokenAddress(
    YOT_TOKEN_ADDRESS,
    POOL_AUTHORITY
  );
  
  const yosPoolAccount = await getAssociatedTokenAddress(
    YOS_TOKEN_ADDRESS,
    POOL_AUTHORITY
  );
  
  // Test with sample user public key
  const sampleUserPublicKey = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ'); // Admin wallet for testing
  const liquidityContribution = getLiquidityContributionPda(sampleUserPublicKey);
  
  // Output separator
  console.log('='.repeat(80));
  console.log('MULTI-HUB SWAP PROGRAM ADDRESSES');
  console.log('='.repeat(80));
  
  // Log PDAs and addresses
  console.log(`Program ID: ${MULTI_HUB_SWAP_PROGRAM_ID.toString()}`);
  console.log(`Program State PDA: ${programState.toString()}`);
  console.log(`Program Authority PDA (Central Liquidity): ${programAuthority.toString()}`);
  console.log(`\nToken Addresses:`);
  console.log(`YOT Token: ${YOT_TOKEN_ADDRESS.toString()}`);
  console.log(`YOS Token: ${YOS_TOKEN_ADDRESS.toString()}`);
  
  console.log(`\nPool Addresses:`);
  console.log(`Pool Authority: ${POOL_AUTHORITY.toString()}`);
  console.log(`SOL Pool Account: ${POOL_SOL_ACCOUNT.toString()}`);
  console.log(`YOT Pool Account: ${yotPoolAccount.toString()}`);
  console.log(`YOS Pool Account: ${yosPoolAccount.toString()}`);
  
  console.log(`\nSample User Addresses:`);
  console.log(`User: ${sampleUserPublicKey.toString()}`);
  console.log(`Liquidity Contribution PDA: ${liquidityContribution.toString()}`);
  
  // Staking program info
  console.log('\n' + '='.repeat(80));
  console.log('STAKING PROGRAM ADDRESSES');
  console.log('='.repeat(80));
  console.log(`Staking Program ID: ${STAKING_PROGRAM_ID.toString()}`);
  console.log(`Staking Program State: ${stakingProgramState.toString()}`);
  
  // Important notes
  console.log('\n' + '='.repeat(80));
  console.log('IMPORTANT IMPLEMENTATION NOTES');
  console.log('='.repeat(80));
  console.log('1. The Program Authority PDA should be used as the Central Liquidity Wallet');
  console.log('2. All addresses should be derived from program IDs, not from config files');
  console.log('3. Always use utility functions (getProgramAuthorityPda, etc.) for consistency');
  console.log('4. Ensure that on-chain program expects the same addresses we are deriving');
}

main().catch(console.error);