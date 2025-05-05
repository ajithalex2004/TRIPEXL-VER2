import { type Vehicle, type Driver, type Booking, type InsertBooking, type VehicleGroup, type InsertVehicleGroup, type VehicleMaster, type InsertVehicleMaster } from "@shared/schema";
import * as z from 'zod';
import bcrypt from 'bcryptjs';
import { type Employee, type InsertEmployee } from '@shared/schema';
import { type User, type InsertUser } from '@shared/schema';
import { type OtpVerification, type InsertOtpVerification } from '@shared/schema';
import { type VehicleTypeMaster, type InsertVehicleTypeMaster, type FuelType, VehicleFuelType } from '@shared/schema';
import { type ApprovalWorkflow, type InsertApprovalWorkflow } from '@shared/schema';
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { logBookingRequest, logBookingError } from "./debug/booking-debug";
import * as schema from "@shared/schema";
import { sql } from 'drizzle-orm';

// Add these methods to the IStorage interface
import session from "express-session";
import createMemoryStore from "memorystore";

// Create memory store for sessions
const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // Session store for authentication
  sessionStore: session.Store;

  // Vehicles
  getVehicles(): Promise<Vehicle[]>;
  getAvailableVehicles(): Promise<Vehicle[]>;
  updateVehicleStatus(id: number, status: string): Promise<Vehicle>;

  // Drivers
  getDrivers(): Promise<Driver[]>;
  getAvailableDrivers(): Promise<Driver[]>;
  updateDriverStatus(id: number, status: string): Promise<Driver>;

  // Bookings
  getBookings(): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  assignBooking(bookingId: number, vehicleId: number, driverId: number): Promise<Booking>;
  updateBookingStatus(id: number, status: string): Promise<Booking>;
  deleteAllBookings(): Promise<void>;
  getBookingsEligibleForMerging(): Promise<Booking[]>;
  getRecentlyApprovedBookings(): Promise<Booking[]>;
  markBookingAsMergeEligible(bookingId: number, isEligible: boolean): Promise<Booking>;
  updateBookingMetadata(
    bookingId: number,
    metadata: {
      totalDistance?: number;
      estimatedCost?: number;
      co2Emissions?: number;
    }
  ): Promise<Booking>;

  // Employee methods
  createEmployee(employeeData: InsertEmployee): Promise<Employee>;
  findEmployeeByIdAndEmail(employeeId: string, email: string): Promise<Employee | null>;
  findEmployeeByEmployeeId(employeeId: string): Promise<Employee | null>;
  findEmployeeByEmail(email: string): Promise<Employee | null>;
  findUserByEmployeeId(employeeId: string): Promise<User | null>;
  findUserByEmployeeEmail(email: string): Promise<User | null>;
  mapEmployeeToUser(employee: Employee): Promise<User | null>;
  mapUserToEmployee(user: User): Promise<Employee | null>;
  getAllEmployees(): Promise<Employee[]>;
  getEmployeeById(id: number): Promise<Employee | null>;
  updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: number): Promise<void>;

  // User methods
  findUserByEmail(email: string): Promise<User | null>;
  getUser(id: number): Promise<User | null>;
  markUserAsVerified(userId: number): Promise<User>;
  updateUserLastLogin(userId: number): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUserByUserName(userName: string): Promise<User | null>;
  createUser(userData: InsertUser): Promise<User>;
  updateUser(userId: number, userData: Partial<User>): Promise<User>;
  deleteUser(userId: number): Promise<void>;


  // OTP methods
  createOtpVerification(verification: InsertOtpVerification): Promise<OtpVerification>;
  getOtpVerification(userId: number): Promise<OtpVerification | null>;
  deleteOtpVerification(userId: number): Promise<void>;
  activateUser(userId: number): Promise<User>;

  // Add Vehicle Group methods
  getAllVehicleGroups(): Promise<VehicleGroup[]>;
  getVehicleGroup(id: number): Promise<VehicleGroup | null>;
  createVehicleGroup(group: InsertVehicleGroup): Promise<VehicleGroup>;
  updateVehicleGroup(id: number, data: Partial<InsertVehicleGroup>): Promise<VehicleGroup>;
  
  // Trip merge methods
  createParentBooking(sourceBooking: Booking): Promise<Booking>;
  updateBookingParent(bookingId: number, parentBookingId: number): Promise<Booking>;

  // Approval Workflow methods
  createWorkflow(workflow: InsertApprovalWorkflow): Promise<ApprovalWorkflow>;
  getWorkflows(): Promise<ApprovalWorkflow[]>;
  updateWorkflow(id: number, data: Partial<InsertApprovalWorkflow>): Promise<ApprovalWorkflow>;

  // Vehicle Type Master methods
  getAllVehicleTypes(): Promise<VehicleTypeMaster[]>;
  getVehicleType(id: number): Promise<VehicleTypeMaster | null>;
  createVehicleType(type: InsertVehicleTypeMaster): Promise<VehicleTypeMaster>;
  updateVehicleType(id: number, data: Partial<InsertVehicleTypeMaster>): Promise<VehicleTypeMaster>;
  deleteVehicleType(id: number): Promise<void>;

  // Vehicle Master operations
  getAllVehicleMaster(): Promise<VehicleMaster[]>;
  getVehicleMaster(id: number): Promise<VehicleMaster | null>;
  createVehicleMaster(data: InsertVehicleMaster): Promise<VehicleMaster>;
  updateVehicleMaster(id: number, data: Partial<InsertVehicleMaster>): Promise<VehicleMaster>;

  updateUserResetToken(userId: number, resetToken: string | null, resetTokenExpiry: Date | null): Promise<User>;
  findUserByResetToken(resetToken: string): Promise<User | null>;
  getAllEmployees(): Promise<Employee[]>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<User>;
  initializeDefaultUser(): Promise<void>; // Added method

  // Fuel-related methods
  getAllFuelTypes(): Promise<FuelType[]>;
  getFuelTypeById(id: number): Promise<FuelType | null>;
  getFuelTypeByType(type: string): Promise<FuelType | null>;
  createFuelType(data: any): Promise<FuelType>;
  updateFuelType(id: number, data: Partial<FuelType>): Promise<FuelType>;
  updateFuelTypePrice(fuelType: string, price: number): Promise<void>;
  recalculateVehicleCosts(): Promise<void>;
  getFuelPriceHistory(): Promise<any[]>; // Get historical fuel price data
  deleteFuelType(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Initialize session store
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
  }

  // Fuel-related methods
  async getAllFuelTypes(): Promise<FuelType[]> {
    try {
      console.log("Fetching all fuel types");
      const fuelTypes = await db.select().from(schema.fuelTypes);
      console.log("Found fuel types:", fuelTypes);
      return fuelTypes;
    } catch (error) {
      console.error("Error in getAllFuelTypes:", error);
      throw error;
    }
  }

  async updateFuelTypePrice(fuelType: string, price: number): Promise<void> {
    try {
      console.log(`Updating price for fuel type ${fuelType} to ${price}`);
      await db
        .update(schema.fuelTypes)
        .set({
          price: price.toString(),
          updated_at: new Date(),
          last_fetched_at: new Date()
        })
        .where(eq(schema.fuelTypes.type, fuelType));
      console.log("Fuel price updated successfully");
    } catch (error) {
      console.error(`Error updating fuel price for ${fuelType}:`, error);
      throw error;
    }
  }

  async recalculateVehicleCosts(): Promise<void> {
    try {
      console.log("Recalculating vehicle costs and efficiency metrics based on updated fuel prices");

      // Get all fuel types with their current prices and other metrics
      const fuelTypes = await this.getAllFuelTypes();
      const fuelTypeMap = new Map<string, FuelType>();

      // Create maps for all fuel type metrics for quick lookup
      fuelTypes.forEach(fuel => {
        fuelTypeMap.set(fuel.type, fuel);
      });

      // Efficiency adjustment factors based on fuel price changes
      // As fuel prices increase, fuel efficiency might slightly decrease due to quality changes
      const efficiencyAdjustmentFactor = 0.99; // 1% reduction in efficiency for new fuel

      // Idle consumption adjustment based on fuel quality and price
      const idleConsumptionAdjustmentFactor = 1.02; // 2% increase in idle consumption for new fuel

      // Get all vehicle types
      const vehicleTypes = await this.getAllVehicleTypes();

      // Get current month/year for logging
      const newDataMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      console.log(`Updating vehicle metrics for ${newDataMonth}`);

      // Update each vehicle type with the new fuel price and recalculated values
      for (const vehicleType of vehicleTypes) {
        const fuelType = fuelTypeMap.get(vehicleType.fuel_type);

        if (fuelType) {
          const fuelPrice = parseFloat(fuelType.price.toString());

          // Get current values to calculate adjustments
          const currentFuelEfficiency = parseFloat(vehicleType.fuel_efficiency.toString());
          const currentIdleConsumption = parseFloat(vehicleType.idle_fuel_consumption?.toString() || "0");

          // Calculate adjusted efficiency and consumption values
          const adjustedFuelEfficiency = Math.round(currentFuelEfficiency * efficiencyAdjustmentFactor * 100) / 100;
          const adjustedIdleConsumption = Math.round(currentIdleConsumption * idleConsumptionAdjustmentFactor * 100) / 100;

          // Calculate new cost per km based on fuel efficiency and new price
          const costPerKm = Math.round((fuelPrice / adjustedFuelEfficiency) * 100) / 100;

          // Get CO2 emission factor for this fuel type
          const co2Factor = parseFloat(fuelType.co2_factor?.toString() || "0");

          console.log(`Updating ${vehicleType.vehicle_type_name} (${vehicleType.vehicle_type_code}):`);
          console.log(`- Fuel price: ${fuelPrice} AED/liter`);
          console.log(`- Adjusted fuel efficiency: ${adjustedFuelEfficiency} km/liter`);
          console.log(`- Adjusted idle consumption: ${adjustedIdleConsumption} liters/hour`);
          console.log(`- New cost per km: ${costPerKm} AED/km`);
          console.log(`- CO2 emission factor: ${co2Factor} kg/liter`);

          // Update the vehicle type with new values
          await db
            .update(schema.vehicleTypeMaster)
            .set({
              fuel_price_per_litre: fuelPrice.toString(),
              fuel_efficiency: adjustedFuelEfficiency.toString(),
              idle_fuel_consumption: adjustedIdleConsumption.toString(),
              cost_per_km: costPerKm.toString(),
              co2_emission_factor: co2Factor.toString(),
              updated_at: new Date()
            })
            .where(eq(schema.vehicleTypeMaster.id, vehicleType.id));
        } else {
          console.warn(`Fuel type ${vehicleType.fuel_type} not found for vehicle type ${vehicleType.vehicle_type_name}, skipping update`);
        }
      }

      console.log("Vehicle costs, efficiency, and consumption values recalculated successfully");

      // Now update vehicle masters based on their type
      console.log("Updating vehicle master records with new metrics");
      const vehicleMasters = await this.getAllVehicleMaster();

      for (const vehicle of vehicleMasters) {
        // Find the vehicle type for this vehicle
        const matchingVehicleTypes = vehicleTypes.filter(vt => vt.id === vehicle.vehicle_type_id);

        if (matchingVehicleTypes.length > 0) {
          const vehicleType = matchingVehicleTypes[0];

          // Update the vehicle master with metrics from its vehicle type
          await db
            .update(schema.vehicleMaster)
            .set({
              fuel_price_per_litre: vehicleType.fuel_price_per_litre,
              fuel_efficiency: vehicleType.fuel_efficiency,
              idle_fuel_consumption: vehicleType.idle_fuel_consumption,
              cost_per_km: vehicleType.cost_per_km,
              co2_emission_factor: vehicleType.co2_emission_factor,
              updated_at: new Date()
            })
            .where(eq(schema.vehicleMaster.id, vehicle.id));

          console.log(`Updated vehicle master ${vehicle.vehicle_number} with new metrics from type ${vehicleType.vehicle_type_name}`);
        }
      }

      console.log("Vehicle master records updated successfully");
    } catch (error) {
      console.error("Error recalculating vehicle metrics:", error);
      throw error;
    }
  }

  // Get historical fuel price data
  async getFuelPriceHistory(): Promise<any[]> {
    try {
      console.log("Fetching fuel price history");

      // Get all fuel types with their historical price data
      const fuelTypes = await this.getAllFuelTypes();
      const result: any[] = [];

      // Flatten the historical price data from all fuel types
      fuelTypes.forEach(fuel => {
        if (fuel.historical_prices && Array.isArray(fuel.historical_prices)) {
          const fuelHistory = fuel.historical_prices.map(record => ({
            fuel_type: fuel.type,
            date: record.date,
            price: record.price
          }));
          result.push(...fuelHistory);
        }

        // Also add the current price as the latest entry
        result.push({
          fuel_type: fuel.type,
          date: fuel.updated_at || new Date(),
          price: fuel.price
        });
      });

      // Sort the combined history by date (newest first)
      result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      console.log(`Found ${result.length} historical fuel price records`);
      return result;
    } catch (error) {
      console.error("Error fetching fuel price history:", error);
      throw error;
    }
  }

  // Get a specific fuel type by ID
  async getFuelTypeById(id: number): Promise<FuelType | null> {
    try {
      console.log(`Fetching fuel type with ID: ${id}`);
      const [fuelType] = await db
        .select()
        .from(schema.fuelTypes)
        .where(eq(schema.fuelTypes.id, id));

      return fuelType || null;
    } catch (error) {
      console.error(`Error fetching fuel type by ID ${id}:`, error);
      throw error;
    }
  }

  // Get a specific fuel type by type name
  async getFuelTypeByType(type: string): Promise<FuelType | null> {
    try {
      console.log(`Fetching fuel type with type: ${type}`);
      const [fuelType] = await db
        .select()
        .from(schema.fuelTypes)
        .where(eq(schema.fuelTypes.type, type));

      return fuelType || null;
    } catch (error) {
      console.error(`Error fetching fuel type by type ${type}:`, error);
      throw error;
    }
  }

  // Create a new fuel type
  async createFuelType(data: any): Promise<FuelType> {
    try {
      console.log("Creating new fuel type:", data);

      // Process the historical_prices field if it's a string
      let historicalPrices = data.historical_prices;
      if (typeof historicalPrices === 'string') {
        // Already a string, keep as is
      } else if (Array.isArray(historicalPrices)) {
        // Convert array to JSON string
        historicalPrices = JSON.stringify(historicalPrices);
      } else {
        // Default to empty array
        historicalPrices = '[]';
      }

      const [newFuelType] = await db
        .insert(schema.fuelTypes)
        .values({
          type: data.type,
          price: data.price.toString(),
          co2_factor: data.co2_factor.toString(),
          efficiency: data.efficiency ? data.efficiency.toString() : "0",
          idle_consumption: data.idle_consumption ? data.idle_consumption.toString() : "0",
          updated_at: data.updated_at || new Date(),
          last_fetched_at: data.last_fetched_at || new Date(),
          historical_prices: historicalPrices,
          created_at: data.created_at || new Date()
        })
        .returning();

      console.log("Successfully created fuel type:", newFuelType);
      return newFuelType;
    } catch (error) {
      console.error("Error creating fuel type:", error);
      throw error;
    }
  }

  // Update an existing fuel type
  async updateFuelType(id: number, data: Partial<FuelType>): Promise<FuelType> {
    try {
      console.log(`Updating fuel type with ID ${id}:`, data);

      // Create an update object with processed fields
      const updateData: Record<string, any> = {};

      // Only include fields that are present in the request and properly format them
      if (data.type !== undefined) updateData.type = data.type;

      if (data.price !== undefined) {
        updateData.price = typeof data.price === 'string' ? data.price : data.price.toString();
      }

      if (data.co2_factor !== undefined) {
        updateData.co2_factor = typeof data.co2_factor === 'string' ? data.co2_factor : data.co2_factor.toString();
      }

      if (data.efficiency !== undefined) {
        updateData.efficiency = typeof data.efficiency === 'string' ? data.efficiency : data.efficiency.toString();
      }

      if (data.idle_consumption !== undefined) {
        updateData.idle_consumption = typeof data.idle_consumption === 'string' ? 
          data.idle_consumption : data.idle_consumption.toString();
      }

      if (data.historical_prices !== undefined) {
        if (typeof data.historical_prices === 'string') {
          updateData.historical_prices = data.historical_prices;
        } else if (Array.isArray(data.historical_prices)) {
          updateData.historical_prices = JSON.stringify(data.historical_prices);
        }
      }

      // Always update the timestamps
      updateData.updated_at = new Date();

      // If last_fetched_at is provided, use it
      if (data.last_fetched_at) {
        updateData.last_fetched_at = data.last_fetched_at;
      }

      console.log("Update data:", updateData);

      const [updatedFuelType] = await db
        .update(schema.fuelTypes)
        .set(updateData)
        .where(eq(schema.fuelTypes.id, id))
        .returning();

      if (!updatedFuelType) {
        throw new Error(`Fuel type with ID ${id} not found`);
      }

      console.log("Successfully updated fuel type:", updatedFuelType);

      // After updating fuel type, recalculate vehicle costs
      if (data.price !== undefined) {
        console.log("Fuel price changed, scheduling vehicle cost recalculation");
        // Schedule for later to not block the response
        setTimeout(() => {
          this.recalculateVehicleCosts()
            .catch(err => console.error("Error recalculating vehicle costs after fuel price update:", err));
        }, 100);
      }

      return updatedFuelType;
    } catch (error) {
      console.error("Error updating fuel type:", error);
      throw error;
    }
  }

  // Delete a fuel type
  async deleteFuelType(id: number): Promise<void> {
    try {
      console.log(`Deleting fuel type with ID ${id}`);

      // Check if the fuel type exists first
      const fuelType = await this.getFuelTypeById(id);
      if (!fuelType) {
        throw new Error(`Fuel type with ID ${id} not found`);
      }

      // Check if there are any vehicles using this fuel type
      const [vehicleCount] = await db
        .select({ count: sql`count(*)` })
        .from(schema.vehicleTypeMaster)
        .where(eq(schema.vehicleTypeMaster.fuel_type, fuelType.type));

      if (vehicleCount && Number(vehicleCount.count) > 0) {
        throw new Error(`Cannot delete fuel type "${fuelType.type}" as it is being used by ${vehicleCount.count} vehicles`);
      }

      // Delete the fuel type
      await db
        .delete(schema.fuelTypes)
        .where(eq(schema.fuelTypes.id, id));

      console.log(`Successfully deleted fuel type with ID ${id}`);
    } catch (error) {
      console.error(`Error deleting fuel type with ID ${id}:`, error);
      throw error;
    }
  }
  // Vehicle Type Master methods
  async getAllVehicleTypes(): Promise<VehicleTypeMaster[]> {
    try {
      console.log("Querying vehicle type master records");
      const vehicleTypes = await db.select().from(schema.vehicleTypeMaster);

      // Process each vehicle type to ensure we don't have null values for important fields
      const processedTypes = vehicleTypes.map(type => {
        // Create a new object with non-null values for critical fields
        return {
          ...type,
          // Ensure these specific fields always have a string value
          fuel_type: type.fuel_type || "",
          vehicle_model: type.vehicle_model || "",
          vehicle_type: type.vehicle_type || "",
          manufacturer: type.manufacturer || "",
          vehicle_type_name: type.vehicle_type_name || "",
          vehicle_type_code: type.vehicle_type_code || "",
          region: type.region || "Abu Dhabi",
          department: type.department || "Fleet",
          service_plan: type.service_plan || "",
          unit: type.unit || "",
          // Convert potential nulls to empty strings in Drizzle-style record
          ...(Object.entries(type).reduce((acc, [key, value]) => {
            if (typeof value === 'string' || value === null) {
              acc[key] = value === null ? "" : value;
            }
            return acc;
          }, {} as Record<string, any>))
        };
      });

      console.log("Found and processed vehicle types:", processedTypes.length);
      return processedTypes;
    } catch (error) {
      console.error("Error in getAllVehicleTypes:", error);
      throw error;
    }
  }

  async getVehicleType(id: number): Promise<VehicleTypeMaster | null> {
    try {
      const [type] = await db
        .select()
        .from(schema.vehicleTypeMaster)
        .where(eq(schema.vehicleTypeMaster.id, id));
      return type || null;
    } catch (error) {
      console.error("Error in getVehicleType:", error);
      throw error;
    }
  }

  async createVehicleType(type: InsertVehicleTypeMaster): Promise<VehicleTypeMaster> {
    // Generate the vehicle type name by combining manufacturer and vehicle type
    const vehicleTypeName = `${type.manufacturer} ${type.vehicleType}`;

    const [newType] = await db
      .insert(schema.vehicleTypeMaster)
      .values({
        ...type,
        vehicleTypeName,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return newType;
  }

  async updateVehicleType(id: number, data: Partial<InsertVehicleTypeMaster>): Promise<VehicleTypeMaster> {
    let updateData = { ...data };

    // If either manufacturer or vehicleType is updated, update the vehicleTypeName
    if (data.manufacturer || data.vehicleType) {
      const [currentType] = await db
        .select()
        .from(schema.vehicleTypeMaster)
        .where(eq(schema.vehicleTypeMaster.id, id));

      const manufacturer = data.manufacturer || currentType.manufacturer;
      const vehicleType = data.vehicleType || currentType.vehicleType;
      updateData.vehicleTypeName = `${manufacturer} ${vehicleType}`;
    }

    const [updatedType] = await db
      .update(schema.vehicleTypeMaster)
      .set({
        ...updateData,
        updatedAt: new Date()
      })
      .where(eq(schema.vehicleTypeMaster.id, id))
      .returning();
    return updatedType;
  }

  async deleteVehicleType(id: number): Promise<void> {
    try {
      console.log(`Deleting vehicle type with ID ${id}`);

      // Check if the vehicle type exists first
      const vehicleType = await this.getVehicleType(id);
      if (!vehicleType) {
        throw new Error(`Vehicle type with ID ${id} not found`);
      }

      // Check if this vehicle type is being used by any vehicles
      const [vehicleCount] = await db
        .select({ count: sql`count(*)` })
        .from(schema.vehicleMaster)
        .where(eq(schema.vehicleMaster.vehicle_type_id, id));

      if (vehicleCount && Number(vehicleCount.count) > 0) {
        throw new Error(`Cannot delete vehicle type "${vehicleType.vehicle_type_name}" as it is being used by ${vehicleCount.count} vehicles`);
      }

      // Delete the vehicle type
      await db
        .delete(schema.vehicleTypeMaster)
        .where(eq(schema.vehicleTypeMaster.id, id));

      console.log(`Successfully deleted vehicle type with ID ${id}`);
    } catch (error) {
      console.error(`Error deleting vehicle type with ID ${id}:`, error);
      throw error;
    }
  }

  // Vehicle Group methods
  async getAllVehicleGroups(): Promise<VehicleGroup[]> {
    return await db.select().from(schema.vehicleGroups);
  }

  async getVehicleGroup(id: number): Promise<VehicleGroup | null> {
    const [group] = await db
      .select()
      .from(schema.vehicleGroups)
      .where(eq(schema.vehicleGroups.id, id));
    return group || null;
  }

  async createVehicleGroup(group: InsertVehicleGroup): Promise<VehicleGroup> {
    const [newGroup] = await db
      .insert(schema.vehicleGroups)
      .values({
        ...group,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return newGroup;
  }

  async updateVehicleGroup(id: number, data: Partial<InsertVehicleGroup>): Promise<VehicleGroup> {
    const [updatedGroup] = await db
      .update(schema.vehicleGroups)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(schema.vehicleGroups.id, id))
      .returning();
    return updatedGroup;
  }


  // Implement Vehicle Master operations
  async getAllVehicleMaster(): Promise<VehicleMaster[]> {
    return await db.select().from(schema.vehicleMaster);
  }

  async getVehicleMaster(id: number): Promise<VehicleMaster | null> {
    const [vehicle] = await db
      .select()
      .from(schema.vehicleMaster)
      .where(eq(schema.vehicleMaster.id, id));
    return vehicle || null;
  }

  async createVehicleMaster(data: InsertVehicleMaster): Promise<VehicleMaster> {
    const [newVehicle] = await db
      .insert(schema.vehicleMaster)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return newVehicle;
  }

  async updateVehicleMaster(id: number, data: Partial<InsertVehicleMaster>): Promise<VehicleMaster> {
    const [updatedVehicle] = await db
      .update(schema.vehicleMaster)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(schema.vehicleMaster.id, id))
      .returning();
    return updatedVehicle;
  }

  async getVehicles(): Promise<Vehicle[]> {
    try {
      console.log("[STORAGE] Fetching all vehicles");
      // Use a raw query to avoid schema mismatches
      const result = await db.execute(sql`
        SELECT * FROM vehicles
      `);
      
      console.log(`[STORAGE] Found ${result.rows.length} vehicles`);
      return result.rows as Vehicle[];
    } catch (error) {
      console.error("[STORAGE] Error fetching vehicles:", error);
      // Return empty array instead of throwing to prevent UI breakage
      return [];
    }
  }
  async getAvailableVehicles(): Promise<Vehicle[]> {
    try {
      console.log("[STORAGE] Fetching available vehicles");
      // Use a raw query to avoid schema mismatches
      const result = await db.execute(sql`
        SELECT * FROM vehicles WHERE status = 'available'
      `);
      
      console.log(`[STORAGE] Found ${result.rows.length} available vehicles`);
      return result.rows as Vehicle[];
    } catch (error) {
      console.error("[STORAGE] Error fetching available vehicles:", error);
      // Return empty array instead of throwing to prevent UI breakage
      return [];
    }
  }
  async updateVehicleStatus(id: number, status: string): Promise<Vehicle> {
    const [vehicle] = await db
      .update(schema.vehicles)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(schema.vehicles.id, id))
      .returning();

    return vehicle;
  }
  async getDrivers(): Promise<Driver[]> {
    throw new Error("Method not implemented.");
  }
  async getAvailableDrivers(): Promise<Driver[]> {
    throw new Error("Method not implemented.");
  }
  async updateDriverStatus(id: number, status: string): Promise<Driver> {
    const [driver] = await db
      .update(schema.drivers)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(schema.drivers.id, id))
      .returning();

    return driver;
  }
  async getBookings(): Promise<Booking[]> {
    try {
      console.log("[STORAGE] Fetching all bookings");
      // Use a raw query to avoid schema mismatches
      const result = await db.execute(sql`
        SELECT * FROM bookings
      `);
      
      console.log(`[STORAGE] Found ${result.rows.length} bookings`);
      return result.rows as Booking[];
    } catch (error) {
      console.error("[STORAGE] Error fetching bookings:", error);
      // Return empty array instead of throwing to prevent UI breakage
      return [];
    }
  }
  
  /**
   * Get bookings that are eligible for merging
   * These are confirmed bookings with no assigned vehicle
   * and no trip_id yet (not already merged)
   */
  async getBookingsEligibleForMerging(): Promise<Booking[]> {
    try {
      console.log("[STORAGE] Finding bookings eligible for merging");
      
      // Using raw SQL to avoid column mismatch issues
      const query = sql`
        SELECT * FROM bookings 
        WHERE 
          status = 'confirmed' 
          AND assigned_vehicle_id IS NULL 
          AND is_merged = false 
          AND trip_id IS NULL
          AND merged_with_booking_id IS NULL
      `;
      
      const result = await db.execute(query);
      const eligibleBookings = result.rows as Booking[];
      
      console.log(`[STORAGE] Found ${eligibleBookings.length} bookings eligible for merging`);
      return eligibleBookings;
    } catch (error) {
      console.error("[STORAGE] Error finding bookings eligible for merging:", error);
      return []; // Return empty array instead of throwing to prevent service interruption
    }
  }

  /**
   * Get recently approved bookings that need to be checked for merge eligibility
   * This finds bookings that have been recently set to "approved" status and not yet processed
   */
  async getRecentlyApprovedBookings(): Promise<Booking[]> {
    try {
      console.log("[STORAGE] Finding recently approved bookings for merge eligibility check");
      
      // Get a timestamp for 24 hours ago to check recent bookings
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const oneDayAgoStr = oneDayAgo.toISOString();
      
      // Using raw SQL to avoid column issues
      const query = sql`
        SELECT * FROM bookings 
        WHERE 
          status = 'approved' 
          AND (merge_eligible IS NULL)
          AND updated_at > ${oneDayAgoStr}::timestamp
      `;
      
      const result = await db.execute(query);
      const recentlyApprovedBookings = result.rows as Booking[];
      
      console.log(`[STORAGE] Found ${recentlyApprovedBookings.length} recently approved bookings to check for merge eligibility`);
      return recentlyApprovedBookings;
    } catch (error) {
      console.error("[STORAGE] Error finding recently approved bookings:", error);
      return []; // Return empty array instead of throwing to prevent service interruption
    }
  }
  
  /**
   * Mark a booking as eligible or ineligible for merging
   * This is used to flag bookings that should display with the green flag symbol in the UI
   */
  async markBookingAsMergeEligible(bookingId: number, isEligible: boolean): Promise<Booking> {
    try {
      console.log(`[STORAGE] Marking booking #${bookingId} as ${isEligible ? 'eligible' : 'ineligible'} for merging`);
      
      // Using raw SQL to avoid column mismatch issues
      const query = sql`
        UPDATE bookings
        SET 
          merge_eligible = ${isEligible},
          updated_at = NOW()
        WHERE id = ${bookingId}
        RETURNING *
      `;
      
      const result = await db.execute(query);
      
      if (result.rows.length === 0) {
        throw new Error(`Booking with ID ${bookingId} not found`);
      }
      
      const updatedBooking = result.rows[0] as Booking;
      console.log(`[STORAGE] Successfully marked booking #${bookingId} as ${isEligible ? 'eligible' : 'ineligible'} for merging`);
      
      return updatedBooking;
    } catch (error) {
      console.error(`[STORAGE] Error marking booking #${bookingId} as merge eligible:`, error);
      throw error;
    }
  }
  
  async createBooking(bookingData: InsertBooking): Promise<Booking> {
    const debugId = Date.now().toString();
    try {
      // Enhanced debugging
      console.log(`[BOOKING-DB-${debugId}] Creating booking - Starting process`);
      console.log(`[BOOKING-DB-${debugId}] Creating booking with data:`, JSON.stringify(bookingData, null, 2));

      // Run data analysis on incoming booking data
      console.log(`[BOOKING-DB-${debugId}] Analyzing booking data:`, JSON.stringify(bookingData, null, 2));

      // Convert camelCase properties to snake_case for database
      const dbData: any = { ...bookingData };

      // STEP 1: Set timestamps in snake_case
      dbData.created_at = new Date();
      dbData.updated_at = new Date();

      // STEP 2: Handle the employee ID - this is CRITICAL for proper foreign key reference
      console.log(`[BOOKING-DB-${debugId}] Validating employee_id...`);

      // Handle both camelCase (employeeId) and snake_case (employee_id) for backward compatibility
      let employeeIdValue = undefined;

      // First check employee_id (snake_case) which is the database field name
      if (bookingData.employee_id !== undefined && bookingData.employee_id !== null) {
        employeeIdValue = bookingData.employee_id;
        console.log(`[BOOKING-DB-${debugId}] Found employee_id (snake_case): ${employeeIdValue} (type: ${typeof employeeIdValue})`);
      } 
      // Then check employeeId (camelCase) as fallback
      else if (bookingData.employeeId !== undefined && bookingData.employeeId !== null) {
        employeeIdValue = bookingData.employeeId;
        console.log(`[BOOKING-DB-${debugId}] Found employeeId (camelCase): ${employeeIdValue} (type: ${typeof employeeIdValue})`);
      }

      // Ensure employee_id is a number
      if (employeeIdValue !== undefined && employeeIdValue !== null) {
        // Convert to number if it's not already
        if (typeof employeeIdValue !== 'number') {
          const originalValue = employeeIdValue;
          employeeIdValue = Number(employeeIdValue);

          // Check if conversion was successful
          if (isNaN(employeeIdValue)) {
            console.error(`[BOOKING-DB-${debugId}] Failed to convert employee_id "${originalValue}" to a number`);
            throw new Error(`Invalid employee ID format: "${originalValue}" is not a valid number`);
          }

          console.log(`[BOOKING-DB-${debugId}] Converted employee_id from "${originalValue}" to number: ${employeeIdValue}`);
        }

        // Update dbData with the validated employee_id
        dbData.employee_id = employeeIdValue;

        // Double check the employee exists in the database before proceeding
        try {
          const employee = await db.query.employees.findFirst({
            where: eq(schema.employees.id, employeeIdValue),
            columns: {
              id: true,
              employee_id: true,
              employee_name: true
            }
          });

          if (!employee) {
            // If not found by internal id, try with employee_id field
            // IMPORTANT: employee_id is an integer in the schema, so we must compare with a number
            console.log(`[BOOKING-DB-${debugId}] Looking up employee by employee_id=${employeeIdValue} (${typeof employeeIdValue})`);

            const employeeByCode = await db.query.employees.findFirst({
              where: eq(schema.employees.employee_id, Number(employeeIdValue)),
              columns: {
                id: true,
                employee_id: true,
                employee_name: true
              }
            });

            if (employeeByCode) {
              // Use the internal ID from the found employee
              dbData.employee_id = employeeByCode.id;
              console.log(`[BOOKING-DB-${debugId}] Found employee by employee_id code: ${employeeByCode.employee_name} (ID: ${employeeByCode.id})`);
            } else {
              throw new Error(`Employee with ID ${employeeIdValue} not found in database`);
            }
          } else {
            console.log(`[BOOKING-DB-${debugId}] Verified employee exists: ${employee.employee_name} (ID: ${employee.id})`);
          }
        } catch (error) {
          console.error(`[BOOKING-DB-${debugId}] Error verifying employee:`, error);
          throw new Error(`Employee verification failed: ${error.message}`);
        }
      } else {
        console.error(`[BOOKING-DB-${debugId}] No valid employee_id found in booking data`);
        throw new Error("Employee ID is required for booking creation");
      }

      console.log(`[BOOKING-DB-${debugId}] Final employee ID value:`, employeeIdValue, `(type: ${typeof employeeIdValue})`);

      if (employeeIdValue === undefined || employeeIdValue === null) {
        // Case 1: No employee ID provided
        const error = new Error("Employee ID is required for booking creation");
        console.error("ERROR: Missing employee ID for booking creation");
        console.error(`[BOOKING-DB-${debugId}] ERROR: No employeeId provided in booking data`);
        throw error;
      }

      // Strict conversion to number to ensure database compatibility
      let employeeIdNum: number;

      // Case 2: Handle various input types for employee ID
      if (typeof employeeIdValue === 'number') {
        // Already a number, just use it
        employeeIdNum = employeeIdValue;
        console.log(`[BOOKING-DB-${debugId}] Using numeric employee_id directly:`, employeeIdNum);
      } else if (typeof employeeIdValue === 'string') {
        // Try to convert string to integer with base 10
        const parsed = parseInt(employeeIdValue.trim(), 10);

        if (isNaN(parsed)) {
          const error = new Error(`Invalid employee_id string format: "${employeeIdValue}" - must be a valid number`);
          console.error(`[BOOKING-DB-${debugId}] ERROR: Failed to parse employee_id string: "${employeeIdValue}"`);
          console.error("Invalid employee ID string format:", { providedValue: employeeIdValue });
          throw error;
        }

        employeeIdNum = parsed;
        console.log(`[BOOKING-DB-${debugId}] Converted string employee_id "${employeeIdValue}" to number:`, employeeIdNum);
      } else {
        // Last resort: try generic Number() conversion for other types
        employeeIdNum = Number(employeeIdValue);

        if (isNaN(employeeIdNum)) {
          const error = new Error(`Invalid employee_id type (${typeof employeeIdValue}) or format`);
          console.error(`[BOOKING-DB-${debugId}] ERROR: Failed to convert employee_id of type ${typeof employeeIdValue}`);
          console.error("Invalid employee ID type:", { 
            type: typeof employeeIdValue,
            value: String(employeeIdValue)
          });
          throw error;
        }

        console.log(`[BOOKING-DB-${debugId}] Converted employee_id of type ${typeof employeeIdValue} to number:`, employeeIdNum);
      }

      // STEP 3: Always verify the employee exists to avoid foreign key errors
      try {
        console.log(`[BOOKING-DB-${debugId}] Verifying employee ID ${employeeIdNum} exists in database`);

        // First, try to find by internal ID
        let employee = await db
          .select({ 
            id: schema.employees.id,
            name: schema.employees.employee_name,
            employee_id: schema.employees.employee_id  // Include employee_id string field
          })
          .from(schema.employees)
          .where(eq(schema.employees.id, employeeIdNum))
          .limit(1);

        // If not found by internal ID, try to find by employee_id string field
        if (employee.length === 0) {
          console.log(`[BOOKING-DB-${debugId}] ⚠️ Employee not found by internal ID, trying employee_id string field...`);

          // Convert to string to match the string field in the database
          const employeeIdStr = String(employeeIdNum);

          employee = await db
            .select({ 
              id: schema.employees.id,
              name: schema.employees.employee_name,
              employee_id: schema.employees.employee_id
            })
            .from(schema.employees)
            .where(eq(schema.employees.employee_id, employeeIdStr))
            .limit(1);

          if (employee.length > 0) {
            console.log(`[BOOKING-DB-${debugId}] ✓ Found employee by employee_id string field:`, employee[0]);
            // Update the employeeIdNum to use the internal ID for foreign key reference
            employeeIdNum = employee[0].id;
            console.log(`[BOOKING-DB-${debugId}] Updated employeeIdNum to internal ID:`, employeeIdNum);
          }
        }

        if (employee.length === 0) {
          const error = new Error(`Employee with ID ${employeeIdNum} not found in the database`);
          console.error(`[BOOKING-DB-${debugId}] ERROR: Employee ID ${employeeIdNum} not found in database`);
          console.error("Employee not found:", { employeeId: employeeIdNum });
          throw error;
        }

        // Log successful employee check
        console.log(`[BOOKING-DB-${debugId}] ✓ Successfully verified employee exists:`, employee[0].name);
        console.log(`[BOOKING-DB-${debugId}] Employee details: internal ID = ${employee[0].id}, employee_id = ${employee[0].employee_id}`);
        console.log("Employee verification successful:", { 
          employeeId: employeeIdNum,
          employeeName: employee[0].name,
          employeeFound: true,
          originalEmployeeId: employee[0].employee_id
        });
      } catch (employeeCheckError) {
        console.error("Error checking employee:", { 
          error: employeeCheckError instanceof Error ? employeeCheckError.message : String(employeeCheckError),
          employeeId: employeeIdNum 
        });
        throw employeeCheckError;
      }

      // STEP 4: Assign the validated employee ID to snake_case property and remove camelCase version
      dbData.employee_id = employeeIdNum;
      console.log(`[BOOKING-DB-${debugId}] Setting employee_id in database to:`, dbData.employee_id, `(type: ${typeof dbData.employee_id})`);
      delete dbData.employeeId;

      // Ensure number fields are properly typed with snake_case naming
      if (bookingData.numBoxes !== undefined) dbData.num_boxes = Number(bookingData.numBoxes);
      if (bookingData.weight !== undefined) dbData.weight = Number(bookingData.weight);
      if (bookingData.numPassengers !== undefined) dbData.num_passengers = Number(bookingData.numPassengers);
      if (bookingData.totalDistance !== undefined) dbData.total_distance = Number(bookingData.totalDistance);
      if (bookingData.estimatedCost !== undefined) dbData.estimated_cost = Number(bookingData.estimatedCost);
      if (bookingData.co2Emissions !== undefined) dbData.co2_emissions = Number(bookingData.co2Emissions);

      // Remove camelCase properties to avoid conflicts
      delete dbData.numBoxes;
      delete dbData.numPassengers;
      delete dbData.totalDistance;
      delete dbData.estimatedCost;
      delete dbData.co2Emissions;
      delete dbData.createdAt;
      delete dbData.updatedAt;

      // Make sure reference_no is set if it's not already
      if (!dbData.reference_no) {
        dbData.reference_no = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;
      }

      // STEP 5: Extract coordinates from location objects for direct database storage
      console.log(`[BOOKING-DB-${debugId}] Processing location coordinates...`);

      if (bookingData.pickup_location && bookingData.pickup_location.coordinates) {
        // Extract pickup coordinates
        dbData.pickup_latitude = bookingData.pickup_location.coordinates.lat;
        dbData.pickup_longitude = bookingData.pickup_location.coordinates.lng;
        console.log(`[BOOKING-DB-${debugId}] Extracted pickup coordinates: lat=${dbData.pickup_latitude}, lng=${dbData.pickup_longitude}`);
      } else {
        console.error(`[BOOKING-DB-${debugId}] ERROR: Missing pickup location coordinates`);
        throw new Error("Pickup location coordinates are required");
      }

      if (bookingData.dropoff_location && bookingData.dropoff_location.coordinates) {
        // Extract dropoff coordinates
        dbData.dropoff_latitude = bookingData.dropoff_location.coordinates.lat;
        dbData.dropoff_longitude = bookingData.dropoff_location.coordinates.lng;
        console.log(`[BOOKING-DB-${debugId}] Extracted dropoff coordinates: lat=${dbData.dropoff_latitude}, lng=${dbData.dropoff_longitude}`);
      } else {
        console.error(`[BOOKING-DB-${debugId}] ERROR: Missing dropoff location coordinates`);
        throw new Error("Dropoff location coordinates are required");
      }

      // Final log of data before insert
      console.log("About to insert booking with data:", JSON.stringify(dbData, null, 2));

      try {
        // Create the SQL string for logging purposes
        const insertSql = `
INSERT INTO bookings (
  ${Object.keys(dbData).join(',\n  ')}
) VALUES (
  ${Object.keys(dbData).map((_, i) => `$${i + 1}`).join(', ')}
)
RETURNING *;`;

        // Log the SQL query for debugging
        console.log("SQL query for booking insert:", insertSql);
        console.log("SQL params:", Object.values(dbData));

        // DEBUG: Log more information about the data being inserted
        console.log("DETAILED DEBUG - INSERT OPERATION");
        console.log("======================================");
        console.log("Data type:", typeof dbData);
        console.log("Is Array:", Array.isArray(dbData));
        console.log("Has employee_id:", dbData.hasOwnProperty('employee_id'));
        console.log("employee_id value:", dbData.employee_id, "type:", typeof dbData.employee_id);
        console.log("booking_type value:", dbData.booking_type, "type:", typeof dbData.booking_type);
        console.log("pickup_location type:", typeof dbData.pickup_location);
        console.log("dropoff_location type:", typeof dbData.dropoff_location);
        // Enhanced date debugging and validation
        console.log("BEFORE CONVERSION - pickup_time:", dbData.pickup_time, "type:", typeof dbData.pickup_time);
        console.log("BEFORE CONVERSION - dropoff_time:", dbData.dropoff_time, "type:", typeof dbData.dropoff_time);

        // Ensure dates are valid Date objects before storing
        // Handling timestamps for text columns
        if (dbData.pickup_time) {
          try {
            // Convert any type to string format suitable for text column
            if (typeof dbData.pickup_time === 'string') {
              // If it's already a string, make sure it's valid
              const pickupDate = new Date(dbData.pickup_time);
              if (!isNaN(pickupDate.getTime())) {
                console.log("Valid pickup_time string:", dbData.pickup_time);
              } else {
                console.error(`Invalid pickup_time string: "${dbData.pickup_time}"`);
                dbData.pickup_time = null;
              }
            } 
            // For Date objects, convert to string
            else if (dbData.pickup_time instanceof Date) {
              if (!isNaN(dbData.pickup_time.getTime())) {
                dbData.pickup_time = dbData.pickup_time.toISOString();
                console.log("Converted pickup_time Date object to string:", dbData.pickup_time);
              } else {
                console.error("pickup_time is an invalid Date object");
                dbData.pickup_time = null;
              }
            }
            // If it's neither string nor Date, try to handle it
            else {
              console.error(`Unexpected pickup_time type: ${typeof dbData.pickup_time}, value:`, dbData.pickup_time);
              try {
                const pickupDate = new Date(dbData.pickup_time);
                if (!isNaN(pickupDate.getTime())) {
                  dbData.pickup_time = pickupDate.toISOString();
                  console.log("Successfully converted unusual pickup_time format to string:", dbData.pickup_time);
                } else {
                  dbData.pickup_time = null;
                }
              } catch (e) {
                console.error("Failed to convert unusual pickup_time format:", e);
                dbData.pickup_time = null;
              }
            }
          } catch (error) {
            console.error("Error processing pickup_time:", error);
            dbData.pickup_time = null;
          }
        }

        if (dbData.dropoff_time) {
          try {
            // Convert any type to string format suitable for text column
            if (typeof dbData.dropoff_time === 'string') {
              // If it's already a string, make sure it's valid
              const dropoffDate = new Date(dbData.dropoff_time);
              if (!isNaN(dropoffDate.getTime())) {
                console.log("Valid dropoff_time string:", dbData.dropoff_time);
              } else {
                console.error(`Invalid dropoff_time string: "${dbData.dropoff_time}"`);
                dbData.dropoff_time = null;
              }
            } 
            // For Date objects, convert to string
            else if (dbData.dropoff_time instanceof Date) {
              if (!isNaN(dbData.dropoff_time.getTime())) {
                dbData.dropoff_time = dbData.dropoff_time.toISOString();
                console.log("Converted dropoff_time Date object to string:", dbData.dropoff_time);
              } else {
                console.error("dropoff_time is an invalid Date object");
                dbData.dropoff_time = null;
              }
            }
            // If it's neither string nor Date, try to handle it
            else {
              console.error(`Unexpected dropoff_time type: ${typeof dbData.dropoff_time}, value:`, dbData.dropoff_time);
              try {
                const dropoffDate = new Date(dbData.dropoff_time);
                if (!isNaN(dropoffDate.getTime())) {
                  dbData.dropoff_time = dropoffDate.toISOString();
                  console.log("Successfully converted unusual dropoff_time format to string:", dbData.dropoff_time);
                } else {
                  dbData.dropoff_time = null;
                }
              } catch (e) {
                console.error("Failed to convert unusual dropoff_time format:", e);
                dbData.dropoff_time = null;
              }
            }
          } catch (error) {
            console.error("Error processing dropoff_time:", error);
            dbData.dropoff_time = null;
          }
        }

        console.log("AFTER CONVERSION - pickup_time:", dbData.pickup_time, "type:", typeof dbData.pickup_time);
        console.log("AFTER CONVERSION - dropoff_time:", dbData.dropoff_time, "type:", typeof dbData.dropoff_time);
        console.log("======================================");

        // Perform the actual insert with enhanced logging and validation
        console.log("Executing INSERT operation with data:", JSON.stringify(dbData, null, 2));

        let result;
        try {
          console.log("About to execute db.insert()...");
          result = await db
            .insert(schema.bookings)
            .values(dbData)
            .returning();

          console.log("INSERT query completed successfully, result:", result);
        } catch (insertError) {
          console.error("ERROR during INSERT operation:", insertError);
          if (insertError.code) {
            console.error(`SQL error code: ${insertError.code}, detail: ${insertError.detail || "None"}`);
          }

          // Rethrow with more specific information
          throw new Error(`Database INSERT failed: ${insertError.message}`);
        }

        // Validate the result
        if (!result || result.length === 0) {
          const error = new Error("Database INSERT succeeded but returned no data");
          // Use undefined for sessionId since we don't have it, 'booking' for entity
          console.log("Database INSERT succeeded but returned no data");
          throw error;
        }

        const [booking] = result;

        if (!booking || !booking.id) {
          const error = new Error("Invalid booking data returned from database");
          // Log error with proper console output
          console.error("Invalid booking data returned from database");
          throw error;
        }

        console.log("SUCCESS: Created booking with ID:", booking.id);
        console.log("Booking details:", JSON.stringify({
          id: booking.id,
          reference_no: booking.reference_no,
          employee_id: booking.employee_id,
          status: booking.status,
          booking_type: booking.booking_type
        }, null, 2));

        // Success - booking created successfully
        console.log("Booking created successfully:", booking.id);
        return booking;
      } catch (dbError) {
        console.error("Database error creating booking:", dbError);
        console.error("Database operation failed:", { 
          error: dbError instanceof Error ? dbError.message : String(dbError),
          dbData 
        });

        // Check if this is a constraint violation and provide more details
        if (dbError instanceof Error && dbError.message && dbError.message.includes('violates foreign key constraint')) {
          if (dbError.message.includes('employee_id')) {
            throw new Error(`The employee ID ${dbData.employee_id} does not exist in the database. Please select a valid employee.`);
          }
        }

        // Re-throw the original error if it wasn't one we could provide better info for
        throw dbError;
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      console.error("General booking error:", { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new Error(error instanceof Error ? error.message : "Failed to create booking");
    }
  }
  async assignBooking(bookingId: number, vehicleId: number, driverId: number): Promise<Booking> {
    try {
      console.log(`Assigning booking ${bookingId} to vehicle ${vehicleId} and driver ${driverId}`);

      const [booking] = await db
        .update(schema.bookings)
        .set({
          assigned_vehicle_id: vehicleId,
          assigned_driver_id: driverId,
          status: "confirmed",
          confirmed_at: new Date(),
          updated_at: new Date()
        })
        .where(eq(schema.bookings.id, bookingId))
        .returning();

      if (!booking) {
        throw new Error(`Booking with ID ${bookingId} not found`);
      }

      console.log("Successfully assigned booking:", booking);
      return booking;
    } catch (error) {
      console.error("Error assigning booking:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to assign booking");
    }
  }
  async updateBookingStatus(id: number, status: string): Promise<Booking> {
    try {
      console.log(`Updating booking ${id} status to: ${status}`);

      // Validate the booking ID
      if (!id || isNaN(id)) {
        throw new Error(`Invalid booking ID: ${id}`);
      }

      // Check if booking exists
      const [existingBooking] = await db
        .select()
        .from(schema.bookings)
        .where(eq(schema.bookings.id, id));

      if (!existingBooking) {
        throw new Error(`Booking with ID ${id} not found`);
      }

      const statusTimestamp = new Date();
      const dbData: any = {
        status,
        updated_at: statusTimestamp
      };

      // Add specific timestamp based on status using snake_case for db fields
      switch (status) {
        case "confirmed":
          dbData.confirmed_at = statusTimestamp;
          break;
        case "completed":
          dbData.completed_at = statusTimestamp;
          break;
        case "cancelled":
          dbData.cancelled_at = statusTimestamp;
          break;
      }

      const [updatedBooking] = await db
        .update(schema.bookings)
        .set(dbData)
        .where(eq(schema.bookings.id, id))
        .returning();

      if (!updatedBooking) {
        throw new Error(`Failed to update status for booking with ID ${id}`);
      }

      console.log(`Successfully updated booking ${id} status to ${status}`);
      return updatedBooking;
    } catch (error) {
      console.error(`Error updating booking status:`, error);
      throw new Error(error instanceof Error ? error.message : "Failed to update booking status");
    }
  }

  async deleteAllBookings(): Promise<void> {
    try {
      console.log("[BOOKINGS-DELETE-ALL] Deleting all bookings from database");

      // Delete all records from the bookings table
      await db.delete(schema.bookings);

      console.log("[BOOKINGS-DELETE-ALL] Successfully deleted all bookings");
    } catch (error) {
      console.error("[BOOKINGS-DELETE-ALL] Error deleting all bookings:", error);
      throw error;
    }
  }
  async findEmployeeByIdAndEmail(employeeId: string, email: string): Promise<Employee | null> {
    try {
      console.log(`Finding employee with ID ${employeeId} and email ${email}`);

      // Validate input parameters
      if (!employeeId || !email) {
        console.error('Missing required parameters: employeeId or email');
        return null;
      }

      // Convert employeeId to a number
      const empId = parseInt(employeeId);
      if (isNaN(empId)) {
        console.error('Invalid employee ID format:', employeeId);
        return null;
      }

      // Validate email format
      if (!email.includes('@') || !email.includes('.')) {
        console.error('Invalid email format:', email);
        return null;
      }

      // Query database
      const [employee] = await db
        .select()
        .from(schema.employees)
        .where(eq(schema.employees.employee_id, empId))
        .where(eq(schema.employees.email_id, email));

      if (employee) {
        console.log(`Found employee: ${employee.employee_name}`);
      } else {
        console.log(`No employee found with ID ${employeeId} and email ${email}`);
      }

      return employee || null;
    } catch (error) {
      console.error('Error finding employee by ID and email:', error);
      throw new Error(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async findEmployeeByEmail(email: string): Promise<Employee | null> {
    try {
      console.log(`Finding employee by email: ${email}`);

      if (!email) {
        console.error('Missing required parameter: email');
        return null;
      }

      // Validate email format
      if (!email.includes('@') || !email.includes('.')) {
        console.error('Invalid email format:', email);
        return null;
      }

      // Query database
      const [employee] = await db
        .select()
        .from(schema.employees)
        .where(eq(schema.employees.email_id, email));

      if (employee) {
        console.log(`Found employee by email: ${employee.employee_name} (ID: ${employee.employee_id})`);
      } else {
        console.log(`No employee found with email: ${email}`);
      }

      return employee || null;
    } catch (error) {
      console.error('Error finding employee by email:', error);
      throw new Error(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async findUserByEmployeeEmail(email: string): Promise<User | null> {
    try {
      console.log(`Finding user by employee email: ${email}`);

      // First find the employee by email
      const employee = await this.findEmployeeByEmail(email);
      if (!employee) {
        console.log(`No employee found with email: ${email}`);
        return null;
      }

      // Then find user with matching email
      const user = await this.findUserByEmail(email);

      if (user) {
        console.log(`Found user by employee email: ${user.user_name}`);
      } else {
        console.log(`No user found with email: ${email}`);
      }

      return user;
    } catch (error) {
      console.error('Error finding user by employee email:', error);
      throw new Error(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async mapEmployeeToUser(employee: Employee): Promise<User | null> {
    try {
      console.log(`Mapping employee ID ${employee.employee_id} to user`);

      // Find user with matching email
      const user = await this.findUserByEmail(employee.email_id);

      if (user) {
        console.log(`Employee (ID: ${employee.employee_id}) mapped to user: ${user.user_name}`);
      } else {
        console.log(`No user found for employee with ID: ${employee.employee_id}`);
      }

      return user;
    } catch (error) {
      console.error('Error mapping employee to user:', error);
      throw new Error(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async mapUserToEmployee(user: User): Promise<Employee | null> {
    try {
      console.log(`Mapping user ${user.user_name} to employee`);

      // Find employee with matching email
      const employee = await this.findEmployeeByEmail(user.email_id);

      if (employee) {
        console.log(`User ${user.user_name} mapped to employee: ${employee.employee_name} (ID: ${employee.employee_id})`);
      } else {
        console.log(`No employee found for user: ${user.user_name}`);
      }

      return employee;
    } catch (error) {
      console.error('Error mapping user to employee:', error);
      throw new Error(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async findUserByEmail(emailId: string): Promise<User | null> {
    try {
      console.log(`[STORAGE DEBUG] Finding user by email: "${emailId}"`);
      
      // Log all user emails to help debug
      const allUsers = await db.select({ id: schema.users.id, email: schema.users.email_id }).from(schema.users);
      console.log(`[STORAGE DEBUG] Available user emails in the database: ${JSON.stringify(allUsers.map(u => u.email))}`);
      
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email_id, emailId))
        .limit(1);

      console.log(`[STORAGE DEBUG] User lookup by email "${emailId}" result: ${user ? 'Found user with ID ' + user.id : 'No user found'}`);
      return user || null;
    } catch (error) {
      console.error('[STORAGE DEBUG] Error finding user by email:', error);
      throw new Error('Database error while finding user');
    }
  }
  async getUser(id: number): Promise<User | null> {
    try {
      console.log(`Fetching user with ID: ${id}`);

      // Validate user ID
      if (!id || isNaN(id) || id <= 0) {
        console.error(`Invalid user ID: ${id}`);
        return null;
      }

      // Query database
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, id));

      if (user) {
        console.log(`Found user: ${user.user_name} (${user.email_id})`);
      } else {
        console.log(`No user found with ID: ${id}`);
      }

      return user || null;
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      throw new Error(`Database error while fetching user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  async markUserAsVerified(userId: number): Promise<User> {
    try {
      console.log(`Marking user with ID ${userId} as verified`);

      // Validate userId
      if (!userId || isNaN(userId) || userId <= 0) {
        throw new Error(`Invalid user ID: ${userId}`);
      }

      // Check if user exists first
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      if (user.is_verified) {
        console.log(`User ${userId} is already verified`);
        return user;
      }

      // Update user verification status
      const [updatedUser] = await db
        .update(schema.users)
        .set({
          is_verified: true,
          updated_at: new Date()
        })
        .where(eq(schema.users.id, userId))
        .returning();

      if (!updatedUser) {
        throw new Error(`Failed to update verification status for user with ID ${userId}`);
      }

      console.log(`Successfully marked user ${userId} as verified`);
      return updatedUser;
    } catch (error) {
      console.error('Error marking user as verified:', error);
      throw new Error(`Failed to mark user as verified: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  async updateUserLastLogin(userId: number): Promise<User> {
    console.log('Updating last login for user:', userId);
    try {
      const [user] = await db
        .update(schema.users)
        .set({
          updated_at: new Date()
        })
        .where(eq(schema.users.id, userId))
        .returning();

      if (!user) {
        throw new Error(`User not found with ID: ${userId}`);
      }

      console.log('Last login updated successfully');
      return user;
    } catch (error) {
      console.error('Error updating user last login:', error);
      throw new Error(`Failed to update last login: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  async createUser(userData: InsertUser): Promise<User> {
    try {
      // Log the incoming data
      console.log('Creating user with data:', {
        ...userData,
        password: '[REDACTED]',
        timestamp: new Date().toISOString()
      });

      // Validate required fields
      const requiredFields = [
        'user_name',
        'user_code',
        'email_id',
        'user_type',
        'user_operation_type',
        'user_group',
        'first_name',
        'last_name',
        'full_name'
      ];

      const missingFields = requiredFields.filter(field => !userData[field as keyof InsertUser]);
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Check if mobile number already exists (if provided)
      if (userData.mobile_number) {
        const existingMobile = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.mobile_number, userData.mobile_number));

        if (existingMobile.length > 0) {
          console.error('Mobile number already exists:', userData.mobile_number);
          throw new Error(`Mobile number '${userData.mobile_number}' is already registered`);
        }
      }

      // Begin transaction
      const newUser = await db.transaction(async (tx) => {
        console.log('Starting database transaction for user creation');

        const [user] = await tx
          .insert(schema.users)
          .values({
            user_name: userData.user_name,
            user_code: userData.user_code,
            email_id: userData.email_id,
            user_type: userData.user_type,
            user_operation_type: userData.user_operation_type,
            user_group: userData.user_group,
            first_name: userData.first_name,
            last_name: userData.last_name,
            full_name: userData.full_name,
            password: userData.password,
            country_code: userData.country_code,
            mobile_number: userData.mobile_number,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          })
          .returning();

        if (!user) {
          throw new Error('Failed to create user record');
        }

        console.log('Database transaction completed successfully');
        return user;
      });

      console.log('User created successfully:', {
        id: newUser.id,
        email: newUser.email_id,
        username: newUser.user_name,
        timestamp: new Date().toISOString()
      });

      // Check if there's a matching employee record by email or mobile
      try {
        let matchingEmployee = null;

        // Find by email
        if (userData.email_id) {
          const employeesByEmail = await db
            .select()
            .from(schema.employees)
            .where(eq(schema.employees.email_id, userData.email_id));

          if (employeesByEmail.length > 0) {
            matchingEmployee = employeesByEmail[0];
          }
        }

        // If no match by email, try mobile number
        if (!matchingEmployee && userData.mobile_number) {
          const employeesByMobile = await db
            .select()
            .from(schema.employees)
            .where(eq(schema.employees.mobile_number, userData.mobile_number));

          if (employeesByMobile.length > 0) {
            matchingEmployee = employeesByMobile[0];
          }
        }

        // Update the employee record with the user_id
        if (matchingEmployee) {
          console.log(`Linking user ${newUser.id} with employee ${matchingEmployee.id}`);
          await db
            .update(schema.employees)
            .set({ user_id: newUser.id, updated_at: new Date() })
            .where(eq(schema.employees.id, matchingEmployee.id));
        }
      } catch (linkError) {
        // Just log the error but don't fail the user creation
        console.error('Error linking user with employee:', linkError);
      }

      return newUser;
    } catch (error) {
      console.error('Error in createUser:', error);
      if (error instanceof Error) {
        console.error('Detailed error:', {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
      }
      throw error;
    }
  }

  async updateUser(userId: number, userData: Partial<User>): Promise<User> {
    try {
      console.log('Updating user:', userId, 'with data:', {
        ...userData,
        password: '[REDACTED]'
      });

      // Ensure mobile number and country code are included in the update
      const updateData = {
        ...userData,
        country_code: userData.country_code || "+971",
        mobile_number: userData.mobile_number || null,
        updated_at: new Date()
      };

      const [user] = await db
        .update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, userId))
        .returning();

      if (!user) {
        throw new Error(`User not found with ID: ${userId}`);
      }

      console.log('User updated successfully:', {
        id: user.id,
        email: user.email_id,
        country_code: user.country_code,
        mobile_number: user.mobile_number
      });

      return user;
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteUser(userId: number): Promise<void> {
    try {
      console.log('Deleting user:', userId);
      await db
        .delete(schema.users)
        .where(eq(schema.users.id, userId));
      console.log('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createOtpVerification(verification: InsertOtpVerification): Promise<OtpVerification> {
    try {
      console.log(`Creating OTP verification for user ID: ${verification.user_id}`);

      // Validate input data
      if (!verification.user_id || isNaN(verification.user_id) || verification.user_id <= 0) {
        throw new Error(`Invalid user ID: ${verification.user_id}`);
      }

      if (!verification.otp || verification.otp.length < 4) {
        throw new Error('Invalid OTP code');
      }

      // Check if user exists
      const user = await this.getUser(verification.user_id);
      if (!user) {
        throw new Error(`User with ID ${verification.user_id} not found`);
      }

      // Create new OTP verification record
      const [newVerification] = await db
        .insert(schema.otpVerifications)
        .values({
          ...verification,
          is_used: false,
          created_at: new Date()
        })
        .returning();

      if (!newVerification) {
        throw new Error('Failed to create OTP verification record');
      }

      console.log(`OTP verification created successfully for user ID: ${verification.user_id}`);
      return newVerification;
    } catch (error) {
      console.error('Error creating OTP verification:', error);
      throw new Error(`Failed to create OTP verification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  async findLatestOtpVerification(userId: number): Promise<OtpVerification | null> {
    const [verification] = await db
      .select()
      .from(schema.otpVerifications)
      .where(eq(schema.otpVerifications.user_id, userId))
      .orderBy(desc(schema.otpVerifications.created_at))
      .limit(1);
    return verification || null;
  }
  async markOtpAsUsed(verificationId: number): Promise<OtpVerification> {
    const [verification] = await db
      .update(schema.otpVerifications)
      .set({
        is_used: true
      })
      .where(eq(schema.otpVerifications.id, verificationId))
      .returning();
    return verification;
  }
  async updateBookingMetadata(
    bookingId: number,
    metadata: {
      totalDistance?: number;
      estimatedCost?: number;
      co2Emissions?: number;
    }
  ): Promise<Booking> {
    try {
      console.log("Storage: Updating booking metadata:", { bookingId, metadata });

      // Validate the booking ID
      if (!bookingId || isNaN(bookingId)) {
        throw new Error(`Invalid booking ID: ${bookingId}`);
      }

      // Check if booking exists
      const [existingBooking] = await db
        .select()
        .from(schema.bookings)
        .where(eq(schema.bookings.id, bookingId));

      if (!existingBooking) {
        throw new Error(`Booking with ID ${bookingId} not found`);
      }

      // Convert camelCase to snake_case for database fields
      const dbMetadata: any = {};
      if (metadata.totalDistance !== undefined) dbMetadata.total_distance = metadata.totalDistance;
      if (metadata.estimatedCost !== undefined) dbMetadata.estimated_cost = metadata.estimatedCost;
      if (metadata.co2Emissions !== undefined) dbMetadata.co2_emissions = metadata.co2Emissions;

      const [updatedBooking] = await db
        .update(schema.bookings)
        .set({
          ...dbMetadata,
          updated_at: new Date()
        })
        .where(eq(schema.bookings.id, bookingId))
        .returning();

      if (!updatedBooking) {
        throw new Error(`Failed to update metadata for booking with ID ${bookingId}`);
      }

      console.log("Storage: Successfully updated booking metadata:", updatedBooking);
      return updatedBooking;
    } catch (error) {
      console.error("Storage: Error updating booking metadata:", error);
      throw new Error(`Failed to update booking metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  async getAllUsers(): Promise<User[]> {
    console.log('Fetching all users');
    try {
      const users = await db.select().from(schema.users);
      console.log(`Found ${users.length} users`);
      return users;
    } catch (error) {
      console.error('Error fetching all users:', error);
      throw error;
    }
  }

  async getUserByUserName(userName: string): Promise<User | null> {
    try {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.user_name, userName))
        .limit(1);

      return user || null;
    } catch (error) {
      console.error('Error finding user by username:', error);
      throw new Error('Database error while finding user');
    }
  }

  async updateUserResetToken(userId: number, resetToken: string | null, resetTokenExpiry: Date | null): Promise<User> {
    try {
      console.log('Updating reset token for user:', userId);
      const [user] = await db
        .update(schema.users)
        .set({
          reset_token: resetToken,
          reset_token_expiry: resetTokenExpiry,
          updated_at: new Date()
        })
        .where(eq(schema.users.id, userId))
        .returning();

      if (!user) {
        throw new Error(`User not found with ID: ${userId}`);
      }

      return user;
    } catch (error) {
      console.error('Error updating reset token:', error);
      throw new Error(`Failed to update reset token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async findUserByResetToken(resetToken: string): Promise<User | null> {
    try {
      console.log('Finding user by reset token');

      // Validate reset token
      if (!resetToken || typeof resetToken !== 'string' || resetToken.trim() === '') {
        console.error('Invalid reset token provided');
        return null;
      }

      // Find user with valid token (not expired)
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.reset_token, resetToken))
        .where(sql`${schema.users.reset_token_expiry} > NOW()`);

      if (!user) {
        console.log('No user found with the provided reset token or token has expired');
      } else {
        console.log('User found with valid reset token');
      }

      return user || null;
    } catch (error) {
      console.error('Error finding user by reset token:', error);
      throw new Error(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async findEmployeeByEmployeeId(employeeId: string): Promise<Employee | null> {
    try {
      console.log('Finding employee by ID:', employeeId);

      // Convert employeeId to a number if it's a string
      const empId = parseInt(employeeId);
      if (isNaN(empId)) {
        console.error('Invalid employee ID format:', employeeId);
        return null;
      }

      // Select all fields from employees table
      const [employee] = await db
        .select()
        .from(schema.employees)
        .where(eq(schema.employees.employee_id, empId));

      if (!employee) {
        console.log('No employee found with ID:', employeeId);
        return null;
      }

      console.log('Found employee:', {
        ...employee,
        mobile_number: '****' + (employee.mobile_number?.slice(-4) || '')
      });

      return employee;
    } catch (error) {
      console.error('Error finding employee:', error);
      throw new Error(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async findUserByEmployeeId(employeeId: string): Promise<User | null> {
    try {
      console.log('Checking if employee is already registered:', employeeId);

      // Convert employeeId to a number if needed
      const empId = parseInt(employeeId);
      if (isNaN(empId)) {
        console.error('Invalid employee ID format:', employeeId);
        return null;
      }

      // First find the employee record by employee_id
      const employee = await this.findEmployeeByEmployeeId(employeeId);
      if (!employee) {
        console.log('No employee found with ID:', employeeId);
        return null;
      }

      // Then find the user with matching email
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email_id, employee.email_id))
        .limit(1);

      console.log('Existing user found:', user ? 'Yes' : 'No');
      return user || null;
    } catch (error) {
      console.error('Error checking user registration:', error);
      throw new Error(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllEmployees(): Promise<Employee[]> {
    try {
      console.log('Fetching all employees');
      const employees = await db
        .select()
        .from(schema.employees)
        .orderBy(schema.employees.employee_id);

      console.log(`Found ${employees.length} employees`);
      return employees;
    } catch (error) {
      console.error('Error fetching all employees:', error);
      throw error;
    }
  }

  async createEmployee(employeeData: InsertEmployee): Promise<Employee> {
    try {
      console.log('Creating employee:', employeeData);

      // Validate that the employee ID doesn't already exist
      const existingEmployee = await this.findEmployeeByEmployeeId(employeeData.employee_id.toString());
      if (existingEmployee) {
        console.error('Employee ID already exists:', employeeData.employee_id);
        throw new Error(`Employee with ID ${employeeData.employee_id} already exists`);
      }

      // Check if email already exists
      const existingEmail = await db
        .select()
        .from(schema.employees)
        .where(eq(schema.employees.email_id, employeeData.email_id));

      if (existingEmail.length > 0) {
        console.error('Email already exists:', employeeData.email_id);
        throw new Error(`Email ${employeeData.email_id} is already in use`);
      }

      // If user_id is not provided, try to find a user with matching email or mobile number
      if (!employeeData.user_id) {
        // Try to match by email first
        if (employeeData.email_id) {
          const user = await this.findUserByEmail(employeeData.email_id);
          if (user) {
            console.log('Found matching user by email:', user.id);
            employeeData.user_id = user.id;
          }
        }

        // If no match by email and mobile_number is provided, try matching by mobile number
        if (!employeeData.user_id && employeeData.mobile_number) {
          const usersByMobile = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.mobile_number, employeeData.mobile_number));

          if (usersByMobile.length > 0) {
            console.log('Found matching user by mobile:', usersByMobile[0].id);
            employeeData.user_id = usersByMobile[0].id;
          }
        }
      }

      // Insert the new employee
      const [newEmployee] = await db
        .insert(schema.employees)
        .values({
          ...employeeData,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning();

      console.log('Employee created successfully:', newEmployee);
      return newEmployee;
    } catch (error) {
      console.error('Error creating employee:', error);
      throw error;
    }
  }

  async getEmployeeById(id: number): Promise<Employee | null> {
    try {
      console.log(`Fetching employee with ID: ${id}`);
      const [employee] = await db
        .select()
        .from(schema.employees)
        .where(eq(schema.employees.id, id));

      return employee || null;
    } catch (error) {
      console.error(`Error fetching employee by ID ${id}:`, error);
      throw error;
    }
  }

  async updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee> {
    try {
      console.log(`Updating employee with ID ${id}:`, data);

      // Set the updated_at timestamp
      const updateData = {
        ...data,
        updated_at: new Date()
      };

      const [updatedEmployee] = await db
        .update(schema.employees)
        .set(updateData)
        .where(eq(schema.employees.id, id))
        .returning();

      if (!updatedEmployee) {
        throw new Error(`Employee with ID ${id} not found`);
      }

      console.log("Successfully updated employee:", updatedEmployee);
      return updatedEmployee;
    } catch (error) {
      console.error(`Error updating employee with ID ${id}:`, error);
      throw error;
    }
  }

  async deleteEmployee(id: number): Promise<void> {
    try {
      console.log(`Deleting employee with ID: ${id}`);

      // Perform the deletion
      const result = await db
        .delete(schema.employees)
        .where(eq(schema.employees.id, id))
        .returning({ deletedId: schema.employees.id });

      // Check if anything was deleted
      if (!result.length) {
        throw new Error(`Employee with ID ${id} not found`);
      }

      console.log(`Successfully deleted employee with ID: ${id}`);
    } catch (error) {
      console.error(`Error deleting employee with ID ${id}:`, error);
      throw error;
    }
  }
  async getOtpVerification(userId: number): Promise<OtpVerification | null> {
    try {
      console.log(`Fetching latest OTP verification for user ID: ${userId}`);

      // Validate user ID
      if (!userId || isNaN(userId) || userId <= 0) {
        console.error(`Invalid user ID: ${userId}`);
        return null;
      }

      // Get the latest verification record
      const [verification] = await db
        .select()
        .from(schema.otpVerifications)
        .where(eq(schema.otpVerifications.user_id, userId))
        .orderBy(desc(schema.otpVerifications.created_at))
        .limit(1);

      if (verification) {
        console.log(`Found OTP verification record for user ID ${userId}`);
      } else {
        console.log(`No OTP verification records found for user ID ${userId}`);
      }

      return verification || null;
    } catch (error) {
      console.error(`Error fetching OTP verification for user ID ${userId}:`, error);
      throw new Error(`Database error while fetching OTP verification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteOtpVerification(userId: number): Promise<void> {
    try {
      console.log(`Deleting OTP verification records for user ID: ${userId}`);

      // Validate user ID
      if (!userId || isNaN(userId) || userId <= 0) {
        console.error(`Invalid user ID: ${userId}`);
        throw new Error(`Invalid user ID: ${userId}`);
      }

      // Delete all OTP verification records for the user
      const result = await db
        .delete(schema.otpVerifications)
        .where(eq(schema.otpVerifications.user_id, userId))
        .returning({ deletedId: schema.otpVerifications.id });

      console.log(`Deleted ${result.length} OTP verification records for user ID ${userId}`);
    } catch (error) {
      console.error(`Error deleting OTP verification records for user ID ${userId}:`, error);
      throw new Error(`Failed to delete OTP verification records: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async activateUser(userId: number): Promise<User> {
    try {
      console.log(`Activating user with ID ${userId}`);

      // Validate user ID
      if (!userId || isNaN(userId) || userId <= 0) {
        console.error(`Invalid user ID: ${userId}`);
        throw new Error(`Invalid user ID: ${userId}`);
      }

      // Check if user exists
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      // Check if user is already active
      if (user.is_active) {
        console.log(`User with ID ${userId} is already active`);
        return user;
      }

      // Activate the user
      const [updatedUser] = await db
        .update(schema.users)
        .set({
          is_active: true,
          updated_at: new Date()
        })
        .where(eq(schema.users.id, userId))
        .returning();

      if (!updatedUser) {
        throw new Error(`Failed to activate user with ID ${userId}`);
      }

      console.log(`Successfully activated user with ID ${userId}`);
      return updatedUser;
    } catch (error) {
      console.error(`Error activating user with ID ${userId}:`, error);
      throw new Error(`Failed to activate user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  async validateUserPassword(user: User, password: string): Promise<boolean> {
    try {
      console.log('Starting password validation for user:', user.email_id);

      if (!user.password) {
        console.log('No password hash stored for user');
        return false;
      }

      const isValid = await bcrypt.compare(password, user.password);
      console.log('Password validation result:', isValid);

      return isValid;
    } catch (error) {
      console.error('Error during password validation:', error);
      return false;
    }
  }
  async updateUserPassword(userId: number, hashedPassword: string): Promise<User> {
    try {
      console.log('Updating password for user:', userId);
      const [user] = await db
        .update(schema.users)
        .set({
          password: hashedPassword,
          reset_token: null,
          reset_token_expiry: null,
          updated_at: new Date()
        })
        .where(eq(schema.users.id, userId))
        .returning();

      if (!user) {
        throw new Error(`User not found with ID: ${userId}`);
      }

      return user;
    } catch (error) {
      console.error('Error updating user password:', error);
      throw new Error(`Failed to update password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Approval Workflow methods
  async createWorkflow(workflow: InsertApprovalWorkflow): Promise<ApprovalWorkflow> {
    try {
      console.log('Creating new approval workflow:', workflow);

      // Check if workflow already exists for the same region/department/unit combination
      const existingWorkflow = await db
        .select()
        .from(schema.approvalWorkflows)
        .where(
          and(
            eq(schema.approvalWorkflows.region, workflow.region),
            eq(schema.approvalWorkflows.department, workflow.department),
            eq(schema.approvalWorkflows.unit, workflow.unit)
          )
        );

      if (existingWorkflow.length > 0) {
        console.error('Workflow for this region/department/unit combination already exists');
        throw new Error('A workflow for this region, department, and unit combination already exists');
      }

      // Set timestamps
      const workflowWithTimestamps = {
        ...workflow,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Insert the new workflow
      const [newWorkflow] = await db
        .insert(schema.approvalWorkflows)
        .values(workflowWithTimestamps)
        .returning();

      console.log('Workflow created successfully:', newWorkflow);
      return newWorkflow;
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw error;
    }
  }

  async getWorkflows(): Promise<ApprovalWorkflow[]> {
    try {
      console.log('Fetching all approval workflows');

      // Get all workflows
      const workflows = await db
        .select()
        .from(schema.approvalWorkflows);

      console.log(`Found ${workflows.length} workflows`);
      return workflows;
    } catch (error) {
      console.error('Error fetching approval workflows:', error);
      throw error;
    }
  }

  async updateWorkflow(id: number, data: Partial<InsertApprovalWorkflow>): Promise<ApprovalWorkflow> {
    try {
      console.log(`Updating workflow with ID ${id}:`, data);

      // Set the updated_at timestamp
      const updateData = {
        ...data,
        updated_at: new Date()
      };

      // Update the workflow
      const [updatedWorkflow] = await db
        .update(schema.approvalWorkflows)
        .set(updateData)
        .where(eq(schema.approvalWorkflows.id, id))
        .returning();

      if (!updatedWorkflow) {
        throw new Error(`Workflow with ID ${id} not found`);
      }

      console.log('Workflow updated successfully:', updatedWorkflow);
      return updatedWorkflow;
    } catch (error) {
      console.error(`Error updating workflow with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a parent booking to represent a merged trip
   * Uses the source booking as a template and adds merged trip specific fields
   */
  async createParentBooking(sourceBooking: Booking): Promise<Booking> {
    try {
      console.log(`[STORAGE] Creating parent booking for merged trip based on booking #${sourceBooking.id}`);
      
      // Generate a unique trip ID with date
      const currentDate = new Date();
      const dateStr = currentDate.toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const tripId = `TRIP_${dateStr}_${random}`;
      
      // Create a copy of the source booking with merged trip flags set
      const parentBookingData = {
        ...sourceBooking,
        id: undefined, // Remove ID so a new one is generated
        status: 'merged_parent',
        is_merged: true,
        has_merged_trips: true,
        trip_id: tripId,
        merged_booking_ids: [sourceBooking.id.toString()],
        created_at: currentDate,
        updated_at: currentDate
      };
      
      // Using raw SQL to avoid issues with column mismatches
      const query = sql`
        INSERT INTO bookings (
          status, employee_id, booking_type, purpose, priority,
          pickup_location, dropoff_location, pickup_time, dropoff_time,
          special_instructions, is_merged, has_merged_trips, trip_id,
          merged_booking_ids, created_at, updated_at
        )
        VALUES (
          'merged_parent', ${sourceBooking.employee_id}, ${sourceBooking.booking_type},
          ${sourceBooking.purpose}, ${sourceBooking.priority},
          ${JSON.stringify(sourceBooking.pickup_location)}, ${JSON.stringify(sourceBooking.dropoff_location)},
          ${sourceBooking.pickup_time}, ${sourceBooking.dropoff_time},
          ${sourceBooking.special_instructions}, true, true, ${tripId},
          ${JSON.stringify([sourceBooking.id.toString()])}, NOW(), NOW()
        )
        RETURNING *
      `;
      
      const result = await db.execute(query);
      
      if (result.rows.length === 0) {
        throw new Error("Failed to create parent booking for merged trip");
      }
      
      const parentBooking = result.rows[0] as Booking;
      console.log(`[STORAGE] Successfully created parent booking #${parentBooking.id} with trip ID ${tripId}`);
      
      return parentBooking;
    } catch (error) {
      console.error("[STORAGE] Error creating parent booking for merged trip:", error);
      throw error;
    }
  }
  
  /**
   * Update a booking to reference its parent booking (part of a merged trip)
   */
  async updateBookingParent(bookingId: number, parentBookingId: number): Promise<Booking> {
    try {
      console.log(`[STORAGE] Updating booking #${bookingId} to reference parent booking #${parentBookingId}`);
      
      // Get the parent booking to access its trip_id
      const parentQuery = sql`SELECT * FROM bookings WHERE id = ${parentBookingId}`;
      const parentResult = await db.execute(parentQuery);
      
      if (parentResult.rows.length === 0) {
        throw new Error(`Parent booking #${parentBookingId} not found`);
      }
      
      const parentBooking = parentResult.rows[0] as Booking;
      const tripId = parentBooking.trip_id;
      
      if (!tripId) {
        throw new Error(`Parent booking #${parentBookingId} does not have a trip_id`);
      }
      
      // Update the booking to reference the parent and mark as merged
      const updateQuery = sql`
        UPDATE bookings
        SET 
          is_merged = true,
          merged_with_booking_id = ${parentBookingId},
          trip_id = ${tripId},
          status = 'merged_child',
          updated_at = NOW()
        WHERE id = ${bookingId}
        RETURNING *
      `;
      
      const result = await db.execute(updateQuery);
      
      if (result.rows.length === 0) {
        throw new Error(`Booking #${bookingId} not found`);
      }
      
      const updatedBooking = result.rows[0] as Booking;
      console.log(`[STORAGE] Successfully updated booking #${bookingId} to be part of trip ${tripId}`);
      
      // Update the parent booking's merged_booking_ids array to include this booking
      const updateParentQuery = sql`
        UPDATE bookings
        SET
          merged_booking_ids = array_append(merged_booking_ids, ${bookingId.toString()}),
          updated_at = NOW()
        WHERE id = ${parentBookingId}
      `;
      
      await db.execute(updateParentQuery);
      
      return updatedBooking;
    } catch (error) {
      console.error(`[STORAGE] Error updating booking #${bookingId} parent reference:`, error);
      throw error;
    }
  }

  async initializeDefaultUser(): Promise<void> {
    try {
      console.log("Checking for default users existence...");
      
      // First, ensure the admin@tripxl.com user exists
      const defaultUser = await this.findUserByEmail("admin@tripxl.com");
      if (!defaultUser) {
        console.log("Creating default admin user with admin@tripxl.com...");
        try {
          const hashedPassword = await bcrypt.hash("Admin@123", 10);

          const userData = {
            email_id: "admin@tripxl.com",
            password: hashedPassword,
            user_name: "admin",
            user_code: "ADM001",
            user_type: "ADMIN",
            user_operation_type: "ADMIN",
            user_group: "ADMIN",
            first_name: "System",
            last_name: "Admin",
            full_name: "System Admin",
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          };

          await this.createUser(userData);
          console.log("Default admin user created successfully");
        } catch (error: any) {
          if (error.code === '23505') { // Unique constraint violation
            console.log("Default admin user already exists, skipping creation");
          } else {
            console.error("Error creating default admin:", error);
          }
        }
      } else {
        console.log("Default admin user already exists");
      }
      
      // Now ensure the athomas@exlsolutions.ae user exists with proper login credentials
      console.log("Checking for athomas@exlsolutions.ae user...");
      const thomasUser = await this.findUserByEmail("athomas@exlsolutions.ae");
      if (thomasUser) {
        // Update the password to ensure it's correct
        console.log("Updating athomas@exlsolutions.ae user password...");
        const hashedPassword = await bcrypt.hash("Pass@123", 10);
        
        // Update user with new password
        const updateQuery = sql`
          UPDATE users
          SET password = ${hashedPassword},
              reset_token = NULL,
              reset_token_expiry = NULL,
              updated_at = NOW()
          WHERE email_id = ${'athomas@exlsolutions.ae'}
          RETURNING *
        `;
        
        const result = await db.execute(updateQuery);
        console.log("Updated athomas@exlsolutions.ae user password to Pass@123");
      } else {
        console.log("athomas@exlsolutions.ae user not found, creating...");
        try {
          const hashedPassword = await bcrypt.hash("Pass@123", 10);

          const userData = {
            email_id: "athomas@exlsolutions.ae",
            password: hashedPassword,
            user_name: "athomas",
            user_code: "ADM002",
            user_type: "ADMIN",
            user_operation_type: "ADMIN",
            user_group: "ADMIN",
            first_name: "Alex",
            last_name: "Thomas",
            full_name: "Alex Thomas",
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          };

          await this.createUser(userData);
          console.log("Created athomas@exlsolutions.ae user with password Pass@123");
        } catch (error: any) {
          if (error.code === '23505') { // Unique constraint violation
            console.log("User athomas@exlsolutions.ae already exists, updating password...");
            const hashedPassword = await bcrypt.hash("Pass@123", 10);
            await db.update(schema.users)
              .set({ password: hashedPassword })
              .where(eq(schema.users.email_id, "athomas@exlsolutions.ae"))
              .execute();
            console.log("Updated athomas@exlsolutions.ae password to Pass@123");
          } else {
            console.error("Error creating athomas user:", error);
          }
        }
      }
      
    } catch (error) {
      console.error("Error initializing default users:", error);
      // Don't throw the error to prevent app crash
      // Just log it and continue
    }
  }
}

export const storage = new DatabaseStorage();