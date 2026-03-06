import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middlewares/auth.middleware";

const prisma = new PrismaClient();

export const createShop = async (req: AuthRequest, res: Response) => {
  try {
    if (req.role !== "BARBER") {
      return res.status(403).json({ message: "Only barbers can create shops" });
    }

    const { name, address, latitude, longitude, chairs_count } = req.body;

    if (!name || !address || !latitude || !longitude || !chairs_count) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const shop = await prisma.barberShop.create({
      data: {
        owner_id: req.userId!,
        name,
        address,
        latitude,
        longitude,
        chairs_count
      }
    });

    res.status(201).json(shop);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMyShops = async (req: AuthRequest, res: Response) => {
  try {
    if (req.role !== "BARBER") {
      return res.status(403).json({ message: "Only barbers can view their shops" });
    }

    const shops = await prisma.barberShop.findMany({
      where: {
        owner_id: req.userId!
      },
      include: {
        services: true,
        appointments: true
      }
    });

    res.json(shops);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateShop = async (req: AuthRequest, res: Response) => {
  try {
    if (req.role !== "BARBER") {
      return res.status(403).json({ message: "Only barbers can update shops" });
    }

    const { id } = req.params;
    const { name, address, latitude, longitude, chairs_count } = req.body;
    const shop = await prisma.barberShop.findUnique({
      where: { id }
    });

    if (!shop || shop.owner_id !== req.userId) {
      return res.status(404).json({ message: "Shop not found or unauthorized" });
    }

    const updatedShop = await prisma.barberShop.update({
      where: { id },
      data: {
        name,
        address,
        latitude,
        longitude,
        chairs_count
      }
    });

    res.json(updatedShop);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


export const getShopQueue = async (req: AuthRequest, res: Response) => {
  try {
    const { shopId } = req.params;

    // Verify ownership
    const shop = await prisma.barberShop.findUnique({
      where: { id: shopId }
    });

    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    if (shop.owner_id !== req.userId) {
      return res.status(403).json({ message: "Not authorized to view this shop" });
    }

    // Fetch all future appointments
    const appointments = await prisma.appointment.findMany({
      where: {
        shop_id: shopId,
        scheduled_time: {
          gte: new Date()
        },
        status: {
          in: ["PENDING", "ACCEPTED"]
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            contact_number: true
          }
        },
        service: {
          select: {
            id: true,
            name: true,
            duration_min: true
          }
        }
      },
      orderBy: {
        scheduled_time: "asc"
      }
    });

    // Add estimated end time
    const formattedAppointments = appointments.map((appt) => {
      const estEnd = new Date(appt.scheduled_time);
      estEnd.setMinutes(estEnd.getMinutes() + appt.service.duration_min);

      return {
        id: appt.id,
        chair_number: appt.chair_number,
        customer: appt.user,
        service: appt.service,
        scheduled_time: appt.scheduled_time,
        estimated_end_time: estEnd,
        status: appt.status
      };
    });

    res.json(formattedAppointments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
