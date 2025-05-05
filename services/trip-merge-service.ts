import { storage } from '../storage';
import { Booking, Driver, Vehicle } from '../../shared/schema';
import { log } from '../vite';
import { calculateDistance, calculateRouteWithStops } from '../utils/geo-utils';
import { getConfigValue } from './config-service';

/**
 * Service for handling trip merging logic
 * This implements the detailed merging logic based on the provided blueprint
 */

// CORE ELIGIBILITY FUNCTIONS

/**
 * Check if pickup locations are near enough to merge
 */
export async function isPickupNearby(pickupA: any, pickupB: any): Promise<boolean> {
  const maxDistance = await getConfigValue<number>('TRIP_MERGE_PICKUP_DISTANCE_KM');
  const sameZoneRequired = await getConfigValue<boolean>('TRIP_MERGE_SAME_ZONE_REQUIRED');
  
  const distance = calculateDistance(
    pickupA.coordinates.lat, 
    pickupA.coordinates.lng, 
    pickupB.coordinates.lat, 
    pickupB.coordinates.lng
  );
  
  if (distance > maxDistance) {
    return false;
  }
  
  if (sameZoneRequired && pickupA.zone !== pickupB.zone) {
    return false;
  }
  
  return true;
}

/**
 * Check if dropoff locations are near enough to merge
 */
export async function isDropoffNearby(dropoffA: any, dropoffB: any): Promise<boolean> {
  const maxDistance = await getConfigValue<number>('TRIP_MERGE_DROPOFF_DISTANCE_KM');
  const sameZoneRequired = await getConfigValue<boolean>('TRIP_MERGE_SAME_ZONE_REQUIRED');
  
  const distance = calculateDistance(
    dropoffA.coordinates.lat, 
    dropoffA.coordinates.lng, 
    dropoffB.coordinates.lat, 
    dropoffB.coordinates.lng
  );
  
  if (distance > maxDistance) {
    return false;
  }
  
  if (sameZoneRequired && dropoffA.zone !== dropoffB.zone) {
    return false;
  }
  
  return true;
}

/**
 * Check if pickup and dropoff times are compatible for merging
 */
export async function isTimeCompatible(timeA: { pickup: Date, dropoff: Date }, timeB: { pickup: Date, dropoff: Date }): Promise<boolean> {
  const pickupTimeWindowMinutes = await getConfigValue<number>('TRIP_MERGE_PICKUP_TIME_WINDOW_MINUTES');
  const dropoffTimeWindowMinutes = await getConfigValue<number>('TRIP_MERGE_DROPOFF_TIME_WINDOW_MINUTES');
  
  // Convert to milliseconds for comparison
  const pickupTimeWindowMs = pickupTimeWindowMinutes * 60 * 1000;
  const dropoffTimeWindowMs = dropoffTimeWindowMinutes * 60 * 1000;
  
  const pickupTimeA = timeA.pickup.getTime();
  const pickupTimeB = timeB.pickup.getTime();
  const dropoffTimeA = timeA.dropoff.getTime();
  const dropoffTimeB = timeB.dropoff.getTime();
  
  // Check if pickup times are within the window
  if (Math.abs(pickupTimeA - pickupTimeB) > pickupTimeWindowMs) {
    return false;
  }
  
  // Check if dropoff times are within the window
  if (Math.abs(dropoffTimeA - dropoffTimeB) > dropoffTimeWindowMs) {
    return false;
  }
  
  return true;
}

/**
 * Check if vehicle is compatible with all bookings
 */
export async function isVehicleCompatible(vehicle: Vehicle, bookings: Booking[]): Promise<boolean> {
  const sameVehicleTypeRequired = await getConfigValue<boolean>('TRIP_MERGE_SAME_VEHICLE_TYPE_REQUIRED');
  
  // Check if all bookings require the same vehicle type
  if (sameVehicleTypeRequired) {
    const vehicleType = bookings[0].vehicle_type;
    if (bookings.some(booking => booking.vehicle_type !== vehicleType)) {
      return false;
    }
  }
  
  // Check if the vehicle type matches what's required (if specified)
  if (bookings[0].vehicle_type && vehicle.vehicle_type !== bookings[0].vehicle_type) {
    return false;
  }
  
  // Check if the vehicle has enough capacity for all passengers
  const totalPassengers = bookings.reduce((sum, booking) => sum + (booking.passenger_count || 1), 0);
  if (vehicle.capacity < totalPassengers) {
    return false;
  }
  
  return true;
}

