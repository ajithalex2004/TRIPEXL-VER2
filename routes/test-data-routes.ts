import { Router, Request, Response } from 'express';
import { db } from '../db';
import { bookings, vehicles } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { log } from '../vite';
import path from 'path';
import { spawn } from 'child_process';

const router = Router();

/**
 * Route to generate test bookings and vehicles for demonstration
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    log('Generating test bookings and vehicles...');
    
    // Run the script as a separate process to avoid stopping on errors
    const scriptPath = path.join(__dirname, '../scripts/generate-test-bookings.ts');
    const process = spawn('npx', ['tsx', scriptPath], { stdio: 'inherit' });
    
    process.on('close', (code) => {
      if (code === 0) {
        log('Test data generation script completed successfully');
        res.status(200).json({ success: true, message: 'Test bookings and vehicles generated successfully' });
      } else {
        log('Test data generation script failed');
        res.status(500).json({ success: false, message: 'Failed to generate test data' });
      }
    });
    
    process.on('error', (error) => {
      log(`Error running test data script: ${error.message}`);
      res.status(500).json({ success: false, message: `Error running script: ${error.message}` });
    });
    
  } catch (error) {
    log(`Error generating test data: ${error}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate test data', 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

/**
 * Route to clear all test data (for cleanup)
 */
router.post('/clear', async (req: Request, res: Response) => {
  try {
    log('Clearing all test bookings and vehicles...');
    
    // Clear all bookings
    await db.delete(bookings);
    
    // Clear all vehicles
    await db.delete(vehicles);
    
    res.status(200).json({ success: true, message: 'All bookings and vehicles cleared successfully' });
  } catch (error) {
    log(`Error clearing test data: ${error}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to clear test data', 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

/**
 * Route to get test data status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Count bookings and vehicles
    const bookingCount = await db.select({ count: bookings.id }).from(bookings);
    const vehicleCount = await db.select({ count: vehicles.vehicle_number }).from(vehicles);
    
    res.status(200).json({
      success: true,
      bookings: bookingCount[0]?.count || 0,
      vehicles: vehicleCount[0]?.count || 0
    });
  } catch (error) {
    log(`Error getting test data status: ${error}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get test data status', 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

export const testDataRouter = router;