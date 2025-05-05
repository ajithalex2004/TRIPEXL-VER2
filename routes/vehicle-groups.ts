import { Router } from "express";
import { vehicleGroups, insertVehicleGroupSchema, type VehicleGroup } from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import multer from "multer";
import XLSX from "xlsx";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get all vehicle groups
router.get("/api/vehicle-groups", async (_req, res) => {
  try {
    const groups = await db.select().from(vehicleGroups);
    console.log("Retrieved vehicle groups:", groups);
    res.json(groups);
  } catch (error: any) {
    console.error("Error fetching vehicle groups:", error);
    res.status(500).json({ error: "Failed to fetch vehicle groups" });
  }
});

// Create new vehicle group
router.post("/api/vehicle-groups", async (req, res) => {
  try {
    console.log("Received vehicle group creation request:", req.body);

    // Validate the request data
    const validatedData = insertVehicleGroupSchema.parse(req.body);
    console.log("Validated data:", validatedData);

    // Insert into database
    const [newGroup] = await db.insert(vehicleGroups).values({
      group_code: validatedData.group_code,
      region: validatedData.region,
      name: validatedData.name,
      type: validatedData.type,
      department: validatedData.department,
      image_url: validatedData.image_url || null,
      description: validatedData.description || null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }).returning();

    console.log("Created new vehicle group:", newGroup);
    res.status(201).json(newGroup);
  } catch (error: any) {
    console.error("Error creating vehicle group:", error);

    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ 
        error: "Vehicle group with this code or name already exists",
        details: error.detail
      });
    }

    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: "Validation error", 
        errors: error.errors 
      });
    }

    res.status(500).json({ error: "Failed to create vehicle group" });
  }
});

// Update vehicle group
router.patch("/api/vehicle-groups/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    console.log("Updating vehicle group:", id, "with data:", req.body);
    const validatedData = insertVehicleGroupSchema.partial().parse(req.body);

    const [updatedGroup] = await db
      .update(vehicleGroups)
      .set({
        ...validatedData,
        updated_at: new Date()
      })
      .where(eq(vehicleGroups.id, id))
      .returning();

    if (!updatedGroup) {
      return res.status(404).json({ error: "Vehicle group not found" });
    }

    console.log("Updated vehicle group:", updatedGroup);
    res.json(updatedGroup);
  } catch (error: any) {
    console.error("Error updating vehicle group:", error);

    if (error.code === '23505') {
      return res.status(400).json({ 
        error: "Vehicle group with this code or name already exists",
        details: error.detail
      });
    }

    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: "Validation error", 
        errors: error.errors 
      });
    }

    res.status(500).json({ error: "Failed to update vehicle group" });
  }
});

// Delete vehicle group
router.delete("/api/vehicle-groups/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    console.log("Deleting vehicle group:", id);
    const [deletedGroup] = await db
      .delete(vehicleGroups)
      .where(eq(vehicleGroups.id, id))
      .returning();

    if (!deletedGroup) {
      return res.status(404).json({ error: "Vehicle group not found" });
    }

    console.log("Deleted vehicle group:", deletedGroup);
    res.json(deletedGroup);
  } catch (error: any) {
    console.error("Error deleting vehicle group:", error);
    res.status(500).json({ error: "Failed to delete vehicle group" });
  }
});

// Download template
router.get("/api/vehicle-groups/template", (_req, res) => {
  try {
    const template = {
      group_code: "",
      name: "",
      region: "",
      type: "",
      department: "",
      image_url: "",
      description: ""
    };

    const ws = XLSX.utils.json_to_sheet([template]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=vehicle-groups-template.xlsx");
    res.send(buf);
  } catch (error: any) {
    console.error("Error generating template:", error);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

// Export vehicle groups
router.get("/api/vehicle-groups/export", async (_req, res) => {
  try {
    const groups = await db.select().from(vehicleGroups);

    const ws = XLSX.utils.json_to_sheet(groups);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vehicle Groups");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=vehicle-groups.xlsx");
    res.send(buf);
  } catch (error: any) {
    console.error("Error exporting vehicle groups:", error);
    res.status(500).json({ error: "Failed to export vehicle groups" });
  }
});

// Import vehicle groups
router.post("/api/vehicle-groups/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    const results = await Promise.all(
      data.map(async (row: any) => {
        try {
          const validatedData = insertVehicleGroupSchema.parse(row);
          const [group] = await db.insert(vehicleGroups).values({
            ...validatedData,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          }).returning();
          return { success: true, data: group };
        } catch (error: any) {
          return { 
            success: false, 
            error: error.name === 'ZodError' ? 'Validation error' : error.message,
            data: row 
          };
        }
      })
    );

    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      return res.status(400).json({
        error: "Some records failed to import",
        failures
      });
    }

    res.status(201).json({
      message: "All records imported successfully",
      count: results.length
    });
  } catch (error: any) {
    console.error("Error importing vehicle groups:", error);
    res.status(500).json({ error: "Failed to import vehicle groups" });
  }
});

// Get vehicle group by ID
router.get("/api/vehicle-groups/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const [group] = await db
      .select()
      .from(vehicleGroups)
      .where(eq(vehicleGroups.id, id));

    if (!group) {
      return res.status(404).json({ error: "Vehicle group not found" });
    }
    res.json(group);
  } catch (error: any) {
    console.error("Error fetching vehicle group:", error);
    res.status(500).json({ error: "Failed to fetch vehicle group" });
  }
});

export default router;