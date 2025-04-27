import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define Token schema
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

// Define types
export type InsertToken = z.infer<typeof insertTokenSchema>;
export type Token = typeof tokens.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
