/**
 * This script verifies that the PDA addresses we derive match what the program expects
 * 
 * To run:
 * node test-verify-pdas.cjs
 */

const { PublicKey } = require('@solana/web3.js');

// Program ID of the Multi-Hub Swap program
const MULTI_HUB_SWAP_PROGRAM_ID = new PublicKey('Js9TqdpLBsF7M64ra2mYNyfbPTWwTvBUNR85wsEoSKP');

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

// Main function to verify PDAs
async function main() {
  // Get PDAs
  const programState = getProgramStatePda();
  const programAuthority = getProgramAuthorityPda();
  
  // Log PDAs
  console.log(`Program ID: ${MULTI_HUB_SWAP_PROGRAM_ID.toString()}`);
  console.log(`Program State PDA: ${programState.toString()}`);
  console.log(`Program Authority PDA (Central Liquidity): ${programAuthority.toString()}`);
  
  // Test with sample user public key
  const sampleUserPublicKey = new PublicKey('AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ'); // Admin wallet for testing
  const liquidityContribution = getLiquidityContributionPda(sampleUserPublicKey);
  console.log(`Liquidity Contribution PDA for user ${sampleUserPublicKey.toString()}: ${liquidityContribution.toString()}`);
  
  console.log('\nIMPORTANT: The Program Authority PDA should be used as the Central Liquidity Wallet!');
}

main().catch(console.error);