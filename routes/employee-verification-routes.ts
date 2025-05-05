import { Router } from "express";
import { storage } from "../storage";

export const employeeVerificationRouter = Router();

/**
 * API endpoint to verify employee information
 * This endpoint is used during registration to validate that the user is an existing employee
 * Checks if the employee ID and email combination exists in the employee database
 */
employeeVerificationRouter.get("/verify", async (req, res) => {
  try {
    const { employee_id, email } = req.query;
    
    if (!employee_id || !email) {
      return res.status(400).json({ 
        success: false, 
        error: "Employee ID and email are required" 
      });
    }
    
    // Convert string to number for employee_id (if it's stored as a number)
    const employeeIdNumber = parseInt(employee_id as string);
    
    // Check if either the ID is invalid or email is invalid format
    if (isNaN(employeeIdNumber) || !isValidEmail(email as string)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid employee ID or email format" 
      });
    }
    
    // Find employee by ID
    const employee = await storage.findEmployeeByEmployeeId(employee_id as string);
    
    // Check if employee exists
    if (!employee) {
      return res.json({ 
        exists: false, 
        matched: false,
        message: "No employee found with this ID" 
      });
    }
    
    // Check if email matches
    const isEmailMatched = employee.email_id.toLowerCase() === (email as string).toLowerCase();
    
    // Check if this employee already has a user account
    const existingUser = await storage.findUserByEmployeeId(employee_id as string);
    
    if (existingUser) {
      return res.json({
        exists: true,
        matched: false,
        message: "An account already exists for this employee ID. Please use the login form."
      });
    }
    
    // Return result
    return res.json({
      exists: true,
      matched: isEmailMatched,
      message: isEmailMatched 
        ? "Employee information verified" 
        : "Email doesn't match the employee record",
      employee: isEmailMatched ? {
        employee_name: employee.employee_name,
        mobile_number: employee.mobile_number,
        department: employee.department,
        region: employee.region,
      } : null
    });
    
  } catch (error) {
    console.error("Error verifying employee:", error);
    res.status(500).json({ 
      success: false, 
      error: "Server error verifying employee" 
    });
  }
});

// Check if email is valid format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}