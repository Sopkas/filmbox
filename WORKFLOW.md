---
tracker:
  kind: linear
  project_slug: "REPLACE_WITH_LINEAR_PROJECT_SLUG"
  active_states:
    - Todo
    - In Progress
    - In Review
    - Rework
  terminal_states:
    - Done
    - Closed
    - Cancelled
    - Canceled
    - Duplicate
polling:
  interval_ms: 10000
workspace:
  root: D:/symphony-workspaces/filmBebs
hooks:
  after_create: |
    if [ -n "$SOURCE_REPO_URL" ]; then
      git clone --depth 1 "$SOURCE_REPO_URL" .
    else
      LOCAL_SOURCE_PATH="${LOCAL_SOURCE_PATH:-/d/portfolio/filmBebs}"
      if [ ! -d "$LOCAL_SOURCE_PATH" ]; then
        echo "Set SOURCE_REPO_URL or LOCAL_SOURCE_PATH. Current LOCAL_SOURCE_PATH is invalid: $LOCAL_SOURCE_PATH"
        exit 1
      fi

      tar -C "$LOCAL_SOURCE_PATH" \
        --exclude='./node_modules' \
        --exclude='./frontend/node_modules' \
        --exclude='./backend/node_modules' \
        --exclude='./frontend/dist' \
        --exclude='./backend/dist' \
        --exclude='./frontend/npm-cache' \
        --exclude='./backend/npm-cache' \
        --exclude='./npm-cache' \
        --exclude='./.tmpgo' \
        -cf - . | tar -xf -
    fi

    if [ -f backend/.env.example ] && [ ! -f backend/.env ]; then
      cp backend/.env.example backend/.env
    fi

    if [ -f frontend/.env.example ] && [ ! -f frontend/.env ]; then
      cp frontend/.env.example frontend/.env
    fi

    if command -v docker >/dev/null 2>&1; then
      docker compose up -d postgres || true
    fi

    if [ -f backend/package.json ]; then
      cd backend && npm ci
      cd ..
    fi

    if [ -f frontend/package.json ]; then
      cd frontend && npm ci
      cd ..
    fi

  before_run: |
    if [ -f backend/.env.example ] && [ ! -f backend/.env ]; then
      cp backend/.env.example backend/.env
    fi

    if [ -f frontend/.env.example ] && [ ! -f frontend/.env ]; then
      cp frontend/.env.example frontend/.env
    fi

    if command -v docker >/dev/null 2>&1; then
      docker compose up -d postgres || true
    fi

    if [ -f backend/package.json ] && [ ! -d backend/node_modules ]; then
      cd backend && npm ci
      cd ..
    fi

    if [ -f frontend/package.json ] && [ ! -d frontend/node_modules ]; then
      cd frontend && npm ci
      cd ..
    fi

  timeout_ms: 1200000
agent:
  max_concurrent_agents: 2
  max_turns: 10
codex:
  command: codex app-server
  approval_policy: never
  thread_sandbox: workspace-write
  turn_sandbox_policy:
    type: workspaceWrite
server:
  port: 4001
  host: 127.0.0.1
---

You are working on a Linear issue `{{ issue.identifier }}` for KinoPulse.

Issue context:
- Identifier: {{ issue.identifier }}
- Title: {{ issue.title }}
- Status: {{ issue.state }}
- URL: {{ issue.url }}

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

Project stack and layout:
- `frontend/`: React 18 + Vite 5, React Router.
- `backend/`: Node.js (ESM) + Express + pg + JWT auth.
- DB: PostgreSQL 16 via `docker-compose.yml` on `localhost:55432`.
- Backend env requirements: `DATABASE_URL`, `JWT_SECRET`, `POISKKINO_API_KEY`.

Available project scripts:
- Frontend: `cd frontend && npm run dev`, `cd frontend && npm run build`.
- Backend: `cd backend && npm run dev`, `cd backend && npm run start`, `cd backend && npm run db:init`.

Operational rules:
1. This is unattended orchestration. Do not ask for human follow-up unless blocked by missing credentials/permissions.
2. Keep all work inside the workspace clone.
3. If issue state is `Todo`, move it to `In Progress` before implementation.
4. Keep exactly one persistent issue comment with header `## Codex Workpad` and update it continuously.
5. Keep scope tight to the current ticket; no unrelated refactors.

Stack-specific execution standard:
1. Reproduce the issue first and record reproducible signal in workpad.
2. For backend tasks, prefer route-level/API-level fixes inside `backend/src/routes/*` and keep `backend/sql/schema.sql` and runtime behavior consistent.
3. For frontend tasks, keep API contract alignment with `frontend/src/api.js` and pages under `frontend/src/pages/*`.
4. If API shape changes, update both backend response and frontend consumer in same task.

Mandatory validation by changed scope:
- If `frontend/**` changed:
  - run `cd frontend && npm run build`.
- If `backend/**` changed:
  - run `cd backend && node --check src/server.js`.
  - run `cd backend && node --check src/app.js`.
- If DB-related files changed (`backend/sql/**`, `backend/scripts/db-init.js`, or SQL in routes):
  - run `docker compose up -d postgres` when docker is available.
  - run `cd backend && npm run db:init`.
- If backend behavior changed materially:
  - run health smoke test:
    - start backend (`cd backend && npm run start` in background),
    - check `GET http://127.0.0.1:4000/health`,
    - stop backend process,
    - record result in workpad.

Documentation rule:
- If setup, env, scripts, or API contracts changed, update `README.md` in the same ticket.

Handoff quality bar:
- Acceptance criteria are satisfied.
- Required validations above passed and are documented in workpad.
- Final run summary includes only:
  - Completed changes.
  - Validation results.
  - Blockers (if any).
- Do not include next steps for user.
