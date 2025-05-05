import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Employee, InsertUser, User } from '@shared/schema';
import { storage } from '../storage';
import { UserType, UserOperationType, UserGroup } from '@shared/schema';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Configure SMTP transport with environment variables
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export class AuthService {
  private async generateOTP(): Promise<string> {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendOTPEmail(email: string, otp: string): Promise<void> {
    try {
      console.log('Sending OTP email to:', email);

      const mailOptions = {
        from: `"TripXL" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Verify Your TripXL Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb; text-align: center;">Welcome to TripXL!</h1>
            <p style="font-size: 16px; text-align: center;">Your verification code is:</p>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <strong style="font-size: 32px; letter-spacing: 8px;">${otp}</strong>
            </div>
            <p style="color: #6b7280; font-size: 14px; text-align: center;">
              This code will expire in 15 minutes.<br>
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        `
      };

      const info = await emailTransporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      throw new Error('Failed to send verification code. Please try again later.');
    }
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async registerUser(userData: InsertUser): Promise<{ user: User; userId: number }> {
    try {
      // Check if user exists
      const existingUser = await storage.findUserByEmail(userData.emailId);
      if (existingUser) {
        throw new Error('This email is already registered');
      }

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);

      // Create user (initially active for testing)
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        isActive: true // Set to true for initial testing
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, emailId: user.emailId },
        process.env.JWT_SECRET || 'dev-secret-key',
        { expiresIn: '24h' }
      );

      return { user, userId: user.id };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async verifyOTP(userId: number, otp: string): Promise<{ user: User; token: string }> {
    try {
      const verification = await storage.getOtpVerification(userId);
      if (!verification) {
        throw new Error('Verification code not found');
      }

      if (verification.otp !== otp) {
        throw new Error('Invalid verification code');
      }

      if (new Date() > verification.expiresAt) {
        throw new Error('Verification code has expired');
      }

      // Activate user
      const user = await storage.activateUser(userId);

      // Delete used OTP
      await storage.deleteOtpVerification(userId);

      // Generate token
      const token = jwt.sign(
        { userId: user.id, emailId: user.emailId },
        process.env.JWT_SECRET || 'dev-secret-key',
        { expiresIn: '24h' }
      );

      return { user, token };
    } catch (error) {
      console.error('OTP verification error:', error);
      throw error;
    }
  }

  async login(emailId: string, password: string): Promise<{ user: User; token: string }> {
    if (!emailId || !password) {
      throw new Error('Email and password are required');
    }

    const user = await storage.findUserByEmail(emailId);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    await storage.updateUserLastLogin(user.id);

    const token = jwt.sign(
      { userId: user.id, emailId: user.emailId },
      process.env.JWT_SECRET || 'dev-secret-key',
      { expiresIn: '24h' }
    );

    return { user, token };
  }

  async verifyEmployee(employeeId: string, emailId: string): Promise<Employee | null> {
    if (!employeeId || !emailId) {
      return null;
    }

    try {
      const employee = await storage.findEmployeeByIdAndEmail(employeeId, emailId);
      if (!employee || !employee.isActive) {
        return null;
      }
      return employee;
    } catch (error) {
      console.error('Error in verifyEmployee:', error);
      return null;
    }
  }
  async initializeDefaultUser(): Promise<void> {
    try {
      console.log("Checking for default user existence...");
      const existingUser = await storage.getUserByUserName("john.smith");

      if (!existingUser) {
        console.log("Default user not found, creating...");
        const password = await this.hashPassword("Code@4088");

        try {
          const userCode = "USR" + Math.floor(1000 + Math.random() * 9000).toString();
          await storage.createUser({
            userName: "john.smith",
            userCode: userCode,
            userType: UserType.ADMIN,
            emailId: "john.smith@company.com",
            userOperationType: UserOperationType.ADMIN,
            userGroup: UserGroup.GROUP_A,
            firstName: "John",
            lastName: "Smith",
            fullName: "John Smith",
            password,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log("Default user created successfully");
        } catch (error: any) {
          if (error.code === '23505') {
            console.log("Default user already exists (caught duplicate key)");
            return;
          }
          throw error;
        }
      } else {
        console.log("Default user already exists");
      }
    } catch (error) {
      console.error("Error in initializeDefaultUser:", error);
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    try {
      console.log('Sending password reset email to:', email);

      const mailOptions = {
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Reset Your TripXL Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #004990; text-align: center;">TripXL Password Reset</h1>
            <p style="font-size: 16px; line-height: 1.5;">
              You have requested to reset your password. Click the button below to set a new password:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL}/auth/reset-password?token=${resetToken}" 
                 style="background-color: #004990; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 4px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px; text-align: center;">
              This link will expire in 1 hour.<br>
              If you didn't request this, please ignore this email.
            </p>
          </div>
        `
      };

      const info = await emailTransporter.sendMail(mailOptions);
      console.log('Password reset email sent successfully:', info.messageId);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email. Please try again later.');
    }
  }

  async initiatePasswordReset(email: string): Promise<void> {
    try {
      // Find user by email
      const user = await storage.findUserByEmail(email);
      if (!user) {
        // For security, don't reveal if email exists
        return;
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

      // Save reset token to user record
      await storage.updateUserResetToken(user.id, resetToken, resetTokenExpiry);

      // Send reset email
      await this.sendPasswordResetEmail(email, resetToken);
    } catch (error) {
      console.error('Error in initiatePasswordReset:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();