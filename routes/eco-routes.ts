import { Router } from "express";
import { z } from "zod";

const router = Router();

// Validation schema for route calculation request
const routeRequestSchema = z.object({
  origin: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  destination: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  vehicleType: z.string(),
  fuelEfficiency: z.number(),
  co2EmissionFactor: z.number(),
});

// Calculate routes with environmental impact
router.get("/api/eco-routes", async (req, res) => {
  try {
    const params = routeRequestSchema.parse(req.query);
    
    // Mock data for demonstration - In production, this would use real route calculation
    // and traffic data from a mapping service
    const routes = [
      {
        distance: 15.2,
        duration: 25,
        fuelConsumption: params.fuelEfficiency * 15.2 / 100,
        co2Emissions: (params.fuelEfficiency * 15.2 / 100) * params.co2EmissionFactor,
        trafficLevel: "Low" as const,
      },
      {
        distance: 14.8,
        duration: 28,
        fuelConsumption: params.fuelEfficiency * 14.8 / 100,
        co2Emissions: (params.fuelEfficiency * 14.8 / 100) * params.co2EmissionFactor,
        trafficLevel: "Medium" as const,
      },
      {
        distance: 16.5,
        duration: 22,
        fuelConsumption: params.fuelEfficiency * 16.5 / 100,
        co2Emissions: (params.fuelEfficiency * 16.5 / 100) * params.co2EmissionFactor,
        trafficLevel: "High" as const,
      },
    ];

    res.json(routes);
  } catch (error) {
    console.error("Error calculating eco-friendly routes:", error);
    res.status(400).json({ error: "Invalid request parameters" });
  }
});

export const ecoRoutesRouter = router;
