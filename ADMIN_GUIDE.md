# 👨‍💼 YOT/YOS Platform Administrator Guide

This guide provides detailed instructions for platform administrators on how to manage and maintain the YOT/YOS Platform.

## 📋 Table of Contents

1. [Admin Dashboard Overview](#admin-dashboard-overview)
2. [Program Initialization](#program-initialization)
3. [Managing Token Accounts](#managing-token-accounts)
4. [Staking Settings](#staking-settings)
5. [User Management](#user-management)
6. [Analytics and Monitoring](#analytics-and-monitoring)
7. [Security Best Practices](#security-best-practices)

## 🔍 Admin Dashboard Overview

The Admin Dashboard is your control center for the entire platform. To access it:

1. Log in with your admin credentials (default username: `admin`)
2. Connect your Solana wallet (must match the admin wallet set during deployment)
3. Navigate to `/admin` in your browser

The dashboard includes:
- Program statistics and analytics
- Token management tools
- Staking parameter controls
- User management functions

## 🚀 Program Initialization

When first deploying the platform or after a contract upgrade, you must initialize the program:

### Initialize Program Token Accounts

1. Go to Admin Panel → Fund Program Accounts
2. Click "Initialize Program"
3. Approve the transaction with your wallet
4. Wait for confirmation (green success message)

This process creates:
- Program authority PDA (Program Derived Address)
- YOT token account (for staking)
- YOS token account (for rewards)
- Program state account (for settings)

👉 **Important**: This step is mandatory after every program redeployment!

## 💰 Managing Token Accounts

### Funding Program YOT Account

1. Go to Admin Panel → Fund Program Accounts
2. Click "Fund Program YOT Account"
3. Enter the amount of YOT tokens to transfer (e.g., 10000)
4. Approve the transaction with your wallet
5. Wait for confirmation

### Funding Program YOS Account

1. Go to Admin Panel → Fund Program Accounts
2. Click "Fund Program YOS Account"
3. Enter the amount of YOS tokens to transfer (e.g., 5000)
4. Approve the transaction with your wallet
5. Wait for confirmation

👉 **Important**: The program must have sufficient YOS tokens to pay out staking rewards!

### Checking Account Balances

1. Go to Admin Panel → Program Statistics
2. View the "YOT Token Balance" and "YOS Token Balance" cards
3. Click "Refresh Data" to get the latest balances

## ⚙️ Staking Settings

### Adjusting Staking Rate

1. Go to Admin Panel → Staking Settings
2. Locate the "Staking Rate" field
3. Enter the new rate in basis points (1 = 0.01% per day)
   - Example: 300 basis points = 3% per day
   - Recommended range: 1-500 basis points
4. Click "Update Parameters"
5. Approve the transaction with your wallet

### Setting Harvest Threshold

1. Go to Admin Panel → Staking Settings
2. Locate the "Harvest Threshold" field
3. Enter the minimum amount of rewards (in raw units) required for harvesting
   - Example: 1000000000 (1 YOS with 9 decimals)
   - Lower values allow more frequent harvesting
   - Higher values reduce network fees by batching rewards
4. Click "Update Parameters"
5. Approve the transaction with your wallet

👉 **Note**: Changes to staking parameters take effect immediately for all users!

## 👥 User Management

### Viewing User Information

1. Go to Admin Panel → User Management
2. View the list of registered users
3. Click on a user to see their details:
   - Wallet address
   - Staking amount
   - Total harvested rewards
   - Registration date

### Administrator Role Management

1. Go to Admin Panel → User Management → Admin Roles
2. View current administrators
3. To add a new admin:
   - Click "Add Administrator"
   - Enter the user's wallet address
   - Click "Save"
4. To remove an admin:
   - Locate the admin in the list
   - Click the "Remove" button
   - Confirm the action

## 📊 Analytics and Monitoring

### Viewing Platform Statistics

1. Go to Admin Panel → Dashboard
2. View key performance indicators:
   - Total Value Locked (TVL)
   - Total users
   - Active staking positions
   - Total rewards distributed

### Monitoring Transaction Activity

1. Go to Admin Panel → Activity Log
2. View recent transactions:
   - Stake transactions
   - Unstake transactions
   - Harvest events
   - Admin actions

### Exporting Data

1. Go to Admin Panel → Reports
2. Click "Generate Report"
3. Select the report type:
   - User Activity Report
   - Staking Statistics Report
   - Token Distribution Report
4. Choose the date range
5. Click "Export" (CSV format)

## 🔐 Security Best Practices

### Admin Account Security

1. Use a strong, unique password for your admin account
2. Enable two-factor authentication if available
3. Use a hardware wallet for admin transactions when possible
4. Never share admin credentials

### Regular Audits

Perform these audits regularly:

1. **Token Balance Audit**:
   - Verify program token balances match expected amounts
   - Check for any unexpected transfers

2. **User Activity Audit**:
   - Monitor for unusual staking or unstaking patterns
   - Review large transactions

3. **System Audit**:
   - Check server logs for unauthorized access attempts
   - Verify all security configurations are up to date

### Emergency Procedures

In case of security incidents:

1. **Suspicious Activity**:
   - Temporarily disable new user registrations
   - Investigate the suspicious transactions

2. **Contract Vulnerability**:
   - Pause staking features if possible
   - Prepare for emergency contract upgrade

3. **Server Breach**:
   - Rotate all admin credentials
   - Reset session keys
   - Check for unauthorized changes to server configuration

## ⚠️ Troubleshooting

### Common Admin Issues

| Issue | Solution |
|-------|----------|
| Cannot initialize program | Ensure your wallet has sufficient SOL for transaction fees |
| Failed to update parameters | Verify you're using the correct admin wallet |
| Low token balances | Fund the program accounts with more tokens |
| User reports missing rewards | Check program YOS balance and verify staking calculations |
| Transaction timeouts | Adjust RPC endpoint in app.config.json to a more reliable provider |

---

© 2025 YOT Platform - Administrator Documentation