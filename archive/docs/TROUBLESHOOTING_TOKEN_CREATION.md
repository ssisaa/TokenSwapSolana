# Troubleshooting Token Creation in YOT Swap

This guide addresses common issues with token creation in the YOT Swap platform, particularly the "Please connect your wallet to create test tokens" error.

## Error: "Please connect your wallet to create test tokens"

If you're seeing this error message when trying to create tokens, follow these steps to resolve it:

### 1. Check Wallet Connection

First, ensure your wallet is properly connected:

1. Look at the top-right corner of the application
2. If you see "Connect Wallet" button, click it and select your wallet
3. Approve the connection request in your wallet extension
4. Wait for the connection to complete (button should change to your wallet address)

### 2. Verify Wallet Compatibility

YOT Swap supports the following wallets:
- Phantom
- Solflare

Make sure you're using one of these wallets and that it's configured for the Solana devnet network.

To switch to devnet in Phantom:
1. Open Phantom extension
2. Click the gear icon (settings)
3. Go to "Developer Settings"
4. Select "Devnet" as the network

To switch to devnet in Solflare:
1. Open Solflare extension
2. Click the network dropdown (top-right)
3. Select "Devnet"

### 3. Check Browser Console for Errors

If you're still experiencing issues, check for errors in the browser console:

1. Right-click anywhere on the page
2. Select "Inspect" or "Inspect Element"
3. Go to the "Console" tab
4. Look for any red error messages

Common errors and solutions:

| Error | Solution |
|-------|----------|
| "Wallet not found" | Install a supported wallet (Phantom or Solflare) |
| "Connection refused" | Check your internet connection and try again |
| "Not authorized" | Approve the connection request in your wallet |
| "Transaction failed" | Your wallet may not have enough SOL to pay fees |

### 4. Refresh the Application

Sometimes a simple refresh can resolve connection issues:

1. Disconnect your wallet first (if connected)
2. Refresh the browser page (F5 or Ctrl+R)
3. Reconnect your wallet
4. Try creating tokens again

### 5. Check SOL Balance

Token creation requires SOL to pay for transaction fees:

1. Make sure your wallet has at least 0.1 SOL on devnet
2. If needed, request SOL from the devnet faucet:
   - Visit https://solfaucet.com/
   - Enter your wallet address
   - Select "Devnet"
   - Click "Request 1 SOL"

### 6. Use the Admin Wallet

The token creation feature requires specific permissions:

1. Make sure you're using the admin wallet: `AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ`
2. If you don't have access to this wallet, contact the application administrator

### 7. Check Network Status

Sometimes the Solana devnet may experience issues:

1. Check the Solana devnet status at https://status.solana.com/
2. If the devnet is experiencing problems, try again later

### 8. Manual Token Creation (Developer Option)

If all else fails, you can manually create tokens using the Solana CLI:

```bash
# Install Solana CLI tools if you haven't already
sh -c "$(curl -sSfL https://release.solana.com/v1.16.19/install)"

# Configure for devnet
solana config set --url https://api.devnet.solana.com

# Create a token (replace MY_TOKEN_NAME and MY_TOKEN_SYMBOL)
spl-token create-token --decimals 9

# Create a token account
spl-token create-account TOKEN_ADDRESS

# Mint some tokens
spl-token mint TOKEN_ADDRESS AMOUNT
```

## Technical Details for Developers

The token creation issue can occur due to several code-related issues:

### Wallet Connection Flow

The `TestTokenTransfer.tsx` component checks for wallet connection using:

```typescript
if (!publicKey) {
  setResult({
    success: false,
    message: 'Please connect your wallet to create test tokens.'
  });
  return;
}
```

For wallet connection to work:

1. The wallet adapter must be correctly initialized
2. The wallet must be properly connected through `useWallet()` from Solana wallet adapter
3. The `publicKey` must be available when the function is called

### Wallet Permissions

Token creation requires specific permissions:

```typescript
const signedTransaction = await wallet.signTransaction(transaction);
const signature = await connection.sendRawTransaction(signedTransaction.serialize());
await connection.confirmTransaction(signature);
```

Make sure:
1. The wallet's `signTransaction` method is accessible
2. The transaction is properly formed with the correct instructions
3. The wallet has enough SOL to pay transaction fees

### Code Fixes

If needed, you can directly modify the code for troubleshooting:

1. Add more detailed logging in `TestTokenTransfer.tsx`:

```typescript
console.log('Wallet connection state:', {
  publicKey: publicKey?.toString(),
  connected: connected,
  connecting: connecting
});
```

2. Verify TEST_TOKENS are properly defined in `client/src/lib/test-token-transfer.ts`

3. Check that token creation parameters are correct:

```typescript
const TOKEN_DECIMALS = 9;
const INITIAL_SUPPLY = 1_000_000_000; // 1 billion tokens
```

## Contact Support

If you've tried all the steps above and are still experiencing issues, please contact the YOT Swap support team at support@example.com with the following information:

1. Which wallet you're using
2. The exact error message you're seeing
3. Any relevant console logs
4. The steps you've already taken to troubleshoot

Our team will help you resolve the issue.