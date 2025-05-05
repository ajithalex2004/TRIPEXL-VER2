import { sql } from 'drizzle-orm';
import { db } from '../db';
import { log } from '../vite';

/**
 * This script updates the bookings table by adding required columns for trip merging functionality.
 * It checks if columns exist before trying to add them to avoid errors.
 */
async function updateBookingsSchema() {
  try {
    log("Starting bookings schema update script...");
    
    // Check and add is_merged column (boolean)
    await checkAndAddColumn(
      'is_merged', 
      'boolean', 
      'ALTER TABLE bookings ADD COLUMN is_merged boolean DEFAULT false'
    );
    
    // Check and add merge_eligible column (boolean)
    await checkAndAddColumn(
      'merge_eligible', 
      'boolean', 
      'ALTER TABLE bookings ADD COLUMN merge_eligible boolean DEFAULT NULL'
    );
    
    // Check and add merged_with_booking_id column (integer)
    await checkAndAddColumn(
      'merged_with_booking_id', 
      'integer', 
      'ALTER TABLE bookings ADD COLUMN merged_with_booking_id integer DEFAULT NULL'
    );
    
    // Check and add merged_booking_ids column (text array)
    await checkAndAddColumn(
      'merged_booking_ids', 
      'text[]', 
      'ALTER TABLE bookings ADD COLUMN merged_booking_ids text[] DEFAULT \'{}\''
    );
    
    // Check and add has_merged_trips column (boolean)
    await checkAndAddColumn(
      'has_merged_trips', 
      'boolean', 
      'ALTER TABLE bookings ADD COLUMN has_merged_trips boolean DEFAULT false'
    );
    
    // Check and add trip_id column (text)
    await checkAndAddColumn(
      'trip_id', 
      'text', 
      'ALTER TABLE bookings ADD COLUMN trip_id text DEFAULT NULL'
    );
    
    // Check and add pickup_sequence column (integer)
    await checkAndAddColumn(
      'pickup_sequence', 
      'integer', 
      'ALTER TABLE bookings ADD COLUMN pickup_sequence integer DEFAULT NULL'
    );
    
    // Check and add dropoff_sequence column (integer)
    await checkAndAddColumn(
      'dropoff_sequence', 
      'integer', 
      'ALTER TABLE bookings ADD COLUMN dropoff_sequence integer DEFAULT NULL'
    );

    // Check and add pickup_zone column (text)
    await checkAndAddColumn(
      'pickup_zone', 
      'text', 
      'ALTER TABLE bookings ADD COLUMN pickup_zone text DEFAULT NULL'
    );
    
    // Check and add dropoff_zone column (text)
    await checkAndAddColumn(
      'dropoff_zone', 
      'text', 
      'ALTER TABLE bookings ADD COLUMN dropoff_zone text DEFAULT NULL'
    );
    
    log("Bookings schema update completed successfully");
  } catch (error) {
    log(`Error during bookings schema update: ${error}`);
  }
}

/**
 * Check if a column exists in the bookings table and add it if not
 */
async function checkAndAddColumn(columnName: string, dataType: string, alterSql: string): Promise<void> {
  try {
    // Check if column exists
    const checkQuery = sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'bookings'
        AND column_name = ${columnName}
      );
    `;
    
    const result = await db.execute(checkQuery);
    const exists = result.rows[0]?.exists === true;
    
    if (!exists) {
      log(`Adding column '${columnName}' (${dataType}) to bookings table...`);
      await db.execute(sql.raw(alterSql));
      log(`Column '${columnName}' added successfully`);
    } else {
      log(`Column '${columnName}' already exists in bookings table`);
    }
  } catch (error) {
    log(`Error checking/adding column '${columnName}': ${error}`);
    throw error;
  }
}

// Run the update immediately
updateBookingsSchema();

export { updateBookingsSchema };