import { Router } from "express";
import { ACHIEVEMENT_CATEGORIES } from "@shared/schema/achievements";

const router = Router();

// Mock achievements data - In production, this would come from a database
const achievements = [
  {
    id: 1,
    name: "Eco Warrior",
    description: "Maintain fleet CO2 emissions below target for 30 days",
    icon: "leaf",
    criteria: "CO2_EMISSIONS_TARGET",
    progress: 0.75,
    isCompleted: false,
    unlockedAt: null,
    badgeColor: ACHIEVEMENT_CATEGORIES.ECO_FRIENDLY,
  },
  {
    id: 2,
    name: "Efficiency Master",
    description: "Achieve 95% fuel efficiency across the fleet",
    icon: "gauge",
    criteria: "FUEL_EFFICIENCY",
    progress: 1,
    isCompleted: true,
    unlockedAt: "2024-03-20T10:30:00Z",
    badgeColor: ACHIEVEMENT_CATEGORIES.FUEL_EFFICIENCY,
  },
  {
    id: 3,
    name: "Safety Champion",
    description: "Zero incidents reported for 60 days",
    icon: "shield",
    criteria: "SAFETY_RECORD",
    progress: 0.9,
    isCompleted: false,
    unlockedAt: null,
    badgeColor: ACHIEVEMENT_CATEGORIES.SAFETY,
  },
  {
    id: 4,
    name: "Fleet Expert",
    description: "Successfully manage 50+ vehicles",
    icon: "star",
    criteria: "FLEET_SIZE",
    progress: 1,
    isCompleted: true,
    unlockedAt: "2024-03-15T14:20:00Z",
    badgeColor: ACHIEVEMENT_CATEGORIES.MANAGEMENT,
  },
];

// Get all achievements
router.get("/api/achievements", (_req, res) => {
  res.json(achievements);
});

// Get achievement by ID
router.get("/api/achievements/:id", (req, res) => {
  const achievement = achievements.find(a => a.id === parseInt(req.params.id));
  if (!achievement) {
    return res.status(404).json({ error: "Achievement not found" });
  }
  res.json(achievement);
});

export const achievementsRouter = router;
