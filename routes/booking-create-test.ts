import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { validateToken } from '../middleware/auth';
import { insertBookingSchema } from '@shared/schema';

const bookingCreateTestRouter = Router();

// Debug endpoint for testing booking creation directly
bookingCreateTestRouter.post('/test-booking-create', async (req: Request, res: Response) => {
  try {
    console.log('[BOOKING-CREATE-TEST] Request received to test booking creation');
    console.log('[BOOKING-CREATE-TEST] Request body:', JSON.stringify(req.body, null, 2));
    
    // Prepare a simple booking object for testing
    const testBooking = {
      employee_id: 1, // Using a known employee ID that exists
      booking_type: 'passenger',
      purpose: 'Testing',
      priority: 'HIGH',
      pickup_location: {
        address: 'Test Pickup Location',
        coordinates: { lat: 25.1234, lng: 55.1234 }
      },
      dropoff_location: {
        address: 'Test Dropoff Location',
        coordinates: { lat: 25.5678, lng: 55.5678 }
      },
      reference_no: `TEST-${Date.now()}`
    };
    
    console.log('[BOOKING-CREATE-TEST] Creating test booking with data:', JSON.stringify(testBooking, null, 2));
    
    // Create the booking using the storage interface directly
    const newBooking = await storage.createBooking(testBooking);
    
    console.log('[BOOKING-CREATE-TEST] Test booking created successfully:', JSON.stringify(newBooking, null, 2));
    
    return res.status(201).json({
      success: true,
      message: 'Test booking created successfully',
      booking: newBooking
    });
  } catch (error: any) {
    console.error('[BOOKING-CREATE-TEST] Error creating test booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create test booking',
      error: error.message
    });
  }
});

// Debug endpoint for direct database query
bookingCreateTestRouter.get('/booking-database-check', async (req: Request, res: Response) => {
  try {
    console.log('[BOOKING-DB-CHECK] Checking booking database connection');
    
    // Get all bookings to verify the database connection
    const bookings = await storage.getBookings();
    
    console.log(`[BOOKING-DB-CHECK] Successfully retrieved ${bookings.length} bookings from database`);
    
    return res.status(200).json({
      success: true,
      message: `Successfully retrieved ${bookings.length} bookings from database`,
      bookings: bookings.map(b => ({
        id: b.id,
        reference_no: b.reference_no,
        employee_id: b.employee_id,
        status: b.status,
        created_at: b.created_at
      }))
    });
  } catch (error: any) {
    console.error('[BOOKING-DB-CHECK] Database error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check booking database',
      error: error.message
    });
  }
});

export default bookingCreateTestRouter;