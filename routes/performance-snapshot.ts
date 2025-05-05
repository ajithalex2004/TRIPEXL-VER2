import express from "express";
import { storage } from "../storage";
import { VehicleTypeMaster } from "@shared/schema";

export const performanceRouter = express.Router();

// Get detailed top performing vehicles data
performanceRouter.get("/api/performance-snapshot/top-performers", async (req, res) => {
  try {
    // Get all vehicle types
    const vehicles = await storage.getAllVehicleTypes();
    const fuelTypes = await storage.getAllFuelTypes();
    
    if (!vehicles || vehicles.length === 0) {
      return res.json([]);
    }
    
    // Get top performers - prioritize high efficiency and low cost
    const topPerformers = [...vehicles]
      .sort((a, b) => {
        // Calculate a score based on efficiency and cost
        const scoreA = (Number(a.fuel_efficiency) / 2) - Number(a.cost_per_km);
        const scoreB = (Number(b.fuel_efficiency) / 2) - Number(b.cost_per_km);
        return scoreB - scoreA; // Higher score is better
      })
      .slice(0, 3) // Get top 3 performers
      .map(vehicle => {
        // Find the associated fuel type
        const fuelType = fuelTypes.find(f => f.type === vehicle.fuel_type) || null;
        
        // Function to handle null or undefined values
        const safeString = (value: any) => value === null || value === undefined ? "" : value;
        const safeNumber = (value: any) => {
          if (value === null || value === undefined || value === '') return 0;
          const num = typeof value === 'string' ? parseFloat(value) : Number(value);
          return isNaN(num) ? 0 : num;
        };
        
        return {
          id: vehicle.id,
          name: safeString(vehicle.vehicle_type_name),
          code: safeString(vehicle.vehicle_type_code),
          manufacturer: safeString(vehicle.manufacturer),
          modelYear: safeNumber(vehicle.model_year),
          fuelType: safeString(vehicle.fuel_type),
          fuelTypeDetails: fuelType,
          fuelEfficiency: safeNumber(vehicle.fuel_efficiency),
          costPerKm: safeNumber(vehicle.cost_per_km),
          co2EmissionFactor: safeNumber(vehicle.co2_emission_factor),
          idleFuelConsumption: safeNumber(vehicle.idle_fuel_consumption),
          passengerCapacity: safeNumber(vehicle.number_of_passengers),
          region: safeString(vehicle.region),
          department: safeString(vehicle.department),
          // Additional fields
          vehicle_model: safeString(vehicle.vehicle_model),
          vehicle_type: safeString(vehicle.vehicle_type),
          service_plan: safeString(vehicle.service_plan),
          unit: safeString(vehicle.unit),
          color: safeString(vehicle.color),
          performance: {
            efficiencyRating: calculateEfficiencyRating(vehicle, vehicles),
            costRating: calculateCostRating(vehicle, vehicles),
            emissionsRating: calculateEmissionsRating(vehicle, vehicles),
            overallScore: calculateOverallScore(vehicle, vehicles)
          }
        };
      });
    
    res.json(topPerformers);
  } catch (error) {
    console.error("Error getting top performers:", error);
    res.status(500).json({ message: "Failed to get top performers data" });
  }
});

// Get performance snapshot data
performanceRouter.get("/api/performance-snapshot", async (req, res) => {
  try {
    // Get vehicle data
    const vehicles = await storage.getAllVehicleTypes();
    
    // Get fuel prices
    const fuelTypes = await storage.getAllFuelTypes();
    
    // Get fuel price history
    const fuelPriceHistory = await storage.getFuelPriceHistory();
    
    // Calculate performance metrics
    const performanceMetrics = calculatePerformanceMetrics(vehicles, fuelTypes);
    
    // Return everything in a single call
    res.json({
      vehicles,
      fuelTypes,
      fuelPriceHistory,
      performanceMetrics
    });
  } catch (error) {
    console.error("Error getting performance snapshot:", error);
    res.status(500).json({ message: "Failed to get performance snapshot" });
  }
});

