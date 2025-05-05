import { eq } from 'drizzle-orm';
import { db } from '../db';
import { employees, EmployeeDesignation, HierarchyLevel } from '@shared/schema';

export class EmployeeHierarchyService {
  // Get the hierarchy level based on designation
  static getHierarchyLevel(designation: string): string {
    switch (designation) {
      case EmployeeDesignation.REGIONAL_DIRECTOR:
      case EmployeeDesignation.REGIONAL_MANAGER:
        return HierarchyLevel.REGIONAL;
      
      case EmployeeDesignation.DEPARTMENT_HEAD:
      case EmployeeDesignation.DEPARTMENT_MANAGER:
        return HierarchyLevel.DEPARTMENT;
      
      case EmployeeDesignation.UNIT_HEAD:
      case EmployeeDesignation.UNIT_SUPERVISOR:
        return HierarchyLevel.UNIT;
      
      default:
        return HierarchyLevel.STAFF;
    }
  }

  // Validate if supervisor assignment is valid based on hierarchy
  static async validateSupervisorAssignment(
    employeeDesignation: string,
    supervisorId: number
  ): Promise<{ isValid: boolean; message: string }> {
    const supervisor = await db.query.employees.findFirst({
      where: eq(employees.id, supervisorId)
    });

    if (!supervisor) {
      return { isValid: false, message: "Supervisor not found" };
    }

    const employeeLevel = this.getHierarchyLevel(employeeDesignation);
    const supervisorLevel = this.getHierarchyLevel(supervisor.designation);

    // Validate based on hierarchy levels
    const hierarchyLevels = [
      HierarchyLevel.REGIONAL,
      HierarchyLevel.DEPARTMENT,
      HierarchyLevel.UNIT,
      HierarchyLevel.STAFF
    ];

    const employeeLevelIndex = hierarchyLevels.indexOf(employeeLevel);
    const supervisorLevelIndex = hierarchyLevels.indexOf(supervisorLevel);

    if (supervisorLevelIndex >= employeeLevelIndex) {
      return {
        isValid: false,
        message: "Supervisor must be at a higher level in the hierarchy"
      };
    }

    return { isValid: true, message: "Valid supervisor assignment" };
  }

  // Get complete hierarchy path for an employee
  static async getHierarchyPath(employeeId: number): Promise<any> {
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, employeeId)
    });

    if (!employee) {
      return null;
    }

    return {
      region: employee.region,
      department: employee.department,
      unit: employee.unit,
      designation: employee.designation,
      hierarchyLevel: employee.hierarchyLevel
    };
  }

  // Get all employees under a supervisor (direct and indirect reports)
  static async getSubordinateHierarchy(supervisorId: number): Promise<any[]> {
    const directReports = await db.query.employees.findMany({
      where: eq(employees.supervisorId, supervisorId)
    });

    const hierarchy = [];
    for (const report of directReports) {
      const subordinates = await this.getSubordinateHierarchy(report.id);
      hierarchy.push({
        employee: report,
        subordinates
      });
    }

    return hierarchy;
  }
}
