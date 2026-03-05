# KinoPulse MVP

KinoPulse is a personal movie tracker with profile and social-ready data model.

## Stack
- Backend: Node.js + Express + PostgreSQL
- Frontend: React + Vite
- External API: PoiskKino API
- Auth: JWT

## Quick Start

### 0) Database (PostgreSQL)
```bash
docker compose up -d
```
Docker maps PostgreSQL to `localhost:55432` to avoid conflicts with local services.

### 1) Backend
```bash
cd backend
copy .env.example .env
npm install
npm run db:init
npm run dev
```
Set `POISKKINO_API_KEY` in `backend/.env` before running backend.

### 2) Frontend
```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Frontend default: `http://localhost:5173`  
Backend default: `http://localhost:4000`

## Core Flows
- Sign up / sign in.
- Search movies via PoiskKino API.
- Add rating and comment.
- Add manual movie if no API result.
- View sortable profile table with personal top 10.

## API Endpoints
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/movies/search?q=interstellar`
- `POST /api/reviews` (movie from external API)
- `POST /api/reviews/manual` (manual movie)
- `GET /api/reviews/me?sortBy=rating&order=desc&limit=10`
