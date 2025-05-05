import { Router } from 'express';
import { insertBookingSchema } from '@shared/schema';
import { logBookingRequest } from '../debug/booking-debug';

const bookingTestRouter = Router();

// Test endpoint to validate booking data without creating a booking
bookingTestRouter.post('/validate', (req, res) => {
  const debugId = `validate-${Date.now()}`;
  console.log(`[BOOKING-TEST] Received validation request at ${new Date().toISOString()}`);
  
  try {
    // Log detailed request information
    console.log(`[BOOKING-TEST] Request headers:`, {
      contentType: req.headers['content-type'],
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      contentLength: req.headers['content-length']
    });
    
    // Log the raw request body for debugging
    console.log(`[BOOKING-TEST] Raw request body:`, JSON.stringify(req.body, null, 2));
    
    // Log detailed booking data using our debug helper
    const requestSummary = logBookingRequest(req, debugId);
    
    // Validate the data using the booking schema
    const result = insertBookingSchema.safeParse(req.body);
    
    if (!result.success) {
      console.log(`[BOOKING-TEST] Validation errors:`, result.error.issues);
      
      // Send friendly formatted response with all validation issues
      return res.status(400).json({
        valid: false,
        errors: result.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code
        })),
        receivedData: {
          employee_id: req.body.employee_id,
          booking_type: req.body.booking_type,
          purpose: req.body.purpose,
          priority: req.body.priority,
          pickup_location: req.body.pickup_location ? {
            address: req.body.pickup_location.address,
            coordinates: req.body.pickup_location.coordinates
          } : undefined,
          dropoff_location: req.body.dropoff_location ? {
            address: req.body.dropoff_location.address,
            coordinates: req.body.dropoff_location.coordinates
          } : undefined,
          pickup_time: req.body.pickup_time,
          dropoff_time: req.body.dropoff_time
        }
      });
    }
    
    // Successfully validated
    return res.json({
      valid: true,
      message: "Booking data is valid",
      data: {
        employee_id: result.data.employee_id,
        booking_type: result.data.booking_type,
        purpose: result.data.purpose,
        priority: result.data.priority,
        pickup_location: result.data.pickup_location ? {
          address: req.body.pickup_location.address,
          coordinates: req.body.pickup_location.coordinates
        } : undefined,
        dropoff_location: result.data.dropoff_location ? {
          address: req.body.dropoff_location.address,
          coordinates: req.body.dropoff_location.coordinates
        } : undefined,
        pickup_time: result.data.pickup_time,
        dropoff_time: result.data.dropoff_time
      }
    });
  } catch (error) {
    console.error(`[BOOKING-TEST] Error processing validation request:`, error);
    return res.status(500).json({
      valid: false,
      message: "Error processing validation request",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default bookingTestRouter;