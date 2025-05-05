import { Router, Request, Response } from 'express';
import { db } from '../db';
import { bookings } from '../../shared/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { log } from '../vite';
import fetch from 'node-fetch';
import { getGoogleMapsApiKey } from '../services/config-service';
import { haversineDistance } from '../utils/geo-utils';
import { 
  findPotentialMergesForBooking, 
  generateOptimizedRoutePlan,
  getMergeRecommendations
} from '../services/trip-merge-service';

const router = Router();

// Generate a unique Trip ID based on date
function generateTripId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = date.getTime().toString().slice(-6);
  return `TRIP_${dateStr}_${timeStr}`;
}

// Optimize route using Google Maps Directions API with waypoint optimization
async function optimizeRoute(
  pickupPoints: Array<{location: {lat: number, lng: number}, bookingId: number}>,
  dropoffPoints: Array<{location: {lat: number, lng: number}, bookingId: number}>,
  startLocation: {lat: number, lng: number} // Driver/vehicle starting location
): Promise<{
  waypoints: Array<{location: {lat: number, lng: number}, stopType: string, bookingId: number}>,
  waypointOrder: number[],
  distance: number,
  duration: number,
  polyline: string
} | null> {
  try {
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
      log('Google Maps API key not configured');
      return null;
    }

    // First, we respect the rule that each pickup must come before its associated dropoff
    // Create array of waypoints with appropriate metadata
    const waypoints = [
      // Start with all pickups
      ...pickupPoints.map(point => ({
        location: point.location,
        stopType: 'pickup',
        bookingId: point.bookingId
      })),
      // Then all dropoffs
      ...dropoffPoints.map(point => ({
        location: point.location,
        stopType: 'dropoff',
        bookingId: point.bookingId
      }))
    ];

    // We need at least one waypoint for optimization
    if (waypoints.length < 1) {
      log('Not enough waypoints for optimization');
      return null;
    }

    // The origin is the vehicle's current location
    const origin = `${startLocation.lat},${startLocation.lng}`;
    
    // The destination is the last dropoff point
    const destination = `${dropoffPoints[dropoffPoints.length - 1].location.lat},${dropoffPoints[dropoffPoints.length - 1].location.lng}`;

    // Format waypoints for the Directions API (excluding the first and last points)
    const waypointsParam = waypoints.slice(0, -1).map(wp => 
      `${wp.location.lat},${wp.location.lng}`
    ).join('|');

    // Build the URL with 'optimize:true' to get the optimal waypoint order
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&waypoints=optimize:true|${waypointsParam}&key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      log(`Error from Google Maps API: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as any;
    if (data.status !== 'OK') {
      log(`Google Maps API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      return null;
    }

    if (!data.routes || data.routes.length === 0) {
      log('No routes returned from Google Maps API');
      return null;
    }

    const route = data.routes[0];
    const optimizedWaypointOrder = route.waypoint_order || [];
    const totalDistance = route.legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0) / 1000; // Convert to km
    const totalDuration = route.legs.reduce((sum: number, leg: any) => sum + leg.duration.value, 0) / 60; // Convert to minutes
    const encodedPolyline = route.overview_polyline?.points || '';

    // Now we need to reorder our waypoints according to the optimization
    // BUT we must always ensure pickups come before their associated dropoffs
    // We'll use the original waypoints array and the optimized order to create a new sequence

    // First, create a mapping of bookingId to pickup and dropoff indices in the final sequence
    const sequenceMap = new Map<number, { pickupIndex: number, dropoffIndex: number }>();

    // Initialize with very high values
    waypoints.forEach(wp => {
      if (!sequenceMap.has(wp.bookingId)) {
        sequenceMap.set(wp.bookingId, { pickupIndex: Infinity, dropoffIndex: Infinity });
      }
    });

    // Now update the sequence based on the optimized waypoint order
    optimizedWaypointOrder.forEach((waypointIdx: number, sequenceIdx: number) => {
      const waypoint = waypoints[waypointIdx];
      const bookingId = waypoint.bookingId;
      const currentMapping = sequenceMap.get(bookingId)!;

      if (waypoint.stopType === 'pickup') {
        currentMapping.pickupIndex = sequenceIdx;
      } else {
        currentMapping.dropoffIndex = sequenceIdx;
      }
      sequenceMap.set(bookingId, currentMapping);
    });

    // Ensure dropoffs always come after pickups for the same booking
    let requiresAdjustment = false;
    sequenceMap.forEach((mapping, bookingId) => {
      if (mapping.pickupIndex > mapping.dropoffIndex) {
        requiresAdjustment = true;
        // We'll handle the adjustment below
      }
    });

    // If we need to adjust the sequence, use a simpler approach
    // that just ensures pickups come before dropoffs
    if (requiresAdjustment) {
      // First all pickups in their original order
      const reorderedWaypoints = waypoints
        .filter(wp => wp.stopType === 'pickup')
        .sort((a, b) => {
          // Use haversine distance to sort pickups by proximity to start location
          const distA = haversineDistance(
            startLocation.lat, startLocation.lng,
            a.location.lat, a.location.lng
          );
          const distB = haversineDistance(
            startLocation.lat, startLocation.lng,
            b.location.lat, b.location.lng
          );
          return distA - distB;
        });

      // Then all dropoffs in order of their associated pickups
      const pickupBookingIds = reorderedWaypoints.map(wp => wp.bookingId);
      const dropoffs = waypoints.filter(wp => wp.stopType === 'dropoff');
      
      // Sort dropoffs to match the pickup order
      pickupBookingIds.forEach(bookingId => {
        const matchingDropoff = dropoffs.find(d => d.bookingId === bookingId);
        if (matchingDropoff) {
          reorderedWaypoints.push(matchingDropoff);
        }
      });

      return {
        waypoints: reorderedWaypoints,
        waypointOrder: reorderedWaypoints.map((_, idx) => idx),
        distance: totalDistance,
        duration: totalDuration,
        polyline: encodedPolyline
      };
    }

    // If no adjustment needed, use the Google-optimized order
    const reorderedWaypoints = optimizedWaypointOrder.map((idx: number) => waypoints[idx]);
    
    return {
      waypoints: reorderedWaypoints,
      waypointOrder: optimizedWaypointOrder,
      distance: totalDistance,
      duration: totalDuration,
      polyline: encodedPolyline
    };
  } catch (error) {
    log(`Error optimizing route: ${error}`);
    return null;
  }
}

