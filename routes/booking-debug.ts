import { Router, Request, Response } from 'express';
import { bookingDebugManager } from '../debug/booking-debug';
import { storage } from '../storage';
import { createToken, verifyToken } from '../auth/token-service';

const bookingDebugRouter = Router();

// Get all debug sessions
bookingDebugRouter.get('/sessions', (req: Request, res: Response) => {
  try {
    const sessions = bookingDebugManager.getAllSessions();
    res.json({
      total: sessions.length,
      sessions: sessions
    });
  } catch (error) {
    console.error('Error fetching booking debug sessions:', error);
    res.status(500).json({ error: 'Failed to fetch booking debug sessions' });
  }
});

// Get a specific debug session
bookingDebugRouter.get('/sessions/:sessionId', (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId;
    const session = bookingDebugManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Debug session not found' });
    }
    
    res.json(session);
  } catch (error) {
    console.error('Error fetching booking debug session:', error);
    res.status(500).json({ error: 'Failed to fetch booking debug session' });
  }
});

// Diagnostic endpoint to test booking submission issues
bookingDebugRouter.post('/test-booking', (req: Request, res: Response) => {
  try {
    // Log the incoming test request
    console.log('[DEBUG-TEST] Received test booking request:', {
      headers: req.headers,
      body: req.body
    });
    
    // Check what fields might be missing or incorrect
    const requiredFields = [
      'employee_id', 'booking_type', 'purpose', 'priority',
      'pickup_location', 'dropoff_location', 'pickup_time', 'dropoff_time'
    ];
    
    const missingFields = requiredFields.filter(field => {
      if (field === 'pickup_location' || field === 'dropoff_location') {
        const locationValue = req.body[field];
        return !locationValue || 
               !locationValue.address || 
               !locationValue.coordinates || 
               locationValue.coordinates.lat === undefined || 
               locationValue.coordinates.lng === undefined;
      }
      return req.body[field] === undefined || req.body[field] === null || req.body[field] === '';
    });
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields,
        receivedBody: req.body
      });
    }
    
    // If all required fields are present, respond with a success message
    res.json({
      success: true,
      message: 'Test booking data looks valid',
      receivedData: {
        employee_id: req.body.employee_id,
        booking_type: req.body.booking_type,
        purpose: req.body.purpose,
        priority: req.body.priority,
        pickup_location: {
          address: req.body.pickup_location.address,
          coordinates: req.body.pickup_location.coordinates
        },
        dropoff_location: {
          address: req.body.dropoff_location.address,
          coordinates: req.body.dropoff_location.coordinates
        },
        pickup_time: req.body.pickup_time,
        dropoff_time: req.body.dropoff_time
      }
    });
  } catch (error) {
    console.error('Error in test booking endpoint:', error);
    res.status(500).json({
      error: 'Error processing test booking',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Special diagnostic endpoint to check booking data format
bookingDebugRouter.get('/format-check', async (req: Request, res: Response) => {
  try {
    console.log('[DEBUG-FORMAT] Checking booking data format');
    
    // Get all bookings
    const bookings = await storage.getBookings();
    console.log(`[DEBUG-FORMAT] Found ${bookings.length} bookings in database`);
    
    // Check data format of the first booking
    if (bookings.length > 0) {
      const sample = bookings[0];
      console.log('[DEBUG-FORMAT] Sample booking:', JSON.stringify(sample, null, 2));
      
      // Check types of important fields
      const diagnostics = {
        id: sample.id ? { value: sample.id, type: typeof sample.id } : 'missing',
        reference_no: sample.reference_no ? { value: sample.reference_no, type: typeof sample.reference_no } : 'missing',
        booking_type: sample.booking_type ? { value: sample.booking_type, type: typeof sample.booking_type } : 'missing',
        purpose: sample.purpose ? { value: sample.purpose, type: typeof sample.purpose } : 'missing',
        priority: sample.priority ? { value: sample.priority, type: typeof sample.priority } : 'missing',
        status: sample.status ? { value: sample.status, type: typeof sample.status } : 'missing',
        pickup_location: sample.pickup_location ? {
          type: typeof sample.pickup_location,
          isJson: typeof sample.pickup_location === 'string',
          hasAddress: typeof sample.pickup_location === 'object' && 'address' in sample.pickup_location,
          address: sample.pickup_location.address,
          coordinates: sample.pickup_location.coordinates
        } : 'missing',
        dropoff_location: sample.dropoff_location ? {
          type: typeof sample.dropoff_location,
          isJson: typeof sample.dropoff_location === 'string',
          hasAddress: typeof sample.dropoff_location === 'object' && 'address' in sample.dropoff_location,
          address: sample.dropoff_location.address,
          coordinates: sample.dropoff_location.coordinates
        } : 'missing',
        created_at: sample.created_at ? { 
          value: sample.created_at, 
          type: typeof sample.created_at,
          isDateObject: sample.created_at instanceof Date,
          localString: new Date(sample.created_at).toLocaleString()
        } : 'missing'
      };
      
      // Return detailed diagnostics
      res.json({
        success: true,
        count: bookings.length,
        sampleBooking: sample,
        diagnostics,
        instructions: "Use this data to fix any format issues in the frontend",
        dateExample: `To format dates, use: format(new Date("${sample.created_at}"), "MMM d, yyyy HH:mm")`
      });
    } else {
      res.json({
        success: false,
        message: 'No bookings found in database',
        count: 0
      });
    }
  } catch (error) {
    console.error('[DEBUG-FORMAT] Error:', error);
    res.status(500).json({
      error: 'Error checking booking format',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default bookingDebugRouter;