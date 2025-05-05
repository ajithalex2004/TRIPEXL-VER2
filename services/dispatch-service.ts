
import { VehicleType, BookingType } from '@shared/schema';

interface DispatchScore {
  vehicleId: number;
  score: number;
  reasons: string[];
}

export class DispatchService {
  calculateDispatchScore(
    vehicle: VehicleType,
    booking: BookingType,
    currentLocation: { lat: number; lng: number }
  ): DispatchScore {
    let score = 100;
    const reasons: string[] = [];

    // Distance factor
    const distance = this.calculateDistance(
      currentLocation,
      { lat: booking.pickup_lat, lng: booking.pickup_lng }
    );
    
    if (distance > 10) {
      score -= (distance - 10) * 2;
      reasons.push(`Distance penalty: ${distance}km`);
    }

    // Vehicle type suitability
    if (vehicle.vehicle_type !== booking.vehicle_type) {
      score -= 20;
      reasons.push('Vehicle type mismatch');
    }

    // Fuel efficiency consideration
    if (Number(vehicle.fuel_efficiency) < 15) {
      score -= 10;
      reasons.push('Low fuel efficiency');
    }

    return {
      vehicleId: vehicle.id,
      score,
      reasons
    };
  }

  private calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
    // Haversine formula implementation
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(point2.lat - point1.lat);
    const dLon = this.deg2rad(point2.lng - point1.lng);
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(point1.lat)) * Math.cos(this.deg2rad(point2.lat)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
}

export const dispatchService = new DispatchService();