/**
 * Route to check if bookings can be merged based on eligibility criteria
 */
router.post('/api/bookings/check-merge-eligibility', async (req: Request, res: Response) => {
  // Initialize checkpointCount at the top of the function to ensure it's accessible in all scopes
  let checkpointCount = 0;
  
  try {
    const { parentBookingId, childBookingIds } = req.body;
    
    if (!parentBookingId || !childBookingIds || !Array.isArray(childBookingIds) || childBookingIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request. parentBookingId and childBookingIds array are required',
        eligibility: {
          canMerge: false,
          reasons: ['Invalid request parameters']
        }
      });
    }
    
    // Verify parent booking exists
    const [parentBooking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, parentBookingId));

    if (!parentBooking) {
      return res.status(404).json({
        success: false,
        message: `Parent booking #${parentBookingId} not found`,
        eligibility: {
          canMerge: false,
          reasons: ['Parent booking not found']
        }
      });
    }

    if (parentBooking.is_merged) {
      return res.status(400).json({
        success: false,
        message: 'Cannot use a merged booking as a parent',
        eligibility: {
          canMerge: false,
          reasons: ['Parent booking is already merged with another booking']
        }
      });
    }
    
    // Get all child bookings and check their eligibility
    const childBookings = [];
    const ineligibleBookings = [];
    const reasons = [];
    
    // Reset checkpointCount for this iteration
    checkpointCount = 0;
    
    for (const childId of childBookingIds) {
      const [childBooking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, childId));
      
      // Checkpoint 1: Check if child booking exists
      checkpointCount++;
      if (!childBooking) {
        ineligibleBookings.push(childId);
        reasons.push(`Checkpoint #1: Booking #${childId} not found`);
        continue;
      }
      
      // Checkpoint 2: Check if child booking is already merged
      checkpointCount++;
      if (childBooking.is_merged) {
        ineligibleBookings.push(childId);
        reasons.push(`Checkpoint #2: Booking #${childId} is already merged with another booking`);
        continue;
      }
      
      // Checkpoint 3: Check if pickup locations are compatible
      checkpointCount++;
      const pickupDistance = haversineDistance(
        parentBooking.pickup_location.coordinates.lat,
        parentBooking.pickup_location.coordinates.lng,
        childBooking.pickup_location.coordinates.lat,
        childBooking.pickup_location.coordinates.lng
      );
      
      // Hardcoded threshold for now - in real implementation would use system config
      if (pickupDistance > 7) { // 7 km threshold 
        ineligibleBookings.push(childId);
        reasons.push(`Checkpoint #3: Booking #${childId} pickup location is too far from parent booking (${pickupDistance.toFixed(2)} km)`);
        continue;
      }
      
      // Checkpoint 4: Check if dropoff locations are compatible
      checkpointCount++;
      const dropoffDistance = haversineDistance(
        parentBooking.dropoff_location.coordinates.lat,
        parentBooking.dropoff_location.coordinates.lng,
        childBooking.dropoff_location.coordinates.lat,
        childBooking.dropoff_location.coordinates.lng
      );
      
      if (dropoffDistance > 7) { // 7 km threshold
        ineligibleBookings.push(childId);
        reasons.push(`Checkpoint #4: Booking #${childId} dropoff location is too far from parent booking (${dropoffDistance.toFixed(2)} km)`);
        continue;
      }
      
      // Checkpoint 5: Check if booking types are compatible
      checkpointCount++;
      if (parentBooking.booking_type !== childBooking.booking_type) {
        ineligibleBookings.push(childId);
        reasons.push(`Checkpoint #5: Booking #${childId} type (${childBooking.booking_type}) doesn't match parent booking type (${parentBooking.booking_type})`);
        continue;
      }
      
      // Checkpoint 6: Check if pickup times are compatible (within 15 min window)
      checkpointCount++;
      // Handle various possible data types safely
      let parentPickupTime: Date;
      if (typeof parentBooking.pickup_time === 'string') {
        parentPickupTime = new Date(parentBooking.pickup_time);
      } else if (parentBooking.pickup_time instanceof Date) {
        parentPickupTime = parentBooking.pickup_time;
      } else {
        // Fallback to current time if pickup_time is null/undefined
        parentPickupTime = new Date();
        log(`Warning: Parent booking #${parentBookingId} has invalid pickup time`);
      }
      
      let childPickupTime: Date;
      if (typeof childBooking.pickup_time === 'string') {
        childPickupTime = new Date(childBooking.pickup_time);
      } else if (childBooking.pickup_time instanceof Date) {
        childPickupTime = childBooking.pickup_time;
      } else {
        // Fallback to current time if pickup_time is null/undefined
        childPickupTime = new Date();
        log(`Warning: Child booking #${childId} has invalid pickup time`);
      }
        
      const pickupTimeDiffMin = Math.abs(
        (parentPickupTime.getTime() - childPickupTime.getTime()) / (60 * 1000)
      );
      
      if (pickupTimeDiffMin > 15) { // 15 min threshold
        ineligibleBookings.push(childId);
        reasons.push(`Checkpoint #6: Booking #${childId} pickup time is too far from parent booking (${pickupTimeDiffMin.toFixed(0)} min)`);
        continue;
      }
      
      // All checkpoints passed
      log(`All ${checkpointCount} checkpoints passed for booking #${childId}`);
      // If we get here, the booking is eligible
      childBookings.push(childBooking);
    }
    
    // Calculate eligibility result
    const eligibleBookingIds = childBookings.map(b => b.id);
    const canMerge = eligibleBookingIds.length > 0;
    
    return res.status(200).json({
      success: true,
      message: canMerge 
        ? `${eligibleBookingIds.length} booking(s) can be merged with parent booking`
        : 'No eligible bookings found for merging',
      eligibility: {
        canMerge,
        eligibleBookings: eligibleBookingIds,
        ineligibleBookings,
        totalCheckpoints: checkpointCount,
        reasons: reasons.length > 0 ? reasons : ['All selected bookings are eligible for merging']
      }
    });
  } catch (error) {
    log(`Error checking merge eligibility: ${error}`);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to check merge eligibility',
      eligibility: {
        canMerge: false,
        totalCheckpoints: 0, // Safe fallback value for error case
        reasons: ['An error occurred while checking eligibility']
      }
    });
  }
});

