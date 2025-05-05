import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { validateToken } from '../middleware/auth';
import { insertBookingSchema } from '@shared/schema';
import { db } from '../db';

const bookingManagementRouter = Router();

// Apply authentication middleware to all routes
bookingManagementRouter.use(validateToken);

// Create a booking with dedicated endpoint
bookingManagementRouter.post('/create', async (req: Request, res: Response) => {
  try {
    console.log('[BOOKING-CREATE] Request received to create a booking');
    console.log('[BOOKING-CREATE] Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('[BOOKING-CREATE] Request body:', JSON.stringify(req.body, null, 2));
    
    // Check authentication
    const userId = req.user?.userId;
    if (!userId) {
      console.log('[BOOKING-CREATE] Authentication failed');
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
    // Validate request body
    console.log('[BOOKING-CREATE] Validating request body against schema...');
    const validationResult = insertBookingSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.log('[BOOKING-CREATE] Validation failed:', validationResult.error);
      console.log('[BOOKING-CREATE] Validation errors:', JSON.stringify(validationResult.error.errors, null, 2));
      return res.status(400).json({
        success: false,
        message: 'Invalid booking data',
        errors: validationResult.error.errors
      });
    }
    
    console.log('[BOOKING-CREATE] Validation successful');
    const bookingData = validationResult.data;
    console.log('[BOOKING-CREATE] Parsed booking data:', JSON.stringify(bookingData, null, 2));
    
    // Generate a reference number if not provided
    if (!bookingData.reference_no) {
      const timestamp = Date.now();
      bookingData.reference_no = `BK${timestamp}${Math.floor(Math.random() * 1000)}`;
    }
    
    console.log('[BOOKING-CREATE] Creating booking with data:', JSON.stringify(bookingData, null, 2));
    
    // Create the booking
    const newBooking = await storage.createBooking(bookingData);
    
    console.log('[BOOKING-CREATE] Booking created successfully with ID:', newBooking.id);
    
    return res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking: newBooking
    });
  } catch (error: any) {
    console.error('[BOOKING-CREATE] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: error.message
    });
  }
});

// Delete all bookings
bookingManagementRouter.delete('/delete-all', async (req: Request, res: Response) => {
  try {
    console.log('[BOOKINGS-DELETE-ALL] Attempting to delete all bookings');
    
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Fetch all bookings first to get the count
    const allBookings = await storage.getBookings();
    const count = allBookings.length;
    
    // Delete all bookings from the database
    await storage.deleteAllBookings();
    
    console.log(`[BOOKINGS-DELETE-ALL] Successfully deleted ${count} bookings`);
    
    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${count} bookings`,
      deletedCount: count
    });
  } catch (error: any) {
    console.error('[BOOKINGS-DELETE-ALL] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete bookings',
      error: error.message
    });
  }
});

export default bookingManagementRouter;