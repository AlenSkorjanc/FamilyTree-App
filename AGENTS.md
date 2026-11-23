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

## Relationship integrity

- Parent-child edges form a directed acyclic graph. A person can never be their own ancestor or descendant.
- Every parent-child insert or update must flow through the centralized relationship service and perform persisted, tree-scoped cycle validation.
- Ancestry mutations must serialize on the relevant `FamilyTree`; never use a global application lock or permit concurrent checks to race.
- Graph traversal is always scoped to one tree. React Flow positions, layout rows, dates, and gender are never authoritative genealogy data.
- Derive grandparents, siblings, and other extended relations from parent-child edges instead of persisting redundant relationship types.
- Do not impose a two-parent limit and do not use gender to validate parenthood.
- Keep social/legal partnership policy separate from ancestry DAG integrity; unusual partnerships must not corrupt or redefine ancestry.
- Future person merges and bulk/GEDCOM imports must validate the complete proposed graph and preserve DAG integrity transactionally.

## Family graph layout integrity

- Canonical parent-child data remains a DAG; never use visual copies to conceal an ancestry cycle.
- Every rendered parent-child edge flows strictly downward, and every rendered partnership remains horizontal.
- Never move a canonical ancestry occurrence across generations merely to align a partnership.
- When one Person is required in incompatible ranks or family contexts, create deterministic visual copy/alias occurrences that all retain the canonical Person ID.
- Visual copies are frontend layout objects only. Never persist them as Person records or create fake relationships for layout purposes.
- Search, details, selection, editing, relationship actions, and deletion always operate on canonical Person identity for primary and copy occurrences alike.
- A Person may have multiple copies when topology requires them; reuse occurrences with compatible rank and context to avoid copy explosion.
- Preserve immediate current-partner adjacency when expanding occurrences and arranging partner groups.
- Expand canonical graph data into a semantically valid occurrence graph before ELK layout; never use upward or looping routes to disguise invalid ranks.
- Generate occurrence IDs and copy choices deterministically from stable relationship, partnership, rank, and canonical-person identifiers.
- A canonical Person does not require a permanently rendered primary occurrence; retain only occurrences required by the current visual topology.
- After assigning real relationship edges, prune every redundant degree-zero occurrence belonging to a Person with displayed relationships before ELK layout.
- Never create fake primary-to-copy or copy-to-copy relationship edges to preserve visual connectivity.
- Primary and copy occurrences are equal visual representations of one canonical Person; canonical-person lookup must resolve search, selection, focus, and editing to a currently visible occurrence.
- Prune unused family/helper layout objects before ELK and ensure they cannot influence spacing or fit-view bounds.
- Minimize occurrence count after satisfying downward ancestry, horizontal partnership, and current-partner adjacency constraints.
- Keep each canonical connected family component visually connected whenever compatible occurrences allow it; never allow upward parent-child edges to repair a split layout.
- Treat the render graph as a connected unfolding of each canonical family component; every complete canonical component must produce exactly one rendered component.
- Build preferred vertical ranks from the parent-child DAG first. Unequal ancestry path depth alone never justifies a copy.
- Create a copy only through the real relationship that requires it and with another endpoint already anchored in the rendered component; copies never become independent roots.
- Prefer an existing compatible connected occurrence over creating a copy, and never inherit copy status or automatically duplicate a copy's parents, children, or wider branch.
- Assign every displayed canonical relationship to exactly one occurrence pair or family route.
- Validate rendered connectivity as a hard precondition before ELK; never repair it with fake same-person edges.

## Production deployment

- Production is one Spring Boot container that serves the compiled React application; do not add a separate frontend server or deployment.
- Frontend production API and OAuth URLs stay same-origin and relative. Local development routes `/api`, `/oauth2`, and `/login/oauth2` through the Vite proxy.
- Production must listen on `${PORT}` and use forwarded-header handling appropriate for the Koyeb reverse proxy.
- Production persistence must never rely on the container filesystem. PostgreSQL and future external object storage are the only durable stores.
- All production credentials and secrets come from environment variables or the platform secret store. Never commit `.env` or real credentials.
- Production refresh cookies must be `HttpOnly`, `Secure`, `SameSite=Lax`, and scoped to `/api/auth`.
- Never expose access tokens, refresh tokens, OAuth codes, credentials, or secrets in URLs or logs.
- Run the root Docker build plus relevant backend and frontend tests after deployment-related changes.

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
- Frontend: `cd frontend && npm test` and `npm run build`, followed by functional browser/API verification.
- Database: `docker compose up -d` from the monorepo root.
- Run relevant tests after every change and exercise cross-stack changes against PostgreSQL.
- Do not commit generated builds, dependencies, `.env`, secrets, or IDE files.
