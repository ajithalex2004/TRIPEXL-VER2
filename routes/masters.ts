import { Router } from "express";
import { 
  VehicleFuelType, 
  Region, 
  Department, 
  PlateCategory,
  TransmissionType,
  vehicleGroups,
  fuelTypes as fuelTypesTable,
  insertEmployeeSchema
} from "@shared/schema";
import { storage } from "../storage";
import { db } from "../db";
import { z } from "zod";

const router = Router();

// Export this data for use in other modules
export { vehicleModels, manufacturers, co2EmissionFactors, currentFuelPrices, servicePlans, units };

// Current UAE fuel prices - Updated March 2024
const currentFuelPrices: Record<string, number> = {
  'PETROL': 2.85,
  'DIESEL': 2.95,
  'ELECTRIC': 0,
  'HYBRID': 2.85,
  'CNG': 2.35,
  'LPG': 2.25
};

// Service Plans
const servicePlans = [
  {
    code: "BASIC",
    name: "Basic Service Plan",
    description: "Regular maintenance and basic service coverage",
    intervalKm: 5000,
    intervalMonths: 6
  },
  {
    code: "STANDARD",
    name: "Standard Service Plan",
    description: "Comprehensive maintenance with extended coverage",
    intervalKm: 10000,
    intervalMonths: 12
  },
  {
    code: "PREMIUM",
    name: "Premium Service Plan",
    description: "Complete coverage including preventive maintenance",
    intervalKm: 15000,
    intervalMonths: 12
  }
];

// Units master data
const units = [
  "Fleet Operations",
  "Maintenance",
  "Emergency Response",
  "Patient Transport",
  "Special Operations",
  "General Transport",
  "VIP Services"
];

// UAE Vehicle Manufacturers list (Popular in UAE)
const manufacturers = [
  "Toyota",
  "Nissan",
  "Mercedes-Benz",
  "BMW",
  "Lexus",
  "Land Rover",
  "Audi",
  "Porsche",
  "Mitsubishi",
  "Chevrolet",
  "Ford",
  "GMC",
  "Honda",
  "Hyundai",
  "Kia",
  "Infiniti",
  "Jeep",
  "Mazda",
  "MG",
  "Volkswagen",
  "Cadillac",
  "Jaguar",
  "Dodge",
  "Volvo",
  "Bentley",
  "Ferrari",
  "Lamborghini",
  "Maserati",
  "Rolls-Royce",
  "Haval",
  "BAIC",
  "GAC",
  "Changan",
  "W Motors"
];

