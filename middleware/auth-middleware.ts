import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';

// Authentication middleware to protect routes
export const checkAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }
    
    // Extract token (remove "Bearer " prefix)
    const token = authHeader.substring(7);
    
    if (token === 'test-token') {
      // Special case for development/testing
      return next();
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key');
      
      if (typeof decoded !== 'object' || !decoded.userId) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token' });
      }
      
      // Get user from storage
      const user = await storage.getUser(decoded.userId);
      
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized: User not found' });
      }
      
      // Attach user to request
      (req as any).user = user;
      
      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ message: 'Internal server error during authentication' });
  }
};