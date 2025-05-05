import { pool } from '../db';

async function createTestData() {
  console.log('Creating test bookings directly with SQL...');
  
  try {
    // Get employee ID 1 or the first available employee
    const employeeResult = await pool.query('SELECT id FROM employees LIMIT 1');
    if (employeeResult.rows.length === 0) {
      console.log('No employees found in the database. Please add at least one employee first.');
      return;
    }
    
    const employeeId = employeeResult.rows[0].id;
    console.log(`Using employee ID: ${employeeId}`);
    
    // Check existing bookings count
    const countResult = await pool.query('SELECT COUNT(*) FROM bookings');
    console.log(`Current booking count: ${countResult.rows[0].count}`);
    
    // Get all required columns from the bookings table
    const columnsResult = await pool.query(`
      SELECT column_name, is_nullable, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'bookings' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    const requiredColumns = columnsResult.rows
      .filter(col => col.is_nullable === 'NO' && col.column_default === null)
      .map(col => col.column_name);
    
    console.log(`Required columns: ${requiredColumns.join(', ')}`);
    
    // Create 10 test bookings
    for (let i = 1; i <= 10; i++) {
      // Location data
      const pickupLocation = JSON.stringify({
        address: `Dubai Marina ${i}`,
        coordinates: { 
          lat: 25.0 + Math.random() * 0.5, 
          lng: 55.0 + Math.random() * 0.5 
        }
      });
      
      const dropoffLocation = JSON.stringify({
        address: `Dubai Airport ${i}`,
        coordinates: { 
          lat: 24.0 + Math.random() * 0.5, 
          lng: 54.0 + Math.random() * 0.5 
        }
      });
      
      // Set pickup time within next 24 hours
      const pickupTime = new Date();
      pickupTime.setHours(pickupTime.getHours() + Math.floor(Math.random() * 24));
      
      // Status and priority options
      const statuses = ['confirmed', 'assigned'];
      const priorities = ['normal', 'high', 'urgent'];
      
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      
      // Generate a reference number
      const referenceNo = `BK-${new Date().getFullYear()}-${String(i).padStart(5, '0')}`;
      
      // Insert the booking with all required fields
      const insertQuery = `
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
          updated_at,
          reference_no,
          remarks,
          trip_type
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) RETURNING id
      `;
      
      const result = await pool.query(insertQuery, [
        'passenger',                     // booking_type
        `Test Booking ${i}`,             // purpose
        priority,                        // priority
        status,                          // status
        employeeId,                      // employee_id
        pickupLocation,                  // pickup_location
        dropoffLocation,                 // dropoff_location
        pickupTime.toISOString(),        // pickup_time
        new Date().toISOString(),        // created_at
        new Date().toISOString(),        // updated_at
        referenceNo,                     // reference_no
        `Test remarks for booking ${i}`, // remarks
        'single'                         // trip_type
      ]);
      
      console.log(`Created booking ${i} with ID: ${result.rows[0].id} and ref: ${referenceNo}`);
    }
    
    // Check vehicle table columns
    const vehicleColumnsResult = await pool.query(`
      SELECT column_name, is_nullable, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'vehicles' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    const requiredVehicleColumns = vehicleColumnsResult.rows
      .filter(col => col.is_nullable === 'NO' && col.column_default === null)
      .map(col => col.column_name);
    
    console.log(`Required vehicle columns: ${requiredVehicleColumns.join(', ')}`);
    
    // Create 5 test vehicles
    for (let i = 1; i <= 5; i++) {
      const currentLocation = JSON.stringify({
        address: `Dubai Location ${i}`,
        coordinates: { 
          lat: 25.0 + Math.random() * 0.5, 
          lng: 55.0 + Math.random() * 0.5 
        }
      });
      
      // Insert the vehicle
      const insertQuery = `
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
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) RETURNING id
      `;
      
      const result = await pool.query(insertQuery, [
        `UAE-TEST-${i}`,                 // vehicle_number
        `Test Vehicle ${i}`,             // name
        'Toyota',                        // make
        'Land Cruiser',                  // model
        2023,                            // year
        i <= 3 ? 'Available' : 'Busy',   // status
        `REG-TEST-${i}`,                 // registration_number
        1000,                            // load_capacity
        4,                               // passenger_capacity
        currentLocation,                 // current_location
        true,                            // is_active
        new Date().toISOString(),        // created_at
        new Date().toISOString()         // updated_at
      ]);
      
      console.log(`Created vehicle ${i} with ID: ${result.rows[0].id}`);
    }
    
    // Get final count
    const finalCount = await pool.query('SELECT COUNT(*) FROM bookings');
    const vehicleCount = await pool.query('SELECT COUNT(*) FROM vehicles');
    
    console.log(`Test data creation complete!`);
    console.log(`Final booking count: ${finalCount.rows[0].count}`);
    console.log(`Final vehicle count: ${vehicleCount.rows[0].count}`);
    
  } catch (error) {
    console.error('Error creating test data:', error);
    if (error.detail) {
      console.error('Error detail:', error.detail);
    }
  } finally {
    // Close connection
    await pool.end();
    process.exit(0);
  }
}

createTestData();