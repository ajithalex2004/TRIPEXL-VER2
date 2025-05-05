import { MailService } from '@sendgrid/mail';
import nodemailer from 'nodemailer';

// Initialize SendGrid mail service
const mailService = new MailService();

// Set API key from environment variables
if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY environment variable is not set. Email sending will use fallback SMTP.");
} else {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("SendGrid API key configured successfully");
}

// Configure SMTP transport as fallback
const smtpTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Log SMTP configuration
console.log(`SMTP configured with: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);

interface EmailOptions {
  to: string;
  subject: string;
  from?: string;
  text?: string;
  html: string;
}

/**
 * Send an email using SMTP with SendGrid fallback
 * @param options Email options including recipient, subject, and content
 * @returns Promise resolving to success status
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // Get standard from address
  const from = options.from || process.env.EMAIL_FROM || 'no-reply@tripxl.com';
  
  // Validate email format
  if (!options.to || !options.to.includes('@')) {
    console.error(`Invalid email address: ${options.to}`);
    return false;
  }
  
  // First try SMTP as primary email delivery service
  try {
    console.log(`Attempting to send email to ${options.to} using SMTP (primary)`);
    
    const info = await smtpTransport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    });
    
    console.log(`Email sent successfully to ${options.to} via SMTP (ID: ${info.messageId})`);
    return true;
  } catch (smtpError) {
    console.error('SMTP email sending failed:', smtpError);
    console.log('Falling back to SendGrid...');
    // Fall through to SendGrid as backup
  }
  
  // Fallback to SendGrid if SMTP failed
  if (process.env.SENDGRID_API_KEY) {
    try {
      console.log(`Attempting to send email to ${options.to} using SendGrid (fallback)`);
      
      await mailService.send({
        to: options.to,
        from,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      
      console.log(`Email sent successfully to ${options.to} via SendGrid fallback`);
      return true;
    } catch (sendgridError) {
      console.error('SendGrid fallback email sending failed:', sendgridError);
    }
  } else {
    console.error('SendGrid API key not configured, cannot use as fallback');
  }
  
  // If we got here, both primary and fallback methods failed
  console.error('All email delivery methods failed');
  return false;
}

/**
 * Send a password reset email to a user
 * @param email User's email address
 * @param name User's full name
 * @param resetToken Password reset token
 * @returns Promise resolving to success status
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string
): Promise<boolean> {
  try {
    // Get app domain from environment or use a default
    const appDomain = process.env.APP_DOMAIN || 'http://localhost:5000';
    const resetLink = `${appDomain}/auth/reset-password?token=${resetToken}`;
    
    // Create email content with EXL branding
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #004990; color: white; padding: 20px; text-align: center;">
          <h1>Reset Your TripXL Password</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #e9e9e9; border-top: none;">
          <p>Hello ${name},</p>
          <p>We received a request to reset your password for your TripXL account. To reset your password, click the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #004990; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
          </div>
          <p>If you didn't request a password reset, you can safely ignore this email. The link will expire in 24 hours.</p>
          <p>Best regards,<br>The TripXL Team</p>
        </div>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated email, please do not reply directly to this message.</p>
          <p>TripXL - Enterprise Workforce Transportation Platform</p>
        </div>
      </div>
    `;
    
    // Text version for email clients that don't support HTML
    const text = `
Hello ${name},

We received a request to reset your password for your TripXL account. To reset your password, please visit the following link:

${resetLink}

If you didn't request a password reset, you can safely ignore this email. The link will expire in 24 hours.

Best regards,
The TripXL Team

---
This is an automated email, please do not reply directly to this message.
TripXL - Enterprise Workforce Transportation Platform
    `;
    
    return await sendEmail({
      to: email,
      subject: 'Reset Your TripXL Password',
      html,
      text,
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
}