/**
 * Route to merge multiple bookings into a parent booking
 */
router.post('/api/bookings/merge', async (req: Request, res: Response) => {
  try {
    const { parentBookingId, childBookingIds } = req.body;
    
    if (!parentBookingId || !childBookingIds || !Array.isArray(childBookingIds) || childBookingIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request. parentBookingId and childBookingIds array are required'
      });
    }

    // Start a transaction to ensure data consistency
    const result = await db.transaction(async (tx) => {
      // Verify parent booking exists and is not merged
      const [parentBooking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, parentBookingId));

      if (!parentBooking) {
        throw new Error('Parent booking not found');
      }

      if (parentBooking.is_merged) {
        throw new Error('Cannot use a merged booking as a parent');
      }

      // Verify all child bookings exist and are not merged
      for (const childId of childBookingIds) {
        const [childBooking] = await tx
          .select()
          .from(bookings)
          .where(eq(bookings.id, childId));

        if (!childBooking) {
          throw new Error(`Child booking with id ${childId} not found`);
        }

        if (childBooking.is_merged) {
          throw new Error(`Child booking with id ${childId} is already merged`);
        }
      }

      // Generate a trip ID
      const tripId = generateTripId();

      // Get all relevant bookings for route optimization
      const allBookings = [
        parentBooking,
        ...await Promise.all(childBookingIds.map(async (id) => {
          const [booking] = await tx
            .select()
            .from(bookings)
            .where(eq(bookings.id, id));
          return booking;
        }))
      ];

      // Extract pickup and dropoff points for route optimization
      const pickupPoints = allBookings.map(booking => ({
        location: booking.pickup_location.coordinates,
        bookingId: booking.id
      }));

      const dropoffPoints = allBookings.map(booking => ({
        location: booking.dropoff_location.coordinates,
        bookingId: booking.id
      }));

      // Use parent booking's pickup location as the start location if no vehicle assigned yet
      // In a real implementation, you would use the current vehicle location
      const startLocation = parentBooking.assigned_vehicle_id 
        ? { lat: 25.276987, lng: 55.296249 } // Placeholder for vehicle location
        : parentBooking.pickup_location.coordinates;

      // Optimize the route
      const optimizedRoute = await optimizeRoute(pickupPoints, dropoffPoints, startLocation);

      // Update parent booking to indicate it has merged trips
      await tx
        .update(bookings)
        .set({
          has_merged_trips: true,
          merged_booking_ids: childBookingIds.map(id => id.toString()),
          status: 'confirmed',
          trip_id: tripId,
          optimized_route: optimizedRoute
        })
        .where(eq(bookings.id, parentBookingId));

      // Update each child booking
      for (const childId of childBookingIds) {
        await tx
          .update(bookings)
          .set({
            merged_with_booking_id: parentBookingId,
            is_merged: true,
            status: 'merged',
            trip_id: tripId
          })
          .where(eq(bookings.id, childId));
      }

      // Set pickup and dropoff sequences based on the optimized route
      if (optimizedRoute) {
        // Create a map of bookingId to its pickup and dropoff sequences
        const sequenceMap = new Map<number, { pickupSequence: number, dropoffSequence: number }>();
        
        optimizedRoute.waypoints.forEach((waypoint, index) => {
          const { bookingId, stopType } = waypoint;
          
          if (!sequenceMap.has(bookingId)) {
            sequenceMap.set(bookingId, { pickupSequence: -1, dropoffSequence: -1 });
          }
          
          const sequence = sequenceMap.get(bookingId)!;
          if (stopType === 'pickup') {
            sequence.pickupSequence = index;
          } else {
            sequence.dropoffSequence = index;
          }
          
          sequenceMap.set(bookingId, sequence);
        });
        
        // Update each booking with its sequence numbers
        const sequenceEntries = Array.from(sequenceMap.entries());
        for (let i = 0; i < sequenceEntries.length; i++) {
          const bookingId = sequenceEntries[i][0];
          const sequence = sequenceEntries[i][1];
          await tx
            .update(bookings)
            .set({
              pickup_sequence: sequence.pickupSequence,
              dropoff_sequence: sequence.dropoffSequence
            })
            .where(eq(bookings.id, bookingId));
        }
      } else {
        // Fallback to simple sequential ordering if optimization failed
        const allBookingIds = [parentBookingId, ...childBookingIds];
        for (let i = 0; i < allBookingIds.length; i++) {
          await tx
            .update(bookings)
            .set({
              pickup_sequence: i,
              dropoff_sequence: allBookingIds.length * 2 - i - 1,
            })
            .where(eq(bookings.id, allBookingIds[i]));
        }
      }

      // Return the updated parent booking with its merged children
      const [updatedParent] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, parentBookingId));

      const children = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.merged_with_booking_id, parentBookingId));

      return { 
        parent: updatedParent, 
        children,
        trip: {
          tripId,
          route: optimizedRoute,
          sequence: optimizedRoute?.waypoints.map(wp => ({
            type: wp.stopType,
            location: wp.location,
            bookingId: wp.bookingId
          }))
        }
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Bookings merged successfully',
      data: result
    });
  } catch (error) {
    log(`Error merging bookings: ${error}`);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to merge bookings'
    });
  }
});

