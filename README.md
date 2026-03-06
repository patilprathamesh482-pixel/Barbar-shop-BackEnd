# BBR Backend API

Backend API for a barber booking and queue management system built with Node.js, TypeScript, Express, Prisma (PostgreSQL), JWT auth, and Socket.IO.

## Tech Stack

- Node.js + TypeScript
- Express 5
- Prisma ORM
- PostgreSQL
- JWT authentication
- Socket.IO realtime updates

## Project Structure

```text
src/
  controllers/
    auth.controller.ts
    shop.controller.ts
    service.controller.ts
    appointment.controller.ts
  middlewares/
    auth.middleware.ts
  routes/
    auth.routes.ts
    shop.routes.ts
    service.routes.ts
    appointment.routes.ts
  index.ts
prisma/
  schema.prisma
  migrations/
```

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL database

## Environment Variables

Create a `.env` file in project root:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public"
JWT_SECRET="your_secret_key"
PORT=5000
```

Notes:
- `PORT` is optional. Default is `5000`.
- If `JWT_SECRET` is not provided, code falls back to `secret_key` (not recommended for production).

## Installation & Run

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Server starts at:

```text
http://localhost:5000
```

## Authentication

- JWT is required for protected routes.
- Pass token in header:

```http
Authorization: Bearer <token>
```

## API Base Paths

- Auth: `/api/auth`
- Shops: `/api/shops`
- Services: `/api/services`
- Appointments: `/api/appointments`

## API Documentation

### 1) Auth

#### POST `/api/auth/register`
Register a new user.

Request body:

```json
{
  "name": "John",
  "contact_number": "9999999999",
  "password": "pass123",
  "role": "CUSTOMER",
  "email": "john@example.com"
}
```

Rules:
- Required: `name`, `contact_number`, `password`, `role`
- Role should map to enum values: `CUSTOMER` or `BARBER`
- `contact_number` must be unique

Response:
- `201` with JWT token

#### POST `/api/auth/login`
Login with contact number and password.

Request body:

```json
{
  "contact_number": "9999999999",
  "password": "pass123"
}
```

Response:
- `200` with JWT token

### 2) Shops

#### POST `/api/shops/` (Protected, BARBER)
Create a barber shop.

Request body:

```json
{
  "name": "Downtown Cuts",
  "address": "Main Street",
  "latitude": 22.5726,
  "longitude": 88.3639,
  "chairs_count": 3
}
```

Response:
- `201` created shop

#### GET `/api/shops/my` (Protected, BARBER)
Get shops owned by logged-in barber.

Response includes:
- shop details
- services
- appointments

#### PUT `/api/shops/:id` (Protected, BARBER)
Update a shop owned by logged-in barber.

Request body (any updatable fields):

```json
{
  "name": "Downtown Cuts Updated",
  "chairs_count": 4
}
```

#### GET `/api/shops/:shopId/queue` (Protected, BARBER)
Get future queue for a specific shop.

Includes appointment data with:
- customer info
- service info
- `estimated_end_time`

### 3) Services

#### POST `/api/services/:shopId/services` (Protected, BARBER)
Create service for a shop owned by barber.

Request body:

```json
{
  "name": "Haircut",
  "description": "Classic cut",
  "price": 250,
  "duration_min": 30
}
```

Required fields:
- `name`
- `price`
- `duration_min`

#### GET `/api/services/:shopId/services`
Get all services for a shop.

#### PUT `/api/services/service/:id` (Protected, BARBER)
Update existing service (must belong to barber-owned shop).

Request body:

```json
{
  "name": "Premium Haircut",
  "price": 300,
  "duration_min": 40
}
```

### 4) Appointments

#### POST `/api/appointments/` (Protected, CUSTOMER)
Book an appointment.

Request body:

```json
{
  "shop_id": "shop-uuid",
  "service_id": "service-uuid",
  "scheduled_time": "2026-03-10T10:00:00.000Z"
}
```

Behavior:
- Only `CUSTOMER` role can book.
- Validates shop and service relation.
- Calculates chair availability based on future `PENDING`/`ACCEPTED` appointments.
- Assigns earliest available chair and adjusted start time.

Response includes:
- appointment record
- `estimated_start_time`
- `assigned_chair`

#### GET `/api/appointments/my` (Protected)
Role-based response:
- `CUSTOMER`: returns own appointments
- `BARBER`: returns appointments for all owned shops

Each response item includes:
- shop
- service
- `scheduled_time`
- `status`
- `chair_number`
- `estimated_end_time`
- `customer` object for barber role

#### PUT `/api/appointments/:id/status` (Protected, BARBER)
Update appointment status.

Allowed request statuses in controller:
- `ACCEPTED`
- `REJECTED`
- `COMPLETED`
- `CANCELLED`

Example request body:

```json
{
  "status": "ACCEPTED"
}
```

Notes:
- Barbers can update only appointments belonging to their shops.
- When status becomes `COMPLETED`, `user.visit_count` is incremented.

## Realtime (Socket.IO)

### Connection
- Socket server runs on same host/port as API.

### Client Events
- `joinShopRoom` with `shopId` to subscribe shop-specific updates.

### Server Events
- `appointmentUpdate`
  - Emitted after appointment create (`type: "new"`) and update (`type: "update"`).
- `speakMessage`
  - Emitted during status update flow with a thank-you message payload.

## Database Models (Prisma)

Main entities:
- `User`
- `BarberShop`
- `Service`
- `Appointment`
- `Loyalty`

Important enums:
- `Role`: `CUSTOMER`, `BARBER`
- `AppointmentStatus`: `PENDING`, `ACCEPTED`, `REJECTED`, `COMPLETEDsss`, `CANCELLED`

## Known Implementation Note

In `prisma/schema.prisma`, `AppointmentStatus` contains `COMPLETEDsss`, while controller logic expects `COMPLETED` when updating appointment status. This mismatch should be corrected in schema/controller for consistent behavior.

## Error Responses

Typical errors:
- `400` invalid/missing input
- `401` unauthorized/invalid token
- `403` role or ownership restriction
- `404` resource not found
- `500` server error

## Development Notes

- API does not include automated tests yet (`npm test` is placeholder).
- CORS is currently open (`origin: "*"`) in both Express and Socket.IO config.
- Use production-safe secrets and stricter CORS before deployment.