/**
 * Check if booking types are compatible for merging
 */
export async function isBookingTypeCompatible(bookings: Booking[]): Promise<boolean> {
  const sameBookingTypeRequired = await getConfigValue<boolean>('TRIP_MERGE_SAME_BOOKING_TYPE_REQUIRED');
  
  if (!sameBookingTypeRequired) {
    return true;
  }
  
  const bookingType = bookings[0].booking_type;
  return bookings.every(booking => booking.booking_type === bookingType);
}

/**
 * Check if booking priorities are compatible for merging
 */
export async function isPriorityMatchSafe(bookings: Booking[]): Promise<boolean> {
  const samePriorityRequired = await getConfigValue<boolean>('TRIP_MERGE_SAME_PRIORITY_REQUIRED');
  
  if (!samePriorityRequired) {
    return true;
  }
  
  const priority = bookings[0].priority;
  return bookings.every(booking => booking.priority === priority);
}

/**
 * Check if the route deviation is within acceptable tolerance
 */
export async function isRouteDeviationAllowed(originalRoute: any, mergedRoute: any): Promise<boolean> {
  const toleranceKm = await getConfigValue<number>('TRIP_MERGE_ROUTE_DEVIATION_TOLERANCE_KM');
  
  // Calculate deviation between routes
  // This is a simplified approach - in a real system, you would use actual route data from a routing API
  const originalDistance = originalRoute.distance;
  const mergedDistance = mergedRoute.distance;
  
  const deviation = Math.abs(mergedDistance - originalDistance);
  return deviation <= toleranceKm;
}

/**
 * Check if pickup time gaps are acceptable
 */
