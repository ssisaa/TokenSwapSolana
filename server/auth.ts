import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage";
import { AdminUser, adminUsers } from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";

declare global {
  namespace Express {
    interface User extends AdminUser {}
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "solana-token-swap-admin-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport to use local strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.verifyAdminPassword(username, password);
        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }
        
        // Update last login time
        await storage.updateAdminLastLogin(user.id);
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  // Serialize and deserialize user
  passport.serializeUser((user, done) => done(null, user.id));
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getAdminUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Middleware to check if user is authenticated
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // Auth APIs
  app.post("/api/admin/login", passport.authenticate("local"), (req, res) => {
    const { password, ...userWithoutPassword } = req.user as AdminUser;
    res.json(userWithoutPassword);
  });

  app.post("/api/admin/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.json({ success: true });
    });
  });

  app.get("/api/admin/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { password, ...userWithoutPassword } = req.user as AdminUser;
    res.json(userWithoutPassword);
  });

  app.post("/api/admin/register", async (req, res) => {
    try {
      // For the purposes of this demo, we'll allow all registrations
      // In a production environment, you would want to restrict this
      // Uncomment the following block to restrict registrations
      /*
      const adminCount = await db.select({ count: sql<number>`count(*)` }).from(adminUsers);
      const isFirstAdmin = adminCount[0].count === 0;
      
      if (!isFirstAdmin) {
        // Only allow registration if logged in as an admin already
        if (!req.isAuthenticated()) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }
      */
      
      const { username, password, isFounder, founderPublicKey } = req.body;
      
      // Validate input
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      // Check if username already exists
      const existingUser = await storage.getAdminUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }
      
      // Create the admin user
      const user = await storage.createAdminUser({
        username,
        password,
        isFounder: isFounder || false,
        founderPublicKey: founderPublicKey || null
      });
      
      // Log in the user automatically after registration
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Error during login", error: err.message });
        }
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Error registering admin user:", error);
      res.status(500).json({ 
        message: "Failed to register admin user",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Admin settings APIs
  app.get("/api/admin/settings", async (req, res) => {
    try {
      const settings = await storage.getAdminSettings();
      res.json(settings || {});
    } catch (error) {
      console.error("Error fetching admin settings:", error);
      res.status(500).json({ 
        message: "Failed to fetch admin settings",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.put("/api/admin/settings", isAuthenticated, async (req, res) => {
    try {
      const {
        liquidityContributionPercentage,
        liquidityRewardsRateDaily,
        liquidityRewardsRateWeekly,
        liquidityRewardsRateMonthly,
        stakeRateDaily,
        stakeRateHourly,
        stakeRatePerSecond,
        harvestThreshold
      } = req.body;
      
      const adminId = (req.user as AdminUser).id;
      
      const updated = await storage.updateAdminSettings({
        liquidityContributionPercentage,
        liquidityRewardsRateDaily,
        liquidityRewardsRateWeekly,
        liquidityRewardsRateMonthly,
        stakeRateDaily,
        stakeRateHourly,
        stakeRatePerSecond,
        harvestThreshold,
        updatedBy: adminId
      }, adminId);
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating admin settings:", error);
      res.status(500).json({ 
        message: "Failed to update admin settings",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Verify founder wallet
  app.post("/api/admin/verify-wallet", async (req, res) => {
    try {
      const { publicKey } = req.body;
      
      if (!publicKey) {
        return res.status(400).json({ message: "Public key is required" });
      }
      
      const adminUser = await storage.checkFounderWallet(publicKey);
      
      if (!adminUser) {
        return res.status(403).json({ message: "This wallet is not registered as a founder" });
      }
      
      // Log the user in
      req.login(adminUser, (err) => {
        if (err) {
          return res.status(500).json({ message: "Error during login", error: err.message });
        }
        
        // Update last login time
        storage.updateAdminLastLogin(adminUser.id);
        
        const { password, ...userWithoutPassword } = adminUser;
        res.json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Error verifying wallet:", error);
      res.status(500).json({ 
        message: "Failed to verify wallet",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  return { isAuthenticated };
}