/**
 * GeoUtils class provides utility functions for geospatial operations
 */
export class GeoUtils {
  // Earth radius in km
  private static readonly EARTH_RADIUS_KM = 6371;

  /**
   * Calculate the distance between two geographic coordinates using the Haversine formula
   * @param lat1 Latitude of first point in degrees
   * @param lon1 Longitude of first point in degrees
   * @param lat2 Latitude of second point in degrees
   * @param lon2 Longitude of second point in degrees
   * @returns Distance in kilometers
   */
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Convert degrees to radians
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    // Haversine formula
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = this.EARTH_RADIUS_KM * c;
    
    return distance;
  }

  /**
   * Convert degrees to radians
   * @param degrees Angle in degrees
   * @returns Angle in radians
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate the center point of an array of coordinates
   * @param coordinates Array of {lat, lng} objects
   * @returns Center point as {lat, lng}
   */
  static calculateCenter(coordinates: Array<{lat: number, lng: number}>): {lat: number, lng: number} {
    if (coordinates.length === 0) {
      throw new Error('Cannot calculate center of empty coordinates array');
    }
    
    let sumLat = 0;
    let sumLng = 0;
    
    for (const coord of coordinates) {
      sumLat += coord.lat;
      sumLng += coord.lng;
    }
    
    return {
      lat: sumLat / coordinates.length,
      lng: sumLng / coordinates.length
    };
  }

  /**
   * Check if a location is within a specified radius of another location
   * @param centerLat Center latitude
   * @param centerLng Center longitude
   * @param pointLat Point latitude to check
   * @param pointLng Point longitude to check
   * @param radiusKm Radius in kilometers
   * @returns Boolean indicating if point is within radius
   */
  static isWithinRadius(
    centerLat: number, 
    centerLng: number, 
    pointLat: number, 
    pointLng: number, 
    radiusKm: number
  ): boolean {
    const distance = this.calculateDistance(centerLat, centerLng, pointLat, pointLng);
    return distance <= radiusKm;
  }
}

// Legacy export format for backward compatibility
export const calculateDistance = GeoUtils.calculateDistance.bind(GeoUtils);
export const calculateCenter = GeoUtils.calculateCenter.bind(GeoUtils);
export const isWithinRadius = GeoUtils.isWithinRadius.bind(GeoUtils);
export const haversineDistance = GeoUtils.calculateDistance.bind(GeoUtils);

// Added to maintain compatibility with trip-merge-service
export function calculateRouteWithStops(origin: any, destination: any, stops: any[] = []): any {
  console.log('Calculating route with stops', { origin, destination, stops });
  // Simple implementation that returns a direct route from origin to destination
  return {
    route: [origin, ...stops, destination],
    distance: 0, // In a real implementation, this would be calculated
    duration: 0, // In a real implementation, this would be calculated
  };
}