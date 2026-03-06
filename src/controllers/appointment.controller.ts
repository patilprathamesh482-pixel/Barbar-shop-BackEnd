import { Request, Response } from "express";
import { PrismaClient, AppointmentStatus } from "@prisma/client";
import { AuthRequest } from "../middlewares/auth.middleware";
import { io } from "../index";

const prisma = new PrismaClient();

export const createAppointment = async (req: AuthRequest, res: Response) => {
  try {
    if (req.role !== "CUSTOMER") {
      return res
        .status(403)
        .json({ message: "Only customers can book appointments" });
    }

    const { shop_id, service_id, scheduled_time } = req.body;

    if (!shop_id || !service_id || !scheduled_time) {
      return res
        .status(400)
        .json({ message: "shop_id, service_id, scheduled_time required" });
    }

    const shop = await prisma.barberShop.findUnique({
      where: { id: shop_id },
    });
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const service = await prisma.service.findUnique({
      where: { id: service_id },
    });
    if (!service || service.shop_id !== shop_id) {
      return res
        .status(404)
        .json({ message: "Service not found or doesn't belong to shop" });
    }

    // Get future appointments for this shop
    const futureAppointments = await prisma.appointment.findMany({
      where: {
        shop_id,
        status: { in: ["PENDING", "ACCEPTED"] },
        scheduled_time: { gte: new Date() },
      },
      orderBy: { scheduled_time: "asc" },
    });

    // Initialize chair availability array
    const chairAvailability: {
      chairNumber: number;
      nextAvailableTime: Date;
    }[] = [];

    for (let i = 1; i <= shop.chairs_count; i++) {
      chairAvailability.push({
        chairNumber: i,
        nextAvailableTime: new Date(),
      });
    }

    // Calculate next available time for each chair
    for (const appt of futureAppointments) {
      if (appt.chair_number) {
        const serviceDuration = await prisma.service.findUnique({
          where: { id: appt.service_id },
        });

        const chair = chairAvailability.find(
          (c) => c.chairNumber === appt.chair_number
        );
        if (chair && serviceDuration) {
          const estimatedEnd = new Date(appt.scheduled_time);
          estimatedEnd.setMinutes(
            estimatedEnd.getMinutes() + serviceDuration.duration_min
          );

          if (estimatedEnd > chair.nextAvailableTime) {
            chair.nextAvailableTime = estimatedEnd;
          }
        }
      }
    }

    // Find the chair with earliest availability
    chairAvailability.sort(
      (a, b) => a.nextAvailableTime.getTime() - b.nextAvailableTime.getTime()
    );
    const selectedChair = chairAvailability[0];

    // Assign final start time (earliest of requested or next available)
    let finalStartTime = new Date(scheduled_time);
    if (finalStartTime < selectedChair.nextAvailableTime) {
      finalStartTime = selectedChair.nextAvailableTime;
    }

    const appointment = await prisma.appointment.create({
      data: {
        user_id: req.userId!,
        shop_id,
        service_id,
        scheduled_time: finalStartTime,
        chair_number: selectedChair.chairNumber,
        status: "PENDING",
      },
    });

    res.status(201).json({
      ...appointment,
      estimated_start_time: finalStartTime,
      assigned_chair: selectedChair.chairNumber,
    });
    // After creating appointment
    io.to(shop_id).emit("appointmentUpdate", { type: "new", appointment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMyAppointments = async (req: AuthRequest, res: Response) => {
  try {
    let appointments: any = [];

    if (req.role === "CUSTOMER") {
      appointments = await prisma.appointment.findMany({
        where: { user_id: req.userId },
        include: {
          shop: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              duration_min: true,
              price: true,
            },
          },
        },
        orderBy: {
          scheduled_time: "asc",
        },
      });
    } else if (req.role === "BARBER") {
      // Get all shops owned by barber
      const shops = await prisma.barberShop.findMany({
        where: { owner_id: req.userId },
        select: { id: true },
      });

      const shopIds = shops.map((s) => s.id);

      appointments = await prisma.appointment.findMany({
        where: {
          shop_id: { in: shopIds },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              contact_number: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              duration_min: true,
              price: true,
            },
          },
          shop: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
        orderBy: {
          scheduled_time: "asc",
        },
      });
    }

    // Add estimated end time for each appointment
    const formattedAppointments = appointments.map((appt: any) => {
      const estEnd = new Date(appt.scheduled_time);
      estEnd.setMinutes(estEnd.getMinutes() + appt.service.duration_min);

      return {
        id: appt.id,
        shop: appt.shop,
        service: appt.service,
        scheduled_time: appt.scheduled_time,
        status: appt.status,
        chair_number: appt.chair_number,
        estimated_end_time: estEnd,
        ...(req.role === "BARBER" && { customer: appt.user }),
      };
    });

    res.json(formattedAppointments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateAppointmentStatus = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (req.role !== "BARBER") {
      return res
        .status(403)
        .json({ message: "Only barbers can update appointments" });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (
      !status ||
      !["ACCEPTED", "REJECTED", "COMPLETED", "CANCELLED"].includes(status)
    ) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { shop: true },
    });

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.shop.owner_id !== req.userId) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this appointment" });
    }
    const user = await prisma.user.findUnique({
      where: { id: appointment.user_id },
    });
    const shop = await prisma.barberShop.findUnique({
      where: { id: appointment.shop_id },
    });
    const service = await prisma.service.findUnique({
      where: { id: appointment.service_id },
    });

    // Format ordinal (1st, 2nd, 3rd, etc.)
    function ordinalSuffix(n: number) {
      const s = ["th", "st", "nd", "rd"],
        v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    // Calculate upcoming visit count
    const visitNumber = (user?.visit_count ?? 0) + 1;

    // Build message
    const message = `Thank you ${
      user?.name
    } for visiting us for the ${ordinalSuffix(visitNumber)} time at ${
      shop?.name
    }. Enjoy your ${service?.name}.`;

    // Emit event
    io.to(appointment.shop_id).emit("speakMessage", {
      message,
      customerId: appointment.user_id,
      appointmentId: appointment.id,
    });

    if (status === "COMPLETED") {
      await prisma.user.update({
        where: { id: appointment.user_id },
        data: {
          visit_count: { increment: 1 },
        },
      });
    }

    // In addition User can cancel his appoinment V2
    const updated = await prisma.appointment.update({
      where: { id },
      data: { status },
    });

    res.json(updated);
    io.to(appointment.shop_id).emit("appointmentUpdate", {
      type: "update",
      appointment: updated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
