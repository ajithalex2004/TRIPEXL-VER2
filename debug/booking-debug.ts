/**
 * Debug helper for booking API requests
 * This module helps diagnose booking creation issues by providing detailed logging
 */
import { Request, Response, NextFunction } from 'express';

// Booking debug session manager
class BookingDebugManager {
  private sessions: Map<string, any> = new Map();
  
  startSession(req: Request): string {
    const debugId = Date.now().toString();
    this.sessions.set(debugId, {
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      headers: req.headers,
      body: req.body, 
      status: 'started'
    });
    
    console.log(`[BOOKING-${debugId}] Started new debug session`);
    return debugId;
  }
  
  updateSession(debugId: string, data: any) {
    if (!this.sessions.has(debugId)) {
      console.log(`[BOOKING-${debugId}] Warning: Trying to update non-existent session`);
      return;
    }
    
    const session = this.sessions.get(debugId);
    this.sessions.set(debugId, {...session, ...data});
  }
  
  completeSession(debugId: string, status: 'success' | 'error', result: any) {
    if (!this.sessions.has(debugId)) {
      console.log(`[BOOKING-${debugId}] Warning: Trying to complete non-existent session`);
      return;
    }
    
    const session = this.sessions.get(debugId);
    this.sessions.set(debugId, {
      ...session, 
      status,
      result,
      completed_at: new Date().toISOString()
    });
    
    console.log(`[BOOKING-${debugId}] Session completed with status: ${status}`);
  }
  
  getSession(debugId: string) {
    return this.sessions.get(debugId);
  }
  
  getAllSessions() {
    return Array.from(this.sessions.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
  }
  
  cleanupOldSessions() {
    // Remove sessions older than 24 hours
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    Array.from(this.sessions.keys()).forEach(id => {
      const session = this.sessions.get(id);
      const sessionTime = new Date(session.timestamp).getTime();
      
      if (now - sessionTime > oneDayMs) {
        this.sessions.delete(id);
      }
    });
  }
}

export const bookingDebugManager = new BookingDebugManager();

/**
 * Express middleware to add debugging for booking API requests
 */
export const bookingDebugMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Check if this is a booking-related API request
  if (req.path.includes('/api/bookings') && req.method === 'POST') {
    const debugId = bookingDebugManager.startSession(req);
    console.log(`[BOOKING-${debugId}] New booking request received: ${req.path}`);
    
    // Log the request details
    const requestInfo = logBookingRequest(req, debugId);
    bookingDebugManager.updateSession(debugId, { requestInfo });
    
    // Add debug ID to response headers for tracking
    res.setHeader('X-Booking-Debug-ID', debugId);
    
    // Capture the original send method to intercept the response
    const originalSend = res.send;
    res.send = function(body) {
      // Restore the original method
      res.send = originalSend;
      
      // Log the response
      try {
        const responseBody = typeof body === 'string' ? JSON.parse(body) : body;
        const wasSuccessful = res.statusCode >= 200 && res.statusCode < 300;
        
        bookingDebugManager.completeSession(
          debugId, 
          wasSuccessful ? 'success' : 'error',
          {
            statusCode: res.statusCode,
            headers: res.getHeaders(),
            body: responseBody
          }
        );
        
        console.log(`[BOOKING-${debugId}] Response:`, {
          statusCode: res.statusCode,
          body: responseBody,
          success: wasSuccessful
        });
      } catch (error) {
        console.error(`[BOOKING-${debugId}] Error capturing response:`, error);
      }
      
      // Call the original method
      return originalSend.call(this, body);
    };
  }
  
  // Always continue to the next middleware
  next();
};

export function logBookingRequest(req: any, debugId: string) {
  // Log detailed information about the request body
  console.log(`[BOOKING-${debugId}] ===== DETAILED BOOKING REQUEST LOGGING =====`);
  console.log(`[BOOKING-${debugId}] Request body:`, JSON.stringify(req.body, null, 2));
  
  // Log specific fields for type and value analysis
  console.log(`[BOOKING-${debugId}] Employee ID check:`, {
    employee_id: req.body.employee_id,
    employee_id_type: typeof req.body.employee_id,
    employeeId: req.body.employeeId,  // Alternative field name
    employeeId_type: typeof req.body.employeeId,
    employee_code: req.body.employee_code,
    employee_name: req.body.employee_name
  });
  
  console.log(`[BOOKING-${debugId}] Booking type fields:`, {
    booking_type: req.body.booking_type, 
    purpose: req.body.purpose,
    priority: req.body.priority
  });
  
  console.log(`[BOOKING-${debugId}] Location data:`, {
    pickup_location_present: req.body.pickup_location ? true : false,
    pickup_location_type: typeof req.body.pickup_location,
    dropoff_location_present: req.body.dropoff_location ? true : false,
    dropoff_location_type: typeof req.body.dropoff_location
  });
  
  if (req.body.pickup_location) {
    console.log(`[BOOKING-${debugId}] Pickup location details:`, {
      address: req.body.pickup_location.address,
      coordinates_present: req.body.pickup_location.coordinates ? true : false,
      lat: req.body.pickup_location.coordinates?.lat,
      lng: req.body.pickup_location.coordinates?.lng,
      additional_fields: Object.keys(req.body.pickup_location).filter(key => 
        !['address', 'coordinates'].includes(key))
    });
  }
  
  console.log(`[BOOKING-${debugId}] Time fields:`, {
    pickup_time: req.body.pickup_time,
    dropoff_time: req.body.dropoff_time,
    pickup_time_valid: req.body.pickup_time && !isNaN(new Date(req.body.pickup_time).getTime()),
    dropoff_time_valid: req.body.dropoff_time && !isNaN(new Date(req.body.dropoff_time).getTime())
  });
  
  // Check for any extra unexpected fields
  const standardFields = [
    'employee_id', 'employeeId', 'employee_code', 'employee_name',
    'booking_type', 'purpose', 'priority', 'remarks',
    'pickup_location', 'dropoff_location', 'waypoints',
    'pickup_time', 'dropoff_time',
    'cargo_type', 'num_boxes', 'weight', 'box_size',
    'trip_type', 'num_passengers', 'with_driver', 'booking_for_self',
    'passenger_details'
  ];
  
  const unexpectedFields = Object.keys(req.body).filter(key => !standardFields.includes(key));
  if (unexpectedFields.length > 0) {
    console.log(`[BOOKING-${debugId}] Unexpected fields:`, unexpectedFields);
  }
  
  // Return a structured summary for easy logging
  return {
    employee_id_present: req.body.employee_id !== undefined,
    employee_id_type: typeof req.body.employee_id,
    employee_id_valid: !isNaN(Number(req.body.employee_id)),
    required_fields_present: 
      req.body.booking_type && 
      req.body.purpose && 
      req.body.priority && 
      req.body.pickup_location && 
      req.body.dropoff_location &&
      req.body.pickup_time &&
      req.body.dropoff_time
  };
}

export function logBookingError(error: any, debugId: string) {
  console.log(`[BOOKING-${debugId}] ERROR: Booking creation failed:`, error.message);
  
  if (error.stack) {
    console.log(`[BOOKING-${debugId}] Error stack:`, error.stack);
  }
  
  if (error.code) {
    console.log(`[BOOKING-${debugId}] Error code:`, error.code);
  }
  
  return {
    message: error.message,
    code: error.code || 'unknown',
    timestamp: new Date().toISOString()
  };
}