// Vehicle models with specifications (Popular in UAE)
const vehicleModels = {
  "Toyota": {
    models: [
      {
        name: "Corolla",
        efficiency: 14.5,
        capacity: 13,
        idleConsumption: 0.8,
        passengerCapacity: 5,
        categories: ["SEDAN"]
      },
      {
        name: "Land Cruiser",
        efficiency: 8.5,
        capacity: 82,
        idleConsumption: 1.5,
        passengerCapacity: 8,
        categories: ["SUV"]
      },
      {
        name: "Camry",
        efficiency: 13.2,
        capacity: 15,
        idleConsumption: 0.9,
        passengerCapacity: 5,
        categories: ["SEDAN"]
      },
      {
        name: "Prado",
        efficiency: 9.8,
        capacity: 60,
        idleConsumption: 1.3,
        passengerCapacity: 7,
        categories: ["SUV"]
      },
      {
        name: "Fortuner",
        efficiency: 10.2,
        capacity: 55,
        idleConsumption: 1.2,
        passengerCapacity: 7,
        categories: ["SUV"]
      },
      {
        name: "Hiace",
        efficiency: 9.5,
        capacity: 65,
        idleConsumption: 1.4,
        passengerCapacity: 14,
        categories: ["VAN"]
      }
    ]
  },
  "Nissan": {
    models: [
      {
        name: "Patrol",
        efficiency: 7.8,
        capacity: 95,
        idleConsumption: 1.6,
        passengerCapacity: 8,
        categories: ["SUV"]
      },
      {
        name: "Altima",
        efficiency: 13.8,
        capacity: 15,
        idleConsumption: 0.9,
        passengerCapacity: 5,
        categories: ["SEDAN"]
      },
      {
        name: "Sunny",
        efficiency: 15.5,
        capacity: 12,
        idleConsumption: 0.7,
        passengerCapacity: 5,
        categories: ["SEDAN"]
      },
      {
        name: "X-Trail",
        efficiency: 11.8,
        capacity: 42,
        idleConsumption: 1.1,
        passengerCapacity: 5,
        categories: ["SUV"]
      },
      {
        name: "Urvan",
        efficiency: 8.5,
        capacity: 68,
        idleConsumption: 1.5,
        passengerCapacity: 14,
        categories: ["VAN"]
      }
    ]
  },
  "Mercedes-Benz": {
    models: [
      {
        name: "G-Class",
        efficiency: 7.5,
        capacity: 85,
        idleConsumption: 1.7,
        passengerCapacity: 5,
        categories: ["SUV"]
      },
      {
        name: "GLE",
        efficiency: 9.2,
        capacity: 70,
        idleConsumption: 1.4,
        passengerCapacity: 5,
        categories: ["SUV"]
      },
      {
        name: "S-Class",
        efficiency: 10.5,
        capacity: 65,
        idleConsumption: 1.2,
        passengerCapacity: 5,
        categories: ["SEDAN"]
      },
      {
        name: "Sprinter",
        efficiency: 8.0,
        capacity: 75,
        idleConsumption: 1.6,
        passengerCapacity: 14,
        categories: ["VAN"]
      }
    ]
  },
  "BMW": {
    models: [
      {
        name: "X5",
        efficiency: 9.3,
        capacity: 68,
        idleConsumption: 1.3,
        passengerCapacity: 5,
        categories: ["SUV"]
      },
      {
        name: "X7",
        efficiency: 8.5,
        capacity: 75,
        idleConsumption: 1.5,
        passengerCapacity: 7,
        categories: ["SUV"]
      },
      {
        name: "7 Series",
        efficiency: 10.2,
        capacity: 60,
        idleConsumption: 1.2,
        passengerCapacity: 5,
        categories: ["SEDAN"]
      }
    ]
  },
  "Lexus": {
    models: [
      {
        name: "LX",
        efficiency: 8.0,
        capacity: 85,
        idleConsumption: 1.6,
        passengerCapacity: 8,
        categories: ["SUV"]
      },
      {
        name: "ES",
        efficiency: 12.5,
        capacity: 15,
        idleConsumption: 0.9,
        passengerCapacity: 5,
        categories: ["SEDAN"]
      },
      {
        name: "RX",
        efficiency: 9.8,
        capacity: 65,
        idleConsumption: 1.3,
        passengerCapacity: 5,
        categories: ["SUV"]
      }
    ]
  },
  "Land Rover": {
    models: [
      {
        name: "Range Rover",
        efficiency: 7.5,
        capacity: 82,
        idleConsumption: 1.8,
        passengerCapacity: 5,
        categories: ["SUV"]
      },
      {
        name: "Defender",
        efficiency: 8.2,
        capacity: 75,
        idleConsumption: 1.5,
        passengerCapacity: 5,
        categories: ["SUV"]
      }
    ]
  },
  "Honda": {
    models: [
      {
        name: "Civic",
        efficiency: 14.8,
        capacity: 13,
        idleConsumption: 0.8,
        passengerCapacity: 5,
        categories: ["SEDAN"]
      },
      {
        name: "CR-V",
        efficiency: 11.2,
        capacity: 37,
        idleConsumption: 1.0,
        passengerCapacity: 5,
        categories: ["SUV"]
      },
      {
        name: "Accord",
        efficiency: 13.5,
        capacity: 15,
        idleConsumption: 0.9,
        passengerCapacity: 5,
        categories: ["SEDAN"]
      }
    ]
  },
  "Mitsubishi": {
    models: [
      {
        name: "Pajero",
        efficiency: 9.0,
        capacity: 72,
        idleConsumption: 1.4,
        passengerCapacity: 7,
        categories: ["SUV"]
      },
      {
        name: "Montero Sport",
        efficiency: 10.2,
        capacity: 65,
        idleConsumption: 1.3,
        passengerCapacity: 7,
        categories: ["SUV"]
      },
      {
        name: "L200",
        efficiency: 10.5,
        capacity: 55,
        idleConsumption: 1.2,
        passengerCapacity: 5,
        categories: ["TRUCK"]
      }
    ]
  },
  "Chevrolet": {
    models: [
      {
        name: "Tahoe",
        efficiency: 8.2,
        capacity: 85,
        idleConsumption: 1.6,
        passengerCapacity: 8,
        categories: ["SUV"]
      },
      {
        name: "Suburban",
        efficiency: 7.8,
        capacity: 90,
        idleConsumption: 1.7,
        passengerCapacity: 8,
        categories: ["SUV"]
      },
      {
        name: "Silverado",
        efficiency: 8.5,
        capacity: 75,
        idleConsumption: 1.5,
        passengerCapacity: 5,
        categories: ["TRUCK"]
      }
    ]
  },
  "GMC": {
    models: [
      {
        name: "Yukon",
        efficiency: 8.0,
        capacity: 85,
        idleConsumption: 1.6,
        passengerCapacity: 8,
        categories: ["SUV"]
      },
      {
        name: "Sierra",
        efficiency: 8.3,
        capacity: 75,
        idleConsumption: 1.5,
        passengerCapacity: 5,
        categories: ["TRUCK"]
      }
    ]
  },
  "Ford": {
    models: [
      {
        name: "Expedition",
        efficiency: 8.2,
        capacity: 88,
        idleConsumption: 1.6,
        passengerCapacity: 8,
        categories: ["SUV"]
      },
      {
        name: "F-150",
        efficiency: 8.5,
        capacity: 78,
        idleConsumption: 1.5,
        passengerCapacity: 5,
        categories: ["TRUCK"]
      },
      {
        name: "Explorer",
        efficiency: 9.5,
        capacity: 72,
        idleConsumption: 1.4,
        passengerCapacity: 7,
        categories: ["SUV"]
      }
    ]
  }
};

