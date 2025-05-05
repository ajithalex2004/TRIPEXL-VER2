import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { createServer } from "http";
import authRouter from "./routes/auth";
import path from "path";
import { initializeFuelPriceService } from "./services/fuel-price-service";
import { bookingDebugMiddleware } from "./debug/booking-debug";

// Add global error handlers
process.on("uncaughtException", (error) => {
  log(`UNCAUGHT EXCEPTION: ${error.message}`);
  log(error.stack || "No stack trace available");
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  log(`UNHANDLED REJECTION at ${promise}`);
  log(`Reason: ${reason}`);
  process.exit(1);
});

const app = express();

// Essential middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add booking debugging middleware
app.use(bookingDebugMiddleware);

// Serve static files from the public directory
app.use(express.static(path.join(process.cwd(), 'public')));

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// API Routes - Mount these before the catch-all route
app.use("/api/auth", authRouter);

// All other routes should serve the frontend
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }

  // For all other routes, let Vite handle it in development
  // or serve static files in production
  next();
});

// Basic error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  log(`Error handler caught: ${err.message}`);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

// Test database connection with better error handling
async function testDbConnection() {
  try {
    log("Testing database connection...");
    const result = await db.execute(sql`SELECT 1`);
    log("Database connection successful");
    return true;
  } catch (error: any) {
    log(`Database connection error: ${error.message}`);
    if (error.stack) {
      log(`Stack trace: ${error.stack}`);
    }
    return false;
  }
}

// Initialize server with proper error handling
async function initializeServer() {
  try {
    log("Starting application initialization...");

    // Test database connection first
    log("Testing database connection...");
    const dbConnected = await testDbConnection();
    if (!dbConnected) {
      throw new Error("Failed to connect to database");
    }
    log("Database connection successful");
    
    // Initialize fuel price service
    log("Initializing fuel price service...");
    await initializeFuelPriceService();
    log("Fuel price service initialized successfully");

    // Create HTTP server first
    log("Creating HTTP server...");
    const server = createServer(app);
    log("HTTP server created");

    // Register API routes
    log("Registering API routes...");
    await registerRoutes(app);
    log("API routes registered successfully");

    // Set up Vite or static serving
    if (app.get("env") === "development") {
      log("Setting up Vite for development...");
      await setupVite(app, server);
      log("Vite setup complete");
    } else {
      log("Setting up static serving for production...");
      serveStatic(app);
      log("Static serving setup complete");
    }

    // Bind to 0.0.0.0 to be accessible from outside
    // Try different ports sequentially if the first one is in use
    const preferredPorts = [5000, 5001, 5002, 5003, 5004, 5005];
    const port = process.env.PORT || preferredPorts[0];
    log(`Attempting to start server on port ${port}...`);

    // Create a function to try each port in sequence
    const tryPort = (portIndex = 0) => {
      if (portIndex >= preferredPorts.length) {
        throw new Error("All ports are in use. Cannot start server.");
      }
      
      const currentPort = process.env.PORT || preferredPorts[portIndex];
      log(`Trying to bind to port ${currentPort}...`);
      
      server.listen(Number(currentPort), "0.0.0.0")
        .on('listening', () => {
          log(`Server successfully started and listening on port ${currentPort}`);
          log(`Server is accessible at http://localhost:${currentPort}`);
        })
        .on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            log(`Port ${currentPort} is already in use. Trying next port...`);
            // Close current server attempt
            server.close();
            // Try next port
            tryPort(portIndex + 1);
          } else {
            throw err;
          }
        });
    };
    
    // Start trying ports
    tryPort();

    return server;
  } catch (error: any) {
    log(`Fatal error during startup: ${error.message}`);
    if (error.stack) {
      log(`Stack trace: ${error.stack}`);
    }
    process.exit(1);
  }
}

// Start the server
initializeServer().catch((error) => {
  log(`Failed to initialize server: ${error.message}`);
  process.exit(1);
});