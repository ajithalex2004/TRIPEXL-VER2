import { Router, Request, Response } from 'express';
import * as schema from '@shared/schema';
import { db } from '../db';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { and, eq, sql } from 'drizzle-orm';

// Create a router for tracing booking creation steps
const router = Router();

// Helper function to verify token
const verifyToken = (token: string): { userId: number, email: string } => {
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key');
    return {
      userId: decoded.userId,
      email: decoded.email
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    throw new Error("Invalid token");
  }
};

// Authentication test endpoint
router.get('/auth', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(200).json({ 
        status: 'error', 
        step: 'auth',
        message: 'No authorization header provided',
        details: { headers: JSON.stringify(req.headers) }
      });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(200).json({ 
        status: 'error', 
        step: 'auth',
        message: 'No bearer token found in authorization header',
        details: { authHeader }
      });
    }
    
    try {
      const decoded = verifyToken(token);
      
      // Check if user exists
      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return res.status(200).json({ 
          status: 'error', 
          step: 'auth',
          message: 'User not found with the ID from token',
          details: { userId: decoded.userId }
        });
      }
      
      return res.status(200).json({ 
        status: 'success', 
        step: 'auth',
        message: 'Authentication successful',
        details: {
          userId: decoded.userId,
          email: decoded.email,
          userName: user.user_name,
          userType: user.user_type
        }
      });
    } catch (tokenError) {
      return res.status(200).json({ 
        status: 'error', 
        step: 'auth',
        message: 'Token validation failed',
        details: { error: String(tokenError) }
      });
    }
  } catch (error) {
    return res.status(500).json({ 
      status: 'error', 
      step: 'auth',
      message: 'Server error during authentication check',
      details: { error: String(error) }
    });
  }
});

// Payload validation test endpoint
router.post('/payload', async (req: Request, res: Response) => {
  try {
    // Authenticate first
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ 
        status: 'error', 
        step: 'auth',
        message: 'No authorization header provided'
      });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        status: 'error', 
        step: 'auth',
        message: 'No bearer token found in authorization header'
      });
    }
    
    try {
      const decoded = verifyToken(token);
      
      // Now validate the payload
      const payload = req.body;
      const validationErrors = [];
      
      // Required fields
      if (!payload.booking_type) validationErrors.push('booking_type is required');
      if (!payload.purpose) validationErrors.push('purpose is required');
      if (!payload.priority) validationErrors.push('priority is required');
      if (!payload.employee_id) validationErrors.push('employee_id is required');
      
      // Check if employee_id is a number
      if (payload.employee_id && typeof payload.employee_id === 'string') {
        try {
          const empId = parseInt(payload.employee_id, 10);
          if (isNaN(empId)) {
            validationErrors.push('employee_id must be a valid number');
          }
        } catch (e) {
          validationErrors.push('employee_id must be a valid number');
        }
      }
      
      // Check location fields
      if (!payload.pickup_location) {
        validationErrors.push('pickup_location is required');
      } else {
        if (!payload.pickup_location.address) validationErrors.push('pickup_location.address is required');
        if (!payload.pickup_location.coordinates) {
          validationErrors.push('pickup_location.coordinates is required');
        } else {
          if (typeof payload.pickup_location.coordinates.lat !== 'number') 
            validationErrors.push('pickup_location.coordinates.lat must be a number');
          if (typeof payload.pickup_location.coordinates.lng !== 'number') 
            validationErrors.push('pickup_location.coordinates.lng must be a number');
        }
      }
      
      if (!payload.dropoff_location) {
        validationErrors.push('dropoff_location is required');
      } else {
        if (!payload.dropoff_location.address) validationErrors.push('dropoff_location.address is required');
        if (!payload.dropoff_location.coordinates) {
          validationErrors.push('dropoff_location.coordinates is required');
        } else {
          if (typeof payload.dropoff_location.coordinates.lat !== 'number') 
            validationErrors.push('dropoff_location.coordinates.lat must be a number');
          if (typeof payload.dropoff_location.coordinates.lng !== 'number') 
            validationErrors.push('dropoff_location.coordinates.lng must be a number');
        }
      }
      
      if (validationErrors.length > 0) {
        return res.status(200).json({ 
          status: 'error', 
          step: 'payload',
          message: 'Validation failed',
          details: { errors: validationErrors, payload }
        });
      }
      
      return res.status(200).json({ 
        status: 'success', 
        step: 'payload',
        message: 'Payload validation successful',
        details: { 
          validatedPayload: payload,
          userId: decoded.userId
        }
      });
    } catch (tokenError) {
      return res.status(401).json({ 
        status: 'error', 
        step: 'auth',
        message: 'Token validation failed',
        details: { error: String(tokenError) }
      });
    }
  } catch (error) {
    return res.status(500).json({ 
      status: 'error', 
      step: 'payload',
      message: 'Server error during payload validation',
      details: { error: String(error) }
    });
  }
});

// Database test endpoint - validate against schema without actual insertion
router.post('/db', async (req: Request, res: Response) => {
  try {
    // Authenticate first
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ 
        status: 'error', 
        step: 'auth',
        message: 'No authorization header provided'
      });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        status: 'error', 
        step: 'auth',
        message: 'No bearer token found in authorization header'
      });
    }
    
    try {
      const decoded = verifyToken(token);
      
      // Validate the payload first
      const payload = req.body;
      const validationErrors = [];
      
      // Required fields (simplified)
      if (!payload.booking_type) validationErrors.push('booking_type is required');
      if (!payload.purpose) validationErrors.push('purpose is required');
      if (!payload.priority) validationErrors.push('priority is required');
      if (!payload.employee_id) validationErrors.push('employee_id is required');
      if (!payload.pickup_location) validationErrors.push('pickup_location is required');
      if (!payload.dropoff_location) validationErrors.push('dropoff_location is required');
      
      if (validationErrors.length > 0) {
        return res.status(200).json({ 
          status: 'error', 
          step: 'payload',
          message: 'Validation failed',
          details: { errors: validationErrors }
        });
      }
      
      // Check employee exists
      const employeeId = typeof payload.employee_id === 'string' 
        ? parseInt(payload.employee_id, 10) 
        : payload.employee_id;
        
      const employee = await db.query.employees.findFirst({
        where: eq(schema.employees.id, employeeId)
      });
      
      if (!employee) {
        return res.status(200).json({ 
          status: 'error', 
          step: 'db',
          message: `Employee with ID ${employeeId} not found`,
          details: { employeeId }
        });
      }
      
      // Format booking entry for DB
      const bookingEntry = {
        employee_id: employeeId,
        booking_type: payload.booking_type.toLowerCase(),
        purpose: payload.purpose,
        priority: payload.priority,
        pickup_location: payload.pickup_location,
        dropoff_location: payload.dropoff_location,
        waypoints: payload.waypoints || [],
        reference_no: `TEST-${Date.now()}`,
        status: 'test'
      };
      
      // Test schema compatibility without insertion
      return res.status(200).json({ 
        status: 'success', 
        step: 'db',
        message: 'Database validation successful',
        details: { 
          formattedBooking: bookingEntry,
          employeeFound: {
            id: employee.id,
            name: employee.employee_name,
            email: employee.email_id
          }
        }
      });
      
    } catch (tokenError) {
      return res.status(401).json({ 
        status: 'error', 
        step: 'auth',
        message: 'Token validation failed',
        details: { error: String(tokenError) }
      });
    }
  } catch (error) {
    return res.status(500).json({ 
      status: 'error', 
      step: 'db',
      message: 'Server error during database validation',
      details: { error: String(error) }
    });
  }
});

export default router;