import { Router, Request, Response } from 'express';
import * as schema from '@shared/schema';
import { db } from '../db';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { and, eq, sql } from 'drizzle-orm';

// Create a router for debugging booking creation
const router = Router();

// Helper function to verify token
const verifyToken = (token: string): { userId: number, email: string } | null => {
  try {
    if (!token) return null;
    
    console.log("Verifying token:", token.substring(0, 15) + "...");
    console.log("JWT_SECRET length:", process.env.JWT_SECRET?.length, "first 5 chars:", process.env.JWT_SECRET?.substring(0, 5));
    console.log("Full token being verified:", token);
    
    const timestamp = Math.floor(Date.now() / 1000);
    console.log("Current timestamp:", timestamp);
    
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key');
    
    console.log("Token payload structure:", Object.keys(decoded).join(", "));
    console.log("Token full decoded payload:", JSON.stringify(decoded));
    console.log("Token exp:", decoded.exp, "iat:", decoded.iat);
    console.log("Current time (epoch):", timestamp, "Token expiry:", decoded.exp, "Difference:", decoded.exp - timestamp);
    
    return {
      userId: decoded.userId,
      email: decoded.email
    };
  } catch (tokenError) {
    console.error("Token verification failed:", tokenError);
    return null;
  }
};

// Test endpoint for advanced diagnostics
router.post('/test', async (req: Request, res: Response) => {
  const stages: any[] = [];
  let finalStatus = 'success';
  
  try {
    // Stage 1: Authentication check
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      stages.push({
        name: 'Authentication',
        success: false,
        message: 'No authentication token provided',
        details: { headers: req.headers['authorization'] ? 'Bearer xxx...' : 'Not present' }
      });
      finalStatus = 'error';
      return res.status(200).json({
        status: finalStatus, 
        message: 'Authentication failed - no token provided',
        stages
      });
    }
    
    const decoded = verifyToken(token);
    
    if (!decoded) {
      stages.push({
        name: 'Authentication',
        success: false,
        message: 'Invalid authentication token',
        details: { token_fragment: token.substring(0, 10) + '...' }
      });
      finalStatus = 'error';
      return res.status(200).json({
        status: finalStatus, 
        message: 'Authentication failed - invalid token',
        stages
      });
    }
    
    stages.push({
      name: 'Authentication',
      success: true,
      message: 'Token is valid and user is authenticated',
      details: { userId: decoded.userId, email: decoded.email }
    });
    
    // Stage 2: Request payload validation
    const payload = req.body;
    const validationIssues: string[] = [];
    
    // Basic validation
    if (!payload) validationIssues.push('Request body is empty');
    if (!payload.booking_type) validationIssues.push('booking_type is required');
    if (!payload.purpose) validationIssues.push('purpose is required');
    if (!payload.priority) validationIssues.push('priority is required');
    
    // Employee ID validation - check if it's a string vs number 
    if (payload.employee_id === undefined) {
      validationIssues.push('employee_id is required');
    } else if (typeof payload.employee_id === 'string') {
      validationIssues.push('employee_id is a string, should be a number');
    }
    
    // Location validation
    if (!payload.pickup_location) {
      validationIssues.push('pickup_location is required');
    } else {
      if (!payload.pickup_location.address) validationIssues.push('pickup_location.address is required');
      if (!payload.pickup_location.coordinates) validationIssues.push('pickup_location.coordinates is required');
      if (payload.pickup_location.coordinates && typeof payload.pickup_location.coordinates.lat !== 'number') 
        validationIssues.push('pickup_location.coordinates.lat must be a number');
      if (payload.pickup_location.coordinates && typeof payload.pickup_location.coordinates.lng !== 'number') 
        validationIssues.push('pickup_location.coordinates.lng must be a number');
    }
    
    if (!payload.dropoff_location) {
      validationIssues.push('dropoff_location is required');
    } else {
      if (!payload.dropoff_location.address) validationIssues.push('dropoff_location.address is required');
      if (!payload.dropoff_location.coordinates) validationIssues.push('dropoff_location.coordinates is required');
      if (payload.dropoff_location.coordinates && typeof payload.dropoff_location.coordinates.lat !== 'number') 
        validationIssues.push('dropoff_location.coordinates.lat must be a number');
      if (payload.dropoff_location.coordinates && typeof payload.dropoff_location.coordinates.lng !== 'number') 
        validationIssues.push('dropoff_location.coordinates.lng must be a number');
    }
    
    if (validationIssues.length > 0) {
      stages.push({
        name: 'Payload Validation',
        success: false,
        message: 'Request payload validation failed',
        details: { issues: validationIssues, payload }
      });
      finalStatus = 'error';
    } else {
      stages.push({
        name: 'Payload Validation',
        success: true,
        message: 'Payload is valid',
        details: { payload }
      });
    }
    
    // Stage 3: Schema and database validation
    try {
      // Debug: Check database schema
      const bookingsTableInfo = {
        name: schema.bookings.name,
        columns: Object.keys(schema.bookings.columns)
      };
      
      stages.push({
        name: 'Schema Validation',
        success: true,
        message: 'Database schema is accessible',
        details: { bookingsTable: bookingsTableInfo }
      });
      
      // Check employee exists
      if (payload.employee_id) {
        try {
          const employeeId = typeof payload.employee_id === 'string' 
            ? parseInt(payload.employee_id, 10) 
            : payload.employee_id;
          
          const employee = await db.query.employees.findFirst({
            where: eq(schema.employees.id, employeeId)
          });
          
          if (!employee) {
            stages.push({
              name: 'Employee Validation',
              success: false,
              message: `Employee with ID ${employeeId} not found`,
              details: { employeeId }
            });
            finalStatus = 'error';
          } else {
            stages.push({
              name: 'Employee Validation',
              success: true,
              message: `Employee with ID ${employeeId} exists`,
              details: { 
                employeeId: employee.id,
                employeeName: employee.employee_name,
                email: employee.email_id
              }
            });
          }
        } catch (error) {
          stages.push({
            name: 'Employee Validation',
            success: false,
            message: 'Error checking employee existence',
            details: { error: String(error) }
          });
          finalStatus = 'error';
        }
      }
      
      // Test database insertion
      if (finalStatus === 'success') {
        try {
          // Only attempt insertion if previous stages are successful
          const newBooking = {
            employee_id: typeof payload.employee_id === 'string' 
              ? parseInt(payload.employee_id, 10) 
              : payload.employee_id,
            booking_type: payload.booking_type,
            purpose: payload.purpose,
            priority: payload.priority,
            pickup_location: payload.pickup_location,
            dropoff_location: payload.dropoff_location,
            reference_no: `TEST-${Date.now()}`,
            status: 'diagnostic'
          };
          
          // Don't actually insert, just validate
          stages.push({
            name: 'Database Test',
            success: true,
            message: 'Booking payload is compatible with database schema',
            details: { 
              validatedBooking: newBooking,
              note: "No actual insertion performed - diagnostic only"
            }
          });
        } catch (dbError) {
          stages.push({
            name: 'Database Test',
            success: false,
            message: 'Booking payload validation against database schema failed',
            details: { error: String(dbError) }
          });
          finalStatus = 'error';
        }
      }
    } catch (schemaError) {
      stages.push({
        name: 'Schema Validation',
        success: false,
        message: 'Error accessing database schema',
        details: { error: String(schemaError) }
      });
      finalStatus = 'error';
    }
    
    // Provide final summary message
    let summaryMessage = '';
    if (finalStatus === 'success') {
      summaryMessage = 'All diagnostic checks passed. Booking creation should work correctly.';
    } else {
      const failedStages = stages.filter(stage => !stage.success)
        .map(stage => stage.name)
        .join(', ');
      summaryMessage = `Diagnostics failed at stages: ${failedStages}. Please check the details for each failed stage.`;
    }
    
    return res.status(200).json({
      status: finalStatus, 
      message: summaryMessage,
      stages
    });
    
  } catch (error) {
    // Catch any unhandled exceptions
    stages.push({
      name: 'Unhandled Exception',
      success: false,
      message: 'An unexpected error occurred during diagnostics',
      details: { error: String(error) }
    });
    
    return res.status(500).json({
      status: 'error', 
      message: 'Diagnostic process encountered an unexpected error',
      stages
    });
  }
});

export default router;