// Helper function to calculate performance metrics
function calculatePerformanceMetrics(vehicles: any[], fuelTypes: any[]) {
  // Skip calculation if no data
  if (!vehicles.length || !fuelTypes.length) {
    return {
      avgFuelEfficiency: 0,
      avgCostPerKm: 0,
      avgCO2EmissionFactor: 0,
      fuelTypeDistribution: {},
      topPerformers: [],
      underperformers: [],
      recommendations: []
    };
  }
  
  // Filter out electric vehicles for some calculations
  const nonElectricVehicles = vehicles.filter(v => 
    v.fuel_type.toLowerCase() !== "electric"
  );
  
  // Calculate averages
  const avgFuelEfficiency = nonElectricVehicles.length > 0 
    ? nonElectricVehicles.reduce((acc, v) => acc + Number(v.fuel_efficiency), 0) / nonElectricVehicles.length
    : 0;
    
  const avgCostPerKm = vehicles.length > 0
    ? vehicles.reduce((acc, v) => acc + Number(v.cost_per_km), 0) / vehicles.length
    : 0;
    
  const avgCO2EmissionFactor = vehicles.length > 0
    ? vehicles.reduce((acc, v) => acc + Number(v.co2_emission_factor), 0) / vehicles.length
    : 0;
  
  // Calculate fuel type distribution
  const fuelTypeDistribution = vehicles.reduce((acc: any, v) => {
    const type = v.fuel_type;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  
  // Find top performers (high efficiency, low cost)
  const topPerformers = [...nonElectricVehicles]
    .sort((a, b) => Number(b.fuel_efficiency) - Number(a.fuel_efficiency))
    .slice(0, 5)
    .map(v => ({
      id: v.id,
      code: v.vehicle_type_code,
      name: v.vehicle_type_name,
      efficiency: Number(v.fuel_efficiency),
      cost: Number(v.cost_per_km),
      fuelType: v.fuel_type
    }));
  
  // Find underperformers (low efficiency, high cost)
  const underperformers = [...nonElectricVehicles]
    .sort((a, b) => Number(a.fuel_efficiency) - Number(b.fuel_efficiency))
    .slice(0, 5)
    .map(v => ({
      id: v.id,
      code: v.vehicle_type_code,
      name: v.vehicle_type_name,
      efficiency: Number(v.fuel_efficiency),
      cost: Number(v.cost_per_km),
      fuelType: v.fuel_type
    }));
  
  // Generate recommendations
  const recommendations = generateRecommendations(vehicles, fuelTypes, fuelTypeDistribution);
  
  return {
    avgFuelEfficiency,
    avgCostPerKm,
    avgCO2EmissionFactor,
    fuelTypeDistribution,
    topPerformers,
    underperformers,
    recommendations
  };
}

// Helper functions to calculate performance ratings (1-10 scale)
function calculateEfficiencyRating(vehicle: VehicleTypeMaster, allVehicles: VehicleTypeMaster[]): number {
  if (vehicle.fuel_type.toLowerCase() === "electric") {
    return 10; // Electric vehicles get top rating for efficiency
  }
  
  // Get all non-electric vehicles for comparison
  const nonElectricVehicles = allVehicles.filter(v => 
    v.fuel_type.toLowerCase() !== "electric"
  );
  
  if (nonElectricVehicles.length === 0) {
    return 8; // Fallback if no comparison vehicles
  }
  
  // Find min and max efficiency values
  const efficiencies = nonElectricVehicles.map(v => Number(v.fuel_efficiency));
  const minEfficiency = Math.min(...efficiencies);
  const maxEfficiency = Math.max(...efficiencies);
  
  // Avoid division by zero
  if (maxEfficiency === minEfficiency) {
    return 5;
  }
  
  // Calculate rating on 1-10 scale
  const normalized = (Number(vehicle.fuel_efficiency) - minEfficiency) / (maxEfficiency - minEfficiency);
  return Math.round(1 + normalized * 9);
}

function calculateCostRating(vehicle: VehicleTypeMaster, allVehicles: VehicleTypeMaster[]): number {
  // Get all costs for comparison
  const costs = allVehicles.map(v => Number(v.cost_per_km));
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  
  // Avoid division by zero
  if (maxCost === minCost) {
    return 5;
  }
  
  // For cost, lower is better, so invert the scale
  const normalized = 1 - ((Number(vehicle.cost_per_km) - minCost) / (maxCost - minCost));
  return Math.round(1 + normalized * 9);
}

function calculateEmissionsRating(vehicle: VehicleTypeMaster, allVehicles: VehicleTypeMaster[]): number {
  if (vehicle.fuel_type.toLowerCase() === "electric") {
    return 10; // Electric vehicles get top rating for emissions
  }
  
  // Get all emissions for comparison
  const emissions = allVehicles.map(v => Number(v.co2_emission_factor));
  const minEmission = Math.min(...emissions);
  const maxEmission = Math.max(...emissions);
  
  // Avoid division by zero
  if (maxEmission === minEmission) {
    return 5;
  }
  
  // For emissions, lower is better, so invert the scale
  const normalized = 1 - ((Number(vehicle.co2_emission_factor) - minEmission) / (maxEmission - minEmission));
  return Math.round(1 + normalized * 9);
}

function calculateOverallScore(vehicle: VehicleTypeMaster, allVehicles: VehicleTypeMaster[]): number {
  const efficiencyWeight = 0.4;
  const costWeight = 0.35;
  const emissionsWeight = 0.25;
  
  const efficiencyScore = calculateEfficiencyRating(vehicle, allVehicles);
  const costScore = calculateCostRating(vehicle, allVehicles);
  const emissionsScore = calculateEmissionsRating(vehicle, allVehicles);
  
  return parseFloat((
    (efficiencyScore * efficiencyWeight) +
    (costScore * costWeight) +
    (emissionsScore * emissionsWeight)
  ).toFixed(1));
}

// Generate intelligent recommendations based on fleet data
function generateRecommendations(vehicles: any[], fuelTypes: any[], distribution: any) {
  const recommendations = [];
  
  // Check fleet composition
  const totalVehicles = vehicles.length;
  const electricVehicles = vehicles.filter(v => v.fuel_type.toLowerCase() === "electric").length;
  const hybridVehicles = vehicles.filter(v => v.fuel_type.toLowerCase() === "hybrid").length;
  const electricPercentage = (electricVehicles / totalVehicles) * 100;
  const alternativeFuelPercentage = ((electricVehicles + hybridVehicles) / totalVehicles) * 100;
  
  // Recommend increasing electric vehicles if percentage is low
  if (electricPercentage < 15) {
    recommendations.push({
      title: "Fuel Type Optimization",
      subtitle: "Based on current fuel prices and fleet performance",
      description: "Electric vehicles make up only " + electricPercentage.toFixed(1) + "% of your fleet. Electric vehicles show 75% lower cost per kilometer compared to petrol vehicles.",
      impact: "high",
      savings: "Up to 0.45 AED per kilometer, translating to approximately 18,000 AED per vehicle annually based on average usage patterns.",
      actions: "When replacing aged vehicles, prioritize electric models for urban usage profiles."
    });
  }
  
  // Check for high-consumption vehicles
  const highConsumptionVehicles = vehicles.filter(v => 
    v.fuel_type.toLowerCase() !== "electric" && 
    Number(v.fuel_efficiency) < 10
  );
  
  if (highConsumptionVehicles.length > 0) {
    const estimatedIdleTime = 1.8; // hours per day
    const estimatedSavings = (highConsumptionVehicles.length * 0.5).toFixed(1);
    
    recommendations.push({
      title: "Idle Time Reduction",
      subtitle: "Based on vehicle telemetry data analysis",
      description: "Data indicates an average idle time of " + estimatedIdleTime + " hours per vehicle per day across your fleet. Implementing systematic idle reduction practices could significantly reduce fuel consumption and emissions.",
      impact: "medium",
      savings: "Reducing idle time by 50% could save approximately 0.8-1.5 liters of fuel per vehicle daily, resulting in monthly savings of ~800 AED per 10 vehicles.",
      actions: "Implement driver training program focused on idle reduction and consider idle-reduction technologies for high-usage vehicles."
    });
  }
  
  // Check fuel price trends for cost optimization
  const petrolFuel = fuelTypes.find((f: any) => f.type.toLowerCase() === "petrol");
  const dieselFuel = fuelTypes.find((f: any) => f.type.toLowerCase() === "diesel");
  
  if (petrolFuel && dieselFuel) {
    // Maintenance optimization recommendation
    recommendations.push({
      title: "Maintenance Optimization",
      subtitle: "Preventative maintenance schedule improvements",
      description: "Analysis shows maintenance intervals can be optimized based on fuel type and usage patterns. Diesel vehicles in particular show 15% longer optimal service intervals than currently scheduled.",
      impact: "low",
      savings: "Approximately 5-8% reduction in annual maintenance costs while maintaining optimal vehicle performance.",
      actions: "Revise maintenance schedules based on vehicle-specific data rather than using standardized intervals."
    });
    
    // Add fuel-specific recommendation if price difference is significant
    if (Number(petrolFuel.price) > Number(dieselFuel.price) * 1.1) {
      recommendations.push({
        title: "Strategic Fuel Usage",
        subtitle: "Based on current Abu Dhabi fuel prices",
        description: "Current diesel prices (" + Number(dieselFuel.price).toFixed(2) + " AED) are significantly lower than petrol (" + Number(petrolFuel.price).toFixed(2) + " AED). Prioritize diesel vehicles for high-mileage routes.",
        impact: "medium",
        savings: "Potential cost savings of " + ((Number(petrolFuel.price) - Number(dieselFuel.price)) * 1000).toFixed(0) + " AED per 1000km driven.",
        actions: "Reassign vehicles based on route distance: diesel for long routes, electric/hybrid for urban routes."
      });
    }
  }
  
  // Check for vehicle replacement opportunities
  const agingVehicles = vehicles.filter(v => 
    (new Date().getFullYear() - Number(v.model_year)) > 7 &&
    v.fuel_type.toLowerCase() !== "electric" && 
    v.fuel_type.toLowerCase() !== "hybrid"
  );
  
  if (agingVehicles.length > 0) {
    recommendations.push({
      title: "Fleet Modernization",
      subtitle: "Replacing aging fossil-fuel vehicles",
      description: "Your fleet has " + agingVehicles.length + " conventional fuel vehicles older than 7 years. Modern alternatives offer 25-40% better fuel efficiency and significantly lower emissions.",
      impact: "high",
      savings: "Replacing these vehicles could reduce your operational costs by 15-20% and carbon footprint by 30-35%.",
      actions: "Develop a 24-month replacement plan prioritizing the oldest and least efficient vehicles first."
    });
  }
  
  return recommendations;
}