// import express from "express";
// import cors from "cors";
// import { PrismaClient } from "@prisma/client";
// import authRoutes from "./routes/auth.routes";
// import shopRoutes from "./routes/shop.routes";
// import serviceRoutes from "./routes/service.routes";
// import appointmentRoutes from "./routes/appointment.routes";


// const app = express();
// const prisma = new PrismaClient();

// app.use(cors());
// app.use(express.json());

// app.use("/api/auth", authRoutes);
// app.use("/api/shops", shopRoutes);
// app.use("/api/shops", serviceRoutes);
// app.use("/api/appointments", appointmentRoutes);

// const PORT = 5000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });


import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

// Import routes
import authRoutes from "./routes/auth.routes";
import shopRoutes from "./routes/shop.routes";
import appointmentRoutes from "./routes/appointment.routes";
import serviceRoutes from "./routes/service.routes";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Frontend origin or '*'
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/services", serviceRoutes);

// Socket.IO connection event
io.on("connection", (socket) => {
  console.log("A barber connected: " + socket.id);

  socket.on("joinShopRoom", (shopId) => {
    socket.join(shopId);
    console.log(`Socket ${socket.id} joined shop room ${shopId}`);
  });

  socket.on("disconnect", () => {
    console.log("A barber disconnected: " + socket.id);
  });
});

// Export io to use in controllers
export { io };

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
