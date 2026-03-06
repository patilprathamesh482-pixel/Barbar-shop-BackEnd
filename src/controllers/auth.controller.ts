import { Request, Response } from "express";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "secret_key";

export const register = async (req: Request, res: Response) => {
  try {
    const { name, contact_number, password, role, email } = req.body;

    if (!name || !contact_number || !password || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { contact_number }
    });

    if (existingUser) {
      return res.status(400).json({ message: "Contact number already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        contact_number,
        password_hash: hashedPassword,
        role: role.toUpperCase() as Role,
        email
      }
    });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d"
    });

    res.status(201).json({ message: "User registered successfully", token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { contact_number, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { contact_number }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d"
    });

    res.json({ message: "Login successful", token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
