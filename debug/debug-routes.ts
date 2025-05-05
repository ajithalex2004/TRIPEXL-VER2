import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { bookingDebugManager } from './booking-debug';
import os from 'os';

const debugRouter = Router();

// Get all debug sessions
debugRouter.get('/booking-sessions', (req: Request, res: Response) => {
  try {
    const sessions = bookingDebugManager.getAllSessions();
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching booking debug sessions:', error);
    res.status(500).json({ error: 'Failed to fetch booking debug sessions' });
  }
});

// Get a specific debug session
debugRouter.get('/booking-sessions/:sessionId', (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId;
    const session = bookingDebugManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Debug session not found' });
    }
    
    res.json(session);
  } catch (error) {
    console.error('Error fetching booking debug session:', error);
    res.status(500).json({ error: 'Failed to fetch booking debug session' });
  }
});

// Get database status
debugRouter.get('/db-status', async (req: Request, res: Response) => {
  try {
    // Test database connection
    const client = await pool.connect();
    
    // Run a simple query to verify connection
    await client.query('SELECT NOW()');
    
    // Release the client back to the pool
    client.release();
    
    res.json({
      connected: true,
      database: process.env.DATABASE_URL ? 'PostgreSQL' : 'Unknown',
      version: 'PostgreSQL'
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(200).json({
      connected: false,
      error: error instanceof Error ? error.message : String(error),
      details: error
    });
  }
});

// Get server information
debugRouter.get('/server-info', (req: Request, res: Response) => {
  try {
    const startTime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    // Get CPU usage (this is a simple approximation)
    const cpuUsage = process.cpuUsage();
    const totalCpuTime = cpuUsage.user + cpuUsage.system;
    const cpuPercentage = (totalCpuTime / 1000000) / os.cpus().length; // Convert to percentage
    
    res.json({
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(), // In seconds
      startTime: new Date(Date.now() - Math.floor(process.uptime()) * 1000).toISOString(),
      environment: process.env.NODE_ENV || 'development',
      memory: {
        used: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        total: os.totalmem()
      },
      cpu: cpuPercentage,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    });
  } catch (error) {
    console.error('Error fetching server info:', error);
    res.status(500).json({ error: 'Failed to fetch server information' });
  }
});

// Get current active workflows
debugRouter.get('/workflows', (req: Request, res: Response) => {
  try {
    // This is a placeholder. In a production environment,
    // you would have actual workflow monitoring here.
    res.json({
      workflows: [
        {
          id: 'server',
          name: 'Server',
          status: 'running',
          startedAt: new Date(Date.now() - Math.floor(process.uptime()) * 1000).toISOString(),
          uptime: process.uptime()
        },
        {
          id: 'booking-processor',
          name: 'Booking Processor',
          status: 'running',
          startedAt: new Date(Date.now() - Math.floor(process.uptime()) * 1000).toISOString(),
          uptime: process.uptime()
        }
      ]
    });
  } catch (error) {
    console.error('Error fetching workflow status:', error);
    res.status(500).json({ error: 'Failed to fetch workflow status' });
  }
});

export default debugRouter;