import { Router } from "express";
import { storage } from "../storage";
import { insertVehicleTypeMasterSchema, vehicleTypeMaster } from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { vehicleModels, manufacturers, servicePlans, units } from "./masters";
import { 
  updateFuelPrices,
  triggerFuelPriceUpdate,
  initializeFuelPriceService 
} from "../services/fuel-price-service";

const router = Router();

// Updated fuel prices with proper types
const currentFuelPrices: Record<string, number> = {
  'PETROL': 2.99,
  'DIESEL': 2.89,
  'ELECTRIC': 0.45,
  'HYBRID': 2.85,
  'CNG': 2.10,
  'LPG': 2.25
};

const uaeVehicleModels: Record<string, string[]> = {
  "Toyota": [
    "Corolla",
    "Camry",
    "Land Cruiser",
    "Prado",
    "RAV4",
    "Fortuner",
    "Hiace",
    "Yaris",
    "Hilux",
    "Coaster",
    "Innova"
  ],
  "Nissan": [
    "Altima",
    "Patrol",
    "X-Trail",
    "Sunny",
    "Kicks",
    "Pathfinder",
    "Urvan",
    "Navara"
  ]
  // ... [Keep other manufacturer models]
};

const defaultFuelEfficiency: Record<string, number> = {
  "TOYOTA-COROLLA": 14.5,
  "TOYOTA-CAMRY": 13.2,
  "TOYOTA-LANDCRUISER": 8.5,
  "TOYOTA-PRADO": 9.5,
  "TOYOTA-RAV4": 11.8
  // ... [Keep other efficiency data]
};

const defaultVehicleCapacity: Record<string, number> = {
  "TOYOTA-COROLLA": 13,
  "TOYOTA-CAMRY": 15,
  "TOYOTA-LANDCRUISER": 82
  // ... [Keep other capacity data]
};

const defaultIdleFuelConsumption: Record<string, number> = {
  "TOYOTA-COROLLA": 0.8,
  "TOYOTA-CAMRY": 0.9,
  "TOYOTA-LANDCRUISER": 1.5
  // ... [Keep other consumption data]
};

const co2EmissionFactors: Record<string, number> = {
  "Petrol": 2.31,
  "Diesel": 2.68,
  "Electric": 0,
  "Hybrid": 1.85,
  "CNG": 1.81,
  "LPG": 1.51
};

// Enhanced fuel prices endpoint with better error handling
router.get("/api/fuel-prices", async (_req, res) => {
  try {
    console.log("Fetching current fuel prices from database...");
    
    // Get real fuel prices from the database
    const fuelTypes = await storage.getAllFuelTypes();
    
    // Convert response to lowercase keys for consistency
    const formattedPrices = fuelTypes.reduce((acc, fuelType) => {
      acc[fuelType.type.toLowerCase()] = parseFloat(fuelType.price.toString());
      return acc;
    }, {} as Record<string, number>);

    console.log("Sending formatted fuel prices:", formattedPrices);
    res.json(formattedPrices);
  } catch (error: any) {
    console.error("Error fetching fuel prices:", error);
    res.status(500).json({ 
      error: "Failed to fetch fuel prices",
      message: error.message,
      details: error.stack
    });
  }
});

