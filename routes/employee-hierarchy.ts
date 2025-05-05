import { Router } from 'express';
import { EmployeeHierarchyService } from '../services/employee-hierarchy';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { employees } from '@shared/schema';

const router = Router();

// Get employee's complete hierarchy information
router.get('/api/employees/:id/hierarchy', async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    console.log("Fetching hierarchy for employee ID:", employeeId);

    // Get employee's hierarchy path
    const hierarchyPath = await EmployeeHierarchyService.getHierarchyPath(employeeId);
    if (!hierarchyPath) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Get employee's subordinates
    const subordinates = await EmployeeHierarchyService.getSubordinateHierarchy(employeeId);

    // Get employee's supervisor chain
    const supervisorChain = [];
    let currentEmployee = await db.query.employees.findFirst({
      where: eq(employees.id, employeeId)
    });

    while (currentEmployee?.supervisorId) {
      const supervisor = await db.query.employees.findFirst({
        where: eq(employees.id, currentEmployee.supervisorId)
      });
      if (supervisor) {
        supervisorChain.push({
          id: supervisor.id,
          name: supervisor.employeeName,
          designation: supervisor.designation,
          hierarchyLevel: supervisor.hierarchyLevel
        });
        currentEmployee = supervisor;
      } else {
        break;
      }
    }

    res.json({
      employee: hierarchyPath,
      supervisorChain: supervisorChain.reverse(),
      subordinates
    });

  } catch (error: any) {
    console.error("Error fetching employee hierarchy:", error);
    res.status(500).json({ error: "Failed to fetch employee hierarchy" });
  }
});

export const employeeHierarchyRouter = router;
