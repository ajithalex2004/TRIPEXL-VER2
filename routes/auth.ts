import { Router } from "express";
import { storage } from "../storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, schema } from '../db'; // Import the db object and schema
import { sql } from 'drizzle-orm';

const router = Router();

const generateToken = (userId: number) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '24h',
  });
};

// Update the default user creation code
console.log('Initializing default user...');
const defaultUser = {
  user_name: 'john.smith',
  user_code: 'USR1444',
  user_type: 'ADMIN',
  email_id: 'john.smith@company.com',
  country_code: '+971',
  mobile_number: '501234567',
  user_operation_type: 'ADMIN',
  user_group: 'DEFAULT',
  first_name: 'John',
  last_name: 'Smith',
  full_name: 'John Smith',
  password: 'Pass@123',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

console.log('Checking for default user existence...');
const existingUser = await storage.findUserByEmail(defaultUser.email_id);

if (!existingUser) {
  console.log('Default user not found, creating...');
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(defaultUser.password, salt);

    await storage.createUser({
      ...defaultUser,
      password: hashedPassword
    });
    console.log('Default user created successfully');
  } catch (error) {
    console.error('Error creating default user:', error);
    throw error;
  }
} else {
  console.log('Default user already exists');
}

router.post("/login", async (req, res) => {
  try {
    const { userName, password } = req.body;

    console.log('Login attempt with username:', userName);

    if (!userName || !password) {
      return res.status(400).json({
        error: "Username and password are required"
      });
    }

    // Find user by either email or username
    let user;
    if (userName.includes('@')) {
      user = await storage.findUserByEmail(userName);
    } else {
      user = await storage.getUserByUserName(userName);
    }

    if (!user) {
      console.error('User not found:', userName);
      return res.status(401).json({
        error: "Invalid username or password"
      });
    }

    console.log('User found:', user.id, user.user_name);

    // Compare the provided password with the stored password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      console.error('Password validation failed for user:', userName);
      return res.status(401).json({
        error: "Invalid username or password"
      });
    }

    const token = generateToken(user.id);

    // Update last login
    await storage.updateUserLastLogin(user.id);
    console.log('Login successful for user:', user.id, user.user_name);

    return res.status(200).json({
      token,
      id: user.id,
      email_id: user.email_id,
      userName: user.user_name
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: "An error occurred during login. Please try again."
    });
  }
});

router.post("/logout", (req, res) => {
  res.status(200).json({ message: "Logged out successfully" });
});

// Get all users
router.get("/users", async (_req, res) => {
  try {
    console.log('Fetching all users');
    const users = await storage.getAllUsers();
    console.log(`Successfully fetched ${users.length} users`);
    return res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      error: "Failed to fetch users"
    });
  }
});

// Update user creation route
router.post("/users", async (req, res) => {
  try {
    console.log('Received user creation request:', {
      ...req.body,
      password: '[REDACTED]',
      timestamp: new Date().toISOString()
    });

    const { password, ...userData } = req.body;

    // Validate required fields
    const requiredFields = [
      'user_name',
      'user_code',
      'email_id',
      'user_type',
      'user_operation_type',
      'user_group',
      'first_name',
      'last_name',
      'full_name'
    ];

    const missingFields = requiredFields.filter(field => !userData[field]);
    if (missingFields.length > 0) {
      console.error('Validation failed - missing fields:', missingFields);
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Check if email already exists in users table
    const existingUserEmail = await storage.findUserByEmail(userData.email_id);
    if (existingUserEmail) {
      console.error('Email already exists in users table:', userData.email_id);
      return res.status(400).json({
        error: "Email address is already registered"
      });
    }

    // Check if username already exists
    const existingUserName = await storage.getUserByUserName(userData.user_name);
    if (existingUserName) {
      console.error('Username already exists:', userData.user_name);
      return res.status(400).json({
        error: "Username is already taken"
      });
    }

    // Check if mobile number already exists in users table (if provided)
    if (userData.mobile_number) {
      const [existingUserMobile] = await db
        .select()
        .from(schema.users)
        .where(sql`
          country_code = ${userData.country_code || "+971"} 
          AND mobile_number = ${userData.mobile_number}
        `);

      if (existingUserMobile) {
        return res.status(400).json({
          error: "Mobile number is already registered"
        });
      }
    }

    // EMPLOYEE VALIDATION: Check if the email exists in the employees table
    // If it exists, this is a valid employee that can be registered as a user
    const [employeeByEmail] = await db
      .select()
      .from(schema.employees)
      .where(sql`email_id = ${userData.email_id}`);

    // If email not found, also check by mobile number if provided
    let employeeFound = !!employeeByEmail;
    let employeeByMobile = null;
    
    if (!employeeFound && userData.mobile_number) {
      [employeeByMobile] = await db
        .select()
        .from(schema.employees)
        .where(sql`mobile_number = ${userData.mobile_number}`);
      
      employeeFound = !!employeeByMobile;
    }

    // If the email or mobile number doesn't match any employee record, return an error
    if (!employeeFound) {
      console.error('No matching employee record found for email or mobile number:', {
        email: userData.email_id,
        mobile: userData.mobile_number
      });
      return res.status(400).json({
        error: "Registration failed: No matching employee record found with this email or mobile number. Please contact your administrator."
      });
    }

    // If we got here, a matching employee was found - proceed with user creation
    console.log('Matching employee record found:', {
      byEmail: !!employeeByEmail,
      byMobile: !!employeeByMobile,
      employeeId: (employeeByEmail || employeeByMobile)?.id
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = password
      ? await bcrypt.hash(password, salt)
      : await bcrypt.hash("Pass@123", salt);

    // Create user with validated data
    const newUser = await storage.createUser({
      ...userData,
      password: hashedPassword,
      is_active: true
    });

    console.log('User created successfully:', {
      id: newUser.id,
      email: newUser.email_id,
      username: newUser.user_name,
      timestamp: new Date().toISOString()
    });

    return res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to create user. Please try again."
    });
  }
});

// Update user
router.put("/users/:id", async (req, res) => {
  try {
    console.log('Updating user:', req.params.id, 'with data:', {
      ...req.body,
      password: '[REDACTED]'
    });
    const userId = parseInt(req.params.id);
    const userData = req.body;

    // Fetch existing user
    const existingUser = await storage.getUser(userId);
    if (!existingUser) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    // Check email uniqueness if email is being updated
    if (userData.email_id && userData.email_id !== existingUser.email_id) {
      const existingUserEmail = await storage.findUserByEmail(userData.email_id);
      if (existingUserEmail) {
        return res.status(400).json({
          error: "Email already exists"
        });
      }
    }

    // Check mobile number uniqueness only if it's being updated
    if (userData.mobile_number && userData.mobile_number !== existingUser.mobile_number) {
      const [existingUserMobile] = await db
        .select()
        .from(schema.users)
        .where(sql`
          country_code = ${userData.country_code || "+971"} 
          AND mobile_number = ${userData.mobile_number}
          AND id != ${userId}
        `);

      if (existingUserMobile) {
        return res.status(400).json({
          error: "Mobile number already exists"
        });
      }
    }

    // Check username uniqueness if username is being updated
    if (userData.user_name && userData.user_name !== existingUser.user_name) {
      const existingUserName = await storage.getUserByUserName(userData.user_name);
      if (existingUserName) {
        return res.status(400).json({
          error: "Username already exists"
        });
      }
    }

    // Update user data
    const updatedUser = await storage.updateUser(userId, {
      ...userData,
      country_code: userData.country_code || "+971",
      mobile_number: userData.mobile_number,
      updated_at: new Date(),
    });

    console.log('User updated successfully:', { id: updatedUser.id, email: updatedUser.email_id, mobile: updatedUser.mobile_number });
    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to update user"
    });
  }
});

