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
