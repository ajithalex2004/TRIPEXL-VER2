import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { ApprovalLevel, WorkflowLevels, insertApprovalWorkflowSchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { eq, and } from "drizzle-orm";

export const approvalWorkflowsRouter = Router();

// Get all approval workflows
approvalWorkflowsRouter.get("/", async (req: Request, res: Response) => {
  try {
    console.log("Getting all approval workflows");
    const workflows = await storage.getWorkflows();
    res.json(workflows);
  } catch (error) {
    console.error("Error fetching approval workflows:", error);
    res.status(500).json({ message: "Failed to fetch approval workflows", error: (error as Error).message });
  }
});

// Create new approval workflow
approvalWorkflowsRouter.post("/", async (req: Request, res: Response) => {
  try {
    console.log("Creating new approval workflow", req.body);
    
    // Parse and validate the request data
    let workflowData;
    try {
      workflowData = insertApprovalWorkflowSchema.parse(req.body);
    } catch (validationError) {
      console.error("Validation error:", validationError);
      return res.status(400).json({ 
        message: "Invalid workflow data", 
        error: (validationError as Error).message 
      });
    }
    
    // Create the workflow
    const workflow = await storage.createWorkflow(workflowData);
    res.status(201).json(workflow);
  } catch (error) {
    console.error("Error creating approval workflow:", error);
    
    // Check if it's a duplicate error
    if ((error as Error).message.includes("already exists")) {
      return res.status(409).json({ 
        message: "Workflow for this region/department/unit combination already exists",
        error: (error as Error).message
      });
    }
    
    res.status(500).json({ 
      message: "Failed to create approval workflow", 
      error: (error as Error).message 
    });
  }
});

// Update an existing approval workflow
approvalWorkflowsRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const workflowId = parseInt(req.params.id);
    
    if (isNaN(workflowId)) {
      return res.status(400).json({ message: "Invalid workflow ID" });
    }
    
    console.log(`Updating approval workflow ${workflowId}`, req.body);
    
    // Partial validation of update data
    let updateData;
    try {
      // We use partial here since it's an update
      updateData = insertApprovalWorkflowSchema.partial().parse(req.body);
    } catch (validationError) {
      console.error("Validation error:", validationError);
      return res.status(400).json({ 
        message: "Invalid workflow data", 
        error: (validationError as Error).message 
      });
    }
    
    // Update the workflow
    const updatedWorkflow = await storage.updateWorkflow(workflowId, updateData);
    res.json(updatedWorkflow);
  } catch (error) {
    console.error(`Error updating approval workflow:`, error);
    res.status(500).json({ 
      message: "Failed to update approval workflow", 
      error: (error as Error).message 
    });
  }
});

// Get approvers by role, region, department
approvalWorkflowsRouter.get("/approvers", async (req: Request, res: Response) => {
  try {
    const { region, department, unit, level } = req.query;
    console.log(`Getting approvers for region=${region}, department=${department}, unit=${unit}, level=${level}`);
    
    // Validate query parameters
    if (!region || !department || !unit) {
      return res.status(400).json({ 
        message: "Missing required parameters: region, department, unit" 
      });
    }
    
    // Get all employees
    const employees = await storage.getAllEmployees();
    
    // Filter by region, department and employee role (based on level)
    let approvers = employees.filter(employee => {
      // Basic filtering by region, department, unit
      const regionMatch = employee.region === region;
      const departmentMatch = employee.department === department;
      const unitMatch = employee.unit === unit;
      
      // Check if employee can be an approver (has approving role)
      const hasApprovingRole = employee.employee_role === "Approving Authority";
      
      // Filter by hierarchy level if specified
      let levelMatch = true;
      if (level) {
        if (level === "1") {
          levelMatch = employee.hierarchy_level === "Level 1";
        } else if (level === "2") {
          levelMatch = employee.hierarchy_level === "Level 2";
        }
      }
      
      return regionMatch && departmentMatch && unitMatch && hasApprovingRole && levelMatch;
    });
    
    // Return filtered list of approvers
    res.json(approvers);
  } catch (error) {
    console.error("Error fetching approvers:", error);
    res.status(500).json({ 
      message: "Failed to fetch approvers", 
      error: (error as Error).message 
    });
  }
});