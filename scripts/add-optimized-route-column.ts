import { db } from '../db';
import { sql } from 'drizzle-orm';
import { log } from '../vite';

/**
 * This script adds the optimized_route column to the bookings table
 * Required for trip merging functionality
 */
async function addOptimizedRouteColumn() {
  try {
    log("Starting optimized_route column addition script...");
    
    // Check if the column already exists
    const checkQuery = sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'bookings'
        AND column_name = 'optimized_route'
      );
    `;
    
    const result = await db.execute(checkQuery);
    const exists = result.rows[0]?.exists === true;
    
    if (!exists) {
      log("Adding optimized_route column to bookings table...");
      
      // Add the column as a JSON field
      await db.execute(sql.raw(`
        ALTER TABLE bookings 
        ADD COLUMN optimized_route jsonb DEFAULT NULL
      `));
      
      log("optimized_route column added successfully");
    } else {
      log("optimized_route column already exists in bookings table");
    }
    
    log("Script completed successfully");
  } catch (error) {
    log(`Error adding optimized_route column: ${error}`);
  }
}

// Run the script when this file is executed
addOptimizedRouteColumn();

export { addOptimizedRouteColumn };