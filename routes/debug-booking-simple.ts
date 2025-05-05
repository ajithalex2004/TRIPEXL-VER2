import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { log } from '../vite';

const simpleBookingDebugRouter = Router();

// This is a simplified booking creation endpoint for debugging
simpleBookingDebugRouter.post('/create-simple-booking', async (req: Request, res: Response) => {
  log('[DEBUG-BOOKING] Received create simple booking request');
  console.log('[DEBUG-BOOKING] Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Validate essential fields
    const { booking_type, employee_id, pickup_location, dropoff_location, pickup_time, dropoff_time } = req.body;
    
    if (!booking_type) {
      return res.status(400).json({ error: 'Missing booking_type field' });
    }
    
    if (!employee_id) {
      return res.status(400).json({ error: 'Missing employee_id field' });
    }
    
    if (!pickup_location || !pickup_location.coordinates || !pickup_location.address) {
      return res.status(400).json({ error: 'Invalid pickup_location - must have coordinates and address' });
    }
    
    if (!dropoff_location || !dropoff_location.coordinates || !dropoff_location.address) {
      return res.status(400).json({ error: 'Invalid dropoff_location - must have coordinates and address' });
    }
    
    if (!pickup_time) {
      return res.status(400).json({ error: 'Missing pickup_time field' });
    }
    
    if (!dropoff_time) {
      return res.status(400).json({ error: 'Missing dropoff_time field' });
    }
    
    // Prepare a minimal booking object for creation
    const minimalBookingData = {
      booking_type,
      employee_id: Number(employee_id),
      pickup_location,
      dropoff_location,
      pickup_time,
      dropoff_time,
      // Default values for required fields
      purpose: req.body.purpose || 'STAFF_TRANSPORTATION',
      priority: req.body.priority || 'NORMAL',
      status: 'PENDING',
      booking_for_self: req.body.booking_for_self ?? true,
      with_driver: req.body.with_driver ?? true
    };
    
    // Log the prepared data
    log('[DEBUG-BOOKING] Prepared booking data:', JSON.stringify(minimalBookingData, null, 2));
    
    // Create the booking using the storage interface
    const booking = await storage.createBooking(minimalBookingData);
    
    log('[DEBUG-BOOKING] Booking created successfully:', booking.id.toString());
    
    // Return the created booking
    return res.status(201).json({
      success: true,
      message: 'Booking created successfully using simplified route',
      booking
    });
    
  } catch (error: any) {
    console.error('[DEBUG-BOOKING] Error creating booking:', error);
    
    // Provide detailed error information
    return res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: error.message,
      stack: error.stack
    });
  }
});

// Get route to check if the router is working
simpleBookingDebugRouter.get('/simple-booking-status', (_req, res) => {
  return res.status(200).json({
    status: 'Simple booking debug router is working',
    time: new Date().toISOString()
  });
});

export default simpleBookingDebugRouter;