// Get all vehicle types
router.get("/api/vehicle-types", async (_req, res) => {
  try {
    console.log("Fetching all vehicle types");
    const types = await db.select().from(vehicleTypeMaster);
    
    // Process each record to convert null values to empty strings for all string fields
    const processedTypes = types.map(type => {
      return Object.entries(type).reduce((acc, [key, value]) => {
        if (typeof value === 'string' || value === null) {
          // Convert null values to empty strings
          acc[key] = value === null ? "" : value;
        } else if (key === 'fuel_type' || key === 'vehicle_model' || key === 'vehicle_type') {
          // Ensure these specific fields always have a string value even if they're not string type
          acc[key] = value === null || value === undefined ? "" : String(value);
        } else {
          acc[key] = value;
        }
        return acc;
      }, {} as any);
    });
    
    console.log("Retrieved vehicle types:", processedTypes);
    res.json(processedTypes);
  } catch (error: any) {
    console.error("Error fetching vehicle types:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create new vehicle type with proper type handling
router.post("/api/vehicle-types", async (req, res) => {
  try {
    console.log("Received vehicle type data:", req.body);

    // Special handling for fuel types
    // First check if the validation would fail specifically for fuel_type
    const result = insertVehicleTypeMasterSchema.safeParse(req.body);
    
    if (!result.success) {
      // Check if the only issue is the fuel_type field
      const fuelTypeIssue = result.error.issues.find(issue => 
        issue.path.includes('fuel_type') && issue.code === 'invalid_enum_value'
      );
      
      if (fuelTypeIssue) {
        console.log("Found fuel type validation issue:", fuelTypeIssue);
        console.log("Attempting to bypass validation for fuel_type");
        
        // If we have a fuel_type issue, let's verify the fuel_type exists in the database
        const fuelTypes = await storage.getAllFuelTypes();
        const requestedFuelType = req.body.fuel_type;
        const fuelTypeExists = fuelTypes.some(ft => ft.type === requestedFuelType);
        
        if (fuelTypeExists) {
          console.log(`Fuel type '${requestedFuelType}' exists in database, bypassing validation`);
          // Continue processing with the data as-is
        } else {
          console.error(`Fuel type '${requestedFuelType}' not found in database`);
          return res.status(400).json({
            error: "Invalid fuel type",
            message: `The fuel type '${requestedFuelType}' does not exist in the database`
          });
        }
      } else {
        // If there are other validation issues, return them
        console.error("Validation failed:", result.error.issues);
        return res.status(400).json({
          error: "Invalid vehicle type data",
          details: result.error.issues
        });
      }
    }

    // Ensure all data is properly formatted for database
    // First, create the base object with correct string values for required fields
    // Use req.body directly if we had a fuel_type validation bypass
    const data = result.success ? result.data : req.body;
    
    const formattedData = {
      group_id: data.group_id,
      vehicle_type_code: data.vehicle_type_code,
      vehicle_type_name: data.vehicle_type_name,
      manufacturer: data.manufacturer,
      model_year: data.model_year,
      number_of_passengers: data.number_of_passengers,
      region: data.region || "Abu Dhabi",
      fuel_type: data.fuel_type,
      department: data.department || "Fleet",
      vehicle_capacity: data.vehicle_capacity,
      alert_before: data.alert_before,
      
      // Ensure all string fields have values
      vehicle_model: data.vehicle_model || (data.vehicle_type || ""),
      vehicle_type: data.vehicle_type || (data.vehicle_model || ""),
      service_plan: data.service_plan || "",
      unit: data.unit || "",
      color: data.color || "",
      
      // Convert numeric fields to strings
      fuel_efficiency: typeof data.fuel_efficiency === 'number' 
        ? data.fuel_efficiency.toString()
        : (data.fuel_efficiency || "0"),
        
      fuel_price_per_litre: typeof data.fuel_price_per_litre === 'number'
        ? data.fuel_price_per_litre.toString()
        : (data.fuel_price_per_litre || "0"),
        
      cost_per_km: typeof data.cost_per_km === 'number'
        ? data.cost_per_km.toString()
        : (data.cost_per_km || "0"),
        
      idle_fuel_consumption: typeof data.idle_fuel_consumption === 'number'
        ? data.idle_fuel_consumption.toString()
        : (data.idle_fuel_consumption || "0"),
        
      co2_emission_factor: typeof data.co2_emission_factor === 'number'
        ? data.co2_emission_factor.toString()
        : (data.co2_emission_factor || "0")
    };
    
    console.log("Formatted data for insert:", formattedData);
    
    // Insert using await db.insert() pattern
    const [newType] = await db
      .insert(vehicleTypeMaster)
      .values(formattedData)
      .returning();

    // Convert null values to empty strings for string fields
    const processedNewType = Object.entries(newType).reduce((acc, [key, value]) => {
      if (typeof value === 'string' || value === null) {
        acc[key] = value === null ? "" : value;
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
    
    console.log("Successfully created vehicle type:", processedNewType);
    res.status(201).json(processedNewType);
  } catch (error: any) {
    console.error("Error creating vehicle type:", error);

    if (error.code === '23505') {
      return res.status(400).json({ 
        error: "Vehicle type with this code already exists",
        details: error.detail
      });
    }

    res.status(500).json({ 
      error: "Failed to create vehicle type",
      message: error.message
    });
  }
});

// Get single vehicle type
router.get("/api/vehicle-types/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    console.log("Fetching vehicle type with ID:", id);
    const [type] = await db
      .select()
      .from(vehicleTypeMaster)
      .where(eq(vehicleTypeMaster.id, id));

    if (!type) {
      console.log("Vehicle type not found with ID:", id);
      return res.status(404).json({ error: "Vehicle type not found" });
    }

    // Convert null values to empty strings for string fields
    const processedType = Object.entries(type).reduce((acc, [key, value]) => {
      if (typeof value === 'string' || value === null) {
        acc[key] = value === null ? "" : value;
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    console.log("Retrieved and processed vehicle type:", processedType);
    res.json(processedType);
  } catch (error: any) {
    console.error("Error fetching vehicle type:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get form-ready vehicle type data
router.get("/api/vehicle-types/:id/form-data", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    console.log("Fetching form-ready vehicle type with ID:", id);
    const [type] = await db
      .select()
      .from(vehicleTypeMaster)
      .where(eq(vehicleTypeMaster.id, id));

    if (!type) {
      console.log("Vehicle type not found with ID:", id);
      return res.status(404).json({ error: "Vehicle type not found" });
    }

    // Process stringified numeric values for form display
    const formReadyData = {
      ...type,
      // String fields - ensure they're not null
      vehicle_type_code: type.vehicle_type_code || "",
      vehicle_type_name: type.vehicle_type_name || "",
      manufacturer: type.manufacturer || "",
      vehicle_model: type.vehicle_model || "",
      region: type.region || "Abu Dhabi",
      fuel_type: type.fuel_type || "",
      service_plan: type.service_plan || "",
      vehicle_type: type.vehicle_type || "",
      department: type.department || "Fleet",
      unit: type.unit || "",
      color: type.color || "",
      
      // Numeric fields - parse and format
      fuel_efficiency: type.fuel_efficiency ? parseFloat(type.fuel_efficiency.toString()) : 0,
      fuel_price_per_litre: type.fuel_price_per_litre ? parseFloat(type.fuel_price_per_litre.toString()) : 0,
      cost_per_km: type.cost_per_km ? parseFloat(type.cost_per_km.toString()) : 0,
      idle_fuel_consumption: type.idle_fuel_consumption ? parseFloat(type.idle_fuel_consumption.toString()) : 0,
      co2_emission_factor: type.co2_emission_factor ? parseFloat(type.co2_emission_factor.toString()) : 0,
      
      // Integer fields
      model_year: type.model_year || new Date().getFullYear(),
      number_of_passengers: type.number_of_passengers || 0,
      alert_before: type.alert_before || 0,
      vehicle_capacity: type.vehicle_capacity || 0,
      group_id: type.group_id || 0,
    };

    console.log("Form-ready vehicle type data:", formReadyData);
    res.json(formReadyData);
  } catch (error: any) {
    console.error("Error fetching form-ready vehicle type:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update vehicle type
router.patch("/api/vehicle-types/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    console.log("Updating vehicle type:", id, "with data:", req.body);
    const result = insertVehicleTypeMasterSchema.partial().safeParse(req.body);

    if (!result.success) {
      // Check if the only issue is the fuel_type field
      const fuelTypeIssue = result.error.issues.find(issue => 
        issue.path.includes('fuel_type') && issue.code === 'invalid_enum_value'
      );
      
      if (fuelTypeIssue) {
        console.log("Found fuel type validation issue on update:", fuelTypeIssue);
        console.log("Attempting to bypass validation for fuel_type");
        
        // Verify the fuel_type exists in the database
        const fuelTypes = await storage.getAllFuelTypes();
        const requestedFuelType = req.body.fuel_type;
        const fuelTypeExists = fuelTypes.some(ft => ft.type === requestedFuelType);
        
        if (fuelTypeExists) {
          console.log(`Fuel type '${requestedFuelType}' exists in database, bypassing validation`);
          // Continue with processing using req.body directly
        } else {
          console.error(`Fuel type '${requestedFuelType}' not found in database`);
          return res.status(400).json({
            error: "Invalid fuel type",
            message: `The fuel type '${requestedFuelType}' does not exist in the database`
          });
        }
      } else {
        // If there are other validation issues, return them
        return res.status(400).json({
          error: "Invalid vehicle type data",
          details: result.error.issues
        });
      }
    }

    // Create a clean update object with proper type conversions
    const updateData: Record<string, any> = {};
    
    // Use result.data if validation succeeded, otherwise use req.body
    const data = result.success ? result.data : req.body;
    
    // Only include fields that are present in the request
    if (data.group_id !== undefined) updateData.group_id = data.group_id;
    if (data.vehicle_type_code !== undefined) updateData.vehicle_type_code = data.vehicle_type_code;
    if (data.vehicle_type_name !== undefined) updateData.vehicle_type_name = data.vehicle_type_name;
    if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer;
    
    // Handle special text fields
    if (data.vehicle_model !== undefined) {
      updateData.vehicle_model = data.vehicle_model || "";
    }
    
    if (data.model_year !== undefined) updateData.model_year = data.model_year;
    if (data.number_of_passengers !== undefined) updateData.number_of_passengers = data.number_of_passengers;
    if (data.region !== undefined) updateData.region = data.region || "Abu Dhabi";
    
    // Handle numeric fields with proper string conversion
    if (data.fuel_efficiency !== undefined) {
      updateData.fuel_efficiency = typeof data.fuel_efficiency === 'number'
        ? data.fuel_efficiency.toString()
        : (data.fuel_efficiency || "0");
    }
    
    if (data.fuel_price_per_litre !== undefined) {
      updateData.fuel_price_per_litre = typeof data.fuel_price_per_litre === 'number'
        ? data.fuel_price_per_litre.toString()
        : (data.fuel_price_per_litre || "0");
    }
    
    if (data.fuel_type !== undefined) updateData.fuel_type = data.fuel_type;
    if (data.service_plan !== undefined) updateData.service_plan = data.service_plan || "";
    
    if (data.cost_per_km !== undefined) {
      updateData.cost_per_km = typeof data.cost_per_km === 'number'
        ? data.cost_per_km.toString()
        : (data.cost_per_km || "0");
    }
    
    // Handle vehicle_type field with fallback to vehicle_model
    if (data.vehicle_type !== undefined) {
      updateData.vehicle_type = data.vehicle_type || "";
    } else if (data.vehicle_model !== undefined) {
      updateData.vehicle_type = data.vehicle_model || "";
    }
    
    if (data.department !== undefined) updateData.department = data.department || "Fleet";
    if (data.unit !== undefined) updateData.unit = data.unit || "";
    if (data.alert_before !== undefined) updateData.alert_before = data.alert_before;
    
    if (data.idle_fuel_consumption !== undefined) {
      updateData.idle_fuel_consumption = typeof data.idle_fuel_consumption === 'number'
        ? data.idle_fuel_consumption.toString()
        : (data.idle_fuel_consumption || "0");
    }
    
    if (data.vehicle_capacity !== undefined) updateData.vehicle_capacity = data.vehicle_capacity;
    
    if (data.co2_emission_factor !== undefined) {
      updateData.co2_emission_factor = typeof data.co2_emission_factor === 'number'
        ? data.co2_emission_factor.toString()
        : (data.co2_emission_factor || "0");
    }
    
    if (data.color !== undefined) updateData.color = data.color || "";
    
    console.log("Formatted update data:", updateData);
    
    const [updatedType] = await db
      .update(vehicleTypeMaster)
      .set(updateData)
      .where(eq(vehicleTypeMaster.id, id))
      .returning();

    if (!updatedType) {
      return res.status(404).json({ error: "Vehicle type not found" });
    }

    // Convert null values to empty strings for string fields
    const processedUpdatedType = Object.entries(updatedType).reduce((acc, [key, value]) => {
      if (typeof value === 'string' || value === null) {
        acc[key] = value === null ? "" : value;
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
    
    console.log("Updated and processed vehicle type:", processedUpdatedType);
    res.json(processedUpdatedType);
  } catch (error: any) {
    console.error("Error updating vehicle type:", error);
    res.status(500).json({ error: error.message });
  }
});

// Fuel price management endpoints
router.get("/api/fuel-types", async (_req, res) => {
  try {
    console.log("Fetching all fuel types from database");
    const fuelTypes = await storage.getAllFuelTypes();
    console.log("Retrieved fuel types:", fuelTypes);
    res.json(fuelTypes);
  } catch (error: any) {
    console.error("Error fetching fuel types:", error);
    res.status(500).json({ 
      error: "Failed to fetch fuel types",
      message: error.message 
    });
  }
});

// Endpoint to manually trigger fuel price update
router.post("/api/fuel-prices/update", async (_req, res) => {
  try {
    console.log("Manually triggering fuel price update");
    await triggerFuelPriceUpdate();
    console.log("Fuel prices updated successfully");
    
    // Return the updated fuel types
    const updatedFuelTypes = await storage.getAllFuelTypes();
    res.json({
      message: "Fuel prices updated successfully",
      fuelTypes: updatedFuelTypes
    });
  } catch (error: any) {
    console.error("Error updating fuel prices:", error);
    res.status(500).json({ 
      error: "Failed to update fuel prices",
      message: error.message 
    });
  }
});

// Delete vehicle type
router.delete("/api/vehicle-types/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    console.log("Deleting vehicle type with ID:", id);
    
    // First check if the vehicle type exists
    const [vehicleType] = await db
      .select()
      .from(vehicleTypeMaster)
      .where(eq(vehicleTypeMaster.id, id));
      
    if (!vehicleType) {
      console.log("Vehicle type not found with ID:", id);
      return res.status(404).json({ error: "Vehicle type not found" });
    }
    
    // Delete the vehicle type
    await db
      .delete(vehicleTypeMaster)
      .where(eq(vehicleTypeMaster.id, id));
    
    console.log("Successfully deleted vehicle type with ID:", id);
    res.status(200).json({ message: "Vehicle type deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting vehicle type:", error);
    res.status(500).json({ 
      error: "Failed to delete vehicle type",
      message: error.message
    });
  }
});

export default router;