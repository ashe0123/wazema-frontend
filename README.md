# Wazema SCBC — Next.js Frontend

Optional modern React frontend for the Wazema system. The primary frontend is the vanilla HTML/CSS/JS version served directly by the Express backend at `http://localhost:3002`.

## Setup

```bash
cd Wazema/frontend-next
npm install
npm run dev   # http://localhost:3000
```

The backend must be running on port 3002. All `/api/*` requests are proxied automatically via `next.config.js`.

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **CSS Variables** (no external UI library)

## Pages

| Route | Description |
|-------|-------------|
| `/` | Login — member and admin tabs |
| `/admin` | Admin dashboard |
| `/dashboard` | Member portal |

## Demo Credentials

| Role | ID | Password |
|------|----|----------|
| Admin | `admin` | `admin123` |
| Member | `WZ-001` | `1234` |

## Notes

- This frontend is a work in progress. The vanilla frontend (`Wazema/frontend/`) is the fully-featured production UI.
- For full feature documentation see [`../DOCUMENTATION.md`](../DOCUMENTATION.md).