// Delete user
router.delete("/users/:id", async (req, res) => {
  try {
    console.log('Deleting user:', req.params.id);
    const userId = parseInt(req.params.id);
    await storage.deleteUser(userId);
    console.log('User deleted successfully');
    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({
      error: "Failed to delete user"
    });
  }
});

// Add the new email check endpoint after the existing routes
router.get("/check-email/:email", async (req, res) => {
  try {
    const { email } = req.params;
    console.log('Checking email:', email);

    if (!email) {
      return res.status(400).json({
        error: "Email is required"
      });
    }

    // First check if the email exists in the users table
    const existingUser = await storage.findUserByEmail(email);
    if (existingUser) {
      return res.json({
        available: false,
        isValid: false,
        message: "Email is already registered"
      });
    }

    // If not already registered, check if the email exists in the employees table
    const [employeeWithEmail] = await db
      .select()
      .from(schema.employees)
      .where(sql`email_id = ${email}`);

    return res.json({
      available: true, // Available for registration since not in users table
      isValid: !!employeeWithEmail, // Valid only if found in employees table
      message: employeeWithEmail ? 
        "Email belongs to a valid employee" : 
        "Email not found in employee records. Only registered employees can create accounts."
    });

  } catch (error) {
    console.error('Error checking email:', error);
    return res.status(500).json({
      error: "Failed to check email availability"
    });
  }
});

// Add the mobile number check endpoint
router.get("/check-mobile/:countryCode/:number", async (req, res) => {
  try {
    const { countryCode, number } = req.params;
    const fullMobileNumber = `${countryCode}${number}`;
    console.log('Checking mobile number:', fullMobileNumber);

    if (!countryCode || !number) {
      return res.status(400).json({
        error: "Country code and mobile number are required"
      });
    }

    // Check if mobile number exists in users table
    const [existingUser] = await db
      .select()
      .from(schema.users)
      .where(sql`country_code = ${countryCode} AND mobile_number = ${number}`);

    if (existingUser) {
      return res.json({
        available: false,
        isValid: false, 
        message: "Mobile number is already registered"
      });
    }

    // If not already registered, check if the mobile number exists in the employees table
    const [employeeWithMobile] = await db
      .select()
      .from(schema.employees)
      .where(sql`mobile_number = ${fullMobileNumber}`);

    return res.json({
      available: true, // Available for registration since not in users table
      isValid: !!employeeWithMobile, // Valid only if found in employees table
      message: employeeWithMobile ? 
        "Mobile number belongs to a valid employee" : 
        "Mobile number not found in employee records. Only registered employees can create accounts."
    });

  } catch (error) {
    console.error('Error checking mobile number:', error);
    return res.status(500).json({
      error: "Failed to check mobile number availability"
    });
  }
});

export default router;