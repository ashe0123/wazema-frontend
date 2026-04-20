# Wazema Saving and Credit Basic Cooperative (SCBC)

A full-featured microfinance management system for savings, loans, and member management.

---

## Architecture

```
Wazema/
├── backend/              Express.js API (Node.js 20+) — port 3002
│   ├── routes/           Auth, Members, Savings, Loans, Repayments, Settings, Uploads
│   ├── middleware/       JWT auth, input validation, rate limiting
│   ├── db.js             Database layer (PostgreSQL / Turso / SQLite)
│   ├── server.js         Express server — API only, no static files
│   └── .env              Environment configuration
│
└── frontend-next/        Next.js 14 frontend — port 3000
    ├── src/app/
    │   ├── page.tsx      Login + forgot password
    │   ├── admin/        Admin dashboard (all sections)
    │   └── dashboard/    Member portal (all sections)
    ├── src/components/   Sidebar, Modal, Toast
    ├── src/lib/api.ts    API client + formatters
    └── next.config.js    Proxies /api/* → backend:3002
```

---

## Quick Start

### 1. Start the backend API

```bash
cd backend
npm install
node server.js
# API running at http://localhost:3002
```

### 2. Start the Next.js frontend

```bash
cd frontend-next
npm install
npm run dev
# Frontend running at http://localhost:3000
```

Open **http://localhost:3000** in your browser.

---

## Database Options

The backend auto-selects the database based on `.env`:

| Priority | Database | Condition |
|----------|----------|-----------|
| 1st | **PostgreSQL** | `DATABASE_URL` is set |
| 2nd | **Turso** (cloud SQLite) | `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` set |
| 3rd | **Local SQLite** | fallback (development) |

Schema and seed data are created automatically on first startup.

---

## Demo Credentials

| Role | ID | Password |
|------|----|----------|
| Admin | `admin` | `admin123` |
| Member | `WZ-003` | `1234` |
| Member | `WZ-004` | `1234` |

---

## Docker Deployment

```bash
# Copy and fill environment variables
cp backend/.env.example .env

# Build and start all services (PostgreSQL + API + Next.js)
docker-compose up -d

# View logs
docker-compose logs -f
```

Services:
- **PostgreSQL** — internal, port 5432
- **API** — http://localhost:3002
- **Frontend** — http://localhost:3000

---

## Environment Variables

See `backend/.env.example` for all required variables.

Key variables:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Strong random secret (min 32 chars) |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |
| `DATABASE_URL` | PostgreSQL connection string |
| `CORS_ORIGIN` | Frontend URL (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_API_URL` | Backend URL for Next.js (e.g. `http://localhost:3002`) |

---

## First-Time Setup

See **[SETUP.md](SETUP.md)** for the complete first-run checklist.

---

## API Endpoints

The backend exposes a pure REST API at `http://localhost:3002/api/`.
See **[DOCUMENTATION.md](DOCUMENTATION.md)** for the full API reference.
