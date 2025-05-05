import { db } from '../db';
import { systemConfig, insertSystemConfigSchema } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { log } from '../vite';

// Default values for system configuration
const DEFAULT_CONFIG = {
  // Trip merging parameters
  TRIP_MERGE_AUTO_ENABLED: true, // Whether automated trip merging is enabled
  TRIP_MERGE_AUTO_CHECK_INTERVAL_SECONDS: 60, // How often to check for potential trip merges (in seconds)
  
  // Proximity and zone parameters
  TRIP_MERGE_PICKUP_DISTANCE_KM: 7, // Maximum distance between pickup locations (in km)
  TRIP_MERGE_DROPOFF_DISTANCE_KM: 7, // Maximum distance between dropoff locations (in km)
  TRIP_MERGE_SAME_ZONE_REQUIRED: true, // Whether pickup/dropoff must be in same zone
  
  // Time compatibility parameters
  TRIP_MERGE_PICKUP_TIME_WINDOW_MINUTES: 15, // Maximum time difference between pickups
  TRIP_MERGE_DROPOFF_TIME_WINDOW_MINUTES: 15, // Maximum time difference between dropoffs
  TRIP_MERGE_MAX_PICKUP_GAP_MINUTES: 15, // Maximum time gap between consecutive pickups
  TRIP_MERGE_MAX_TRIP_DURATION_MINUTES: 120, // Maximum total trip duration allowed
  
  // Booking compatibility parameters
  TRIP_MERGE_SAME_VEHICLE_TYPE_REQUIRED: true, // Whether bookings must use same vehicle type
  TRIP_MERGE_SAME_BOOKING_TYPE_REQUIRED: true, // Whether bookings must be of same type
  TRIP_MERGE_SAME_PRIORITY_REQUIRED: true, // Whether bookings must have same priority
  
  // Route optimization parameters
  TRIP_MERGE_ROUTE_DEVIATION_TOLERANCE_KM: 3, // Maximum allowed route deviation
  
  // Auto dispatch parameters
  AUTO_DISPATCH_ENABLED: true, // Whether auto dispatch is enabled
  AUTO_DISPATCH_BUFFER_MINUTES: 30, // How many minutes before pickup time to dispatch
  AUTO_DISPATCH_CHECK_INTERVAL_SECONDS: 60, // How often to check for potential dispatches (in seconds)
  
  // Google Maps API key (never expose this to the client)
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '',
  
  // UI configuration
  UI_REFRESH_INTERVAL_SECONDS: 10, // How often the UI should refresh data (in seconds)
};

// Type for system configuration parameters
export type SystemConfigKey = keyof typeof DEFAULT_CONFIG;
export type SystemConfigValue = string | number | boolean;

/**
 * Get a configuration value by key
 */
export async function getConfigValue<T extends SystemConfigValue>(key: SystemConfigKey): Promise<T> {
  try {
    // Try to get from database first
    const [configEntry] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, key));
    
    if (configEntry) {
      // Parse the value based on the default value type
      const defaultValue = DEFAULT_CONFIG[key];
      if (typeof defaultValue === 'number') {
        return Number(configEntry.value) as T;
      } else if (typeof defaultValue === 'boolean') {
        return (configEntry.value === 'true') as unknown as T;
      }
      return configEntry.value as T;
    }
    
    // If not found in database, return the default value
    const defaultValue = DEFAULT_CONFIG[key];
    
    // Create the entry in the database for future edits
    await db.insert(systemConfig).values({
      key: key,
      value: String(defaultValue),
      description: `Auto-created configuration for ${key}`,
      group: getConfigGroup(key),
      data_type: typeof defaultValue,
    });
    
    return defaultValue as T;
  } catch (error) {
    log(`Error getting config value for ${key}: ${error}`);
    return DEFAULT_CONFIG[key] as T;
  }
}

/**
 * Set a configuration value
 */
export async function setConfigValue(key: SystemConfigKey, value: SystemConfigValue): Promise<void> {
  try {
    // Check if config exists
    const [existingConfig] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, key));

    if (existingConfig) {
      // Update existing config
      await db
        .update(systemConfig)
        .set({
          value: String(value),
          updated_at: new Date(),
        })
        .where(eq(systemConfig.key, key));
    } else {
      // Insert new config
      await db.insert(systemConfig).values({
        key: key,
        value: String(value),
        description: `Auto-created configuration for ${key}`,
        group: getConfigGroup(key),
        data_type: typeof value,
      });
    }
  } catch (error) {
    log(`Error setting config value for ${key}: ${error}`);
    throw error;
  }
}

/**
 * Get all configuration values
 */
export async function getAllConfig(): Promise<Record<string, SystemConfigValue>> {
  try {
    const configs = await db.select().from(systemConfig);
    
    // Start with default values
    const result: Record<string, SystemConfigValue> = { ...DEFAULT_CONFIG };
    
    // Override with values from database
    for (const config of configs) {
      const configKey = config.key as SystemConfigKey;
      const defaultValue = DEFAULT_CONFIG[configKey];
      
      if (defaultValue !== undefined) {
        if (typeof defaultValue === 'number') {
          result[configKey] = Number(config.value);
        } else if (typeof defaultValue === 'boolean') {
          result[configKey] = config.value === 'true';
        } else {
          result[configKey] = config.value;
        }
      }
    }
    
    return result;
  } catch (error) {
    log(`Error getting all config values: ${error}`);
    return DEFAULT_CONFIG;
  }
}

/**
 * Initialize the system configuration
 * This ensures all default values are saved to the database
 */
export async function initializeConfig(): Promise<void> {
  try {
    for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
      const configKey = key as SystemConfigKey;
      
      // Check if config exists
      const [existingConfig] = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, configKey));
        
      if (!existingConfig) {
        // Insert new config
        await db.insert(systemConfig).values({
          key: configKey,
          value: String(value),
          description: `Auto-created configuration for ${configKey}`,
          group: getConfigGroup(configKey),
          data_type: typeof value,
        });
      }
    }
    log('System configuration initialized successfully');
  } catch (error) {
    log(`Error initializing system config: ${error}`);
  }
}

/**
 * Get the Google Maps API key with additional cache and validation
 */
let cachedApiKey: string | null = null;

export function getGoogleMapsApiKey(): string {
  // Return cached key if available
  if (cachedApiKey) {
    return cachedApiKey;
  }

  // First try environment variable
  const envKey = process.env.GOOGLE_MAPS_API_KEY;
  if (envKey && envKey.length > 10) {
    cachedApiKey = envKey;
    log(`Using Google Maps API key from environment (length: ${envKey.length})`);
    return envKey;
  }

  // Fall back to config system if environment variable not set or invalid
  const configKey = DEFAULT_CONFIG.GOOGLE_MAPS_API_KEY as string;
  if (configKey && configKey.length > 10) {
    cachedApiKey = configKey;
    log(`Using Google Maps API key from config system (length: ${configKey.length})`);
    return configKey;
  }

  // Log warning if no valid key found
  log('WARNING: No valid Google Maps API key found. Features requiring Google Maps may not work correctly.');
  return envKey || configKey || '';
}

/**
 * Helper function to determine config group based on key prefix
 */
function getConfigGroup(key: string): string {
  if (key.startsWith('TRIP_MERGE_')) {
    return 'trip_merging';
  } else if (key.startsWith('AUTO_DISPATCH_')) {
    return 'auto_dispatch';
  } else if (key.includes('API_KEY')) {
    return 'api_keys';
  } else if (key.startsWith('UI_')) {
    return 'user_interface';
  }
  return 'general';
}