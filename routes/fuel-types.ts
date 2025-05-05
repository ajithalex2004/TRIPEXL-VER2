import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";

const router = Router();

// Get all fuel types
router.get("/", async (req, res) => {
  try {
    const fuelTypes = await storage.getAllFuelTypes();
    res.json(fuelTypes);
  } catch (error) {
    console.error("Error getting fuel types:", error);
    res.status(500).json({ error: "Failed to get fuel types" });
  }
});

// Create a new fuel type
router.post("/", async (req, res) => {
  try {
    const schema = z.object({
      type: z.string().min(2),
      price: z.number().min(0),
      co2_factor: z.number().min(0),
    });

    const validatedData = schema.parse(req.body);
    const currentDate = new Date();
    
    // Convert number fields to strings for database storage
    const fuelTypeData: Record<string, any> = {
      type: validatedData.type,
      price: String(validatedData.price),
      co2_factor: String(validatedData.co2_factor),
      created_at: currentDate,
      updated_at: currentDate,
      historical_prices: JSON.stringify([{
        date: currentDate.toISOString(),
        price: validatedData.price
      }])
    };
    
    const newFuelType = await storage.createFuelType(fuelTypeData);
    
    res.status(201).json(newFuelType);
  } catch (error) {
    console.error("Error creating fuel type:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: "Failed to create fuel type" });
    }
  }
});

// Update a fuel type
router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const schema = z.object({
      type: z.string().min(2).optional(),
      price: z.number().min(0).optional(),
      co2_factor: z.number().min(0).optional(),
    });

    const validatedData = schema.parse(req.body);
    const currentFuelType = await storage.getFuelTypeById(id);
    
    if (!currentFuelType) {
      return res.status(404).json({ error: "Fuel type not found" });
    }
    
    // If price is being updated, add to historical prices
    let historicalPrices = [];
    if (currentFuelType.historical_prices) {
      try {
        // It's possible the historical_prices is already an object if it was returned like that from the database
        if (typeof currentFuelType.historical_prices === 'string') {
          historicalPrices = JSON.parse(currentFuelType.historical_prices);
        } else if (Array.isArray(currentFuelType.historical_prices)) {
          historicalPrices = currentFuelType.historical_prices;
        } else {
          console.log('Historical prices is neither a string nor an array:', currentFuelType.historical_prices);
        }
      } catch (err) {
        console.error('Error parsing historical prices:', err);
        console.log('Raw historical prices:', currentFuelType.historical_prices);
      }
    }
    
    // Convert numbers to strings to match database types
    const updateData: Partial<Record<string, any>> = {
      ...validatedData,
      updated_at: new Date()
    };
    
    // Convert number fields to strings for the database
    if (validatedData.price !== undefined) {
      updateData.price = String(validatedData.price);
    }
    
    if (validatedData.co2_factor !== undefined) {
      updateData.co2_factor = String(validatedData.co2_factor);
    }
    
    // Check if price has changed and update historical prices
    if (validatedData.price && Number(validatedData.price) !== Number(currentFuelType.price)) {
      historicalPrices.push({
        date: new Date().toISOString(),
        price: validatedData.price
      });
      
      updateData.historical_prices = JSON.stringify(historicalPrices);
    }
    
    const updatedFuelType = await storage.updateFuelType(id, updateData);
    
    res.json(updatedFuelType);
  } catch (error) {
    console.error("Error updating fuel type:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: "Failed to update fuel type" });
    }
  }
});

// Delete a fuel type
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    await storage.deleteFuelType(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting fuel type:", error);
    res.status(500).json({ error: "Failed to delete fuel type" });
  }
});

// Get fuel price history
router.get("/history", async (_req, res) => {
  try {
    const history = await storage.getFuelPriceHistory();
    res.json(history);
  } catch (error) {
    console.error("Error fetching fuel price history:", error);
    res.status(500).json({ error: "Failed to fetch fuel price history" });
  }
});

