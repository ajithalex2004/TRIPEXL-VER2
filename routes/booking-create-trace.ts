/**
 * This is a diagnostic endpoint to trace booking creation
 * It has minimal validation and logs each step in the process
 */

import { storage } from '../storage';
import { Request, Response, Router } from 'express';
import { Priority as BookingPriority, BookingStatus, BookingType } from '@shared/schema';

// Simple version of auth middleware
const authMiddleware = (req: Request, res: Response, next: Function) => {
  // Just pass through for diagnostic purposes
  if (!req.user) {
    req.user = { userId: 1 };
  }
  next();
};

// Simple reference number generator
const generateReferenceNumber = () => {
  return `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;
};

// Simple metrics calculator
const calculateBookingMetrics = (
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
  bookingType: string
) => {
  // Calculate rough distance using Haversine formula
  const R = 6371; // Earth's radius in km
  const dLat = (dropoff.lat - pickup.lat) * Math.PI / 180;
  const dLon = (dropoff.lng - pickup.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(pickup.lat * Math.PI / 180) * Math.cos(dropoff.lat * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in km
  
  // Simple cost calculation
  const costPerKm = bookingType === BookingType.AMBULANCE ? 5 : 2.5;
  const cost = distance * costPerKm;
  
  // Simple CO2 calculation - 0.12kg per km
  const co2 = distance * 0.12;
  
  return {
    totalDistance: distance.toFixed(2),
    estimatedCost: cost.toFixed(2),
    co2Emissions: co2.toFixed(2)
  };
};

export const bookingCreateTraceRouter = Router();

// POST /api/booking-create-trace - Create a new booking directly with minimal validation
bookingCreateTraceRouter.post('/', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  console.log("TRACE: Booking create trace endpoint called by user:", userId);
  console.log("TRACE: Request body:", JSON.stringify(req.body, null, 2));
  
  try {
    // Basic validation only - just ensure critical fields exist
    const { 
      employee_id, 
      booking_type, 
      purpose, 
      priority, 
      pickup_location, 
      dropoff_location 
    } = req.body;
    
    console.log("TRACE: Extracted fields -", {
      employee_id,
      booking_type, 
      priority,
      // Don't log full locations in production, just log that they exist
      has_pickup: !!pickup_location,
      has_dropoff: !!dropoff_location
    });
    
    // Check critical fields
    if (!employee_id) {
      console.error("TRACE: Missing employee_id");
      return res.status(400).json({ 
        success: false, 
        error: "Missing employee_id field" 
      });
    }
    
    if (!booking_type) {
      console.error("TRACE: Missing booking_type");
      return res.status(400).json({ 
        success: false, 
        error: "Missing booking_type field" 
      });
    }
    
    // Ensure employee_id is a number
    let employeeId = Number(employee_id);
    if (isNaN(employeeId)) {
      console.error(`TRACE: Invalid employee_id format: ${employee_id}`);
      return res.status(400).json({ 
        success: false, 
        error: "Invalid employee_id, must be a number" 
      });
    }
    
    // Generate a reference number
    const referenceNo = generateReferenceNumber();
    console.log("TRACE: Generated reference number:", referenceNo);
    
    // Pre-process the booking data
    let validatedBookingType = booking_type.toLowerCase();
    if (!Object.values(BookingType).includes(validatedBookingType)) {
      console.warn(`TRACE: Invalid booking_type: ${booking_type}, defaulting to 'passenger'`);
      validatedBookingType = BookingType.PASSENGER;
    }
    
    let validatedPriority = priority || BookingPriority.NORMAL;
    if (!Object.values(BookingPriority).includes(validatedPriority)) {
      console.warn(`TRACE: Invalid priority: ${priority}, defaulting to 'normal'`);
      validatedPriority = BookingPriority.NORMAL;
    }
    
    // Create a booking object with bare minimum fields
    const bookingData = {
      employee_id: employeeId,
      booking_type: validatedBookingType,
      purpose: purpose || "Unknown",
      priority: validatedPriority,
      pickup_location,
      dropoff_location,
      reference_no: referenceNo,
      status: BookingStatus.NEW,
      ...req.body  // Include all other fields from the request
    };
    
    console.log("TRACE: Final booking data (before storage):", {
      ...bookingData,
      // Don't log full locations in production
      pickup_location: pickup_location ? "PRESENT" : null,
      dropoff_location: dropoff_location ? "PRESENT" : null
    });
    
    try {
      // Calculate booking metrics if possible
      if (pickup_location?.coordinates && dropoff_location?.coordinates) {
        console.log("TRACE: Calculating booking metrics");
        
        try {
          const metrics = calculateBookingMetrics(
            pickup_location.coordinates,
            dropoff_location.coordinates,
            validatedBookingType
          );
          
          console.log("TRACE: Calculated metrics:", metrics);
          
          // Add metrics to booking data
          bookingData.total_distance = metrics.totalDistance.toString();
          bookingData.estimated_cost = metrics.estimatedCost.toString();
          bookingData.co2_emissions = metrics.co2Emissions.toString();
        } catch (metricsError) {
          console.error("TRACE: Error calculating metrics:", metricsError);
        }
      } else {
        console.log("TRACE: Skipping metrics calculation - missing coordinates");
      }
      
      // Create the booking
      console.log("TRACE: Calling storage.createBooking");
      const booking = await storage.createBooking(bookingData);
      console.log("TRACE: Booking created successfully with ID:", booking.id);
      
      // Return success
      return res.status(201).json({
        success: true,
        message: "Booking created successfully via trace endpoint",
        booking
      });
    } catch (error: any) {
      console.error("TRACE: Error during booking creation:", error);
      
      // Detailed error reporting
      return res.status(500).json({
        success: false,
        error: "Database error during booking creation",
        details: {
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          code: error.code,
          constraint: error.constraint
        }
      });
    }
  } catch (error: any) {
    console.error("TRACE: Unexpected error:", error);
    
    return res.status(500).json({
      success: false,
      error: "Unexpected error during booking creation trace",
      details: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
});

export default bookingCreateTraceRouter;