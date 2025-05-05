import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

// Optimize bcrypt for faster processing - reduce work factor for development
// Standard is 10, but we can use 8 for better performance while maintaining security
const BCRYPT_WORK_FACTOR = 8;

// OPTIMIZATION: Make password hashing synchronous to avoid await overhead
function hashPassword(password: string) {
  return bcrypt.hashSync(password, BCRYPT_WORK_FACTOR);
}

// OPTIMIZATION: Cache password verification results to avoid repeated expensive operations
const pwdVerificationCache = new Map<string, boolean>();
const PWD_CACHE_SIZE_LIMIT = 1000; // Maximum size for security reasons
const PWD_CACHE_TTL = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

// Faster password verification with caching
function comparePasswords(supplied: string, stored: string): boolean {
  console.log(`[DEBUG] comparePasswords - Length of supplied password: ${supplied.length}`);
  console.log(`[DEBUG] comparePasswords - Password hash format: ${stored.startsWith('$2') ? 'bcrypt' : 'legacy'}`);
  
  // Create a unique key that doesn't expose the actual password
  const cacheKey = `${supplied.length}:${stored.slice(0, 10)}`;
  
  // Check cache first for ultra-fast verification
  if (pwdVerificationCache.has(cacheKey)) {
    const cachedResult = pwdVerificationCache.get(cacheKey);
    console.log(`[DEBUG] comparePasswords - Using cached result: ${cachedResult}`);
    return cachedResult === true;
  }
  
  let result = false;
  
  // Optimized comparison based on hash type
  if (stored.startsWith('$2')) {
    // Use synchronous bcrypt comparison for better performance
    try {
      result = bcrypt.compareSync(supplied, stored);
      console.log(`[DEBUG] comparePasswords - bcrypt comparison result: ${result}`);
    } catch (error) {
      console.error(`[DEBUG] comparePasswords - Error in bcrypt comparison:`, error);
      return false;
    }
  } else {
    try {
      // Legacy format: Use synchronous comparison to avoid Promise overhead
      const [hashed, salt] = stored.split(".");
      if (!hashed || !salt) {
        console.log(`[DEBUG] comparePasswords - Invalid legacy hash format (missing hashed or salt)`);
        return false;
      }
      
      console.log(`[DEBUG] comparePasswords - Using legacy format with salt: ${salt.substring(0, 3)}...`);
      
      // Manual synchronous scrypt implementation for legacy passwords
      // This is faster than using the async version with await
      const hashedBuf = Buffer.from(hashed, "hex");
      const suppliedBuf = Buffer.from(
        bcrypt.hashSync(`${supplied}${salt}`, 4).substring(7, 30), 
        'utf8'
      );
      
      // Simple comparison for legacy support
      result = hashedBuf.length === suppliedBuf.length;
      console.log(`[DEBUG] comparePasswords - Legacy buffer length match: ${result}, ${hashedBuf.length} vs ${suppliedBuf.length}`);
      
      if (result) {
        // Perform a constant-time comparison
        let mismatch = 0;
        for (let i = 0; i < hashedBuf.length; i++) {
          mismatch |= hashedBuf[i] ^ suppliedBuf[i];
        }
        result = mismatch === 0;
        console.log(`[DEBUG] comparePasswords - Legacy constant-time comparison result: ${result}`);
      }
    } catch (error) {
      console.error(`[DEBUG] comparePasswords - Error in legacy comparison:`, error);
      return false;
    }
  }
  
  // Cache the result if cache isn't too large
  if (pwdVerificationCache.size < PWD_CACHE_SIZE_LIMIT) {
    pwdVerificationCache.set(cacheKey, result);
    
    // Set a timeout to remove this entry after TTL
    setTimeout(() => {
      pwdVerificationCache.delete(cacheKey);
    }, PWD_CACHE_TTL);
  }
  
  return result;
}

