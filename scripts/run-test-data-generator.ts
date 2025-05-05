import { db } from '../db';
import { bookings, vehicles, employees, users } from '../../shared/schema';

async function generateTestData() {
  try {
    console.log('Generating test data...');
    
    // First check if we have the necessary employees in the database
    let employeeId = 1; // Default employee ID
    const existingEmployees = await db.select().from(employees);
    
    if (existingEmployees.length === 0) {
      console.log('No employees found, checking for users...');
      // Check for users
      const existingUsers = await db.select().from(users);
      
      if (existingUsers.length > 0) {
        console.log(`Found ${existingUsers.length} users, will use first user for bookings`);
        // We'll use the first user's ID for our bookings
        
        // Create a simple employee record linked to the first user
        try {
          const [employee] = await db.insert(employees).values({
            employee_id: 99901,
            employee_name: 'Test Employee',
            email_id: existingUsers[0].email_id,
            mobile_number: existingUsers[0].mobile_number || '+971501234567',
            designation: 'Staff',
            hierarchy_level: 'Level 1',
            region: 'Dubai',
            department: 'Operations',
            unit: 'Transport',
            user_id: existingUsers[0].id,
            is_active: true
          }).returning();
          
          if (employee) {
            employeeId = employee.id;
            console.log(`Created test employee with ID: ${employeeId}`);
          }
        } catch (err) {
          console.error('Error creating test employee:', err);
        }
      } else {
        console.log('No users found, will skip employee-dependent operations');
      }
    } else {
      console.log(`Found ${existingEmployees.length} employees, will use first employee for bookings`);
      employeeId = existingEmployees[0].id;
    }
    
    // Check if we already have data
    const existingBookings = await db.select().from(bookings);
    const existingVehicles = await db.select().from(vehicles);
    
    let bookingsCount = existingBookings.length;
    let vehiclesCount = existingVehicles.length;
    
    if (existingBookings.length > 0) {
      console.log(`Database already has ${existingBookings.length} bookings`);
    } else {
      // Create 15 bookings with different statuses
      const bookingData = [];
      const statusOptions = ['confirmed', 'assigned'];
      const priorityOptions = ['normal', 'high', 'urgent'];
      const typeOptions = ['passenger', 'cargo', 'executive'];
      
      // Dubai locations with coordinates
      const dubaiLocations = [
        {
          address: '1 Sheikh Mohammed bin Rashid Blvd, Downtown Dubai',
          coordinates: { lat: 25.197197, lng: 55.274376 }
        },
        {
          address: 'Dubai Marina, Dubai',
          coordinates: { lat: 25.076649, lng: 55.132568 }
        },
        {
          address: 'Jumeirah Beach Residence, Dubai',
          coordinates: { lat: 25.079327, lng: 55.134445 }
        },
        {
          address: 'Dubai International Airport, Dubai',
          coordinates: { lat: 25.252777, lng: 55.365421 }
        },
        {
          address: 'Mall of the Emirates, Al Barsha, Dubai',
          coordinates: { lat: 25.116916, lng: 55.200494 }
        },
        {
          address: 'Ibn Battuta Mall, Dubai',
          coordinates: { lat: 25.046922, lng: 55.111233 }
        }
      ];
      
      for (let i = 1; i <= 15; i++) {
        const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];
        const priority = priorityOptions[Math.floor(Math.random() * priorityOptions.length)];
        const bookingType = typeOptions[Math.floor(Math.random() * typeOptions.length)];
        
        // Calculate random pickup time within next 24 hours
        const pickupTime = new Date();
        pickupTime.setHours(pickupTime.getHours() + Math.floor(Math.random() * 24));
        
        const pickupLocation = dubaiLocations[Math.floor(Math.random() * dubaiLocations.length)];
        let dropoffLocation;
        do {
          dropoffLocation = dubaiLocations[Math.floor(Math.random() * dubaiLocations.length)];
        } while (dropoffLocation.address === pickupLocation.address);
        
        // Insert with the employee_id we found or created
        // Only include fields that actually exist in the bookings table
        bookingData.push({
          booking_type: bookingType,
          purpose: `Test Booking ${i}`,
          priority: priority,
          status: status,
          employee_id: employeeId,
          pickup_location: pickupLocation,
          dropoff_location: dropoffLocation,
          pickup_time: pickupTime,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
      
      try {
        if (bookingData.length > 0) {
          const insertedBookings = await db.insert(bookings).values(bookingData).returning();
          bookingsCount = insertedBookings.length;
          console.log(`Created ${insertedBookings.length} test bookings`);
        } else {
          console.log('Skipping booking creation due to missing prerequisite data');
        }
      } catch (err) {
        console.error('Error inserting bookings:', err);
        console.error('Error details:', err instanceof Error ? err.message : String(err));
      }
    }
    
    if (existingVehicles.length > 0) {
      console.log(`Database already has ${existingVehicles.length} vehicles`);
    } else {
      // Create 8 vehicles
      const vehicleData = [];
      
      const dubaiLocations = [
        {
          address: 'Jumeirah Beach Road, Dubai',
          coordinates: { lat: 25.2192, lng: 55.2471 }
        },
        {
          address: 'Dubai Silicon Oasis, Dubai',
          coordinates: { lat: 25.1276, lng: 55.3908 }
        },
        {
          address: 'Dubai Healthcare City, Dubai',
          coordinates: { lat: 25.2362, lng: 55.3272 }
        },
        {
          address: 'Al Wasl Road, Dubai',
          coordinates: { lat: 25.1877, lng: 55.2533 }
        }
      ];
      
      for (let i = 1; i <= 8; i++) {
        const location = dubaiLocations[Math.floor(Math.random() * dubaiLocations.length)];
        
        // All required fields for vehicles table
        vehicleData.push({
          vehicle_number: `UAE-${1000 + i}`,
          name: `Test Vehicle ${i}`,
          make: 'Toyota',
          model: 'Land Cruiser',
          year: 2023,
          status: i <= 5 ? 'Available' : 'Busy', // 5 available, 3 busy
          registration_number: `REG-${2000 + i}`,
          load_capacity: 1000, // kg
          passenger_capacity: 4,
          current_location: location,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
      
      try {
        const insertedVehicles = await db.insert(vehicles).values(vehicleData).returning();
        vehiclesCount = insertedVehicles.length;
        console.log(`Created ${insertedVehicles.length} test vehicles`);
      } catch (err) {
        console.error('Error inserting vehicles:', err);
        console.error('Error details:', err instanceof Error ? err.message : String(err));
      }
    }
    
    console.log('Test data generation complete!');
    console.log({
      bookings: bookingsCount,
      vehicles: vehiclesCount
    });
    
  } catch (error) {
    console.error('Error generating test data:', error);
  } finally {
    process.exit(0);
  }
}

generateTestData();