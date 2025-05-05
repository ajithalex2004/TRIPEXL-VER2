import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db, pool } from "./db";
import { schema } from "./db";
import { log } from "./vite";
import { setupAuth } from "./auth";
// Import debug utils
import { logBookingRequest, logBookingError } from "./debug/booking-debug";
import { createToken, verifyToken, isValidTokenPayload } from "./auth/token-service";
import vehicleGroupRouter from "./routes/vehicle-groups";
import vehicleTypeMasterRouter from "./routes/vehicle-type-master";
import { ecoRoutesRouter } from "./routes/eco-routes";
import multer from "multer";
import { approvalWorkflowsRouter } from './routes/approval-workflows';
import { insertBookingSchema, insertUserSchema, employees, bookings, insertEmployeeSchema, insertApprovalWorkflowSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import authTestRouter from "./routes/auth-test";
import jwt from "jsonwebtoken";
import XLSX from "xlsx";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { eq, sql, or } from 'drizzle-orm';
import mastersRouter from "./routes/masters"; // Added import statement
import { initializeFuelPriceService, updateFuelPrices, getFuelPriceHistory, triggerFuelPriceUpdate, runWamFuelPriceScraper } from "./services/fuel-price-service";
import { performanceRouter } from "./routes/performance-snapshot";
import fuelTypesRouter from "./routes/fuel-types";
import mapsRouter from "./routes/maps-routes";
import userEmployeeRouter from "./routes/user-employee-router";
import bookingDebugRouter from "./routes/booking-debug";
import bookingTestRouter from "./routes/booking-test";
import bookingDebugTraceRouter from "./routes/booking-debug-trace";
import bookingCreateTraceRouter from "./routes/booking-create-trace";
import bookingManagementRouter from "./routes/booking-management";
import bookingDebugAdvancedRouter from "./routes/booking-debug-advanced";
import bookingCreateTestRouter from "./routes/booking-create-test";
import { testBookingDirectRouter } from "./routes/test-booking-direct";
import { dispatchRouter } from "./routes/dispatch-routes";
import { testDataRouter } from "./routes/test-data-routes";
import { tripMergeRouter } from "./routes/trip-merge-routes";
import configRouter from "./routes/config-routes";
import { setupAutomatedDispatch } from "./services/auto-dispatch-service";
import { setupAutomatedTripMerging } from "./services/trip-merge-service";
import { employeeVerificationRouter } from "./routes/employee-verification-routes";
import { authDebugRouter } from "./routes/auth-debug";
import simpleBookingDebugRouter from "./routes/debug-booking-simple";
import routeInsightsRouter from "./routes/route-insights-routes";

// Direct admin hash for "testPassword123"
const ADMIN_PASSWORD_HASH = "$2b$10$wCcxgfC5BHh3BFrx6McYWeOOKQKwK1qXUqGzKLDJvb3Xp1y.6m1BS";

// Configure multer for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  log("Starting route registration...");
  const httpServer = createServer(app);

  try {
    // Health check endpoint
    app.get("/api/health", (_req, res) => {
      res.json({ status: "healthy" });
    });
    log("Health check endpoint registered");
    
    // API endpoint to get booking purposes by booking type
    app.get("/api/booking/purposes/:type", (req, res) => {
      try {
        const { type } = req.params;
        // Import BookingPurpose directly from the schema
        const { BookingPurpose, CargoType } = schema;
        
        let purposes = [];
        if (type === "freight") {
          purposes = [
            { key: "FREIGHT_TRANSPORT", value: BookingPurpose.FREIGHT_TRANSPORT }
          ];
        } else if (type === "passenger") {
          purposes = [
            { key: "STAFF_TRANSPORTATION", value: BookingPurpose.STAFF_TRANSPORTATION },
            { key: "VIP_TRANSFER", value: BookingPurpose.VIP_TRANSFER },
            { key: "GUEST", value: BookingPurpose.GUEST },
            { key: "MEETING", value: BookingPurpose.MEETING },
            { key: "EVENTS_SEMINAR", value: BookingPurpose.EVENTS_SEMINAR },
            { key: "TRAINING", value: BookingPurpose.TRAINING },
            { key: "MARKETING", value: BookingPurpose.MARKETING }
          ];
        } else if (type === "medical") {
          purposes = [
            { key: "HOSPITAL_VISIT", value: BookingPurpose.HOSPITAL_VISIT },
            { key: "PATIENT", value: BookingPurpose.PATIENT },
            { key: "BLOOD_BANK", value: BookingPurpose.BLOOD_BANK },
            { key: "MEDICINE", value: BookingPurpose.MEDICINE }
          ];
        } else {
          // Return all purposes
          purposes = Object.keys(BookingPurpose).map(key => ({
            key,
            value: BookingPurpose[key as keyof typeof BookingPurpose]
          }));
        }
        
        res.json(purposes);
      } catch (error: any) {
        console.error("Error fetching booking purposes:", error);
        res.status(500).json({ error: "Failed to fetch booking purposes" });
      }
    });

    // Setup authentication routes
    log("Setting up authentication routes...");
    setupAuth(app);
    log("Authentication routes setup successfully");
    
    // Initialize default user
    log("Initializing default user...");
    await storage.initializeDefaultUser();
    log("Default user initialized");
    
    // Initialize fuel price service
    log("Initializing fuel price service...");
    await initializeFuelPriceService();
    log("Fuel price service initialized successfully");

    // Register vehicle group routes
    log("Registering vehicle group routes...");
    app.use(vehicleGroupRouter);
    log("Vehicle group routes registered");

    // Add vehicle type master routes
    log("Registering vehicle type master routes...");
    app.use(vehicleTypeMasterRouter);
    log("Vehicle type master routes registered");

    // Approval workflows routes are registered later with the /api prefix

    app.use(mastersRouter); // Added mastersRouter
    
    // Add auth test routes
    app.use("/api", authTestRouter);
    log("Auth test routes registered");
    
    // Register user-employee mapping router
    log("Registering user-employee mapping routes...");
    app.use("/api/users", userEmployeeRouter);
    log("User-employee mapping routes registered");
    
    // Register fuel price update endpoint
    app.post("/api/fuel-prices/update", async (req, res) => {
      try {
        const { token } = req.body;
        
        if (token !== process.env.FUEL_PRICE_UPDATE_TOKEN) {
          return res.status(403).json({ error: "Invalid token" });
        }
        
        await updateFuelPrices();
        res.json({ message: "Fuel price update scheduled" });
      } catch (error) {
        console.error("Error scheduling fuel price update:", error);
        res.status(500).json({ error: "Failed to schedule fuel price update" });
      }
    });
    
    // Register fuel price update trigger endpoint
    app.post("/api/fuel-prices/trigger-update", async (req, res) => {
      try {
        await triggerFuelPriceUpdate();
        res.json({ message: "Manual fuel price update triggered" });
      } catch (error) {
        console.error("Error triggering fuel price update:", error);
        res.status(500).json({ error: "Failed to trigger fuel price update" });
      }
    });
    
    // Register fuel price history endpoint
    app.get("/api/fuel-prices/history", async (_req, res) => {
      try {
        const history = await getFuelPriceHistory();
        res.json(history);
      } catch (error) {
        console.error("Error fetching fuel price history:", error);
        res.status(500).json({ error: "Failed to fetch fuel price history" });
      }
    });
    
    // Register WAM fuel price scraper endpoint
    app.post("/api/fuel-prices/scrape-wam", async (_req, res) => {
      try {
        const data = await runWamFuelPriceScraper();
        res.json(data);
      } catch (error) {
        console.error("Error running WAM fuel price scraper:", error);
        res.status(500).json({ error: "Failed to run WAM fuel price scraper" });
      }
    });
    
    // Register approval workflows routes
    log("Registering approval workflows routes...");
    app.use("/api/workflows", approvalWorkflowsRouter);
    log("Approval workflows routes registered");
    
    // Vehicle Group routes are handled by vehicleGroupRouter

    // Add eco-routes router
    log("Registering eco-routes...");
    app.use(ecoRoutesRouter);
    log("Eco-routes registered");
    
    // Add booking test router for diagnostics
    log("Registering booking test router...");
    app.use("/api/booking-test", bookingTestRouter);
    log("Booking test router registered");
    
    // Register booking debug router for detailed diagnostic output
    log("Registering booking debug router...");
    app.use("/api/booking-debug", bookingDebugRouter);
    log("Booking debug router registered");

    // Register booking debug trace router for diagnosing issues
    app.use("/api/booking-debug-trace", bookingDebugTraceRouter);
    log("Booking debug trace router registered");
    
    // Register booking create trace router
    app.use("/api/booking-create-trace", bookingCreateTraceRouter);
    log("Booking create trace router registered");
    
    // Register advanced booking debug router
    app.use("/api/booking-debug-advanced", bookingDebugAdvancedRouter);
    log("Advanced booking debug router registered");
    
    // Register booking management router
    // Register booking management routes at /api/bookings/management to avoid conflicts
    app.use("/api/bookings/management", bookingManagementRouter);
    log("Booking management router registered");
    
    // Register booking creation test routes for diagnostic purposes
    app.use("/api/debug", bookingCreateTestRouter);
    log("Booking create test router registered");
    
    // Register direct test booking route (TEMPORARY DEBUG HELPER)
    app.use("/api/debug", testBookingDirectRouter);
    log("Direct test booking router registered");
    
    // Add fuel types router
    log("Registering fuel types router...");
    app.use("/api/fuel-types", fuelTypesRouter);
    
    // Register maps API routes
    log("Registering maps routes...");
    app.use("/api/maps", mapsRouter);
    log("Maps routes registered");
    
    // Register dispatch and auto-assignment routes
    log("Registering auto-dispatch routes...");
    app.use("/api/dispatch", dispatchRouter);
    log("Auto-dispatch routes registered");
    
    // Register test data generation routes
    log("Registering test data routes...");
    app.use("/api/test-data", testDataRouter);
    log("Test data routes registered");
    
    // Register trip merge routes
    log("Registering trip merge routes...");
    app.use(tripMergeRouter);
    log("Trip merge routes registered");

    // Register system configuration routes
    log("Registering system configuration routes...");
    app.use(configRouter);
    log("System configuration routes registered");
    
    // Register employee verification routes
    log("Registering employee verification routes...");
    app.use("/api/employee", employeeVerificationRouter);
    log("Employee verification routes registered");
    
    // Register auth debug routes
    log("Registering auth debug routes...");
    app.use("/api/auth-debug", authDebugRouter);
    log("Auth debug routes registered");
    
    // Register simplified booking debug routes
    log("Registering simple booking debug routes...");
    app.use("/api/debug-booking", simpleBookingDebugRouter);
    log("Simple booking debug routes registered");
    
    // Register route optimization insights routes
    try {
      log("Registering route optimization insights routes...");
      app.use("/api/route-optimization", routeInsightsRouter);
      log("Route optimization insights routes registered");
    } catch (error) {
      console.error("Failed to register route optimization routes:", error);
      log("Failed to register route optimization routes - continuing with other routes");
    }
    
    // Direct admin password reset route (for emergencies only)
    app.post("/api/debug/reset-admin-password", async (req, res) => {
      try {
        // Use bcrypt to hash the new password "Pass@123"
        const bcrypt = require('bcryptjs');
        const WORK_FACTOR = 10;
        const newPassword = "Pass@123";
        const newPasswordHash = bcrypt.hashSync(newPassword, WORK_FACTOR);
        
        // Find and update the admin user by either username or email
        const result = await db
          .update(schema.users)
          .set({ 
            password: newPasswordHash,
            reset_token: null,
            reset_token_expiry: null
          })
          .where(
            or(
              eq(schema.users.user_name, 'admin'),
              eq(schema.users.email_id, 'athomas@exlsolutions.ae')
            )
          )
          .returning();
        
        if (result.length === 0) {
          return res.status(404).json({ error: "Admin user not found" });
        }
        
        console.log(`Admin password reset successfully to: ${newPassword}`);
        return res.status(200).json({ 
          message: "Admin password reset successfully", 
          username: "admin",
          email: "athomas@exlsolutions.ae",
          password: newPassword
        });
      } catch (error) {
        console.error("Error resetting admin password:", error);
        return res.status(500).json({ error: "Failed to reset admin password" });
      }
    });
    
    // Initialize automated services
    log("Setting up automated background services...");
    
    // Initialize automated trip merging
    try {
      setupAutomatedTripMerging();
      log("Automated trip merging service initialized");
    } catch (error) {
      log(`Error initializing trip merging service: ${error}`);
    }
    
    // Initialize automated dispatch
    try {
      setupAutomatedDispatch();
      log("Automated dispatch service initialized");
    } catch (error) {
      log(`Error initializing dispatch service: ${error}`);
    }
    
    log("All background services initialized");

    // Get all vehicles - Not protected with authentication for booking operations page
    app.get("/api/vehicles", async (_req, res) => {
      try {
        console.log("[API] Fetching all vehicles");
        const vehicles = await storage.getVehicles();
        console.log(`[API] Found ${vehicles.length} vehicles`);
        res.json(vehicles);
      } catch (error: any) {
        console.error("[API] Error retrieving vehicles:", error);
        res.status(500).json({ error: "Failed to retrieve vehicles" });
      }
    });

    // Get available vehicles
    app.get("/api/vehicles/available", async (_req, res) => {
      try {
        const vehicles = await storage.getAvailableVehicles();
        res.json(vehicles);
      } catch (error: any) {
        res.status(500).json({ error: "Failed to retrieve available vehicles" });
      }
    });

    // Get all drivers
    app.get("/api/drivers", async (_req, res) => {
      try {
        const drivers = await storage.getDrivers();
        res.json(drivers);
      } catch (error: any) {
        res.status(500).json({ error: "Failed to retrieve drivers" });
      }
    });

    // Get available drivers
    app.get("/api/drivers/available", async (_req, res) => {
      try {
        const drivers = await storage.getAvailableDrivers();
        res.json(drivers);
      } catch (error: any) {
        res.status(500).json({ error: "Failed to retrieve available drivers" });
      }
    });

    // Get all bookings - Note: This endpoint is intentionally not protected with authentication
    // for the booking operations dashboard to function without login
    app.get("/api/bookings", async (_req, res) => {
      try {
        console.log("[API] Fetching all bookings");
        const bookings = await storage.getBookings();
        console.log(`[API] Found ${bookings.length} bookings`);
        res.json(bookings);
      } catch (error: any) {
        console.error("[API] Error retrieving bookings:", error);
        res.status(500).json({ error: "Failed to retrieve bookings" });
      }
    });
    
    // Get all vehicles - Similar to bookings, this is for the operations dashboard
    // and is intentionally not protected with authentication
    app.get("/api/vehicles", async (_req, res) => {
      try {
        console.log("[API] Fetching all vehicles");
        const vehicles = await storage.getVehicles();
        console.log(`[API] Found ${vehicles.length} vehicles`);
        res.json(vehicles);
      } catch (error: any) {
        console.error("[API] Error retrieving vehicles:", error);
        res.status(500).json({ error: "Failed to retrieve vehicles" });
      }
    });

    // Create a booking
    app.post("/api/bookings", async (req, res) => {
      try {
        const result = insertBookingSchema.safeParse(req.body);
        if (!result.success) {
          logBookingError("Booking validation failed", { 
            error: result.error,
            request: req.body
          });
          
          return res.status(400).json({
            error: "Invalid booking data",
            details: result.error.issues,
          });
        }

        logBookingRequest("Valid booking request received", result.data);
        
        const booking = await storage.createBooking(result.data);
        res.status(201).json(booking);
      } catch (error: any) {
        console.error("Error creating booking:", error);
        res.status(500).json({ error: "Failed to create booking" });
      }
    });

    // Assign vehicles and drivers to a booking
    app.patch("/api/bookings/:id/assign", async (req, res) => {
      try {
        const { id } = req.params;
        const { vehicleId, driverId } = req.body;

        if (!vehicleId || !driverId) {
          return res
            .status(400)
            .json({ error: "Vehicle ID and driver ID are required" });
        }

        const booking = await storage.assignBooking(
          parseInt(id),
          vehicleId,
          driverId
        );
        res.json(booking);
      } catch (error: any) {
        console.error("Error assigning booking:", error);
        res.status(500).json({ error: "Failed to assign booking" });
      }
    });

    // Update booking status
    app.patch("/api/bookings/:id/status", async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
          return res.status(400).json({ error: "Status is required" });
        }

        const booking = await storage.updateBookingStatus(parseInt(id), status);
        res.json(booking);
      } catch (error: any) {
        console.error("Error updating booking status:", error);
        res.status(500).json({ error: "Failed to update booking status" });
      }
    });

    // Add this route to delete all bookings (used for testing)
    app.delete("/api/bookings/all", async (_req, res) => {
      try {
        await storage.deleteAllBookings();
        res.json({ message: "All bookings deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting all bookings:", error);
        res.status(500).json({ error: "Failed to delete all bookings" });
      }
    });

    // Get all users
    app.get("/api/users", async (_req, res) => {
      try {
        const users = await storage.getAllUsers();
        // Remove passwords from the response
        const safeUsers = users.map(({ password, ...user }) => user);
        res.json(safeUsers);
      } catch (error: any) {
        console.error("Error retrieving users:", error);
        res.status(500).json({ error: "Failed to retrieve users" });
      }
    });

    app.post("/api/users", async (req, res) => {
      try {
        console.log("Creating user with data:", req.body);
        const result = insertUserSchema.safeParse(req.body);

        if (!result.success) {
          console.error("Invalid user data:", result.error.issues);
          return res.status(400).json({
            error: "Invalid user data",
            details: result.error.issues
          });
        }

        // Hash the password before storing
        const hashedPassword = await bcrypt.hash(result.data.password, 10);

        // Create user with hashed password
        const userData = {
          ...result.data,
          password: hashedPassword,
          full_name: `${result.data.first_name} ${result.data.last_name}`
        };

        const user = await storage.createUser(userData);
        console.log("Created user:", user);

        // Remove password from response
        const { password, ...userResponse } = user;
        res.status(201).json(userResponse);
      } catch (error: any) {
        console.error("Error creating user:", error);
        res.status(500).json({ error: "Failed to create user" });
      }
    });

    // Add this inside registerRoutes function, after the auth routes
    app.post("/api/auth/forgot-password", async (req, res) => {
      const { userName, emailId } = req.body;
      console.log('Password reset requested for:', userName, emailId);
      
      try {
        // Lookup user
        let user;
        if (userName) {
          user = await storage.getUserByUserName(userName);
        } else if (emailId) {
          user = await storage.findUserByEmail(emailId);
        } else {
          return res.status(400).json({
            error: "Either username or email is required"
          });
        }
        
        if (!user) {
          return res.status(404).json({
            error: "User not found"
          });
        }
        
        // Generate a reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        // Update user with reset token
        await storage.updateUserResetToken(user.id, resetToken, resetTokenExpiry);
        
        // Import email service
        const { sendPasswordResetEmail } = await import('./services/email-service');
        
        // Send password reset email using SendGrid
        const emailSent = await sendPasswordResetEmail(
          user.email_id,
          user.full_name || 'TripXL User',
          resetToken
        );
        
        if (!emailSent) {
          console.warn('Failed to send password reset email, but token was generated');
        }
        
        // Always return success to prevent user enumeration attacks
        res.json({
          message: "If your account exists, a password reset email has been sent to your registered email address."
        });
        
      } catch (error: any) {
        console.error('Error in forgot password:', error);
        res.status(500).json({
          error: "Failed to process password reset request",
          details: error.message
        });
      }
    });
    
    app.post("/api/auth/reset-password", async (req, res) => {
      const { token, newPassword } = req.body;
      
      try {
        if (!token || !newPassword) {
          return res.status(400).json({
            error: "Token and new password are required"
          });
        }
        
        // Find user by reset token
        const user = await storage.findUserByResetToken(token);
        
        if (!user) {
          return res.status(400).json({
            error: "Invalid or expired reset token"
          });
        }
        
        // Check if token is expired
        const now = new Date();
        if (!user.reset_token_expiry || user.reset_token_expiry < now) {
          return res.status(400).json({
            error: "Reset token has expired"
          });
        }
        
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update user password and clear reset token
        await storage.updateUserResetToken(user.id, null, null);
        await storage.updateUserPassword(user.id, hashedPassword);

        res.json({
          message: "Password reset successful"
        });

      } catch (error: any) {
        console.error('Error resetting password:', error);
        res.status(500).json({
          error: "Failed to reset password",
          details: error.message
        });
      }
    });

    log("All routes registered successfully");
    return httpServer;
  } catch (error) {
    console.error("Error registering routes:", error);
    throw error;
  }
}