# CareNest Babysitter Booking Backend

This repository contains the Express and MongoDB API for CareNest. The React frontend is maintained separately and is published at [dmansour2000.github.io/reactjsbabysitterbookingplatformfrontend](https://dmansour2000.github.io/reactjsbabysitterbookingplatformfrontend).

## API Documentation

The backend includes a comprehensive, interactive documentation dashboard hosted at the root endpoint:
- **Interactive Web Interface:** [`https://nodejsbabysitterbookingplatformbackend.onrender.com/`](https://nodejsbabysitterbookingplatformbackend.onrender.com/) (or `http://localhost:5170/`)
- **Raw JSON Specification:** [`https://nodejsbabysitterbookingplatformbackend.onrender.com/?format=json`](https://nodejsbabysitterbookingplatformbackend.onrender.com/?format=json) or `/docs.json`

The documentation covers all 40+ endpoints with HTTP methods, summaries, parameters, authentication requirements, request schemas, status codes, and ready-to-run cURL snippets.

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
# Database & Authentication (Required)
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/<database>?retryWrites=true&w=majority
JWT_SECRET=<long-random-secret>

# Initial Superadmin Account (Required)
SUPERADMIN_USERNAME=<initial-superadmin-username>
SUPERADMIN_PASSWORD=<initial-superadmin-password>

# Email Delivery - Option 1: Brevo (Recommended for Render Free Tier - HTTP API over port 443)
# Sign up free at https://www.brevo.com and get your API key from Settings > SMTP & API > API Keys
BREVO_API_KEY=<brevo-api-key-starting-with-xkeysib>
BREVO_SENDER_EMAIL=<your-verified-email@gmail.com>
BREVO_SENDER_NAME=CareNest

# Email Delivery - Option 2: Gmail SMTP (For local testing; blocked on Render Free Tier)
# Generate a 16-character App Password at: https://myaccount.google.com/apppasswords
GMAIL_USER=<your-email@gmail.com>
GMAIL_APP_PASSWORD=<16-character-google-app-password>

# Email Delivery - Option 3: Resend (For custom domain production or API-based testing)
RESEND_API_KEY=<resend-api-key>
RESEND_FROM_EMAIL=CareNest <onboarding@resend.dev>

# Optional Email Provider Switch: "brevo", "gmail", or "resend"
EMAIL_PROVIDER=brevo

# Frontend & OAuth Settings
FRONTEND_URL=https://dmansour2000.github.io/reactjsbabysitterbookingplatformfrontend
GOOGLE_CLIENT_ID=<google-oauth-client-id>

# Server Port (Optional; defaults to 5170 locally; hosts like Render assign PORT automatically)
PORT=5170
```

| Variable | Requirement | Purpose |
| --- | --- | --- |
| `MONGO_URI` | Required | MongoDB connection string. |
| `JWT_SECRET` | Required | Secret used to sign and verify JWT authentication and password recovery tokens. Generate a unique value with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`. |
| `SUPERADMIN_USERNAME` | Required | Username for the initial superadmin account. |
| `SUPERADMIN_PASSWORD` | Required | Password for the initial superadmin account. Use a strong, unique password. |
| `BREVO_API_KEY` | Optional (Recommended) | Brevo API key (`xkeysib-...`) for sending via HTTPS REST API over port 443 (ideal for Render free tier). |
| `BREVO_SENDER_EMAIL` | Optional | Verified sender email in your Brevo account (defaults to `GMAIL_USER` or `abdelkareem.dina@gmail.com`). |
| `BREVO_SENDER_NAME` | Optional | Sender display name (defaults to `CareNest`). |
| `GMAIL_USER` | Optional | Gmail address used to send transactional emails via Gmail SMTP (works on localhost; blocked by Render free tier). |
| `GMAIL_APP_PASSWORD` | Optional | 16-character Google App Password. |
| `RESEND_API_KEY` | Optional | Resend API key (`re_...`) for transactional email delivery. |
| `RESEND_FROM_EMAIL` | Optional | Verified sender address in Resend. |
| `EMAIL_PROVIDER` | Optional | Explicitly choose `"brevo"`, `"gmail"`, or `"resend"`. |
| `FRONTEND_URL` | Required | Public URL of the frontend (e.g. `https://dmansour2000.github.io/reactjsbabysitterbookingplatformfrontend`). Used to construct password reset links. |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth 2.0 Web Client ID used to verify Google Sign-In tokens on the backend. |
| `PORT` | Optional | HTTP port. Defaults to `5170` locally; hosting providers supply it automatically. |

For local MongoDB, `MONGO_URI` can be `mongodb://127.0.0.1:27017/babysitter-booking`. Keep `.env` private and never commit it. Start MongoDB, then start the API:

```sh
npm start
```

The API listens on `http://localhost:5170` by default. The frontend development server uses that address unless `VITE_API_BASE_URL` is set.

## Deploy

The backend is deployed separately from the GitHub Pages frontend. Configure the `.env` values in your backend hosting service (such as Render):
- **Core**: `MONGO_URI`, `JWT_SECRET`, `SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD`, `FRONTEND_URL`, and `GOOGLE_CLIENT_ID`.
- **Email**: Either `GMAIL_USER` and `GMAIL_APP_PASSWORD` (for Gmail SMTP), or `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (for Resend).
- The host-provided `PORT` is assigned automatically by hosts like Render; it defaults to `5170` locally.

The backend accepts profile photos and identity documents. Do not serve its `private_uploads/` directory as static files. Local disk on many hosting plans is temporary; configure persistent private storage before relying on uploaded documents in production.

## Main API areas

- `/api/user` — registration, login, and account administration
- `/api/babysitter` — caregiver profiles, availability, and profile documents
- `/api/bookings` — booking requests and status updates
- `/api/admin` — profile review, moderation, and administration
