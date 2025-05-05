import { Router, Request, Response } from 'express';
import { 
  getAllConfig, 
  getConfigValue, 
  setConfigValue, 
  initializeConfig,
  SystemConfigKey 
} from '../services/config-service';
import { log } from '../vite';

const router = Router();

// Initialize configuration when the server starts
initializeConfig().catch(err => {
  log(`Failed to initialize configuration: ${err}`);
});

// Get all configuration values
router.get('/api/config', async (req, res) => {
  try {
    const config = await getAllConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    log(`Error getting config: ${error}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get configuration',
      error: (error as Error).message
    });
  }
});

// Get a specific configuration value
router.get('/api/config/:key', async (req, res) => {
  try {
    const key = req.params.key as SystemConfigKey;
    const value = await getConfigValue(key);
    res.json({
      success: true,
      data: { key, value }
    });
  } catch (error) {
    log(`Error getting config value: ${error}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get configuration value',
      error: (error as Error).message
    });
  }
});

// Update configuration values (bulk or single)
router.post('/api/config', async (req, res) => {
  try {
    const configValues = req.body;
    const results: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(configValues)) {
      await setConfigValue(key as SystemConfigKey, value as any);
      results[key] = value;
    }
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: results
    });
  } catch (error) {
    log(`Error updating config: ${error}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update configuration',
      error: (error as Error).message
    });
  }
});

// Update a specific configuration value
router.post('/api/config/:key', async (req, res) => {
  try {
    const key = req.params.key as SystemConfigKey;
    const value = req.body.value;
    
    await setConfigValue(key, value);
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: { key, value }
    });
  } catch (error) {
    log(`Error updating config value: ${error}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update configuration value',
      error: (error as Error).message
    });
  }
});

// Dedicated endpoint for toggling auto-dispatch - POST method
router.post('/api/toggle-auto-dispatch', async (req: Request, res: Response) => {
  try {
    // Get current value
    const currentValue = await getConfigValue('AUTO_DISPATCH_ENABLED');
    // Toggle to opposite value
    const newValue = currentValue === 'true' ? 'false' : 'true';
    
    // Set the new value
    await setConfigValue('AUTO_DISPATCH_ENABLED', newValue);
    
    // Log the change
    log(`Auto-dispatch ${newValue === 'true' ? 'enabled' : 'disabled'}`);
    
    res.json({
      success: true,
      message: `Auto-dispatch ${newValue === 'true' ? 'enabled' : 'disabled'}`,
      data: { 
        key: 'AUTO_DISPATCH_ENABLED', 
        value: newValue,
        enabled: newValue === 'true'
      }
    });
  } catch (error) {
    log(`Error toggling auto-dispatch: ${error}`);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle auto-dispatch',
      error: (error as Error).message
    });
  }
});

// Also support PATCH method for the same functionality
router.patch('/api/toggle-auto-dispatch', async (req: Request, res: Response) => {
  try {
    // Get current value
    const currentValue = await getConfigValue('AUTO_DISPATCH_ENABLED');
    // Toggle to opposite value
    const newValue = currentValue === 'true' ? 'false' : 'true';
    
    // Set the new value
    await setConfigValue('AUTO_DISPATCH_ENABLED', newValue);
    
    // Log the change
    log(`Auto-dispatch ${newValue === 'true' ? 'enabled' : 'disabled'}`);
    
    res.json({
      success: true,
      message: `Auto-dispatch ${newValue === 'true' ? 'enabled' : 'disabled'}`,
      data: { 
        key: 'AUTO_DISPATCH_ENABLED', 
        value: newValue,
        enabled: newValue === 'true'
      }
    });
  } catch (error) {
    log(`Error toggling auto-dispatch: ${error}`);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle auto-dispatch',
      error: (error as Error).message
    });
  }
});

// Dedicated endpoint for toggling auto-merge - POST method
router.post('/api/toggle-auto-merge', async (req: Request, res: Response) => {
  try {
    // Get current value 
    const currentValue = await getConfigValue('TRIP_MERGE_AUTO_ENABLED');
    // Toggle to opposite value
    const newValue = typeof currentValue === 'boolean' 
      ? (!currentValue).toString() 
      : currentValue === 'true' ? 'false' : 'true';
    
    // Set the new value
    await setConfigValue('TRIP_MERGE_AUTO_ENABLED', newValue);
    
    // Log the change
    log(`Auto-merge ${newValue === 'true' ? 'enabled' : 'disabled'}`);
    
    res.json({
      success: true,
      message: `Auto-merge ${newValue === 'true' ? 'enabled' : 'disabled'}`,
      data: { 
        key: 'TRIP_MERGE_AUTO_ENABLED', 
        value: newValue,
        enabled: newValue === 'true'
      }
    });
  } catch (error) {
    log(`Error toggling auto-merge: ${error}`);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle auto-merge',
      error: (error as Error).message
    });
  }
});

// Also support PATCH method for auto-merge
router.patch('/api/toggle-auto-merge', async (req: Request, res: Response) => {
  try {
    // Get current value
    const currentValue = await getConfigValue('TRIP_MERGE_AUTO_ENABLED');
    // Toggle to opposite value
    const newValue = typeof currentValue === 'boolean' 
      ? (!currentValue).toString() 
      : currentValue === 'true' ? 'false' : 'true';
    
    // Set the new value
    await setConfigValue('TRIP_MERGE_AUTO_ENABLED', newValue);
    
    // Log the change
    log(`Auto-merge ${newValue === 'true' ? 'enabled' : 'disabled'}`);
    
    res.json({
      success: true,
      message: `Auto-merge ${newValue === 'true' ? 'enabled' : 'disabled'}`,
      data: { 
        key: 'TRIP_MERGE_AUTO_ENABLED', 
        value: newValue,
        enabled: newValue === 'true'
      }
    });
  } catch (error) {
    log(`Error toggling auto-merge: ${error}`);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle auto-merge',
      error: (error as Error).message
    });
  }
});

export default router;