// Endpoint to get UAE fuel types from a predefined list
router.get("/uae-fuel-types", async (req, res) => {
  try {
    // Standard UAE fuel types
    const uaeFuelTypes = [
      { type: "Petrol", display: "Petrol (Super 95)" },
      { type: "Diesel", display: "Diesel" },
      { type: "Premium", display: "Premium (Super 98)" },
      { type: "Electric", display: "Electric" },
      { type: "Hybrid", display: "Hybrid" },
      { type: "CNG", display: "CNG (Compressed Natural Gas)" },
      { type: "LPG", display: "LPG (Liquefied Petroleum Gas)" },
      { type: "E-Plus 91", display: "E-Plus 91" },
      { type: "Super 98", display: "Super 98" },
      { type: "Special 95", display: "Special 95 (Super 95)" }
    ];
    
    // Return the UAE fuel types
    return res.status(200).json({
      success: true,
      data: uaeFuelTypes
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching UAE fuel types:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get UAE fuel types",
      error: errorMessage
    });
  }
});

// WAM Scraper endpoint to fetch UAE fuel prices
router.post("/wam-scrape", async (req, res) => {
  try {
    console.log("Starting WAM fuel price scraper...");
    
    // Determine the path to the python script
    const scriptPath = path.resolve(__dirname, "../services/wam_fuel_scraper.py");
    console.log(`Script path: ${scriptPath}`);
    
    // Spawn python process to run the scraper
    const pythonProcess = spawn("python3", [scriptPath]);
    
    let dataString = "";
    let errorString = "";
    
    // Collect data from script
    pythonProcess.stdout.on("data", (data) => {
      dataString += data.toString();
      console.log(`Python stdout: ${data}`);
    });
    
    // Collect errors from script
    pythonProcess.stderr.on("data", (data) => {
      errorString += data.toString();
      console.error(`Python stderr: ${data}`);
    });
    
    // Handle script completion
    pythonProcess.on("close", async (code) => {
      console.log(`Python process exited with code ${code}`);
      
      if (code !== 0) {
        return res.status(500).json({
          success: false,
          message: "WAM scraper failed",
          error: errorString,
        });
      }
      
      // After successful scraping, recalculate vehicle costs
      try {
        await storage.recalculateVehicleCosts();
        console.log("Successfully recalculated vehicle costs based on new fuel prices");
      } catch (recalcError) {
        console.error("Error recalculating vehicle costs:", recalcError);
      }
      
      res.json({
        success: true,
        message: "WAM scraper ran successfully and fuel prices have been updated",
        data: dataString,
      });
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error running WAM scraper:", error);
    res.status(500).json({
      success: false,
      message: "Failed to run WAM scraper",
      error: errorMessage,
    });
  }
});

// Update fuel prices endpoint
router.post("/update", async (req, res) => {
  try {
    const priceData = req.body;
    console.log("Received fuel price update:", priceData);
    
    if (!priceData || !priceData.prices) {
      return res.status(400).json({ error: "Invalid price data" });
    }
    
    // Process each fuel type
    const updates = [];
    for (const [fuelType, price] of Object.entries(priceData.prices)) {
      const existingFuelType = await storage.getFuelTypeByType(fuelType);
      if (existingFuelType) {
        // Update existing fuel type
        console.log(`Updating fuel type ${fuelType} with price ${price}`);
        await storage.updateFuelTypePrice(fuelType, Number(price));
        updates.push({ type: fuelType, price, updated: true });
      } else {
        // Create new fuel type with default CO2 factor
        console.log(`Creating new fuel type ${fuelType} with price ${price}`);
        const co2Factor = 2.33; // Default CO2 factor, could be refined based on fuel type
        const newFuelType = await storage.createFuelType({
          type: fuelType,
          price: String(price),
          co2_factor: String(co2Factor),
          created_at: new Date(),
          updated_at: new Date(),
          historical_prices: JSON.stringify([{
            date: new Date().toISOString(),
            price
          }])
        });
        updates.push({ type: fuelType, price, created: true, id: newFuelType.id });
      }
    }
    
    // Recalculate vehicle costs based on new fuel prices
    await storage.recalculateVehicleCosts();
    
    res.json({
      success: true,
      message: "Fuel prices updated successfully",
      updates,
      source: priceData.source,
      date: priceData.date
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error updating fuel prices:", error);
    res.status(500).json({ error: "Failed to update fuel prices", details: errorMessage });
  }
});

export default router;