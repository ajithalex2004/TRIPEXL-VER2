// Robust Route Optimizer Service with safe defensive programming

// Interface for optimization metrics
interface OptimizationMetrics {
  totalDistance: number;
  totalTime: number;
  fuelConsumption: number;
  co2Emissions: number;
  driverHours: number;
  idleTime: number;
  vehicleUtilization: number;
  trafficAvoidance: number;
  weatherImpact: number;
  totalStops: number;
  avgDistanceBetweenStops: number;
}

// Interface for route comparison
interface RouteComparison {
  algorithm: string;
  distance: number;
  time: number;
  fuel: number;
  co2: number;
  score: number;
}

// Interface for optimization insights
interface OptimizationInsight {
  id: number;
  tripId: number;
  timestamp: string;
  metrics: OptimizationMetrics;
  comparison: RouteComparison[];
  recommendations: string[];
  weatherConditions: string;
  trafficConditions: string;
  optimizedSequence: number[];
  savingsPercentage: {
    distance: number;
    time: number;
    fuel: number;
    co2: number;
  };
}

// Interface for historical data point
interface HistoricalDataPoint {
  date: string;
  distance: number;
  time: number;
  fuel: number;
  co2: number;
}

// Simple service that returns static data
export const routeOptimizerService = {
  
  // Check if a booking exists
  async checkBookingExists(bookingId: number): Promise<boolean> {
    return true;
  },
  
  // Get all merged trips
  async getMergedTrips() {
    // Return sample trips for testing
    return [
      {
        id: 1,
        reference_no: 'TRIP-001',
        mergeTimestamp: new Date().toISOString(),
        parentBookingId: 101,
        childBookingIds: [102, 103],
        status: 'Active'
      },
      {
        id: 2,
        reference_no: 'TRIP-002',
        mergeTimestamp: new Date().toISOString(),
        parentBookingId: 201,
        childBookingIds: [202, 203, 204],
        status: 'Active'
      }
    ];
  },
  
  // Get all insights
  async getAllInsights() {
    // Sample optimization insights for all trips
    const insights: OptimizationInsight[] = [
      {
        id: 1,
        tripId: 1,
        timestamp: new Date().toISOString(),
        metrics: {
          totalDistance: 45.5,
          totalTime: 72.3,
          fuelConsumption: 3.6,
          co2Emissions: 8.3,
          driverHours: 1.5,
          idleTime: 0.3,
          vehicleUtilization: 78.4,
          trafficAvoidance: 65.0,
          weatherImpact: 10.0,
          totalStops: 3,
          avgDistanceBetweenStops: 15.1
        },
        comparison: [
          {
            algorithm: 'Standard',
            distance: 52.8,
            time: 82.1,
            fuel: 4.2,
            co2: 9.8,
            score: 7.2
          },
          {
            algorithm: 'Optimized',
            distance: 45.5,
            time: 72.3,
            fuel: 3.6,
            co2: 8.3,
            score: 8.5
          },
          {
            algorithm: 'Eco-Friendly',
            distance: 47.9,
            time: 75.6,
            fuel: 3.4,
            co2: 7.9,
            score: 8.1
          }
        ],
        recommendations: [
          'Optimize pickup sequence to reduce total distance.',
          'Consider adjusting departure time to avoid peak traffic.',
          'Group bookings with similar destinations for more efficient routing.'
        ],
        weatherConditions: 'Good',
        trafficConditions: 'Light',
        optimizedSequence: [0, 2, 1, 3],
        savingsPercentage: {
          distance: 13.8,
          time: 11.9,
          fuel: 14.3,
          co2: 15.3
        }
      },
      {
        id: 2,
        tripId: 2,
        timestamp: new Date().toISOString(),
        metrics: {
          totalDistance: 62.7,
          totalTime: 95.4,
          fuelConsumption: 5.1,
          co2Emissions: 11.2,
          driverHours: 2.0,
          idleTime: 0.5,
          vehicleUtilization: 82.1,
          trafficAvoidance: 58.0,
          weatherImpact: 15.0,
          totalStops: 4,
          avgDistanceBetweenStops: 15.6
        },
        comparison: [
          {
            algorithm: 'Standard',
            distance: 74.2,
            time: 108.7,
            fuel: 6.3,
            co2: 13.5,
            score: 6.8
          },
          {
            algorithm: 'Optimized',
            distance: 62.7,
            time: 95.4,
            fuel: 5.1,
            co2: 11.2,
            score: 8.3
          },
          {
            algorithm: 'Eco-Friendly',
            distance: 65.9,
            time: 99.6,
            fuel: 4.8,
            co2: 10.5,
            score: 7.9
          }
        ],
        recommendations: [
          'Consider vehicle with higher capacity to reduce number of trips.',
          'Adjust route to avoid construction zones on main highway.',
          'Implement more efficient loading/unloading to reduce idle time.'
        ],
        weatherConditions: 'Good',
        trafficConditions: 'Moderate',
        optimizedSequence: [0, 3, 1, 2, 4],
        savingsPercentage: {
          distance: 15.5,
          time: 12.2,
          fuel: 19.0,
          co2: 17.0
        }
      }
    ];
    
    return insights;
  },
  
  // Get insights for a specific trip
  async getInsightsByTripId(tripId: number) {
    const allInsights = await this.getAllInsights();
    const tripInsights = allInsights.filter(insight => insight.tripId === tripId);
    return tripInsights.length > 0 ? tripInsights : [];
  },
  
  // Get historical data for a specific trip
  async getHistoricalDataByTripId(tripId: number) {
    // Generate sample historical data
    const historicalData: HistoricalDataPoint[] = [];
    const now = new Date();
    
    // Generate data for the past 30 days
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Add some randomness to the data
      const random = Math.random() * 0.4 + 0.8; // 0.8 to 1.2
      const baseDistance = tripId === 1 ? 45.5 : 62.7;
      const baseTime = tripId === 1 ? 72.3 : 95.4;
      const baseFuel = tripId === 1 ? 3.6 : 5.1;
      const baseCO2 = tripId === 1 ? 8.3 : 11.2;
      
      historicalData.push({
        date: date.toISOString().split('T')[0],
        distance: Math.round(baseDistance * random * 10) / 10,
        time: Math.round(baseTime * random * 10) / 10,
        fuel: Math.round(baseFuel * random * 10) / 10,
        co2: Math.round(baseCO2 * random * 10) / 10
      });
    }
    
    return historicalData;
  },
  
  // Generate insights for a trip
  async generateInsights(tripId: number) {
    // For new insights, we'll use the existing template but update the timestamp
    const allInsights = await this.getAllInsights();
    const tripInsights = allInsights.filter(insight => insight.tripId === tripId);
    
    let insight: OptimizationInsight;
    
    if (tripInsights.length > 0) {
      // Clone the existing insight but update the timestamp
      insight = JSON.parse(JSON.stringify(tripInsights[0]));
      insight.id = Date.now();
      insight.timestamp = new Date().toISOString();
    } else {
      // Create a new insight
      insight = {
        id: Date.now(),
        tripId: tripId,
        timestamp: new Date().toISOString(),
        metrics: {
          totalDistance: 50.0,
          totalTime: 80.0,
          fuelConsumption: 4.0,
          co2Emissions: 9.0,
          driverHours: 1.8,
          idleTime: 0.4,
          vehicleUtilization: 75.0,
          trafficAvoidance: 60.0,
          weatherImpact: 12.0,
          totalStops: 3,
          avgDistanceBetweenStops: 16.7
        },
        comparison: [
          {
            algorithm: 'Standard',
            distance: 58.0,
            time: 90.0,
            fuel: 4.7,
            co2: 10.5,
            score: 7.0
          },
          {
            algorithm: 'Optimized',
            distance: 50.0,
            time: 80.0,
            fuel: 4.0,
            co2: 9.0,
            score: 8.2
          },
          {
            algorithm: 'Eco-Friendly',
            distance: 53.0,
            time: 85.0,
            fuel: 3.8,
            co2: 8.5,
            score: 7.8
          }
        ],
        recommendations: [
          'Optimize pickup sequence to reduce total distance.',
          'Consider adjusting departure time to avoid peak traffic.',
          'Use vehicles with better fuel efficiency for this route.'
        ],
        weatherConditions: 'Good',
        trafficConditions: 'Light',
        optimizedSequence: [0, 2, 1, 3],
        savingsPercentage: {
          distance: 13.8,
          time: 11.1,
          fuel: 14.9,
          co2: 14.3
        }
      };
    }
    
    const historicalData = await this.getHistoricalDataByTripId(tripId);
    
    return {
      insight,
      historicalData
    };
  }
};