// CO2 Emission Factors by fuel type
const co2EmissionFactors: Record<string, number> = {
  "PETROL": 2.31,    // kg CO2/liter
  "DIESEL": 2.68,    // kg CO2/liter
  "ELECTRIC": 0,     // Zero direct emissions
  "HYBRID": 1.85,    // Assumes 20% lower than petrol
  "CNG": 1.81,       // kg CO2/m³
  "LPG": 1.51        // kg CO2/liter
};

// Master data endpoints
router.get("/api/vehicle-masters", async (_req, res) => {
  try {
    console.log("Fetching vehicle masters data...");

    // Fetch vehicle groups from database
    const groups = await db.select().from(vehicleGroups);
    console.log("Retrieved vehicle groups:", groups);

    // Fetch real fuel types data from the database
    const fuelTypesData = await db.select().from(fuelTypesTable);
    console.log("Retrieved fuel types from database:", fuelTypesData);

    const formattedFuelTypes = fuelTypesData.map(fuelType => ({
      type: fuelType.type,
      price: parseFloat(fuelType.price.toString()),
      co2Factor: parseFloat(fuelType.co2_factor.toString()) 
    }));
    
    const masterData = {
      groups,
      manufacturers, // Add manufacturers list
      vehicleModels,
      fuelTypes: formattedFuelTypes,
      regions: Object.values(Region),
      departments: Object.values(Department),
      servicePlans,
      units,
      plateCategories: Object.values(PlateCategory),
      transmissionTypes: Object.values(TransmissionType)
    };

    console.log("Sending master data response:", JSON.stringify(masterData, null, 2));
    res.json(masterData);
  } catch (error: any) {
    console.error("Error fetching master data:", error);
    res.status(500).json({ error: error.message });
  }
});

// Employee management endpoints
router.get("/api/employees", async (_req, res) => {
  try {
    console.log("Fetching all employees...");
    const employees = await storage.getAllEmployees();
    res.json(employees);
  } catch (error: any) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/employees/:id", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    if (isNaN(employeeId)) {
      return res.status(400).json({ error: "Invalid employee ID" });
    }

    console.log(`Fetching employee with ID: ${employeeId}`);
    const employee = await storage.getEmployeeById(employeeId);
    
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    
    res.json(employee);
  } catch (error: any) {
    console.error(`Error fetching employee:`, error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/api/employees/:id", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    if (isNaN(employeeId)) {
      return res.status(400).json({ error: "Invalid employee ID" });
    }

    console.log(`Updating employee with ID: ${employeeId}`);
    
    // Check if employee exists
    const existingEmployee = await storage.getEmployeeById(employeeId);
    if (!existingEmployee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    
    // Update the employee without Zod validation as we're doing a partial update
    const updatedEmployee = await storage.updateEmployee(employeeId, req.body);
    res.json(updatedEmployee);
  } catch (error: any) {
    console.error(`Error updating employee:`, error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/api/employees/:id", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    if (isNaN(employeeId)) {
      return res.status(400).json({ error: "Invalid employee ID" });
    }

    console.log(`Deleting employee with ID: ${employeeId}`);
    
    // Check if employee exists
    const existingEmployee = await storage.getEmployeeById(employeeId);
    if (!existingEmployee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    
    // Delete the employee
    await storage.deleteEmployee(employeeId);
    res.json({ success: true, message: "Employee deleted successfully" });
  } catch (error: any) {
    console.error(`Error deleting employee:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Get employees who can be approvers based on hierarchy level and designation
router.get("/api/approvers", async (req, res) => {
  try {
    console.log("Fetching approvers...");
    
    // Get all employees
    const employees = await storage.getAllEmployees();
    
    // Level 1 approvers are employees with "Approval Authority" designation OR hierarchy_level = "Level 1"
    const level1Approvers = employees.filter(e => 
      e.is_active && 
      (e.designation === "Approval Authority" || e.hierarchy_level === "Level 1")
    );
    
    // Level 2 approvers are employees with hierarchy_level = "Level 2"
    const level2Approvers = employees.filter(e => 
      e.is_active && 
      e.hierarchy_level === "Level 2"
    );
    
    res.json({
      level1: level1Approvers,
      level2: level2Approvers
    });
  } catch (error: any) {
    console.error("Error fetching approvers:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;