export async function isPickupGapAcceptable(bookings: Booking[]): Promise<boolean> {
  const maxPickupGapMinutes = await getConfigValue<number>('TRIP_MERGE_MAX_PICKUP_GAP_MINUTES');
  const maxPickupGapMs = maxPickupGapMinutes * 60 * 1000;
  
  // Extract and sort pickup times
  const pickupTimes = bookings
    .map(booking => booking.pickup_time.getTime())
    .sort((a, b) => a - b);
  
  // Check gaps between consecutive pickups
  for (let i = 1; i < pickupTimes.length; i++) {
    if (pickupTimes[i] - pickupTimes[i - 1] > maxPickupGapMs) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if the total trip duration is within acceptable limits
 */
export async function isDurationWithinLimit(mergedRoute: any): Promise<boolean> {
  const maxTripDurationMinutes = await getConfigValue<number>('TRIP_MERGE_MAX_TRIP_DURATION_MINUTES');
  const maxTripDurationMs = maxTripDurationMinutes * 60 * 1000;
  
  return mergedRoute.duration <= maxTripDurationMs;
}

/**
 * Check if zone restrictions allow merging
 */
export function isZoneAllowed(zones: string[]): boolean {
  // This would check if any zones have restrictions against merging
  // For now, we'll assume no restricted zones
  return true;
}

/**
 * Check if driver is available for the merged trip time slot
 */
export function isDriverAvailable(driver: Driver, timeSlot: { start: Date, end: Date }): boolean {
  // This would check the driver's schedule against the time slot
  // For simplicity, we'll assume availability if the driver exists
  return !!driver;
}

/**
 * Main merge eligibility check function that applies all criteria
 */
export async function checkMergeEligibility(booking: Booking, candidateBookings: Booking[]): Promise<Booking[]> {
  // Filter out bookings that don't meet the criteria
  const eligibleBookings: Booking[] = [];
  
  for (const candidate of candidateBookings) {
    try {
      if (booking.id === candidate.id) {
        continue; // Skip self
      }
      
      // Check basic eligibility conditions first to avoid unnecessary calculations
      if (!(await isPickupNearby(booking.pickup_location, candidate.pickup_location))) {
        continue;
      }
      
      if (!(await isDropoffNearby(booking.dropoff_location, candidate.dropoff_location))) {
        continue;
      }
      
      const timeA = { 
        pickup: booking.pickup_time, 
        dropoff: booking.dropoff_time || new Date(booking.pickup_time.getTime() + 3600000) // Fallback if dropoff not set
      };
      
      const timeB = { 
        pickup: candidate.pickup_time, 
        dropoff: candidate.dropoff_time || new Date(candidate.pickup_time.getTime() + 3600000) // Fallback if dropoff not set
      };
      
      if (!(await isTimeCompatible(timeA, timeB))) {
        continue;
      }
      
      if (!(await isBookingTypeCompatible([booking, candidate]))) {
        continue;
      }
      
      if (!(await isPriorityMatchSafe([booking, candidate]))) {
        continue;
      }
      
      // For vehicle compatibility, we need to get actual vehicle data
      // This is placeholder logic and would be replaced with actual vehicle fetching
      const vehicle = candidate.vehicle_id ? await storage.getVehicle(candidate.vehicle_id) : null;
      if (vehicle && !(await isVehicleCompatible(vehicle, [booking, candidate]))) {
        continue;
      }
      
      // For route calculation, we would calculate optimized routes
      // This is placeholder logic and would be replaced with actual route calculation
      const originalRoute = { 
        distance: calculateDistance(
          booking.pickup_location.coordinates.lat,
          booking.pickup_location.coordinates.lng,
          booking.dropoff_location.coordinates.lat,
          booking.dropoff_location.coordinates.lng
        ),
        duration: 30 * 60 * 1000 // 30 minutes in milliseconds
      };
      
      const mergedRoute = await calculateRouteWithStops([
        { 
          lat: booking.pickup_location.coordinates.lat, 
          lng: booking.pickup_location.coordinates.lng 
        },
        { 
          lat: candidate.pickup_location.coordinates.lat,
          lng: candidate.pickup_location.coordinates.lng
        },
        { 
          lat: booking.dropoff_location.coordinates.lat,
          lng: booking.dropoff_location.coordinates.lng
        },
        { 
          lat: candidate.dropoff_location.coordinates.lat,
          lng: candidate.dropoff_location.coordinates.lng
        }
      ]);
      
      if (!(await isRouteDeviationAllowed(originalRoute, mergedRoute))) {
        continue;
      }
      
      if (!(await isPickupGapAcceptable([booking, candidate]))) {
        continue;
      }
      
      if (!(await isDurationWithinLimit(mergedRoute))) {
        continue;
      }
      
      if (!isZoneAllowed([
        booking.pickup_location.zone || "",
        candidate.pickup_location.zone || "",
        booking.dropoff_location.zone || "",
        candidate.dropoff_location.zone || ""
      ])) {
        continue;
      }
      
      // If we've reached here, the candidate is eligible for merging
      eligibleBookings.push(candidate);
      
    } catch (error) {
      log(`Error checking merge eligibility between bookings ${booking.id} and ${candidate.id}: ${error}`);
      // Skip this candidate on error
    }
  }
  
  return eligibleBookings;
}

/**
 * Function to find all potential trip merges in the system
 */
export async function findPotentialTripMerges(): Promise<{ booking: Booking, mergeCandidates: Booking[] }[]> {
  try {
    // Get all bookings that aren't already merged and are in a state where they can be merged
    const bookings = await storage.getBookingsEligibleForMerging();
    
    // Find merge candidates for each booking
    const potentialMerges = [];
    
    for (const booking of bookings) {
      // Skip bookings that already have a merged_with_booking_id (are already part of a merged trip)
      if (booking.merged_with_booking_id || booking.trip_id) {
        continue;
      }
      
      // Find potential merge candidates
      const mergeCandidates = await checkMergeEligibility(booking, bookings);
      
      if (mergeCandidates.length > 0) {
        potentialMerges.push({ booking, mergeCandidates });
      }
    }
    
    return potentialMerges;
    
  } catch (error) {
    log(`Error finding potential trip merges: ${error}`);
    return [];
  }
}

/**
 * Find potential merges for a specific booking - even with trips that are in progress
 * This is used for the manual merge functionality where operators can combine any bookings
 * until they reach 'Completed' status
 */
export async function findPotentialMergesForBooking(bookingId: number): Promise<{ booking: Booking, mergeCandidates: Booking[] }> {
  try {
    // Get the source booking
    const [booking] = await storage.getBooking(bookingId);
    
    if (!booking) {
      throw new Error(`Booking with ID ${bookingId} not found`);
    }
    
    // Get all active bookings (anything not completed or cancelled)
    const allActiveBookings = await storage.getActiveBookings();
    
    // Filter candidates to include only those that aren't completed
    const eligibleCandidates = allActiveBookings.filter(candidate => 
      candidate.id !== bookingId &&                        // Not the same booking
      candidate.status !== 'Completed' &&                 // Not completed
      candidate.status !== 'Cancelled' &&                 // Not cancelled
      !candidate.merged_with_booking_id                   // Not already part of another merged trip
    );
    
    // Check for merge compatibility with more relaxed criteria for manual merging
    const mergeCandidates = await checkManualMergeEligibility(booking, eligibleCandidates);
    
    return { booking, mergeCandidates };
    
  } catch (error) {
    log(`Error finding potential merges for booking ${bookingId}: ${error}`);
    throw error;
  }
}

/**
 * Check merge eligibility with more relaxed criteria for manual operations
 * This allows more flexibility for operators while still preserving essential compatibility checks
 */
export async function checkManualMergeEligibility(booking: Booking, candidateBookings: Booking[]): Promise<Booking[]> {
  // Filter out bookings that don't meet the criteria
  const eligibleBookings: Booking[] = [];
  
  for (const candidate of candidateBookings) {
    try {
      if (booking.id === candidate.id) {
        continue; // Skip self
      }
      
      // For manual merging, we relax some constraints but keep core compatibility checks
      
      // Still require pickup locations to be reasonably close
      if (!(await isPickupNearby(booking.pickup_location, candidate.pickup_location))) {
        continue;
      }
      
      // Still require dropoff locations to be reasonably close
      if (!(await isDropoffNearby(booking.dropoff_location, candidate.dropoff_location))) {
        continue;
      }
      
      // For manual merging, we're more flexible with timing
      // We'll only check if booking types are compatible
      if (!(await isBookingTypeCompatible([booking, candidate]))) {
        continue;
      }
      
      // If the combined passenger count exceeds vehicle capacity, we shouldn't merge
      const totalPassengers = (booking.passenger_count || 1) + (candidate.passenger_count || 1);
      if (booking.vehicle_id) {
        const vehicle = await storage.getVehicle(booking.vehicle_id);
        if (vehicle && vehicle.capacity < totalPassengers) {
          continue;
        }
      }
      
      // If we've reached here, the candidate is eligible for manual merging
      eligibleBookings.push(candidate);
      
    } catch (error) {
      log(`Error checking manual merge eligibility between bookings ${booking.id} and ${candidate.id}: ${error}`);
      // Skip this candidate on error
    }
  }
  
  return eligibleBookings;
}

/**
 * Execute the merging of trips based on eligibility
 */
export async function executeTripMerges(): Promise<void> {
  try {
    const autoMergeEnabled = await getConfigValue<boolean>('TRIP_MERGE_AUTO_ENABLED');
    
    if (!autoMergeEnabled) {
      log('Automated trip merging is disabled');
      return;
    }
    
    log('Starting automated trip merging process...');
    
    // Find potential merges
    const potentialMerges = await findPotentialTripMerges();
    log(`Found ${potentialMerges.length} potential trip merges`);
    
    // Execute each merge
    for (const { booking, mergeCandidates } of potentialMerges) {
      try {
        // Create a parent booking to represent the merged trip
        const parentBooking = await storage.createParentBooking(booking);
        
        // Update the original booking to reference the parent
        await storage.updateBookingParent(booking.id, parentBooking.id);
        
        // Update all merge candidates to reference the parent
        for (const candidate of mergeCandidates) {
          await storage.updateBookingParent(candidate.id, parentBooking.id);
        }
        
        log(`Successfully merged booking ${booking.id} with ${mergeCandidates.length} other bookings`);
        
      } catch (mergeError) {
        log(`Error executing merge for booking ${booking.id}: ${mergeError}`);
      }
    }
    
    log('Automated trip merging process completed');
    
  } catch (error) {
    log(`Error in executeTripMerges: ${error}`);
  }
}

/**
 * Check for newly approved bookings and mark them as eligible for merging
 */
export async function checkApprovedBookingsForMerge(): Promise<void> {
  try {
    // Get recently approved bookings
    const approvedBookings = await storage.getRecentlyApprovedBookings();
    
    if (approvedBookings.length === 0) {
      return;
    }
    
    log(`Found ${approvedBookings.length} recently approved bookings to check for merge eligibility`);
    
    // For each approved booking, check if it's eligible for merging
    for (const booking of approvedBookings) {
      try {
        // Get all eligible bookings
        const allEligibleBookings = await storage.getBookingsEligibleForMerging();
        
        // Check if this booking can be merged with others
        const mergeableWith = await checkMergeEligibility(booking, allEligibleBookings);
        
        if (mergeableWith.length > 0) {
          // Mark booking as eligible for merging with a green flag symbol
          await storage.markBookingAsMergeEligible(booking.id, true);
          log(`Booking #${booking.id} marked as eligible for merge with ${mergeableWith.length} other bookings`);
        }
      } catch (error) {
        log(`Error processing approved booking ${booking.id} for merge eligibility: ${error}`);
      }
    }
    
    log('Completed checking approved bookings for merge eligibility');
    
  } catch (error) {
    log(`Error checking approved bookings for merge: ${error}`);
  }
}

/**
 * Create an optimized route plan for a merged trip
 * This generates a detailed route with turn-by-turn directions for drivers,
 * including the optimal order of pickup and dropoff points
 */
export async function generateOptimizedRoutePlan(parentBookingId: number): Promise<any> {
  try {
    // Get the parent booking
    const [parentBooking] = await storage.getBooking(parentBookingId);
    
    if (!parentBooking) {
      throw new Error(`Parent booking with ID ${parentBookingId} not found`);
    }
    
    // Get all child bookings
    const childBookings = await storage.getChildBookings(parentBookingId);
    
    // All bookings involved in this trip
    const allBookings = [parentBooking, ...childBookings];
    
    // Get current vehicle location if assigned, otherwise use the first pickup point
    let startLocation;
    if (parentBooking.assigned_vehicle_id) {
      const vehicle = await storage.getVehicle(parentBooking.assigned_vehicle_id);
      startLocation = vehicle?.current_location?.coordinates || parentBooking.pickup_location.coordinates;
    } else {
      startLocation = parentBooking.pickup_location.coordinates;
    }
    
    // Create a list of all stops (pickup and dropoff points)
    const stops = [];
    
    // Add pickup points
    for (const booking of allBookings) {
      stops.push({
        type: 'pickup',
        location: booking.pickup_location.coordinates,
        address: booking.pickup_location.address,
        bookingId: booking.id,
        bookingRef: booking.reference_no,
        time: booking.pickup_time,
        passengerName: booking.passenger_name || 'Unknown',
        passengerCount: booking.passenger_count || 1,
        priority: booking.priority || 'Normal'
      });
    }
    
    // Add dropoff points
    for (const booking of allBookings) {
      stops.push({
        type: 'dropoff',
        location: booking.dropoff_location.coordinates,
        address: booking.dropoff_location.address,
        bookingId: booking.id,
        bookingRef: booking.reference_no,
        time: booking.dropoff_time || new Date(booking.pickup_time.getTime() + 3600000), // Estimate if not set
        passengerName: booking.passenger_name || 'Unknown',
        passengerCount: booking.passenger_count || 1,
        priority: booking.priority || 'Normal'
      });
    }
    
    // Get Google Maps API key for route optimization
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Google Maps API key not found');
    }
    
    // Build optimized route
    // For the optimal order, we need to consider the pickup time constraints
    // Higher priority bookings should be serviced earlier
    
    // First sort by priority and time
    stops.sort((a, b) => {
      // Sort by priority first (higher priority first)
      if (a.priority !== b.priority) {
        return a.priority === 'High' ? -1 : (b.priority === 'High' ? 1 : 0);
      }
      
      // Then sort by time (earlier pickup/dropoff first)
      return a.time.getTime() - b.time.getTime();
    });
    
    // Build the waypoints for Google Maps Directions API
    const waypoints = stops.map(stop => ({
      location: `${stop.location.lat},${stop.location.lng}`,
      stopover: true
    }));
    
    // The origin is the starting point (vehicle location)
    const origin = `${startLocation.lat},${startLocation.lng}`;
    
    // The destination is the last stop
    const destination = waypoints.length > 0 
      ? waypoints[waypoints.length - 1].location 
      : origin; // Fallback to origin if no waypoints
    
    // Build the API request URL
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&waypoints=optimize:true|${
      waypoints.slice(0, -1).map(wp => wp.location).join('|')
    }&key=${apiKey}`;
    
    // Make the request to Google Maps Directions API
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Maps API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    
    if (data.status !== 'OK') {
      throw new Error(`Google Maps API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }
    
    // Extract the optimized route and waypoint order
    const route = data.routes[0];
    const optimizedOrder = route.waypoint_order || [];
    
    // Reorder stops based on the optimized order
    const optimizedStops = [];
    optimizedStops.push(stops[0]); // First stop is the starting point (not included in waypoint_order)
    
    // Add the stops in the optimized order
    for (const index of optimizedOrder) {
      optimizedStops.push(stops[index + 1]); // +1 because the first stop is not included in waypoint_order
    }
    
    optimizedStops.push(stops[stops.length - 1]); // Last stop is the destination
    
    // Build the final route with detailed information
    const routePlan = {
      parentBookingId,
      totalDistance: route.legs.reduce((sum, leg) => sum + leg.distance.value, 0) / 1000, // Convert to km
      totalDuration: route.legs.reduce((sum, leg) => sum + leg.duration.value, 0) / 60, // Convert to minutes
      stops: optimizedStops.map((stop, index) => ({
        ...stop,
        sequenceNumber: index + 1,
        eta: index > 0 ? new Date(Date.now() + route.legs[index - 1].duration.value * 1000) : new Date()
      })),
      legs: route.legs.map(leg => ({
        distance: leg.distance,
        duration: leg.duration,
        startAddress: leg.start_address,
        endAddress: leg.end_address,
        steps: leg.steps.map(step => ({
          instructions: step.html_instructions,
          distance: step.distance,
          duration: step.duration,
          maneuver: step.maneuver || null
        }))
      })),
      overview_polyline: route.overview_polyline,
      warnings: route.warnings,
      copyrights: route.copyrights
    };
    
    // Update the parent booking with the optimized route
    await storage.updateBookingRoute(parentBookingId, routePlan);
    
    return routePlan;
    
  } catch (error) {
    log(`Error generating optimized route plan for booking ${parentBookingId}: ${error}`);
    throw error;
  }
}

