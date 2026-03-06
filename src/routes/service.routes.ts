import { Router } from "express";
import { createService, getShopServices, updateService } from "../controllers/service.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.post("/:shopId/services", authenticate, createService);
router.get("/:shopId/services", getShopServices);
router.put("/service/:id", authenticate, updateService);

export default router;