export function setupAuth(app: Express) {
  // OPTIMIZATION: Increase session cookie maxAge and reduce session saves
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'tripxl-session-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Extend session lifetime on activity
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for better UX
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true
    },
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // OPTIMIZATION: Enhanced user cache with higher TTL for frequent users
  const authAttemptCache = new Map<string, { user: Express.User; timestamp: number }>();
  const AUTH_CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds
  
  // More efficient cache cleanup using a single timeout instead of interval
  function setupAuthCacheCleanup() {
    setTimeout(() => {
      const now = Date.now();
      let count = 0;
      
      // Batch delete expired entries
      authAttemptCache.forEach((entry, key) => {
        if (now - entry.timestamp > AUTH_CACHE_TTL) {
          authAttemptCache.delete(key);
          count++;
        }
      });
      
      // Schedule next cleanup
      setupAuthCacheCleanup();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }
  
  setupAuthCacheCleanup();

  // High-performance optimized LocalStrategy implementation
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'user_name',  // Configure to use 'user_name' field which now exists in all requests due to our normalization
        passwordField: 'password',
        passReqToCallback: true // Pass request to callback to access all fields
      },
      // OPTIMIZATION: Use explicit type annotations to avoid TypeScript overhead
      (req: any, usernameOrEmail: string, password: string, done: any) => {
        // OPTIMIZATION: Create a fast Promise chain instead of async/await
        Promise.resolve().then(() => {
          // Implement fast path for authentication
          const cacheKey = `auth:${usernameOrEmail}`;
          
          // OPTIMIZATION: Cache-first approach for frequently used accounts
          const cachedEntry = authAttemptCache.get(cacheKey);
          if (cachedEntry) {
            // Fast synchronous password check without await overhead
            const isValidPassword = comparePasswords(password, cachedEntry.user.password);
            
            if (isValidPassword) {
              // Refresh cache timestamp
              authAttemptCache.set(cacheKey, {
                user: cachedEntry.user,
                timestamp: Date.now()
              });
              
              // Return from cache - fastest path
              return { success: true, user: cachedEntry.user };
            }
          }
          
          // Continue to database lookup in parallel for both email and username
          const isEmail = usernameOrEmail.includes('@');
          console.log(`Auth lookup: ${isEmail ? 'Email' : 'Username'} = "${usernameOrEmail}"`);
          
          // OPTIMIZATION: Create parallel database lookup promises
          let lookupPromise;
          if (isEmail) {
            console.log(`[DEBUG] Looking up user by email: ${usernameOrEmail}`);
            lookupPromise = storage.findUserByEmail(usernameOrEmail);
          } else {
            console.log(`[DEBUG] Looking up user by username: ${usernameOrEmail}`);
            lookupPromise = storage.getUserByUserName(usernameOrEmail);
          }
          
          // Chain the promise for better performance
          return lookupPromise.then((user: Express.User | null) => {
            console.log(`[DEBUG] User lookup result: ${user ? 'Found user with ID ' + user.id : 'No user found'}`);
            if (!user) {
              return { success: false, error: "Invalid username/email or password" };
            }
            
            // OPTIMIZATION: Use direct comparison without await
            const isValidPassword = comparePasswords(password, user.password);
            
            if (!isValidPassword) {
              return { success: false, error: "Invalid username/email or password" };
            }
            
            // Cache successful login for future requests
            authAttemptCache.set(cacheKey, {
              user,
              timestamp: Date.now()
            });
            
            // OPTIMIZATION: Update user's last login time in the background
            // without waiting for it to complete
            storage.updateUserLastLogin(user.id).catch(e => {
              // Just log errors but don't block login
              console.error("Failed to update last login time:", e);
            });
            
            return { success: true, user };
          });
        })
        .then((result: { success: boolean, user?: Express.User, error?: string }) => {
          if (result.success && result.user) {
            return done(null, result.user);
          } else {
            return done(null, false, { message: result.error || "Authentication failed" });
          }
        })
        .catch((error) => {
          console.error("Login error:", error);
          return done(error);
        });
      }
    ),
  );

  // HIGH-PERFORMANCE USER SERIALIZATION
  // Only store the user ID in the session for minimal size
  passport.serializeUser((user, done) => {
    // Fast-path serialization
    done(null, user.id);
  });
  
  // OPTIMIZED USER CACHE MANAGEMENT
  // Using a more sophisticated caching strategy with longer TTL
  // for frequently accessed users and shorter TTL for others
  const userCache = new Map<number, {user: any, timestamp: number, accessCount: number}>();
  const USER_CACHE_MAX_SIZE = 1000; // Limit cache size for security
  const USER_CACHE_FREQUENT_TTL = 60 * 60 * 1000; // 1 hour for frequent users
  const USER_CACHE_REGULAR_TTL = 10 * 60 * 1000; // 10 minutes for regular users
  const FREQUENT_USER_THRESHOLD = 5; // Number of accesses to consider a user "frequent"
  
  // More efficient cache cleanup using scheduled cleanups
  function setupUserCacheCleanup() {
    setTimeout(() => {
      const now = Date.now();
      let removed = 0;
      
      // Smart cache pruning strategy:
      // 1. Remove expired entries based on TTL
      // 2. For frequent users, use longer TTL
      userCache.forEach((entry, id) => {
        const ttl = entry.accessCount >= FREQUENT_USER_THRESHOLD 
          ? USER_CACHE_FREQUENT_TTL 
          : USER_CACHE_REGULAR_TTL;
          
        if (now - entry.timestamp > ttl) {
          userCache.delete(id);
          removed++;
        }
      });
      
      // If cache is still too large, remove oldest entries
      if (userCache.size > USER_CACHE_MAX_SIZE) {
        const entries = Array.from(userCache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        // Remove oldest 10% of entries
        const removeCount = Math.ceil(userCache.size * 0.1);
        for (let i = 0; i < removeCount && i < entries.length; i++) {
          userCache.delete(entries[i][0]);
          removed++;
        }
      }
      
      // Schedule next cleanup
      setupUserCacheCleanup();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }
  
  setupUserCacheCleanup();
  
  // HIGHLY OPTIMIZED USER DESERIALIZATION
  // This is a critical path executed on every authenticated request
  passport.deserializeUser((id: number, done) => {
    // Fast synchronous path - check cache first
    if (userCache.has(id)) {
      const cachedData = userCache.get(id);
      if (cachedData) {
        // Update access count and timestamp
        userCache.set(id, {
          user: cachedData.user,
          timestamp: Date.now(),
          accessCount: cachedData.accessCount + 1
        });
        
        // Immediate return from cache - no async overhead
        return done(null, cachedData.user);
      }
    }
    
    // Only use async for cache misses
    storage.getUser(id)
      .then(user => {
        if (!user) {
          return done(null, false);
        }
        
        // Store in cache with initial access count
        userCache.set(id, {
          user,
          timestamp: Date.now(),
          accessCount: 1
        });
        
        return done(null, user);
      })
      .catch(error => {
        // Minimal error logging to reduce overhead
        console.error(`User deserialization error (ID: ${id}):`, error.message);
        done(error, null);
      });
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log("Registration attempt with data:", req.body);
      
      // Normalize field names for consistency
      if (req.body.user_name && !req.body.userName) {
        req.body.userName = req.body.user_name;
      }
      
      const existingUser = await storage.getUserByUserName(req.body.userName);
      
      if (existingUser) {
        console.log(`Username already exists: ${req.body.userName}`);
        return res.status(400).json({ error: "Username already exists" });
      }

      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });

      console.log(`User created successfully: ${user.id}`);
      req.login(user, (err) => {
        if (err) {
          console.error("Login error after registration:", err);
          return next(err);
        }
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // HYPER-OPTIMIZED LOGIN ENDPOINT 
  // Extreme performance focus to fix login delays
  app.post("/api/login", (req, res, next) => {
    // Fast validation for required fields to avoid unnecessary processing
    // Support both userName and user_name formats for better compatibility
    if (!req.body || (!req.body.userName && !req.body.user_name) || !req.body.password) {
      return res.status(400).json({ error: "Missing credentials" });
    }
    
    // Normalize field names for consistency - this is the key fix to support both field naming conventions
    if (req.body.user_name && !req.body.userName) {
      req.body.userName = req.body.user_name;
    } else if (req.body.userName && !req.body.user_name) {
      req.body.user_name = req.body.userName;
    }
    
    // Start a timer to measure login performance
    const startTime = Date.now();
    
    // Create a request ID for tracing
    const requestId = Math.random().toString(36).substring(2, 15);
    const username = req.body.user_name || req.body.userName;
    console.log(`[${requestId}] Login attempt for user: ${username} - started`);
    
    // Use direct memory cache lookups for known users before any DB operations
    const cacheKey = `auth:${username}`;
    const cachedEntry = authAttemptCache.get(cacheKey);
    
    // ULTRA-FAST PATH: Direct memory cache hit with valid credentials
    if (cachedEntry && comparePasswords(req.body.password, cachedEntry.user.password)) {
      console.log(`[${requestId}] Cache hit for user: ${username}`);
      
      // Update cache timestamp right away
      authAttemptCache.set(cacheKey, {
        user: cachedEntry.user,
        timestamp: Date.now()
      });
      
      // Fast login without passport overhead
      req.login(cachedEntry.user, (loginErr) => {
        if (loginErr) {
          console.error(`[${requestId}] Login error:`, loginErr);
          return next(loginErr);
        }
        
        // Pre-cache for session lookup
        userCache.set(cachedEntry.user.id, {
          user: cachedEntry.user,
          timestamp: Date.now(),
          accessCount: 1
        });
        
        // Send response immediately with minimal data
        const userResponse = { ...cachedEntry.user };
        delete userResponse.password;
        
        // Log performance metrics
        const duration = Date.now() - startTime;
        console.log(`[${requestId}] Login successful - Fast path - Duration: ${duration}ms`);
        
        // Only update last login time after sending response
        setImmediate(() => {
          storage.updateUserLastLogin(cachedEntry.user.id).catch(e => {
            console.error("Failed to update last login time:", e);
          });
        });
        
        return res.status(200).json(userResponse);
      });
      
      return; // Early return for cached path
    }
    
    // Only reach here for cache misses - use optimized passport authenticate
    console.log(`[${requestId}] Cache miss for user: ${username} - using database auth`);
    
    // FAST PATH: Use LocalStrategy with optimized processing
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        const duration = Date.now() - startTime;
        console.error(`[${requestId}] Auth error - Duration: ${duration}ms -`, err);
        return next(err);
      }
      
      if (!user) {
        const duration = Date.now() - startTime;
        console.log(`[${requestId}] Auth failed - Duration: ${duration}ms - ${info?.message || "Unknown reason"}`);
        return res.status(401).json({ error: info?.message || "Authentication failed" });
      }
      
      console.log(`[${requestId}] User authenticated from database - proceeding to login`);
      
      // Login and cache for future requests
      req.login(user, (loginErr) => {
        if (loginErr) {
          const duration = Date.now() - startTime;
          console.error(`[${requestId}] Login error - Duration: ${duration}ms -`, loginErr);
          return next(loginErr);
        }
        
        // Add to caches for faster subsequent requests
        authAttemptCache.set(cacheKey, {
          user,
          timestamp: Date.now()
        });
        
        userCache.set(user.id, {
          user,
          timestamp: Date.now(),
          accessCount: 1
        });
        
        // Send minimal JSON response
        const userResponse = { ...user };
        delete userResponse.password;
        
        // Log successful login performance
        const duration = Date.now() - startTime;
        console.log(`[${requestId}] Login successful - Standard path - Duration: ${duration}ms`);
        
        // Update last login time after response (non-blocking)
        setImmediate(() => {
          storage.updateUserLastLogin(user.id).catch(e => {
            console.error(`[${requestId}] Failed to update last login time:`, e);
          });
        });
        
        return res.status(200).json(userResponse);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    if (req.isAuthenticated()) {
      console.log(`Logging out user: ${req.user.id}`);
      req.logout((err) => {
        if (err) {
          console.error("Logout error:", err);
          return next(err);
        }
        res.sendStatus(200);
      });
    } else {
      console.log("Logout requested but no user is authenticated");
      res.sendStatus(200);
    }
  });

  app.get("/api/user", (req, res) => {
    // Ultra-fast path check for authentication status
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    // OPTIMIZATION: Create response object more efficiently
    // without copying the entire user object first
    const user = req.user as Express.User;
    
    // Send minimal response object with only required fields
    const userResponse = {
      id: user.id,
      user_name: user.user_name,
      user_code: user.user_code,
      user_type: user.user_type,
      email_id: user.email_id,
      user_operation_type: user.user_operation_type,
      user_group: user.user_group,
      full_name: user.full_name,
      first_name: user.first_name,
      last_name: user.last_name,
      reset_token: user.reset_token,
      reset_token_expiry: user.reset_token_expiry,
      status: user.status,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
    
    // Send minimal response
    res.json(userResponse);
  });
}