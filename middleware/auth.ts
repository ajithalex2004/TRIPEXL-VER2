import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';

// Extend Request type to include a user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        email: string;
      };
    }
  }
}

export const validateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is missing or invalid'
      });
    }
    
    // Extract token from header
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is missing'
      });
    }
    
    console.log('[AUTH] Verifying token:', token.substring(0, 15) + '...');
    
    // Verify token using the JWT_SECRET from environment variables
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key') as {
      userId: number;
      email: string;
    };
    
    // Add decoded user information to the request
    req.user = {
      userId: decoded.userId,
      email: decoded.email
    };
    
    console.log('[AUTH] User authenticated with ID:', decoded.userId);
    
    next();
  } catch (error: any) {
    console.error('[AUTH] Token validation error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token'
    });
  }
};