import { Router, Request, Response } from 'express';
import { storage } from '../storage';

export const testBookingDirectRouter = Router();

// Direct booking creation test endpoint (bypasses validation)
testBookingDirectRouter.get('/create-test-booking', async (req: Request, res: Response) => {
  try {
    console.log('ℹ️ Attempting to create test booking with direct storage call');
    
    // Using a known employee ID that exists in the database
    // Create date objects with explicit date and time values
    const now = new Date();
    const later = new Date(now.getTime() + 3600000); // 1 hour later
    
    console.log('Current time (for pickup):', now.toISOString());
    console.log('Later time (for dropoff):', later.toISOString());
    
    const testBooking = {
      employee_id: 10, // Using employee ID that exists
      booking_type: 'passenger',
      purpose: 'Direct Test',
      priority: 'HIGH',
      pickup_location: {
        address: 'Test Direct Pickup',
        coordinates: { lat: 25.1234, lng: 55.1234 }
      },
      dropoff_location: {
        address: 'Test Direct Dropoff',
        coordinates: { lat: 25.5678, lng: 55.5678 }
      },
      // Using various date formats for testing
      pickup_time: now, // Use Date object directly
      dropoff_time: later, // Use Date object
      reference_no: `DIRECT-${Date.now()}`
    };
    
    // Add additional debugging for date formats
    console.log('[DATE DEBUG] pickup_time as object:', testBooking.pickup_time);
    console.log('[DATE DEBUG] pickup_time as ISO string:', testBooking.pickup_time.toISOString());
    console.log('[DATE DEBUG] pickup_time constructor name:', testBooking.pickup_time.constructor.name);
    console.log('[DATE DEBUG] dropoff_time as object:', testBooking.dropoff_time);
    console.log('[DATE DEBUG] dropoff_time as ISO string:', testBooking.dropoff_time.toISOString());
    console.log('[DATE DEBUG] dropoff_time constructor name:', testBooking.dropoff_time.constructor.name);
    
    console.log('📝 Test booking data:', JSON.stringify(testBooking, null, 2));
    
    // Create the booking directly using storage
    const result = await storage.createBooking(testBooking);
    console.log('✅ Test booking created successfully:', result);
    
    return res.json({
      success: true,
      message: 'Test booking created successfully',
      booking: result
    });
  } catch (error: any) {
    console.error('❌ Error creating test booking:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to create test booking',
      error: error.message
    });
  }
});

// Test endpoint for creating bookings with explicit date/time values
testBookingDirectRouter.post('/create-with-times', async (req: Request, res: Response) => {
  try {
    console.log('ℹ️ Attempting to create test booking with explicit date/time values');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    // Extract the pickup and dropoff times from request body or use defaults
    let pickupTime = req.body.pickup_time ? new Date(req.body.pickup_time) : new Date();
    let dropoffTime = req.body.dropoff_time ? new Date(req.body.dropoff_time) : new Date(pickupTime.getTime() + 3600000);
    
    // Validate that we have proper Date objects
    if (isNaN(pickupTime.getTime())) {
      console.error(`Invalid pickup_time: ${req.body.pickup_time}`);
      pickupTime = new Date();
    }
    
    if (isNaN(dropoffTime.getTime())) {
      console.error(`Invalid dropoff_time: ${req.body.dropoff_time}`);
      dropoffTime = new Date(pickupTime.getTime() + 3600000);
    }
    
    console.log('Using pickup time:', pickupTime.toISOString());
    console.log('Using dropoff time:', dropoffTime.toISOString());
    
    const testBooking = {
      employee_id: 10, // Using employee ID that exists
      booking_type: 'passenger',
      purpose: 'Date Test',
      priority: 'HIGH',
      pickup_location: {
        address: 'Time Test Pickup',
        coordinates: { lat: 25.1234, lng: 55.1234 }
      },
      dropoff_location: {
        address: 'Time Test Dropoff',
        coordinates: { lat: 25.5678, lng: 55.5678 }
      },
      pickup_time: pickupTime,
      dropoff_time: dropoffTime,
      reference_no: `TIME-TEST-${Date.now()}`
    };
    
    // Add detailed debug logging for the date fields
    console.log('[DATE DEBUG] pickup_time type:', typeof testBooking.pickup_time);
    console.log('[DATE DEBUG] pickup_time value:', testBooking.pickup_time);
    console.log('[DATE DEBUG] pickup_time ISO:', testBooking.pickup_time.toISOString());
    
    console.log('[DATE DEBUG] dropoff_time type:', typeof testBooking.dropoff_time);
    console.log('[DATE DEBUG] dropoff_time value:', testBooking.dropoff_time);
    console.log('[DATE DEBUG] dropoff_time ISO:', testBooking.dropoff_time.toISOString());
    
    console.log('📝 Test booking data:', JSON.stringify(testBooking, null, 2));
    
    // Create the booking
    const result = await storage.createBooking(testBooking);
    
    // Check if the dates are saved correctly in the result
    console.log('[DATE RESULT] pickup_time in result:', result.pickup_time);
    console.log('[DATE RESULT] dropoff_time in result:', result.dropoff_time);
    
    return res.json({
      success: true,
      message: 'Test booking created with explicit times',
      original: {
        pickup_time: pickupTime.toISOString(),
        dropoff_time: dropoffTime.toISOString()
      },
      booking: result
    });
  } catch (error: any) {
    console.error('❌ Error creating test booking with times:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to create test booking with times',
      error: error.message
    });
  }
});