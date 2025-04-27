import { 
  adminUsers, adminSettings, stakingRecords,
  type AdminUser, type InsertAdminUser,
  type AdminSettings, type InsertAdminSettings,
  type StakingRecord, type InsertStakingRecord
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Admin functionality
  getAdminUser(id: number): Promise<AdminUser | undefined>;
  getAdminUserByUsername(username: string): Promise<AdminUser | undefined>;
  createAdminUser(user: InsertAdminUser): Promise<AdminUser>;
  verifyAdminPassword(username: string, password: string): Promise<AdminUser | null>;
  updateAdminLastLogin(id: number): Promise<void>;
  checkFounderWallet(publicKey: string): Promise<AdminUser | null>;
  
  // Admin settings
  getAdminSettings(): Promise<AdminSettings | undefined>;
  updateAdminSettings(settings: Partial<InsertAdminSettings>, adminId: number): Promise<AdminSettings>;
  
  // Staking functionality
  saveStakingData(data: { walletAddress: string, stakedAmount: number, startTimestamp: number, harvestableRewards?: number }): Promise<any>;
  getStakingData(walletAddress: string): Promise<any>;
  removeStakingData(walletAddress: string): Promise<void>;
  harvestRewards(walletAddress: string): Promise<void>;
  
  // Session store
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true,
      tableName: 'session' 
    });
    
    // Initialize default admin settings if not exists
    this.initializeDefaultSettings();
  }
  
  private async initializeDefaultSettings() {
    const settings = await this.getAdminSettings();
    if (!settings) {
      // Create initial admin settings
      await db.insert(adminSettings).values({
        liquidityContributionPercentage: "33",
        liquidityRewardsRateDaily: "0.05",
        liquidityRewardsRateWeekly: "0.35",
        liquidityRewardsRateMonthly: "1.5",
        stakeRateDaily: "0.1",
        stakeRateHourly: "0.004",
        stakeRatePerSecond: "0.000001",
        harvestThreshold: "100"
      });
    }
  }

  async getAdminUser(id: number): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return user;
  }

  async getAdminUserByUsername(username: string): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.username, username));
    return user;
  }

  async createAdminUser(insertUser: InsertAdminUser): Promise<AdminUser> {
    // Hash the password before storing
    const hashedPassword = await hashPassword(insertUser.password);
    
    const [user] = await db.insert(adminUsers).values({
      ...insertUser,
      password: hashedPassword
    }).returning();
    
    return user;
  }
  
  async verifyAdminPassword(username: string, password: string): Promise<AdminUser | null> {
    const user = await this.getAdminUserByUsername(username);
    if (!user) return null;
    
    const isValid = await comparePasswords(password, user.password);
    return isValid ? user : null;
  }
  
  async updateAdminLastLogin(id: number): Promise<void> {
    await db.update(adminUsers)
      .set({ lastLogin: new Date() })
      .where(eq(adminUsers.id, id));
  }
  
  async checkFounderWallet(publicKey: string): Promise<AdminUser | null> {
    const [user] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.founderPublicKey, publicKey))
      
    return user && user.isFounder ? user : null;
  }
  
  async getAdminSettings(): Promise<AdminSettings | undefined> {
    const [settings] = await db.select().from(adminSettings);
    return settings;
  }
  
  async updateAdminSettings(settings: Partial<InsertAdminSettings>, adminId: number): Promise<AdminSettings> {
    const [updated] = await db
      .update(adminSettings)
      .set({
        ...settings,
        updatedAt: new Date(),
        updatedBy: adminId
      })
      .returning();
      
    return updated;
  }
  
  // Staking functionality
  async saveStakingData(data: { walletAddress: string, stakedAmount: number, startTimestamp: number, harvestableRewards?: number }): Promise<any> {
    // Security enhancements: sanitize inputs
    const sanitizedWalletAddress = data.walletAddress.trim();
    const sanitizedAmount = Math.max(0, data.stakedAmount); // Ensure positive numbers only
    
    // Ensure timestamp is a valid number (UNIX timestamp in milliseconds)
    let timestampMs = Date.now(); // Default fallback value
    try {
      if (typeof data.startTimestamp === 'number') {
        timestampMs = data.startTimestamp;
      } else if (typeof data.startTimestamp === 'string') {
        timestampMs = new Date(data.startTimestamp).getTime();
      }
    } catch (e) {
      console.error("Invalid timestamp format:", e);
      // Use default timestamp (now) if parsing fails
    }
    
    // Check if staking record already exists for this wallet
    const existingRecord = await this.getStakingData(sanitizedWalletAddress);
    
    try {
      if (existingRecord) {
        // Update existing record
        const [updatedRecord] = await db
          .update(stakingRecords)
          .set({
            stakedAmount: sanitizedAmount.toString(),
            startTimestamp: timestampMs,
            harvestedRewards: data.harvestableRewards ? Math.max(0, data.harvestableRewards).toString() : "0",
            updatedAt: new Date()
          })
          .where(eq(stakingRecords.walletAddress, sanitizedWalletAddress))
          .returning();
        
        return updatedRecord;
      } else {
        // Create new record
        const [newRecord] = await db
          .insert(stakingRecords)
          .values({
            walletAddress: sanitizedWalletAddress,
            stakedAmount: sanitizedAmount.toString(),
            startTimestamp: timestampMs,
            lastHarvestTime: timestampMs,
            harvestedRewards: data.harvestableRewards ? Math.max(0, data.harvestableRewards).toString() : "0",
          })
          .returning();
        
        return newRecord;
      }
    } catch (error) {
      console.error('Database operation failed:', error);
      throw new Error('Unable to process staking data. Please try again.');
    }
  }
  
  async getStakingData(walletAddress: string): Promise<any> {
    // Security: Sanitize wallet address
    const sanitizedWalletAddress = walletAddress ? walletAddress.trim() : '';
    
    if (!sanitizedWalletAddress) {
      return null; // Early return for empty wallet addresses
    }
    
    try {
      const [record] = await db
        .select()
        .from(stakingRecords)
        .where(eq(stakingRecords.walletAddress, sanitizedWalletAddress));
      
      if (!record) return null;
      
      // Get current admin settings for rate calculation
      const settings = await this.getAdminSettings();
      
      // Format sensitive data for security
      return {
        id: record.id,
        walletAddress: record.walletAddress,
        stakedAmount: record.stakedAmount,
        startTimestamp: record.startTimestamp,
        lastHarvestTime: record.lastHarvestTime,
        harvestedRewards: record.harvestedRewards,
        updatedAt: record.updatedAt,
        // Include admin settings so frontend can calculate rewards
        currentSettings: settings ? {
          id: settings.id,
          stakeRateDaily: settings.stakeRateDaily,
          stakeRateHourly: settings.stakeRateHourly,
          stakeRatePerSecond: settings.stakeRatePerSecond,
          harvestThreshold: settings.harvestThreshold,
          updatedAt: settings.updatedAt
        } : null
      };
    } catch (error) {
      console.error('Error retrieving staking data:', error);
      throw new Error('Unable to retrieve staking information');
    }
  }
  
  async removeStakingData(walletAddress: string): Promise<void> {
    // Security: Sanitize wallet address
    const sanitizedWalletAddress = walletAddress.trim();
    
    try {
      // First verify the wallet exists to avoid data modification errors
      const existingRecord = await this.getStakingData(sanitizedWalletAddress);
      if (!existingRecord) {
        throw new Error('No staking record found for this wallet');
      }
      
      await db
        .delete(stakingRecords)
        .where(eq(stakingRecords.walletAddress, sanitizedWalletAddress));
    } catch (error) {
      console.error('Error removing staking data:', error);
      throw new Error('Unable to process unstaking request. Please try again.');
    }
  }
  
  async harvestRewards(walletAddress: string): Promise<void> {
    // Security: Sanitize wallet address
    const sanitizedWalletAddress = walletAddress.trim();
    
    // Use current timestamp in milliseconds
    const currentTimeMs = Date.now();
    
    try {
      // Reset harvested rewards and update lastHarvestTime
      await db
        .update(stakingRecords)
        .set({
          harvestedRewards: "0",
          lastHarvestTime: currentTimeMs,
          updatedAt: new Date()
        })
        .where(eq(stakingRecords.walletAddress, sanitizedWalletAddress));
    } catch (error) {
      console.error('Error during reward harvest:', error);
      throw new Error('Unable to harvest rewards. Please try again.');
    }
  }
}

export const storage = new DatabaseStorage();
