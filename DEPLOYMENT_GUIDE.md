# 🚀 YOT/YOS Platform Deployment Guide

This guide provides step-by-step instructions for deploying the YOT/YOS Platform to a production environment. It's designed to be easy to follow even for those with minimal technical experience.

## 📋 Table of Contents

1. [System Requirements](#system-requirements)
2. [Quick Start Deployment](#quick-start-deployment)
3. [Configuration](#configuration)
4. [Security Considerations](#security-considerations)
5. [Admin Guide](#admin-guide)
6. [Web Portal Guide](#web-portal-guide)
7. [Troubleshooting](#troubleshooting)

## 💻 System Requirements

- Node.js 18 or higher
- PostgreSQL database
- At least 2GB RAM
- 10GB disk space
- Solana wallet with SOL for transaction fees
- YOT and YOS tokens (for initial funding)

## 🚀 Quick Start Deployment

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-organization/yot-platform.git
cd yot-platform
```

### Step 2: Configure the Application

Edit the `app.config.json` file at the root of the project:

```json
{
  "environment": "production",
  "solana": {
    "network": "mainnet",  // Change to "mainnet" for production
    "rpcUrl": "https://api.mainnet-beta.solana.com",  // Use your preferred RPC URL
    "programId": "YOUR_DEPLOYED_PROGRAM_ID"
    // other settings...
  },
  "security": {
    "sessionSecret": "YOUR_SECRET_KEY",  // Replace with a secure random string
    // other settings...
  }
}
```

### Step 3: Set Up the Database

```bash
# Create a PostgreSQL database (if not already available)
createdb yot_platform

# Update the DATABASE_URL in your environment
export DATABASE_URL="postgresql://username:password@localhost:5432/yot_platform"
```

### Step 4: Install Dependencies and Build

```bash
npm install
npm run build
```

### Step 5: Deploy Solana Program (if needed)

```bash
npm run program:build
npm run program:deploy
```

### Step 6: Start the Application

```bash
npm run start
```

That's it! Your application should now be running on http://localhost:3000 (or your configured port).

## ⚙️ Configuration

The `app.config.json` file is your central location for all configuration needs:

### Solana Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `network` | Solana network to use (devnet, testnet, mainnet) | devnet |
| `rpcUrl` | RPC endpoint for the Solana network | https://api.devnet.solana.com |
| `programId` | Your deployed Solana program ID | (empty) |
| `tokens.yot.address` | YOT token mint address | (empty) |
| `tokens.yos.address` | YOS token mint address | (empty) |

### Admin Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `defaultUsername` | Default admin username | admin |
| `stakingRatePerSecond` | Staking rate in basis points (1/100 of a percent) | 3 |
| `harvestThreshold` | Minimum amount for harvesting rewards (in raw units) | 1000000000 |

### Security Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `sessionSecret` | Secret key for session encryption | (must be set) |
| `sessionTTL` | Session timeout in milliseconds | 86400000 (24 hours) |
| `rateLimit.max` | Maximum requests per window | 100 |
| `cors.origin` | CORS allowed origin | * (all) |

### API Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `port` | Port to run the server on | 3000 |
| `basePath` | Base path for API endpoints | /api |

### Features

| Setting | Description | Default |
|---------|-------------|---------|
| `enableSwap` | Enable token swap functionality | true |
| `enableStaking` | Enable staking functionality | true |
| `enableLiquidity` | Enable liquidity management | true |
| `enableAdminPanel` | Enable admin panel | true |

## 🔐 Security Considerations

### Critical Security Measures

1. **Update Session Secret**: Replace the default `sessionSecret` in `app.config.json` with a secure random string.

2. **Use HTTPS**: Always deploy with HTTPS in production:
   ```bash
   # Install certbot for Let's Encrypt certificates
   apt-get install certbot
   certbot certonly --standalone -d yourdomain.com
   ```

3. **Restrict CORS**: Update the CORS settings to allow only your domain:
   ```json
   "cors": {
     "origin": "https://yourdomain.com",
     "methods": ["GET", "POST"]
   }
   ```

4. **Update Rate Limiting**: Adjust rate limiting based on your expected traffic:
   ```json
   "rateLimit": {
     "windowMs": 900000,  // 15 minutes
     "max": 50  // 50 requests per 15 minutes
   }
   ```

5. **Regular Audits**: Schedule regular security audits of:
   - Smart contract code
   - Server-side API endpoints
   - Frontend user input validation
   - Database access controls

### Recommended Security Audit Checklist

- [ ] Smart contract has been audited by a professional firm
- [ ] All API endpoints require proper authentication
- [ ] Input validation is performed on all user inputs
- [ ] No sensitive data is logged or exposed
- [ ] Database credentials are properly secured
- [ ] All third-party dependencies are up-to-date
- [ ] Web application firewall (WAF) is in place

## 👨‍💼 Admin Guide

After deployment, follow these steps to initialize and manage the platform:

### Initial Setup

1. **Create Admin Account**: If not automatically created, register the admin account with your chosen password.

2. **Initialize Program**: 
   - Go to Admin Panel → Fund Program Accounts
   - Click "Initialize Program" to set up token accounts

3. **Fund Program**:
   - Click "Fund Program YOT Account" to add YOT tokens
   - Click "Fund Program YOS Account" to add YOS tokens for rewards

### Managing Staking Parameters

1. Go to Admin Panel → Staking Settings
2. Adjust the staking rate (higher = more rewards)
3. Set the harvest threshold (minimum reward amount)
4. Click "Update Parameters" to save

### Monitoring

1. View real-time statistics on the Admin Dashboard
2. Check total tokens staked, active users, and reward distribution
3. Monitor total liquidity and protocol fees

## 💻 Web Portal Guide

### User Journey

1. **Connect Wallet**: 
   - Users connect their Solana wallet to access the platform
   - Supported wallets: Phantom, Solflare, and others

2. **Token Management**:
   - Users can view their YOT and YOS token balances
   - They can swap tokens at the current market rate

3. **Staking**:
   - Users can stake YOT tokens to earn YOS rewards
   - They can unstake tokens at any time
   - Rewards are harvested based on time staked and rate

4. **Liquidity Provision**:
   - Users can add liquidity to earn fees
   - Fees are distributed based on contribution percentage

## ❓ Troubleshooting

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| "Program account not found" | Re-initialize program accounts in Admin Panel |
| "Insufficient balance" | Ensure program accounts are funded with YOT and YOS tokens |
| "Transaction failed" | Check Solana network status and ensure wallet has SOL |
| Database connection errors | Verify DATABASE_URL is correct in environment variables |
| "Session expired" | User needs to reconnect their wallet |

### Getting Help

If you encounter issues not covered in this guide:

1. Check the application logs for specific error messages
2. Consult the API documentation for endpoint specifications
3. Contact support at support@yot-platform.com

---

© 2025 YOT Platform - All rights reserved