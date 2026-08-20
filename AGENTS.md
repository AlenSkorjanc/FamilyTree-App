# AGENTS.md

## Architecture

- This monorepo contains `backend/` (Kotlin/Spring Boot), `frontend/` (React/TypeScript), and root Docker infrastructure.
- People and relationships are graph data. Never convert persistence or REST responses to nested recursive `Person.children` structures.
- `FamilyTree` scopes all people and edges. Never permit a relationship across trees.
- Keep graph responses flat. Avoid N+1 queries and recursive ORM associations.

## Backend conventions

- Use Java 21, idiomatic Kotlin, constructor injection, Kotlin nullability, and immutable request/response data classes.
- Keep controllers thin and do not expose JPA entities. Business rules and transactions belong in services.
- Avoid `!!`, unnecessary interfaces, field injection, and bidirectional entity relationships.
- Public identifiers are UUIDs. Partnerships remain canonically ordered and parent-child edges remain acyclic.

## Frontend conventions

- Use strict TypeScript without `any` or error suppression.
- Keep server state in TanStack Query and use React Hook Form where useful.
- Render the graph with React Flow; never replace it with nested static HTML. Person nodes stay fixed after automatic layout, all partners stay horizontally aligned, and graph mutations trigger a fresh layout.
- Keep all user-facing copy in the translation dictionaries and maintain both English and Slovenian.
- Preserve create-new and link-existing workflows for relatives. Backend validation remains authoritative.

## Database migrations

- Flyway exclusively manages schema changes. Hibernate `ddl-auto` stays `validate`.
- Every schema change requires a new versioned migration in `backend/src/main/resources/db/migration`.
- Never edit an already-released migration in an established environment.
- Preserve constraints, indexes, and the absence of artificial person/generation limits.

## Authentication and authorization

- Never store plaintext passwords or raw refresh tokens in the database.
- Never store access or refresh tokens in browser localStorage, sessionStorage, or IndexedDB.
- Rotate the opaque refresh token on every successful refresh and retain token-family reuse detection.
- Never expose tokens in URLs or log passwords, tokens, authorization codes, client secrets, or authorization headers.
- Scope every `FamilyTree` data access to its authenticated owner, authorized viewer, guest session, or public share capability; never trust a frontend-supplied user ID for ownership.
- Store OAuth provider identities separately from `APP_USER` and never auto-link accounts from an untrusted or merely matching email.
- Authentication schema changes always require a new Flyway migration.
- Run authentication and security tests after every security-related change.

## Tests and commands

- Backend: `cd backend && ./gradlew test` and `./gradlew build`.
- Frontend: `cd frontend && npm run build`, followed by functional browser/API verification.
- Database: `docker compose up -d` from the monorepo root.
- Run relevant tests after every change and exercise cross-stack changes against PostgreSQL.
- Do not commit generated builds, dependencies, `.env`, secrets, or IDE files.
