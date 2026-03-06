import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middlewares/auth.middleware";

const prisma = new PrismaClient();

export const createService = async (req: AuthRequest, res: Response) => {
  try {
    if (req.role !== "BARBER") {
      return res.status(403).json({ message: "Only barbers can create services" });
    }

    const { shopId } = req.params;
    const { name, description, price, duration_min } = req.body;

    // Check if shop belongs to this barber
    const shop = await prisma.barberShop.findUnique({
      where: { id: shopId }
    });

    if (!shop || shop.owner_id !== req.userId) {
      return res.status(404).json({ message: "Shop not found or unauthorized" });
    }

    if (!name || !price || !duration_min) {
      return res.status(400).json({ message: "Name, price, and duration_min are required" });
    }

    const service = await prisma.service.create({
      data: {
        shop_id: shopId,
        name,
        description,
        price,
        duration_min
      }
    });

    res.status(201).json(service);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getShopServices = async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;

    const services = await prisma.service.findMany({
      where: {
        shop_id: shopId
      }
    });

    res.json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateService = async (req: AuthRequest, res: Response) => {
  try {
    if (req.role !== "BARBER") {
      return res.status(403).json({ message: "Only barbers can update services" });
    }

    const { id } = req.params;
    const { name, description, price, duration_min } = req.body;

    // Get the service
    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        shop: true
      }
    });

    if (!service || service.shop.owner_id !== req.userId) {
      return res.status(404).json({ message: "Service not found or unauthorized" });
    }

    const updatedService = await prisma.service.update({
      where: { id },
      data: {
        name,
        description,
        price,
        duration_min
      }
    });

    res.json(updatedService);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
