import { db } from "../db";
import { vehicleTypeMaster } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * This script fixes NULL values in the vehicle_type_master table by updating them with default values.
 * It handles both string fields (setting them to '') and numeric fields (setting them to 0).
 */
async function fixNullValuesInVehicleTypeMaster() {
  console.log("Starting to fix NULL values in vehicle_type_master table...");
  
  try {
    // Get all vehicle types
    const vehicleTypes = await db.select().from(vehicleTypeMaster);
    console.log(`Found ${vehicleTypes.length} vehicle types to process`);
    
    let updatedCount = 0;
    
    // Process each vehicle type
    for (const vehicleType of vehicleTypes) {
      const updates: Record<string, any> = {};
      let needsUpdate = false;
      
      // Check string fields
      const stringFields = [
        'manufacturer', 'vehicle_model', 'vehicle_type', 'region', 
        'fuel_type', 'service_plan', 'department', 'unit', 'color'
      ];
      
      for (const field of stringFields) {
        if (vehicleType[field as keyof typeof vehicleType] === null) {
          updates[field] = '';
          needsUpdate = true;
        }
      }
      
      // Check numeric fields
      const numericFields = [
        'model_year', 'number_of_passengers', 'fuel_efficiency', 
        'fuel_price_per_litre', 'cost_per_km', 'alert_before',
        'idle_fuel_consumption', 'vehicle_capacity', 'co2_emission_factor'
      ];
      
      for (const field of numericFields) {
        if (vehicleType[field as keyof typeof vehicleType] === null) {
          updates[field] = 0;
          needsUpdate = true;
        }
      }
      
      // Update record if needed
      if (needsUpdate) {
        await db.update(vehicleTypeMaster)
          .set(updates)
          .where(eq(vehicleTypeMaster.id, vehicleType.id));
        updatedCount++;
      }
    }
    
    console.log(`Successfully updated ${updatedCount} vehicle types with default values`);
    return { success: true, updatedCount };
  } catch (error) {
    console.error("Error fixing NULL values:", error);
    return { success: false, error };
  }
}

// Ensure database fields have default values for future inserts
async function updateDatabaseSchema() {
  console.log("Updating database schema to ensure default values...");
  
  try {
    // Update string fields to have default value of empty string
    const stringFields = [
      'manufacturer', 'vehicle_model', 'vehicle_type', 'region', 
      'fuel_type', 'service_plan', 'department', 'unit', 'color'
    ];
    
    for (const field of stringFields) {
      await db.execute(sql`
        ALTER TABLE vehicle_type_master 
        ALTER COLUMN ${sql.identifier(field)} 
        SET DEFAULT '';
      `);
      
      // Also set NOT NULL constraint
      await db.execute(sql`
        ALTER TABLE vehicle_type_master 
        ALTER COLUMN ${sql.identifier(field)} 
        SET NOT NULL;
      `);
    }
    
    // Update numeric fields to have default value of 0
    const numericFields = [
      'model_year', 'number_of_passengers', 'fuel_efficiency', 
      'fuel_price_per_litre', 'cost_per_km', 'alert_before',
      'idle_fuel_consumption', 'vehicle_capacity', 'co2_emission_factor'
    ];
    
    for (const field of numericFields) {
      await db.execute(sql`
        ALTER TABLE vehicle_type_master 
        ALTER COLUMN ${sql.identifier(field)} 
        SET DEFAULT 0;
      `);
      
      // Also set NOT NULL constraint
      await db.execute(sql`
        ALTER TABLE vehicle_type_master 
        ALTER COLUMN ${sql.identifier(field)} 
        SET NOT NULL;
      `);
    }
    
    console.log("Database schema successfully updated with default values");
    return { success: true };
  } catch (error) {
    console.error("Error updating database schema:", error);
    return { success: false, error };
  }
}

// Execute both functions
async function main() {
  // Fix NULL values first
  const fixResult = await fixNullValuesInVehicleTypeMaster();
  console.log("Fix NULL values result:", fixResult);
  
  // Now update the schema to prevent future NULL values
  const schemaResult = await updateDatabaseSchema();
  console.log("Schema update result:", schemaResult);
  
  console.log("Script completed");
  process.exit(0);
}

main();