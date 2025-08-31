# Overview

This is a Solana-based decentralized staking platform that allows users to stake YOT tokens and earn YOS rewards. The platform features a React frontend with TypeScript, Express.js backend, and integrates with Solana blockchain through various wallet adapters. The system includes an admin panel for managing staking parameters and a comprehensive user interface for staking, unstaking, harvesting rewards, and token swapping. The platform now includes a configurable token burning mechanism that permanently removes YOT tokens from circulation during swap operations.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent design
- **State Management**: TanStack React Query for server state management and caching
- **Wallet Integration**: Solana wallet adapters supporting Phantom, Solflare, and other popular wallets
- **Routing**: Client-side routing for dashboard, staking, swapping, and admin interfaces

## Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Authentication**: Passport.js with local strategy for admin authentication
- **Session Management**: Express sessions with database-backed storage
- **API Design**: RESTful API endpoints for admin operations and token management

## Blockchain Integration
- **Network**: Solana devnet for development/testing
- **Smart Contract**: Custom Solana program written in Rust for staking logic
- **Token Standards**: SPL tokens (YOT for staking, YOS for rewards)
- **Program Operations**: Stake, unstake, harvest rewards, and parameter updates
- **Interest Calculation**: Linear interest formula to ensure UI-blockchain consistency

## Data Storage
- **Primary Database**: PostgreSQL via Neon Database service
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema**: Admin users, session storage, and application configuration
- **Connection**: Serverless connection pooling for scalability

## Key Design Decisions
- **Token Precision**: Handles 9-decimal SPL token precision with careful raw/UI amount conversions
- **Reward Calculation**: Uses linear interest instead of compound interest to prevent calculation discrepancies
- **Error Handling**: Comprehensive error handling for wallet operations and blockchain interactions
- **Real-time Updates**: Query invalidation and optimistic updates for responsive user experience
- **Token Burning**: Configurable burning mechanism (10% on buy, 6.5% on sell by default) reduces token supply during swaps
- **Transaction Fee Management**: User wallets pay transaction fees instead of pool authority to prevent insufficient fund errors

# External Dependencies

## Blockchain Services
- **Solana RPC**: Devnet endpoint for blockchain interactions
- **Solana Program**: Custom staking program deployed at `6yw2VmZEJw5QkSG7svt4QL8DyCMxUKRtLqqBPTzLZHT6`
- **Token Mints**: YOT (`2EmUMo6kgmospSja3FUpYT3Yrps2YjHJtU9oZohr5GPF`) and YOS (`GcsjAVWYaTce9cpFLm2eGhRjZauvtSP3z3iMrZsrMW8n`) tokens

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting
- **Connection Pooling**: WebSocket-based connections for serverless environments

## Frontend Libraries
- **UI Components**: Radix UI primitives with shadcn/ui styling
- **Form Handling**: React Hook Form with Zod validation
- **Icons**: Lucide React icon library
- **Notifications**: Custom toast system for user feedback

## Development Tools
- **Build System**: Vite with TypeScript support and hot reloading
- **Code Quality**: ESLint and TypeScript for type safety
- **Package Manager**: npm with lockfile for dependency consistency