/**
 * Check newly approved bookings for merge recommendations
 * This implements the dynamic planning capability to recommend when newly approved bookings
 * can be merged with existing trips
 */
export async function getMergeRecommendations(bookingId: number): Promise<any[]> {
  try {
    // Get the booking
    const [booking] = await storage.getBooking(bookingId);
    
    if (!booking) {
      throw new Error(`Booking with ID ${bookingId} not found`);
    }
    
    // Only make recommendations for approved bookings
    if (booking.status !== 'Approved') {
      return [];
    }
    
    // Get all active trips (parent bookings that have merged trips and aren't completed)
    const activeTrips = await storage.getActiveTrips();
    
    // Check if this booking can be merged with any active trip
    const recommendations = [];
    
    for (const trip of activeTrips) {
      try {
        // Skip completed trips
        if (trip.status === 'Completed') {
          continue;
        }
        
        // Get all bookings in this trip
        const childBookings = await storage.getChildBookings(trip.id);
        const allTripBookings = [trip, ...childBookings];
        
        // Check basic compatibility
        // For recommendations, we use relaxed criteria similar to manual merging
        
        // Check pickup location proximity
        const isPickupCompatible = await isPickupNearby(booking.pickup_location, trip.pickup_location);
        if (!isPickupCompatible) {
          continue;
        }
        
        // Check dropoff location proximity
        const isDropoffCompatible = await isDropoffNearby(booking.dropoff_location, trip.dropoff_location);
        if (!isDropoffCompatible) {
          continue;
        }
        
        // Check booking type compatibility
        const isTypeCompatible = await isBookingTypeCompatible([booking, ...allTripBookings]);
        if (!isTypeCompatible) {
          continue;
        }
        
        // Calculate the potential merged route
        const potentialStops = [
          { 
            lat: trip.pickup_location.coordinates.lat, 
            lng: trip.pickup_location.coordinates.lng 
          },
          { 
            lat: booking.pickup_location.coordinates.lat,
            lng: booking.pickup_location.coordinates.lng
          },
          { 
            lat: trip.dropoff_location.coordinates.lat,
            lng: trip.dropoff_location.coordinates.lng
          },
          { 
            lat: booking.dropoff_location.coordinates.lat,
            lng: booking.dropoff_location.coordinates.lng
          }
        ];
        
        // Calculate the potential route
        const mergedRoute = await calculateRouteWithStops(potentialStops);
        
        // Check if adding this booking would make the trip too long
        if (!(await isDurationWithinLimit(mergedRoute))) {
          continue;
        }
        
        // Calculate compatibility score (higher is better)
        const pickupDistanceKm = calculateDistance(
          booking.pickup_location.coordinates.lat,
          booking.pickup_location.coordinates.lng,
          trip.pickup_location.coordinates.lat,
          trip.pickup_location.coordinates.lng
        );
        
        const dropoffDistanceKm = calculateDistance(
          booking.dropoff_location.coordinates.lat,
          booking.dropoff_location.coordinates.lng,
          trip.dropoff_location.coordinates.lat,
          trip.dropoff_location.coordinates.lng
        );
        
        // Calculate a score between 0 and 100
        // Lower distances and matching types give higher scores
        const maxDistanceKm = await getConfigValue<number>('TRIP_MERGE_PICKUP_DISTANCE_KM');
        
        const pickupScore = Math.max(0, 100 - (pickupDistanceKm / maxDistanceKm * 100));
        const dropoffScore = Math.max(0, 100 - (dropoffDistanceKm / maxDistanceKm * 100));
        const typeScore = isTypeCompatible ? 100 : 0;
        
        const compatibilityScore = Math.round((pickupScore * 0.4) + (dropoffScore * 0.4) + (typeScore * 0.2));
        
        // Add to recommendations if score is above threshold
        if (compatibilityScore >= 50) {
          recommendations.push({
            tripId: trip.id,
            tripReference: trip.reference_no,
            compatibilityScore,
            pickupDistanceKm,
            dropoffDistanceKm,
            routeDetails: {
              totalDistance: mergedRoute.distance,
              totalDuration: mergedRoute.duration / 60 // Convert to minutes
            },
            savings: {
              distanceSaved: booking.estimated_distance - (mergedRoute.distance - trip.estimated_distance),
              timeSaved: (booking.estimated_duration || 0) - ((mergedRoute.duration - trip.estimated_duration) / 60)
            }
          });
        }
        
      } catch (error) {
        log(`Error checking merge recommendation between booking ${bookingId} and trip ${trip.id}: ${error}`);
        // Skip this trip on error
      }
    }
    
    // Sort recommendations by compatibility score (highest first)
    return recommendations.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    
  } catch (error) {
    log(`Error getting merge recommendations for booking ${bookingId}: ${error}`);
    return [];
  }
}

/**
 * Setup automated trip merging at the configured interval
 */
export function setupAutomatedTripMerging(): NodeJS.Timeout {
  log('Setting up automated trip merging...');
  
  const intervalId = setInterval(async () => {
    try {
      const autoMergeEnabled = await getConfigValue<boolean>('TRIP_MERGE_AUTO_ENABLED');
      const checkIntervalSeconds = await getConfigValue<number>('TRIP_MERGE_AUTO_CHECK_INTERVAL_SECONDS');
      
      if (autoMergeEnabled) {
        log(`Running automated trip merging (interval: ${checkIntervalSeconds} seconds)`);
        
        // First, check for newly approved bookings that could be eligible for merging
        await checkApprovedBookingsForMerge();
        
        // Then execute any automatic merges based on the configured rules
        await executeTripMerges();
      }
    } catch (error) {
      log(`Error in automated trip merging: ${error}`);
    }
  }, 60000); // Default to checking every minute, will be adjusted by config
  
  return intervalId;
}