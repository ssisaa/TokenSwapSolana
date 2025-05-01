# YOT Swap Deployment Framework

This document provides a complete overview of the YOT Swap deployment process and links to all related documentation and scripts.

## Deployment Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| [README.md](README.md) | General project overview and basic setup | All users |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Comprehensive step-by-step deployment guide | Developers |
| [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md) | Production-specific deployment instructions | Operations team |
| [SYSADMIN_GUIDE.md](SYSADMIN_GUIDE.md) | System administration and maintenance | System administrators |

## Deployment Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| [scripts/setup-database.js](scripts/setup-database.js) | Set up database schema and seed data | `node scripts/setup-database.js` |
| [scripts/validate-database.js](scripts/validate-database.js) | Validate database schema | `node scripts/validate-database.js` |
| [scripts/repair-database.js](scripts/repair-database.js) | Fix database issues | `node scripts/repair-database.js` |
| [scripts/test-db-connection.js](scripts/test-db-connection.js) | Test database connection | `node scripts/test-db-connection.js` |
| [scripts/validate-env.js](scripts/validate-env.js) | Validate environment variables | `node scripts/validate-env.js` |
| [scripts/deployment-utilities.sh](scripts/deployment-utilities.sh) | Utility script for common tasks | `./scripts/deployment-utilities.sh [command]` |
| [scripts/deploy-production.sh](scripts/deploy-production.sh) | Deploy to production | `./scripts/deploy-production.sh` |
| [scripts/pre-deployment-check.js](scripts/pre-deployment-check.js) | Run all pre-deployment checks | `node scripts/pre-deployment-check.js` |

## Deployment Workflow

For a smooth, error-free deployment, follow this workflow:

### 1. Environment Setup

First, ensure your environment is properly configured:

```bash
# Create .env file from template
cp .env.template .env

# Edit .env with correct values
nano .env

# Validate environment
node scripts/validate-env.js
```

### 2. Database Setup

Set up the database structure and initial data:

```bash
# Test database connection
node scripts/test-db-connection.js

# Create database schema and seed data
node scripts/setup-database.js

# Validate database setup
node scripts/validate-database.js
```

### 3. Pre-Deployment Check

Run a comprehensive check to ensure everything is ready:

```bash
# Run all pre-deployment checks
node scripts/pre-deployment-check.js
```

### 4. Deployment

Deploy the application:

```bash
# Deploy to production
./scripts/deploy-production.sh
```

### 5. Post-Deployment Verification

Verify that the deployment was successful:

```bash
# Check application status
pm2 status

# View application logs
pm2 logs yot-swap

# Test HTTP endpoint
curl http://localhost:5000/api/health
```

## Environment Variables Reference

Here's a complete list of environment variables used by YOT Swap:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/database` |
| `PGUSER` | PostgreSQL username | `yot_admin` |
| `PGPASSWORD` | PostgreSQL password | `secure_password` |
| `PGHOST` | PostgreSQL host | `localhost` |
| `PGPORT` | PostgreSQL port | `5432` |
| `PGDATABASE` | PostgreSQL database name | `yot_swap` |
| `SESSION_SECRET` | Secret for session encryption | `long_random_string` |
| `YOT_PROGRAM_ID` | Solana program ID | `6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6` |
| `YOT_TOKEN_ADDRESS` | YOT token address | `2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF` |
| `YOS_TOKEN_ADDRESS` | YOS token address | `GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n` |
| `ADMIN_WALLET_ADDRESS` | Admin wallet address | `AAyGRyMnFcvfdf55R7i5Sym9jEJJGYxrJnwFcq5QMLhJ` |
| `PROGRAM_SCALING_FACTOR` | Program scaling factor | `9260` |
| `YOS_WALLET_DISPLAY_ADJUSTMENT` | YOS wallet display adjustment | `9260` |
| `CONFIRMATION_COUNT` | Solana transaction confirmation count | `1` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | HTTP server port | `5000` | `5000` |
| `NODE_ENV` | Environment mode | `development` | `production` |
| `SOLANA_ENDPOINT` | Solana RPC endpoint | `https://api.devnet.solana.com` | `https://api.devnet.solana.com` |
| `SOL_RPC_RATE_LIMIT` | Solana RPC rate limit | `100` | `100` |
| `DEFAULT_MAX_RETRIES` | Max retries for operations | `3` | `3` |
| `DEFAULT_TIMEOUT_MS` | Default operation timeout | `30000` | `30000` |

## Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Database connection error | Check database credentials and ensure PostgreSQL is running |
| Type mismatch in database | Run `node scripts/repair-database.js` to fix types |
| Application won't start | Check logs with `pm2 logs` and verify environment variables |
| Port already in use | Change the port in `.env` or free up the required port |
| Session errors | Run `node scripts/repair-database.js` to fix the sessions table |
| Missing dependencies | Run `npm install` to install dependencies |

## Production Launch Checklist

Before announcing your site is live, verify:

- [ ] All pre-deployment checks pass (`node scripts/pre-deployment-check.js`)
- [ ] Application is running in PM2 (`pm2 status`)
- [ ] Application responds to HTTP requests (`curl http://localhost:5000`)
- [ ] SSL is properly configured (if using HTTPS)
- [ ] Database backups are working (`./scripts/deployment-utilities.sh backup`)
- [ ] Monitoring is set up (`pm2 monitor`)
- [ ] All environment variables are set correctly
- [ ] Firewall is configured properly
- [ ] You have a rollback plan in case of issues

## Deployment Diagram

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    Set up       │      │   Configure     │      │  Database       │
│   Environment   │─────▶│   Database      │─────▶│  Initialization │
└─────────────────┘      └─────────────────┘      └─────────────────┘
         │                                                 │
         │                                                 ▼
         │                                        ┌─────────────────┐
         │                                        │   Validate      │
         │                                        │   Database      │
         │                                        └─────────────────┘
         │                                                 │
         ▼                                                 ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Environment   │      │ Pre-Deployment  │      │   Production    │
│   Validation    │─────▶│     Check       │─────▶│   Deployment    │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                                          │
                                                          ▼
                                               ┌─────────────────────┐
                                               │ Post-Deployment     │
                                               │ Verification        │
                                               └─────────────────────┘
```

## Deployment Timeline

A typical deployment should follow this timeline:

1. **T-1 day**: Review all documentation and scripts
2. **T-12 hours**: Prepare environment and database
3. **T-6 hours**: Run pre-deployment checks
4. **T-2 hours**: Deploy to staging (if available)
5. **T-1 hour**: Final environment validation
6. **T-0**: Production deployment
7. **T+1 hour**: Post-deployment verification
8. **T+24 hours**: Review logs and performance

## Deployment Team and Responsibilities

For large organizations, define clear responsibilities for the deployment team:

- **Project Lead**: Oversees the entire deployment process
- **Database Administrator**: Manages database setup and migrations
- **System Administrator**: Configures servers and infrastructure
- **DevOps Engineer**: Handles deployment scripts and automation
- **QA Engineer**: Performs validation and testing

## Conclusion

By following this comprehensive deployment framework, you should be able to deploy YOT Swap without encountering any issues. The documentation, scripts, and checklists provided ensure a smooth, reliable deployment process.

If you do encounter issues not covered in this documentation, refer to the official documentation for the specific components (Node.js, PostgreSQL, Solana, etc.) or contact the development team for support.

Remember: thoroughly test each step before proceeding to the next to minimize issues during deployment.