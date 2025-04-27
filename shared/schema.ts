import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define Token schema
export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isFounder: boolean("is_founder").default(false),
  founderPublicKey: text("founder_public_key"),
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login")
});

export const adminSettings = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  liquidityContributionPercentage: decimal("liquidity_contribution_percentage").notNull().default("33"),
  liquidityRewardsRateDaily: decimal("liquidity_rewards_rate_daily").notNull().default("0.05"),
  liquidityRewardsRateWeekly: decimal("liquidity_rewards_rate_weekly").notNull().default("0.35"),
  liquidityRewardsRateMonthly: decimal("liquidity_rewards_rate_monthly").notNull().default("1.5"),
  stakeRateDaily: decimal("stake_rate_daily").notNull().default("0.1"),
  stakeRateHourly: decimal("stake_rate_hourly").notNull().default("0.004"),
  stakeRatePerSecond: decimal("stake_rate_per_second").notNull().default("0.000001"),
  harvestThreshold: decimal("harvest_threshold").notNull().default("100"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => adminUsers.id)
});

export const tokens = pgTable("tokens", {
  id: serial("id").primaryKey(),
  address: text("address").notNull().unique(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  decimals: integer("decimals").notNull(),
  supply: text("supply").notNull(),
  mintAuthority: text("mint_authority"),
  freezeAuthority: text("freeze_authority"),
});

export const insertTokenSchema = createInsertSchema(tokens).pick({
  address: true,
  symbol: true,
  name: true,
  decimals: true,
  supply: true,
  mintAuthority: true,
  freezeAuthority: true,
});

// Define Transaction schema
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  signature: text("signature").notNull().unique(),
  walletAddress: text("wallet_address").notNull(),
  fromToken: text("from_token").notNull(),
  toToken: text("to_token").notNull(),
  fromAmount: text("from_amount").notNull(),
  toAmount: text("to_amount").notNull(),
  fee: text("fee").notNull(),
  timestamp: integer("timestamp").notNull(),
  status: text("status").notNull(),
  isSwap: boolean("is_swap").notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  signature: true,
  walletAddress: true,
  fromToken: true,
  toToken: true,
  fromAmount: true,
  toAmount: true,
  fee: true,
  timestamp: true,
  status: true,
  isSwap: true,
});

// Insert schemas for admin entities
export const insertAdminUserSchema = createInsertSchema(adminUsers).pick({
  username: true,
  password: true,
  isFounder: true,
  founderPublicKey: true
});

export const insertAdminSettingsSchema = createInsertSchema(adminSettings).pick({
  liquidityContributionPercentage: true,
  liquidityRewardsRateDaily: true,
  liquidityRewardsRateWeekly: true,
  liquidityRewardsRateMonthly: true,
  stakeRateDaily: true,
  stakeRateHourly: true,
  stakeRatePerSecond: true,
  harvestThreshold: true,
  updatedBy: true
});

// Staking records table
export const stakingRecords = pgTable("staking_records", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").notNull().unique(),
  stakedAmount: decimal("staked_amount").notNull().default("0"),
  startTimestamp: timestamp("start_timestamp").defaultNow(),
  lastHarvestTime: timestamp("last_harvest_time").defaultNow(),
  harvestedRewards: decimal("harvested_rewards").notNull().default("0"),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertStakingRecordSchema = createInsertSchema(stakingRecords).pick({
  walletAddress: true,
  stakedAmount: true,
  startTimestamp: true,
  harvestedRewards: true
});

// Define types
export type InsertToken = z.infer<typeof insertTokenSchema>;
export type Token = typeof tokens.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;

export type InsertAdminSettings = z.infer<typeof insertAdminSettingsSchema>;
export type AdminSettings = typeof adminSettings.$inferSelect;

export type InsertStakingRecord = z.infer<typeof insertStakingRecordSchema>;
export type StakingRecord = typeof stakingRecords.$inferSelect;
