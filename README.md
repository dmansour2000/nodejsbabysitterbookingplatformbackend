# CareNest Babysitter Booking Backend

This repository contains the Express and MongoDB API for CareNest. The React frontend is maintained separately and is published at [dmansour2000.github.io/reactjsbabysitterbookingplatformfrontend](https://dmansour2000.github.io/reactjsbabysitterbookingplatformfrontend).

## Requirements

- Node.js (the project currently declares Node.js 23.5)
- MongoDB connection string

## Run locally

Install the backend dependencies:

```sh
npm install
```

Create a local `.env` file in this directory with these settings:

```env
MONGO_URI=mongodb://127.0.0.1:27017/babysitter-booking
JWT_SECRET=replace-with-a-long-random-secret
PORT=5170
```

Keep `.env` private and never commit it. Start MongoDB, then start the API:

```sh
npm start
```

The API listens on `http://localhost:5170` by default. The frontend development server uses that address unless `VITE_API_BASE_URL` is set.

## Deploy

The backend is deployed separately from the GitHub Pages frontend. Configure `MONGO_URI` and `JWT_SECRET` as environment variables in the backend hosting service. `PORT` is provided by services such as Render; the server uses it automatically.

The backend accepts profile photos and identity documents. Do not serve its `private_uploads/` directory as static files. Local disk on many hosting plans is temporary; configure persistent private storage before relying on uploaded documents in production.

## Main API areas

- `/api/user` — registration, login, and account administration
- `/api/babysitter` — caregiver profiles, availability, and profile documents
- `/api/bookings` — booking requests and status updates
- `/api/admin` — profile review, moderation, and administration
