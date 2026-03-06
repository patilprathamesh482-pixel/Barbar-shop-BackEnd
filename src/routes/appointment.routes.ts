import { Router } from "express";
import {
  createAppointment,
  getMyAppointments,
  updateAppointmentStatus
} from "../controllers/appointment.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", authenticate, createAppointment);
router.get("/my", authenticate, getMyAppointments);
router.put("/:id/status", authenticate, updateAppointmentStatus);

export default router;
