# KinoPulse

KinoPulse is a personal movie tracker with:
- auth and profile ratings,
- watch later / abandoned lists,
- custom collections,
- personal top-10 list.

## Stack
- Backend: Node.js + Express + PostgreSQL
- Frontend: React + Vite
- External API: PoiskKino API
- Auth: JWT

## Requirements
- Node.js 22+
- npm 10+
- Docker + Docker Compose

## Quick Start (one command)

1. Install dependencies:
```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

2. Create env files:
```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

3. Fill required secrets in `backend/.env`:
- `DATABASE_URL`
- `JWT_SECRET`
- `POISKKINO_API_KEY`

4. Initialize DB schema:
```bash
npm --prefix backend run db:init
```

5. Run full local stack (DB + backend + frontend):
```bash
npm run dev
```

Frontend default: `http://localhost:5173`  
Backend default: `http://localhost:4000`

## Environment Variables

### Backend (`backend/.env`)

Required:
- `DATABASE_URL` (example: `postgresql://postgres:postgres@localhost:55432/kinopulse`)
- `JWT_SECRET`
- `POISKKINO_API_KEY`

Optional:
- `PORT` (default: `4000`)
- `NODE_ENV` (`development` | `test` | `production`)
- `CORS_ORIGIN` (comma-separated allowlist or `*`)
- `AUTH_RATE_LIMIT_WINDOW_MS` (default: `900000`)
- `AUTH_RATE_LIMIT_MAX` (default: `20`)
- `TRUST_PROXY` (`true`/`false`, default: `false`)
- `MOCK_POISKKINO` (`true`/`false`, default: `false`, useful for tests)

### Frontend (`frontend/.env`)

- `VITE_API_BASE_URL` (default: `http://localhost:4000/api`)

## Security Defaults
- `helmet` is enabled in API app.
- CORS is allowlist-based (`CORS_ORIGIN`), requests from disallowed origins return `403`.
- Auth endpoints are protected with rate limit (`AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX`).
- API errors include `requestId`, and request logs are structured.

## Quality Gates

```bash
npm run lint
npm run build
npm run test:integration
npm run check:encoding
```

## Optional pre-commit hook

To enforce encoding checks before each commit:

```bash
git config core.hooksPath .githooks
```

## Useful Commands
- `npm run dev` - DB + backend + frontend
- `npm run db:up` - start PostgreSQL in Docker
- `npm run db:down` - stop PostgreSQL in Docker
- `npm run test:integration` - backend integration API tests
