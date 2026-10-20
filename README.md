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

Create a `.env` file in this directory with the backend settings below. Replace every placeholder with your own value; never put real secrets in this README or commit your `.env` file.

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/<database>?retryWrites=true&w=majority
JWT_SECRET=<long-random-secret>
SUPERADMIN_USERNAME=<initial-superadmin-username>
SUPERADMIN_PASSWORD=<initial-superadmin-password>
RESEND_API_KEY=<resend-api-key>
RESEND_FROM_EMAIL=CareNest <verified-sender@example.com>
FRONTEND_URL=https://your-frontend.example.com
GOOGLE_CLIENT_ID=<google-oauth-client-id>
# Optional; defaults to 5170 locally and uses the host-provided port when deployed.
PORT=5170
```

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB connection string. Required by the API. |
| `JWT_SECRET` | Secret used to sign and verify login tokens. Required by the API. Generate a unique value, for example with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`. |
| `SUPERADMIN_USERNAME` | Username for the initial superadmin account. |
| `SUPERADMIN_PASSWORD` | Password for the initial superadmin account. Use a strong, unique password. |
| `RESEND_API_KEY` | Resend API key for sending account emails. |
| `RESEND_FROM_EMAIL` | Sender name and address verified with Resend, for example `CareNest <you@example.com>`. |
| `FRONTEND_URL` | Public frontend origin used when creating links back to the website. |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID used by the website's Google sign-in flow. |
| `PORT` | Optional HTTP port. Defaults to `5170` locally; hosting providers such as Render supply it automatically. |

For local MongoDB, `MONGO_URI` can be `mongodb://127.0.0.1:27017/babysitter-booking`. Keep `.env` private and never commit it. Start MongoDB, then start the API:

```sh
npm start
```

The API listens on `http://localhost:5170` by default. The frontend development server uses that address unless `VITE_API_BASE_URL` is set.

## Deploy

The backend is deployed separately from the GitHub Pages frontend. Configure the `.env` values in the backend hosting service, including `MONGO_URI`, `JWT_SECRET`, `SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `FRONTEND_URL`, and `GOOGLE_CLIENT_ID`. The host-provided `PORT` is optional in configuration; the server uses it automatically when available, and otherwise defaults to `5170`.

The backend accepts profile photos and identity documents. Do not serve its `private_uploads/` directory as static files. Local disk on many hosting plans is temporary; configure persistent private storage before relying on uploaded documents in production.

## Main API areas

- `/api/user` — registration, login, and account administration
- `/api/babysitter` — caregiver profiles, availability, and profile documents
- `/api/bookings` — booking requests and status updates
- `/api/admin` — profile review, moderation, and administration
