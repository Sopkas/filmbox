# KinoPulse MVP Roadmap

## Stage 1: Project Setup
- Create `backend` and `frontend` apps.
- Add environment templates and run instructions.
- Define database schema for users, movies, and reviews.

## Stage 2: Backend Core
- Implement Express server and PostgreSQL connection.
- Add JWT authentication (`signup`, `login`).
- Add API input validation and error handling.

## Stage 3: Movie Data Integration
- Integrate PoiskKino search endpoint.
- Save selected movies by `external_id`.
- Support manual movie creation if API has no match.

## Stage 4: User Reviews and Profile
- Save `rating` (1-5) and `comment`.
- Expose profile endpoint with sortable list.
- Support top-10 view with server-side limit.

## Stage 5: Frontend MVP
- Auth forms (sign up / sign in).
- Debounced movie search with dropdown suggestions.
- Add review form and manual entry fallback.
- Add responsive sortable profile table.

## Stage 6: Validation and Finish
- Smoke-test all user stories.
- Document setup and API contracts.
- Define next iteration backlog.

• 1. Проверьте, что всё установлено:

  codex --version
  bash --version
  mise --version

  bash нужен обязательно (Git Bash/WSL).

  2. В PowerShell задайте ключ Linear (лучше новый, старый уже засвечен) и URL репо:

  $env:LINEAR_API_KEY="NEW_LINEAR_KEY"
  $env:SOURCE_REPO_URL="https://github.com/Sopkas/filmbox.git"

  3. Убедитесь, что workflow уже настроен:
     WORKFLOW.md
  4. Запустите Symphony:

  cd D:\symphony-main\elixir
  mise trust
  mise install
  mise exec -- mix setup
  mise exec -- mix build
  mise exec -- .\bin\symphony --i-understand-that-this-will-be-running-without-the-usual-guardrails D:\portfolio\filmBebs\WORKFLOW.md

  5. Откройте дашборд:

  - http://127.0.0.1:4001

  6. Чтобы Symphony начал работать, создайте задачу в вашем Linear-проекте filmbox-5a5949382108 со статусом Todo.
  7. Остановка:

  - Ctrl + C в терминале с Symphony.

  
  mise exec -- escript .\bin\symphony --i-understand-that-this-will-be-running-without-the-usual-guardrails D:\portfolio\filmBebs\WORKFLOW.md

$env:LINEAR_API_KEY="YOUR_LINEAR_API_KEY"
