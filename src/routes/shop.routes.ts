import { Router } from "express";
import { createShop, getMyShops, updateShop,getShopQueue } from "../controllers/shop.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", authenticate, createShop);
router.get("/my", authenticate, getMyShops);
router.put("/:id", authenticate, updateShop);
router.get("/:shopId/queue", authenticate, getShopQueue);

export default router;