/**
 * Route to optimize pickup and dropoff sequence for a merged booking
 */
router.post('/api/bookings/:id/optimize-sequence', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Start a transaction to ensure data consistency
    const result = await db.transaction(async (tx) => {
      // Verify parent booking exists and has merged trips
      const [parentBooking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, parseInt(id)));

      if (!parentBooking) {
        throw new Error('Booking not found');
      }

      if (!parentBooking.has_merged_trips) {
        throw new Error('This booking does not have any merged trips');
      }

      // Get all child bookings
      const children = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.merged_with_booking_id, parseInt(id)));

      // All bookings involved (parent + children)
      const allBookings = [parentBooking, ...children];
      
      // Extract pickup and dropoff points for route optimization
      const pickupPoints = allBookings.map(booking => ({
        location: booking.pickup_location.coordinates,
        bookingId: booking.id
      }));

      const dropoffPoints = allBookings.map(booking => ({
        location: booking.dropoff_location.coordinates,
        bookingId: booking.id
      }));

      // Use parent booking's pickup location as the start location if no vehicle assigned yet
      const startLocation = parentBooking.assigned_vehicle_id 
        ? { lat: 25.276987, lng: 55.296249 } // Placeholder for vehicle location
        : parentBooking.pickup_location.coordinates;

      // Optimize the route
      const optimizedRoute = await optimizeRoute(pickupPoints, dropoffPoints, startLocation);

      // Update the parent booking with the optimized route
      await tx
        .update(bookings)
        .set({
          optimized_route: optimizedRoute
        })
        .where(eq(bookings.id, parseInt(id)));

      // Set pickup and dropoff sequences based on the optimized route
      if (optimizedRoute) {
        // Create a map of bookingId to its pickup and dropoff sequences
        const sequenceMap = new Map<number, { pickupSequence: number, dropoffSequence: number }>();
        
        optimizedRoute.waypoints.forEach((waypoint, index) => {
          const { bookingId, stopType } = waypoint;
          
          if (!sequenceMap.has(bookingId)) {
            sequenceMap.set(bookingId, { pickupSequence: -1, dropoffSequence: -1 });
          }
          
          const sequence = sequenceMap.get(bookingId)!;
          if (stopType === 'pickup') {
            sequence.pickupSequence = index;
          } else {
            sequence.dropoffSequence = index;
          }
          
          sequenceMap.set(bookingId, sequence);
        });
        
        // Update each booking with its sequence numbers
        const sequenceEntries = Array.from(sequenceMap.entries());
        for (let i = 0; i < sequenceEntries.length; i++) {
          const bookingId = sequenceEntries[i][0];
          const sequence = sequenceEntries[i][1];
          await tx
            .update(bookings)
            .set({
              pickup_sequence: sequence.pickupSequence,
              dropoff_sequence: sequence.dropoffSequence
            })
            .where(eq(bookings.id, bookingId));
        }
      } else {
        // Fallback to simple sequential ordering if optimization failed
        for (let i = 0; i < allBookings.length; i++) {
          await tx
            .update(bookings)
            .set({
              pickup_sequence: i,
              dropoff_sequence: allBookings.length * 2 - i - 1,
            })
            .where(eq(bookings.id, allBookings[i].id));
        }
      }

      // Return the updated bookings with new sequences
      const [updatedParent] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, parseInt(id)));

      const updatedChildren = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.merged_with_booking_id, parseInt(id)));

      return { 
        parent: updatedParent, 
        children: updatedChildren,
        route: optimizedRoute,
        sequence: optimizedRoute?.waypoints.map(wp => ({
          type: wp.stopType,
          location: wp.location,
          bookingId: wp.bookingId
        }))
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Sequence optimized successfully',
      data: result
    });
  } catch (error) {
    log(`Error optimizing sequence: ${error}`);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to optimize sequence'
    });
  }
});

