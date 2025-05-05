import { db } from '../db';
import { bookings, vehicles } from '../../shared/schema';
import { sql } from 'drizzle-orm';

async function createTestData() {
  try {
    console.log('Creating simple test data...');
    
    // Get existing data counts
    const existingBookings = await db.select().from(bookings);
    const existingVehicles = await db.select().from(vehicles);
    
    console.log(`Current data: ${existingBookings.length} bookings, ${existingVehicles.length} vehicles`);
    
    // Use direct SQL insert to avoid schema mismatches
    // This will create 10 new bookings
    for (let i = 1; i <= 10; i++) {
      // Create random pickup and dropoff locations
      const pickupLocation = {
        address: `Dubai Location ${i}`,
        coordinates: { 
          lat: 25.0 + Math.random() * 0.5, 
          lng: 55.0 + Math.random() * 0.5 
        }
      };
      
      const dropoffLocation = {
        address: `Abu Dhabi Location ${i}`,
        coordinates: { 
          lat: 24.0 + Math.random() * 0.5, 
          lng: 54.0 + Math.random() * 0.5 
        }
      };
      
      // Set pickup time within next 24 hours
      const pickupTime = new Date();
      pickupTime.setHours(pickupTime.getHours() + Math.floor(Math.random() * 24));
      
      // Insert booking with direct SQL to avoid schema mismatch issues
      const res = await db.execute(sql`
        INSERT INTO bookings (
          booking_type,
          purpose,
          priority,
          status,
          employee_id,
          pickup_location,
          dropoff_location,
          pickup_time,
          created_at,
          updated_at
        ) VALUES (
          ${'passenger'},
          ${'Test Booking ' + i},
          ${['normal', 'high', 'urgent'][Math.floor(Math.random() * 3)]},
          ${'confirmed'},
          ${1}, 
          ${JSON.stringify(pickupLocation)},
          ${JSON.stringify(dropoffLocation)},
          ${pickupTime.toISOString()},
          ${new Date().toISOString()},
          ${new Date().toISOString()}
        ) RETURNING id
      `);
      
      console.log(`Created booking ${i} with ID: ${res.rows[0].id}`);
    }
    
    // Create 5 test vehicles
    for (let i = 1; i <= 5; i++) {
      const location = {
        address: `Dubai Location ${i}`,
        coordinates: { 
          lat: 25.0 + Math.random() * 0.5, 
          lng: 55.0 + Math.random() * 0.5 
        }
      };
      
      // Insert vehicle with direct SQL to avoid schema mismatch issues
      const res = await db.execute(sql`
        INSERT INTO vehicles (
          vehicle_number,
          name,
          make,
          model,
          year,
          status,
          registration_number,
          load_capacity,
          passenger_capacity,
          current_location,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          ${'UAE-TEST-' + i},
          ${'Test Vehicle ' + i},
          ${'Toyota'},
          ${'Land Cruiser'},
          ${2023},
          ${i <= 3 ? 'Available' : 'Busy'}, 
          ${'REG-TEST-' + i},
          ${1000},
          ${4},
          ${JSON.stringify(location)},
          ${true},
          ${new Date().toISOString()},
          ${new Date().toISOString()}
        ) RETURNING id
      `);
      
      console.log(`Created vehicle ${i} with ID: ${res.rows[0].id}`);
    }
    
    // Check final count
    const finalBookings = await db.select().from(bookings);
    const finalVehicles = await db.select().from(vehicles);
    
    console.log(`Test data created successfully!`);
    console.log(`Final data count: ${finalBookings.length} bookings, ${finalVehicles.length} vehicles`);
    
  } catch (error) {
    console.error('Error creating test data:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
  } finally {
    process.exit(0);
  }
}

createTestData();