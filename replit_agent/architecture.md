# Architecture Overview

## Introduction

This document outlines the architectural decisions, structure, and components of the YOT/YOS token staking platform. The system is a web application built with React on the frontend and Node.js on the backend, with integration with the Solana blockchain for token staking operations.

## System Architecture

The system follows a client-server architecture with blockchain integration:

- **Frontend**: React-based single-page application with Tailwind CSS for styling
- **Backend**: Node.js/Express.js server 
- **Database**: PostgreSQL with Drizzle ORM
- **Blockchain**: Solana program for token staking and swapping functionality

### High-Level Architecture Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│             │     │             │     │                 │
│ React UI    │────►│ Express API │────►│ PostgreSQL DB   │
│             │     │             │     │                 │
└─────────────┘     └─────────────┘     └─────────────────┘
       │                   │
       │                   │
       ▼                   ▼
┌─────────────────────────────────────┐
│                                     │
│ Solana Blockchain                   │
│ (YOT Staking Program & Swap Program)│
│                                     │
└─────────────────────────────────────┘
```

## Key Components

### Frontend (Client)

- **Technology Stack**: React.js with TypeScript
- **UI Framework**: Tailwind CSS with Radix UI components (shadcn/ui)
- **State Management**: React Query for server state
- **Wallet Integration**: Solana wallet adapters (Phantom, Solflare)

The frontend is built using a modern React stack with TypeScript for type safety. Component composition follows the shadcn/ui approach with Radix UI primitives styled with Tailwind CSS.

### Backend (Server)

- **Technology Stack**: Node.js with Express
- **API Style**: RESTful API
- **Authentication**: Session-based authentication with Passport.js
- **Database ORM**: Drizzle with PostgreSQL

The backend provides API endpoints for the frontend and handles server-side operations that cannot be directly performed on the blockchain.

### Database Schema

The database uses Drizzle ORM with the following main entities:

- `adminUsers`: Stores administrator accounts
- `adminSettings`: Configuration for staking rates and thresholds
- `tokens`: Token metadata and configuration
- `stakingRecords`: User staking activity records

### Blockchain Integration

- **Solana Program**: Custom Rust program for token staking operations
- **Program ID**: `6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6`
- **Token Contracts**:
  - YOT Token: `9KxQHJcBxp29AjGTAqF3LCFzodSpkuv986wsSEwQi6Cw`
  - YOS Token: `2SWCnck3vLAVKaLkAjVtNnsVJVGYmGzyNVnte48SQRop`
- **Multi-Hub Swap Program**: `SMddVoXz2hF9jjecS5A1gZLG8TJHo34MJZuexZ8kVjE`

The on-chain logic handles token staking, reward calculation, and token swapping operations.

## Data Flow

### Token Staking Flow

1. User connects their Solana wallet to the application
2. User stakes YOT tokens through the UI
3. Frontend creates a Solana transaction that calls the staking program
4. User signs the transaction in their wallet
5. The staking program locks the tokens and records the stake
6. The backend periodically queries the blockchain for staking information
7. Rewards accrue linearly based on time staked and configured rates
8. Users can harvest rewards or unstake through the UI

### Administrative Flow

1. Admins authenticate through the web interface
2. Admins can configure staking parameters like rates and thresholds
3. Changes are stored in the PostgreSQL database
4. When applicable, on-chain parameters may be updated through admin-only program instructions

## External Dependencies

### Solana Ecosystem
- `@solana/web3.js`: Core Solana JavaScript API
- `@solana/spl-token`: Solana Program Library Token implementation
- `@solana/wallet-adapter`: Wallet connection interfaces

### UI Components
- Radix UI component primitives
- Tailwind CSS for styling

### Data Management
- NeonDB (serverless Postgres) through `@neondatabase/serverless`
- Drizzle ORM for database operations

## Deployment Strategy

The application is configured for deployment on various platforms:

### Development Environment
- Local development using Vite's development server
- Solana devnet for blockchain interactions

### Production Environment
- Replit for hosting (as indicated in `.replit` configuration)
- Auto-scaling deployment configuration
- Build process:
  1. Vite builds the frontend static assets
  2. Backend is bundled with esbuild
  3. Combined application is served from a single Node.js process

### Blockchain Deployment
- Solana program deployment handled separately via:
  1. Building with `cargo build-bpf`
  2. Deploying to Solana devnet/mainnet with dedicated program keypair

## Recent Architectural Changes

### Linear Interest Fix Implementation
A notable recent change is the implementation of a linear interest calculation to replace the compound interest calculation in the Solana program. This addresses an issue where the rewards shown in the UI didn't match what users received when harvesting or unstaking.

The fix was implemented in these key functions:
1. `calculate_rewards`
2. `process_harvest`
3. `process_unstake`

## Security Considerations

- Session-based authentication for administrative functions
- Proper separation between admin and user functions
- Solana program authority model for permissioned operations
- Founder wallet verification for critical functions

## Future Considerations

- Enhanced analytics for staking activity
- Additional token support in the swap functionality
- Performance optimizations for reward calculations