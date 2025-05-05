import axios from 'axios';
import { getConfigValue } from './config-service';
import { log } from '../vite';

// Variable to track the current interval ID
let autoDispatchIntervalId: NodeJS.Timeout | null = null;

/**
 * Setup automated dispatch service
 * This checks periodically if auto-dispatch is enabled, and if so,
 * triggers the dispatch process for eligible bookings
 */
export function setupAutomatedDispatch(): NodeJS.Timeout {
  log('Setting up automated dispatch service...');
  
  // Clear any existing interval to prevent duplicate processes
  if (autoDispatchIntervalId) {
    clearInterval(autoDispatchIntervalId);
    log('Cleared existing auto-dispatch interval');
  }
  
  const intervalId = setInterval(async () => {
    try {
      // Check if auto-dispatch is enabled in configuration
      const autoDispatchEnabled = await getConfigValue<boolean>('AUTO_DISPATCH_ENABLED');
      const checkIntervalSeconds = await getConfigValue<number>('AUTO_DISPATCH_CHECK_INTERVAL_SECONDS');
      
      if (autoDispatchEnabled === true) {
        log(`Running automated dispatch check (interval: ${checkIntervalSeconds} seconds)`);
        // Make an internal API call to the auto-dispatch endpoint
        await axios.post('http://localhost:5000/api/dispatch/auto');
      } else {
        // Skip this cycle as auto-dispatch is disabled
        log('Automated dispatch is disabled, skipping check');
      }
    } catch (error) {
      log(`Error in automated dispatch service: ${error}`);
    }
  }, 60000); // Default to checking every minute
  
  // Store the interval ID for later reference
  autoDispatchIntervalId = intervalId;
  
  return intervalId;
}

/**
 * Get the current state of the automated dispatch service
 * @returns true if auto-dispatch is running, false if not
 */
export async function isAutoDispatchRunning(): Promise<boolean> {
  try {
    const autoDispatchEnabled = await getConfigValue<boolean>('AUTO_DISPATCH_ENABLED');
    return autoDispatchEnabled === true;
  } catch (error) {
    log(`Error checking auto-dispatch state: ${error}`);
    return false;
  }
}

/**
 * Stop the automated dispatch service
 */
export function stopAutomatedDispatch(): void {
  if (autoDispatchIntervalId) {
    clearInterval(autoDispatchIntervalId);
    autoDispatchIntervalId = null;
    log('Automated dispatch service stopped');
  }
}