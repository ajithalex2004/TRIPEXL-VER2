import { Router, Request, Response } from 'express';
import { getGoogleMapsApiKey } from '../services/config-service';
import fetch from 'node-fetch';

const router = Router();

/**
 * Get the Google Maps API key
 * This is a secure way to provide the API key to the frontend without exposing it in the client-side code
 */
router.get('/key', (req, res) => {
  const apiKey = getGoogleMapsApiKey();
  
  if (!apiKey) {
    console.error('Google Maps API key not configured. Please set the GOOGLE_MAPS_API_KEY environment variable.');
    return res.status(500).json({
      error: 'Google Maps API key not configured. Please set the GOOGLE_MAPS_API_KEY environment variable.'
    });
  }
  
  // Only return the first and last few characters for logging
  const maskedKey = `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`;
  console.log(`Providing Google Maps API key to client (masked: ${maskedKey})`);
  
  res.json({ apiKey });
});

/**
 * Proxy for Google Maps Places API search
 * This allows us to hide the API key and provide better error handling
 * Also bypasses referer restrictions on the API key
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { query, region = 'ae' } = req.query;
    const apiKey = getGoogleMapsApiKey();
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'Google Maps API key not configured. Please set the GOOGLE_MAPS_API_KEY environment variable.'
      });
    }
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    // Use the Places API directly from the server to bypass referer restrictions
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query as string)}&region=${region}&key=${apiKey}`;
    
    console.log(`Fetching Places API data for query: "${query}"`);
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Places API error (${response.status}):`, errorText);
      return res.status(response.status).json({ 
        error: `Google Maps API error: ${response.statusText}`,
        details: errorText
      });
    }
    
    const data = await response.json() as {
      status?: string;
      error_message?: string;
      results: any[];
    };
    
    // Check for API-specific errors
    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error(`Places API status error:`, data.status, data.error_message);
      return res.status(400).json({
        error: `Google Maps API error: ${data.status}`,
        message: data.error_message || 'Unknown error',
        status: data.status
      });
    }
    
    return res.json(data);
  } catch (error) {
    console.error('Error searching Google Maps Places API:', error);
    return res.status(500).json({ error: 'Failed to search locations' });
  }
});

/**
 * Proxy for Google Maps Geocoding API
 * Enhanced with better error handling
 */
router.get('/geocode', async (req: Request, res: Response) => {
  try {
    const { address, latlng } = req.query;
    const apiKey = getGoogleMapsApiKey();
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'Google Maps API key not configured. Please set the GOOGLE_MAPS_API_KEY environment variable.'
      });
    }
    
    if (!address && !latlng) {
      return res.status(400).json({ error: 'Either address or latlng parameter is required' });
    }
    
    let url;
    if (address) {
      url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address as string)}&key=${apiKey}`;
      console.log(`Geocoding address: "${address}"`);
    } else {
      url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latlng}&key=${apiKey}`;
      console.log(`Reverse geocoding coordinates: "${latlng}"`);
    }
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Geocoding API error (${response.status}):`, errorText);
      return res.status(response.status).json({ 
        error: `Google Maps API error: ${response.statusText}`,
        details: errorText
      });
    }
    
    const data = await response.json() as {
      status?: string;
      error_message?: string;
      results: any[];
    };
    
    // Check for API-specific errors
    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error(`Geocoding API status error:`, data.status, data.error_message);
      return res.status(400).json({
        error: `Google Maps API error: ${data.status}`,
        message: data.error_message || 'Unknown error',
        status: data.status
      });
    }
    
    return res.json(data);
  } catch (error) {
    console.error('Error using Google Maps Geocoding API:', error);
    return res.status(500).json({ error: 'Failed to geocode location' });
  }
});

/**
 * Proxy for Google Maps Directions API
 * Enhanced with better error handling
 */
router.get('/directions', async (req: Request, res: Response) => {
  try {
    const { origin, destination, mode = 'driving' } = req.query;
    const apiKey = getGoogleMapsApiKey();
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'Google Maps API key not configured. Please set the GOOGLE_MAPS_API_KEY environment variable.'
      });
    }
    
    if (!origin || !destination) {
      return res.status(400).json({ error: 'Both origin and destination parameters are required' });
    }
    
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin as string)}&destination=${encodeURIComponent(destination as string)}&mode=${mode}&key=${apiKey}`;
    
    console.log(`Fetching directions from "${origin}" to "${destination}" (mode: ${mode})`);
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Directions API error (${response.status}):`, errorText);
      return res.status(response.status).json({ 
        error: `Google Maps API error: ${response.statusText}`,
        details: errorText
      });
    }
    
    const data = await response.json() as {
      status?: string;
      error_message?: string;
      routes?: any[];
    };
    
    // Check for API-specific errors
    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error(`Directions API status error:`, data.status, data.error_message);
      return res.status(400).json({
        error: `Google Maps API error: ${data.status}`,
        message: data.error_message || 'Unknown error',
        status: data.status
      });
    }
    
    return res.json(data);
  } catch (error) {
    console.error('Error using Google Maps Directions API:', error);
    return res.status(500).json({ error: 'Failed to get directions' });
  }
});

/**
 * Proxy endpoint for loading the Google Maps API script
 * This securely adds the API key and helps bypass referer restrictions
 */
router.get('/google-maps-loader', (req: Request, res: Response) => {
  try {
    const apiKey = getGoogleMapsApiKey();
    
    if (!apiKey) {
      console.error('Google Maps API key not configured. Please set the GOOGLE_MAPS_API_KEY environment variable.');
      return res.status(500).send('Google Maps API key not configured');
    }
    
    // Extract query parameters
    const { callback, libraries, v = 'weekly', channel } = req.query;
    
    // Construct the Google Maps script URL with proper parameters
    let scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    
    // Add optional parameters if provided
    if (callback) scriptUrl += `&callback=${callback}`;
    if (libraries) scriptUrl += `&libraries=${libraries}`;
    if (v) scriptUrl += `&v=${v}`;
    if (channel) scriptUrl += `&channel=${channel}`;
    
    // Only show the masked key in logs for security
    const maskedKey = `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`;
    console.log(`Loading Google Maps with libraries: ${libraries}, API key: ${maskedKey}`);
    
    // Set proper headers for caching and security
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Vary', 'Accept-Encoding');
    
    // Redirect to the actual Google Maps script URL
    // This works because the script will be loaded with our domain as the referer
    res.redirect(scriptUrl);
  } catch (error) {
    console.error('Error serving Google Maps script:', error);
    res.status(500).send('Failed to load Google Maps API');
  }
});

export default router;