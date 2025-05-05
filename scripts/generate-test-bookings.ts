import { db } from '../db';
import { sql } from 'drizzle-orm';
import { employees, bookings, vehicles } from '../../shared/schema';
import { format, addHours, addMinutes } from 'date-fns';

/**
 * This script generates test bookings and vehicles for demonstration
 * of the booking operations page, including auto dispatch and trip merging.
 */
async function generateTestData() {
  // First, find the first employee in the database to use as booking creator
  const [employee] = await db.select().from(employees).limit(1);
  
  if (!employee) {
    console.log('No employees found in the database. Please create at least one employee first.');
    return;
  }

  // Generate random reference numbers
  const generateRefNumber = () => {
    return `BK-${Math.floor(Math.random() * 900000) + 100000}`;
  };

  // Generate random coordinates near Dubai
  const generateDubaiCoordinates = () => {
    // Dubai coordinates: 25.276987, 55.296249
    // Add some random variation
    const lat = 25.276987 + (Math.random() - 0.5) * 0.1;
    const lng = 55.296249 + (Math.random() - 0.5) * 0.1;
    return { lat, lng };
  };

  // Generate pickup and dropoff locations in Dubai
  const dubaiLocations = [
    { name: 'Dubai Mall', address: 'Dubai Mall, Downtown Dubai, UAE', zone: 'Downtown' },
    { name: 'Mall of the Emirates', address: 'Mall of the Emirates, Al Barsha, Dubai, UAE', zone: 'Al Barsha' },
    { name: 'Dubai Marina', address: 'Dubai Marina, Dubai, UAE', zone: 'Marina' },
    { name: 'Burj Khalifa', address: 'Burj Khalifa, Downtown Dubai, UAE', zone: 'Downtown' },
    { name: 'Palm Jumeirah', address: 'Palm Jumeirah, Dubai, UAE', zone: 'Palm Jumeirah' },
    { name: 'Dubai International Airport', address: 'Dubai International Airport, Dubai, UAE', zone: 'Airport' },
    { name: 'Jumeirah Beach', address: 'Jumeirah Beach, Dubai, UAE', zone: 'Jumeirah' },
    { name: 'Al Quoz', address: 'Al Quoz, Dubai, UAE', zone: 'Al Quoz' },
    { name: 'Business Bay', address: 'Business Bay, Dubai, UAE', zone: 'Business Bay' },
    { name: 'Deira City Centre', address: 'Deira City Centre, Deira, Dubai, UAE', zone: 'Deira' }
  ];

  // Create priorities for bookings 
  const priorities = ['low', 'medium', 'high', 'urgent'];
  const bookingTypes = ['passenger', 'freight', 'official', 'ambulance'];
  const purposes = ['business', 'personal', 'emergency', 'delivery', 'pick-up', 'shuttle'];
  
  // Create 10 test bookings
  console.log('Generating test bookings...');
  
  // Generate bookings with similar pickup/dropoff zones for testing trip merging
  const bookingData = [];
  
  // Group 1: Downtown to Airport (mergeable group, similar pickup times)
  for (let i = 0; i < 3; i++) {
    const pickupTime = new Date();
    // Make pickup times within 15 minutes of each other
    pickupTime.setMinutes(pickupTime.getMinutes() + i * 5);
    
    bookingData.push({
      reference_no: generateRefNumber(),
      employee_id: employee.id,
      booking_type: 'passenger',
      purpose: 'business',
      priority: 'medium',
      status: 'confirmed',
      pickup_location: JSON.stringify({
        address: dubaiLocations[3].address, // Burj Khalifa (Downtown)
        coordinates: generateDubaiCoordinates(),
        name: dubaiLocations[3].name
      }),
      pickup_zone: dubaiLocations[3].zone,
      dropoff_location: JSON.stringify({
        address: dubaiLocations[5].address, // Dubai Airport
        coordinates: generateDubaiCoordinates(),
        name: dubaiLocations[5].name
      }),
      dropoff_zone: dubaiLocations[5].zone,
      pickup_time: pickupTime.toISOString(),
      is_merged: false,
      auto_dispatched: false,
      created_at: new Date().toISOString()
    });
  }
  
  // Group 2: Marina to Palm Jumeirah (mergeable group, similar pickup times)
  for (let i = 0; i < 2; i++) {
    const pickupTime = new Date();
    // Make pickup times within 10 minutes of each other
    pickupTime.setMinutes(pickupTime.getMinutes() + 30 + i * 5);
    
    bookingData.push({
      reference_no: generateRefNumber(),
      employee_id: employee.id,
      booking_type: 'passenger',
      purpose: 'business',
      priority: 'high',
      status: 'confirmed',
      pickup_location: JSON.stringify({
        address: dubaiLocations[2].address, // Dubai Marina
        coordinates: generateDubaiCoordinates(),
        name: dubaiLocations[2].name
      }),
      pickup_zone: dubaiLocations[2].zone,
      dropoff_location: JSON.stringify({
        address: dubaiLocations[4].address, // Palm Jumeirah
        coordinates: generateDubaiCoordinates(),
        name: dubaiLocations[4].name
      }),
      dropoff_zone: dubaiLocations[4].zone,
      pickup_time: pickupTime.toISOString(),
      is_merged: false,
      auto_dispatched: false,
      created_at: new Date().toISOString()
    });
  }
  
  // Add some individual bookings with different zones
  for (let i = 0; i < 5; i++) {
    const pickupIndex = i % dubaiLocations.length;
    const dropoffIndex = (i + 3) % dubaiLocations.length;
    const pickupTime = new Date();
    // Space out individual bookings
    pickupTime.setHours(pickupTime.getHours() + 1 + i);
    
    bookingData.push({
      reference_no: generateRefNumber(),
      employee_id: employee.id,
      booking_type: bookingTypes[i % bookingTypes.length],
      purpose: purposes[i % purposes.length],
      priority: priorities[i % priorities.length],
      status: 'confirmed',
      pickup_location: JSON.stringify({
        address: dubaiLocations[pickupIndex].address,
        coordinates: generateDubaiCoordinates(),
        name: dubaiLocations[pickupIndex].name
      }),
      pickup_zone: dubaiLocations[pickupIndex].zone,
      dropoff_location: JSON.stringify({
        address: dubaiLocations[dropoffIndex].address,
        coordinates: generateDubaiCoordinates(),
        name: dubaiLocations[dropoffIndex].name
      }),
      dropoff_zone: dubaiLocations[dropoffIndex].zone,
      pickup_time: pickupTime.toISOString(),
      is_merged: false,
      auto_dispatched: false,
      created_at: new Date().toISOString()
    });
  }

  // Insert bookings using raw SQL to handle json fields and maintain field compatibility
  for (const booking of bookingData) {
    await db.execute(sql`
      INSERT INTO bookings (
        reference_no, 
        employee_id, 
        booking_type, 
        purpose, 
        priority, 
        status, 
        pickup_location, 
        pickup_zone, 
        dropoff_location, 
        dropoff_zone, 
        pickup_time, 
        is_merged, 
        auto_dispatched, 
        created_at
      ) VALUES (
        ${booking.reference_no}, 
        ${booking.employee_id}, 
        ${booking.booking_type}, 
        ${booking.purpose}, 
        ${booking.priority}, 
        ${booking.status}, 
        ${booking.pickup_location}::jsonb, 
        ${booking.pickup_zone}, 
        ${booking.dropoff_location}::jsonb, 
        ${booking.dropoff_zone}, 
        ${booking.pickup_time}, 
        ${booking.is_merged}, 
        ${booking.auto_dispatched}, 
        ${booking.created_at}
      )
    `);
  }
  console.log(`Successfully created ${bookingData.length} test bookings`);

  // Generate test vehicles
  console.log('Generating test vehicles...');
  const vehicleTypes = ['Sedan', 'SUV', 'Van', 'Truck', 'Bus'];
  const vehicleData = [];

  // Create 5 test vehicles with different statuses
  for (let i = 0; i < 5; i++) {
    const vehicleNumber = `VEH-${1000 + i}`;
    const status = i < 3 ? 'Available' : 'In Transit';
    
    vehicleData.push({
      vehicle_number: vehicleNumber,
      name: `${vehicleTypes[i]} ${i + 1}`,
      make: 'Toyota',
      model: vehicleTypes[i],
      year: 2023,
      status: status,
      current_location: JSON.stringify({
        address: dubaiLocations[i].address,
        coordinates: generateDubaiCoordinates(),
        name: dubaiLocations[i].name
      }),
      driver_name: `Driver ${i + 1}`,
      last_updated: new Date().toISOString(),
      is_active: true
    });
  }

  // Insert vehicles using raw SQL to handle json fields and maintain field compatibility
  for (const vehicle of vehicleData) {
    await db.execute(sql`
      INSERT INTO vehicles (
        vehicle_number, 
        name, 
        make, 
        model, 
        year, 
        status, 
        current_location, 
        driver_name, 
        last_updated, 
        is_active
      ) VALUES (
        ${vehicle.vehicle_number}, 
        ${vehicle.name}, 
        ${vehicle.make}, 
        ${vehicle.model}, 
        ${vehicle.year}, 
        ${vehicle.status}, 
        ${vehicle.current_location}::jsonb, 
        ${vehicle.driver_name}, 
        ${vehicle.last_updated}, 
        ${vehicle.is_active}
      )
    `);
  }
  console.log(`Successfully created ${vehicleData.length} test vehicles`);

  console.log('Test data generation complete!');
}

// Execute the function
generateTestData()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error generating test data:', error);
    process.exit(1);
  });