import { Router, Request, Response } from 'express';
import { db } from '../db';
import { bookings, vehicles } from '../../shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { log } from '../vite';

const router = Router();

/**
 * Route to manually dispatch a booking to a vehicle
 */
router.post('/manual', async (req: Request, res: Response) => {
  try {
    const { bookingId, vehicleId } = req.body;
    
    if (!bookingId || !vehicleId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request. bookingId and vehicleId are required'
      });
    }

    // Start a transaction for data consistency
    const result = await db.transaction(async (tx) => {
      // Verify booking exists and is not already dispatched
      const [booking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId));

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.assigned_vehicle_id) {
        throw new Error('Booking is already assigned to a vehicle');
      }

      // Verify vehicle exists and is available
      const [vehicle] = await tx
        .select()
        .from(vehicles)
        .where(eq(vehicles.vehicle_number, vehicleId));

      if (!vehicle) {
        throw new Error('Vehicle not found');
      }

      if (vehicle.status !== 'Available') {
        throw new Error('Vehicle is not available');
      }

      // Update booking with vehicle assignment
      await tx
        .update(bookings)
        .set({
          assigned_vehicle_id: vehicleId,
          status: 'assigned',
          dispatched_at: new Date().toISOString(),
          auto_dispatched: false // Explicitly mark as manual dispatch
        })
        .where(eq(bookings.id, bookingId));

      // Update vehicle status
      await tx
        .update(vehicles)
        .set({
          status: 'Assigned',
          last_updated: new Date().toISOString()
        })
        .where(eq(vehicles.vehicle_number, vehicleId));

      // Return the updated booking with vehicle info
      const [updatedBooking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId));

      const [assignedVehicle] = await tx
        .select()
        .from(vehicles)
        .where(eq(vehicles.vehicle_number, vehicleId));

      return { booking: updatedBooking, vehicle: assignedVehicle };
    });

    return res.status(200).json({
      success: true,
      message: 'Booking dispatched successfully',
      data: result
    });
  } catch (error) {
    log(`Error dispatching booking: ${error}`);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to dispatch booking'
    });
  }
});

/**
 * Route to trigger auto-dispatch process
 * This would typically be called by a scheduled job,
 * but can also be triggered manually for testing
 */
router.post('/auto', async (req: Request, res: Response) => {
  try {
    // Find confirmed bookings that are not assigned and are within 1 hour of pickup time
    const confirmationWindow = new Date();
    confirmationWindow.setHours(confirmationWindow.getHours() + 1);
    
    // Get all confirmed bookings within the window
    const now = new Date();
    const nowIso = now.toISOString();
    const confirmationWindowIso = confirmationWindow.toISOString();
    
    const pendingBookings = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.status, 'confirmed'),
          sql`${bookings.assigned_vehicle_id} IS NULL`,
          sql`${bookings.pickup_time} >= ${nowIso}`,
          sql`${bookings.pickup_time} <= ${confirmationWindowIso}`
        )
      );
    
    if (pendingBookings.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No bookings to auto-dispatch',
        data: { dispatched: 0 }
      });
    }
    
    // Get available vehicles
    const availableVehicles = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.status, 'Available'));
    
    if (availableVehicles.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No available vehicles for auto-dispatch',
        data: { dispatched: 0 }
      });
    }
    
    // Simple assignment logic - assign the oldest confirmed booking to the first available vehicle
    // In a real implementation, this would use more sophisticated logic based on proximity, vehicle type, etc.
    const dispatched = [];
    
    for (const booking of pendingBookings) {
      if (availableVehicles.length === 0) break;
      
      const vehicle = availableVehicles.shift(); // Take the first available vehicle
      
      // Assign the booking to the vehicle
      await db.transaction(async (tx) => {
        await tx
          .update(bookings)
          .set({
            assigned_vehicle_id: vehicle!.vehicle_number,
            status: 'assigned',
            dispatched_at: new Date().toISOString(),
            auto_dispatched: true
          })
          .where(eq(bookings.id, booking.id));
        
        await tx
          .update(vehicles)
          .set({
            status: 'Assigned',
            last_updated: new Date().toISOString()
          })
          .where(eq(vehicles.vehicle_number, vehicle!.vehicle_number));
      });
      
      dispatched.push({
        bookingId: booking.id,
        vehicleId: vehicle!.vehicle_number
      });
    }
    
    return res.status(200).json({
      success: true,
      message: `Auto-dispatched ${dispatched.length} bookings`,
      data: { dispatched: dispatched.length, assignments: dispatched }
    });
  } catch (error) {
    log(`Error in auto-dispatch: ${error}`);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to perform auto-dispatch'
    });
  }
});

export const dispatchRouter = router;