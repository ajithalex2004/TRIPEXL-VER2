import { db } from '../db';
import { bookings, vehicles } from '../../shared/schema';

async function generateTestData() {
  console.log('Generating test data...');
  
  try {
    // Check if we already have data
    const existingBookings = await db.select().from(bookings);
    const existingVehicles = await db.select().from(vehicles);
    
    if (existingBookings.length > 0) {
      console.log(`Database already has ${existingBookings.length} bookings`);
    } else {
      // Sample zones in UAE
      const pickupZones = ['Dubai Marina', 'Downtown Dubai', 'Deira', 'Jumeirah', 'Business Bay', 'Al Quoz'];
      const dropoffZones = ['Abu Dhabi City', 'Sharjah City', 'Ajman', 'Ras Al Khaimah', 'Al Ain', 'Fujairah'];
      
      // Create 15 bookings with different statuses
      const bookingData = [];
      const statusOptions = ['confirmed', 'assigned', 'in_progress', 'completed', 'cancelled'];
      const priorityOptions = ['normal', 'high', 'urgent'];
      const typeOptions = ['passenger', 'cargo', 'executive'];
      
      for (let i = 1; i <= 15; i++) {
        const pickupZone = pickupZones[Math.floor(Math.random() * pickupZones.length)];
        const dropoffZone = dropoffZones[Math.floor(Math.random() * dropoffZones.length)];
        const status = statusOptions[Math.floor(Math.random() * 2)]; // Most bookings should be 'confirmed' or 'assigned'
        const priority = priorityOptions[Math.floor(Math.random() * priorityOptions.length)];
        const bookingType = typeOptions[Math.floor(Math.random() * typeOptions.length)];
        
        // Calculate random pickup time within next 24 hours
        const pickupTime = new Date();
        pickupTime.setHours(pickupTime.getHours() + Math.floor(Math.random() * 24));
        
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
        
        const pickupLocation = dubaiLocations[Math.floor(Math.random() * dubaiLocations.length)];
        let dropoffLocation;
        do {
          dropoffLocation = dubaiLocations[Math.floor(Math.random() * dubaiLocations.length)];
        } while (dropoffLocation.address === pickupLocation.address);
        
        bookingData.push({
          booking_type: bookingType,
          purpose: `Test Booking ${i}`,
          priority: priority,
          status: status,
          pickup_location: JSON.stringify(pickupLocation),
          dropoff_location: JSON.stringify(dropoffLocation),
          pickup_zone: pickupZone,
          dropoff_zone: dropoffZone,
          pickup_time: pickupTime.toISOString(),
          is_merged: false,
          auto_dispatched: false,
          created_at: new Date().toISOString()
        });
      }
      
      const insertedBookings = await db.insert(bookings).values(bookingData).returning();
      console.log(`Created ${insertedBookings.length} test bookings`);
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
        
        vehicleData.push({
          vehicle_number: `UAE-${1000 + i}`,
          status: i <= 5 ? 'Available' : 'Busy', // 5 available, 3 busy
          current_location: JSON.stringify(location),
          last_updated: new Date().toISOString(),
          is_active: true
        });
      }
      
      const insertedVehicles = await db.insert(vehicles).values(vehicleData).returning();
      console.log(`Created ${insertedVehicles.length} test vehicles`);
    }
    
    console.log('Test data generation complete!');
    
  } catch (error) {
    console.error('Error generating test data:', error);
  } finally {
    process.exit(0);
  }
}

generateTestData();