/**
 * Route to find potential merge candidates for a specific booking
 * This supports the dynamic planning feature allowing manual merges until trip completion
 */
router.get('/api/bookings/:id/merge-candidates', async (req: Request, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    
    if (isNaN(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }
    
    // Use the service function to find potential merge candidates
    const result = await findPotentialMergesForBooking(bookingId);
    
    return res.status(200).json({
      success: true,
      message: `Found ${result.mergeCandidates.length} potential merge candidates for booking #${bookingId}`,
      data: {
        booking: result.booking,
        mergeCandidates: result.mergeCandidates
      }
    });
  } catch (error) {
    log(`Error finding merge candidates for booking ${req.params.id}: ${error}`);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to find merge candidates'
    });
  }
});

/**
 * Route to get merge recommendations for a booking
 * This supports the dynamic planning capability with compatibility scores
 */
router.get('/api/bookings/:id/merge-recommendations', async (req: Request, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    
    if (isNaN(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }
    
    // Get recommendations with compatibility scores
    const recommendations = await getMergeRecommendations(bookingId);
    
    return res.status(200).json({
      success: true,
      message: `Found ${recommendations.length} merge recommendations for booking #${bookingId}`,
      data: recommendations
    });
  } catch (error) {
    log(`Error getting merge recommendations for booking ${req.params.id}: ${error}`);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get merge recommendations'
    });
  }
});

