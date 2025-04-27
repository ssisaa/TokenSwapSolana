import { 
  adminUsers, adminSettings,
  type AdminUser, type InsertAdminUser,
  type AdminSettings, type InsertAdminSettings
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
}

export const storage = new DatabaseStorage();