/**
 * Route to optimize and generate detailed turn-by-turn directions for a merged trip
 */
router.post('/api/bookings/:id/optimize-route', async (req: Request, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    
    if (isNaN(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }
    
    // Generate the optimized route plan with turn-by-turn directions
    const routePlan = await generateOptimizedRoutePlan(bookingId);
    
    return res.status(200).json({
      success: true,
      message: `Generated optimized route plan for booking #${bookingId}`,
      data: routePlan
    });
  } catch (error) {
    log(`Error generating optimized route for booking ${req.params.id}: ${error}`);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate optimized route'
    });
  }
});

/**
 * Unmerge a booking from its parent trip
 * This restores the booking to its original state as a standalone booking 
 */
router.post('/api/bookings/:id/unmerge', async (req: Request, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    
    if (isNaN(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }
    
    // Verify booking exists and is part of a merged trip
    const [bookingToUnmerge] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));
    
    if (!bookingToUnmerge) {
      return res.status(404).json({
        success: false,
        message: `Booking with ID ${bookingId} not found`
      });
    }
    
    if (!bookingToUnmerge.is_merged || !bookingToUnmerge.parent_booking_id) {
      return res.status(400).json({
        success: false,
        message: `Booking with ID ${bookingId} is not part of a merged trip`
      });
    }
    
    // Get parent booking to check if it needs to be updated
    const parentBookingId = bookingToUnmerge.parent_booking_id;
    
    // Start a transaction to ensure data consistency
    await db.transaction(async (tx) => {
      // Update the booking to remove it from the merged trip
      await tx
        .update(bookings)
        .set({
          is_merged: false,
          parent_booking_id: null,
          trip_id: null,
          // Restore to approved status if it was in assigned status
          status: bookingToUnmerge.status === 'assigned' ? 'approved' : bookingToUnmerge.status,
          // Clear any route-specific fields
          route_sequence: null,
          route_polyline: null,
          // Add audit trail
          updated_at: new Date(),
          last_modified_by: req.user?.username || 'system',
          modification_notes: `Unmerged from trip with parent booking ID ${parentBookingId}`
        })
        .where(eq(bookings.id, bookingId));
      
      // Check if this was the last child booking in the trip
      const [remainingChildren] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(
          and(
            eq(bookings.parent_booking_id, parentBookingId),
            eq(bookings.is_merged, true)
          )
        );
      
      const childCount = remainingChildren?.count || 0;
      
      // If this was the last child booking, update the parent booking to remove trip info
      if (childCount === 0) {
        await tx
          .update(bookings)
          .set({
            is_parent_booking: false,
            trip_id: null,
            route_polyline: null,
            updated_at: new Date(),
            last_modified_by: req.user?.username || 'system',
            modification_notes: 'All child bookings have been unmerged'
          })
          .where(eq(bookings.id, parentBookingId));
      }
    });
    
    return res.status(200).json({
      success: true,
      message: `Booking with ID ${bookingId} successfully unmerged from trip`
    });
  } catch (error) {
    log(`Error unmerging booking: ${error}`);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to unmerge booking'
    });
  }
});

export const tripMergeRouter = router;