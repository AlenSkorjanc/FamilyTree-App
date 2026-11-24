# Family Tree

A full-stack family-tree editor built around a graph data model. People are independent nodes; parent/child and partnership records are edges. This supports up to two biological/adoptive parents per child, remarriage, adoption, half-siblings, pedigree collapse, and arbitrarily deep ancestry without recursive persistence objects.

## Requirements

- Java 21
- Node.js 20.19+ (Node 22 or 24 recommended)
- Docker with Docker Compose

PostgreSQL does not need to be installed on the host. No global Gradle installation is needed because the backend includes the Gradle Wrapper.

## Run locally

Start PostgreSQL from the repository root:

```bash
docker compose up -d
```

Start the backend in a second terminal:

```bash
cd backend
./gradlew bootRun
```

Start the frontend in a third terminal:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api`, `/oauth2`, and `/login/oauth2` to the backend at `http://localhost:8080`; same-origin requests through the Vite proxy also work when the app is opened from a mobile device over the local network. Direct cross-origin API access must still be explicitly permitted with `ALLOWED_ORIGINS`.

Local database defaults are `localhost:5432`, database `family_tree`, and user/password `family_tree`. Override them with `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`. Uploaded profile images are stored in `backend/data/photos` by default; set `PHOTO_STORAGE_PATH` to use another persistent location. Compose variables are documented in `.env.example`; production deployments should supply secrets externally.

Stop the database with `docker compose down`. Add `-v` only if you intentionally want to remove the persisted local database volume.

## Tests and builds

Backend integration tests use a disposable PostgreSQL container:

```bash
cd backend
./gradlew test
./gradlew build
```

Frontend tests and production build:

```bash
cd frontend
npm run build
```

## Architecture

- `backend/`: Kotlin, Spring Boot, Spring Web MVC, Bean Validation, Spring Data JPA, Flyway, and PostgreSQL.
- `frontend/`: React, strict TypeScript, Vite, React Flow, ELK.js, TanStack Query, and React Hook Form.
- `docker-compose.yml`: persistent local PostgreSQL service.

The backend follows controller → service → repository layers. Controllers exchange immutable DTOs and never expose JPA entities. Transactional services enforce tree membership, self-link, duplicate, date, and ancestry-cycle rules. Centralized exception handling returns structured errors. Flyway owns the database schema; Hibernate only validates it.

The frontend obtains a flat graph in one request, lays it out with ELK, and displays it as fixed React Flow nodes and edges. Each tree has a stable `/trees/{uuid}` URL that can be bookmarked or opened directly, while renaming a tree leaves its URL unchanged. All partners are grouped and aligned horizontally, and the layout is recalculated whenever graph data changes. Selecting a person exposes quick actions directly on their tree card for adding a parent, partner, or child; the relationship is preselected and relevant surname data is suggested. Person forms use a controlled gender selection, native whole-field date pickers, and validated profile-image upload. Search results center and select a node, and the interface supports English and Slovenian. The details panel derives relatives from edge records and supports editing, linking existing people, creating relatives, and removing links.

### Database model

- `family_trees`: independent tree roots and metadata.
- `app_user`: local application accounts; password hashes are Argon2id and may be absent for social-only accounts.
- `user_identity`: Google/Facebook identities stored separately from application users.
- `refresh_token`: hashes of rotating opaque refresh tokens and their session families.
- `people`: one row per person, keyed to exactly one tree. Only `first_name` is required.
- `parent_child_relationships`: directed edges; new links support **biological** or **adoptive** types and each child can have **at most two parents total**. Legacy step/other rows are kept readable for safe reconciliation but cannot be created or changed into unsupported types.
- `partnerships`: logical undirected edges stored in canonical UUID order. `is_current` is symmetric and explicit; each person may participate in at most one current partnership, while existing migrated relationships safely remain non-current.

Deleting a person removes their relationships but never deletes related people. Indexed flat graph data supports arbitrarily deep ancestry without recursive ORM objects or artificial generation limits.

## API overview

| Method | Route | Purpose |
| --- | --- | --- |
| `POST`, `GET` | `/api/trees` | Create or list trees |
| `GET`, `PATCH`, `DELETE` | `/api/trees/{treeId}` | Read, rename, or delete a tree |
| `POST`, `GET` | `/api/trees/{treeId}/people` | Create/list people; `?search=name` searches |
| `GET`, `PATCH`, `DELETE` | `/api/trees/{treeId}/people/{personId}` | Person operations |
| `POST`, `GET` | `/api/trees/{treeId}/parent-child-relationships` | Create/list edges; `?personId=` scopes results |
| `DELETE` | `/api/trees/{treeId}/parent-child-relationships/{id}` | Remove a parent-child edge |
| `POST`, `GET` | `/api/trees/{treeId}/partnerships` | Create/list partnerships; `?personId=` scopes results |
| `PATCH`, `DELETE` | `/api/trees/{treeId}/partnerships/{id}` | Edit/remove a partnership |
| `PATCH` | `/api/trees/{treeId}/people/{personId}/current-partner` | Select or clear the person's symmetric current partnership |
| `GET` | `/api/trees/{treeId}/graph` | Fetch people and all edges in one flat response |

Partnerships are explicit and never inferred from shared children. Selecting a current partner transactionally clears conflicting current partnerships for both people; sending a null partner clears the selection without removing historical relationships. Parent-child links are rejected if they cross trees, duplicate an existing edge, self-link, introduce an ancestry cycle, exceed two parents for a child, or use a new relationship type other than biological/adoptive. The per-tree ancestry lock makes the limit safe across concurrent requests; shared-child copying is transactional, so a rejected child does not partially create a partnership or additional parent links.

## Authentication, guest trees, and sharing

An account is optional when creating a tree. Guest trees and their complete graph data are stored in PostgreSQL just like account-owned trees; the browser stores only their UUIDs in `localStorage`. An opaque, year-long `HttpOnly`, `SameSite=Lax` guest cookie proves that the same browser may read and change them, so a UUID copied from local storage is not sufficient authorization. After registration or sign-in, the application offers to connect selected guest trees from that browser to the profile. Claiming is explicit and atomically replaces guest ownership with account ownership.

An owner can keep a tree private, grant read-only access to selected existing accounts, or generate an unguessable public read-only URL at `/shared/{uuid}`. Switching back to private revokes both selected-user access and the previous public URL. Only owners and unclaimed guest owners can mutate graph data; selected users and public-link visitors receive a read-only graph.

Create an account at `/register` or sign in at `/login`; successful password and social logins use the same local user/session model. The authenticated-user menu shows the current account and provides sign out.

The access token is an application-signed JWT with a default lifetime of 10 minutes. The frontend keeps it only in memory and sends it as a Bearer token. The refresh token is a random opaque value with a default lifetime of 30 days. It is stored only in an `HttpOnly`, `SameSite=Lax` cookie while PostgreSQL stores its SHA-256 hash. Every refresh rotates it; reuse of an old token revokes the complete token family. Browser reload restores the application session through `POST /api/auth/refresh` without localStorage or sessionStorage tokens.

Public authentication endpoints are `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, and `GET /api/auth/providers`. `GET /api/auth/me`, guest-tree claim endpoints, and sharing configuration require a Bearer token. Tree endpoints also accept the guest cookie where guest ownership is supported. Cookie-authenticated state-changing requests use POST/PUT/PATCH/DELETE, `SameSite=Lax`, credentialed explicit-origin CORS, and reject a present `Origin` header unless it matches `ALLOWED_ORIGINS`. OAuth state validation remains managed by Spring Security.

For Google login, create OAuth/OIDC client credentials and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Register this exact local callback URL:

```text
http://localhost:8080/login/oauth2/code/google
```

For Facebook login, create a Meta application and set `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET`. Register this exact local callback URL:

```text
http://localhost:8080/login/oauth2/code/facebook
```

Social buttons remain hidden unless both values for that provider are present. Social success sets only the refresh cookie and redirects to `/auth/callback`; no access or refresh token is placed in a URL. If a provider returns an email already belonging to another account, automatic linking is refused and the user must first authenticate the existing account. Registration verification, forgotten-password recovery, and verified password changes use expiring single-use email tokens whose hashes are stored in PostgreSQL. Infrastructure-backed login rate limiting remains future production-hardening work.

Authentication configuration is listed in `.env.example`: `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `REFRESH_COOKIE_SECURE`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, and `FACEBOOK_CLIENT_SECRET`. Set a strong unique `JWT_SECRET` and `REFRESH_COOKIE_SECURE=true` in production. No social secrets have development defaults.

## Deployment — Koyeb + Neon

Production uses one container: a Node build stage compiles the React application, a Java 21 build stage copies `frontend/dist` into Spring Boot's static resources and creates the executable JAR, and a small Java 21 JRE stage runs only that JAR. Spring serves both the UI and API on the same host. The application listens on `${PORT:8080}`, uses container-aware heap sizing, runs Flyway on startup, and exposes only `GET /actuator/health` for platform health checks.

The production profile uses a small configurable Hikari pool and `ddl-auto=validate`. Neon must be supplied as a PostgreSQL JDBC URL with TLS, for example `jdbc:postgresql://HOST/DATABASE?sslmode=require`. React API and OAuth requests remain relative and same-origin; Spring's forwarded-header support ensures OAuth callback URLs use the public HTTPS scheme behind Koyeb.

### 1. Create the Neon database

1. Create a Neon project and choose a region near the application, preferably AWS Europe (Frankfurt) when available.
2. Open the project's **Connection Details** and select a pooled connection if Neon offers one for the branch.
3. Copy the host, database, username, and password. Convert the connection string to JDBC form: `jdbc:postgresql://<HOST>/<DATABASE>?sslmode=require`.
4. Keep the password in Koyeb Secrets; do not add it to this repository or a committed `.env` file.
5. No schema import is needed. Flyway applies every migration automatically on first application startup.

### 2. Create the Koyeb service

1. Push the reviewed repository to GitHub, then in Koyeb choose **Create Web Service** and select that GitHub repository.
2. Choose **Dockerfile** as the builder, with repository root as the build context and `Dockerfile` as the Dockerfile path.
3. Select the **Free** instance and the **Frankfurt** region.
4. Configure the service port as `8080` (Koyeb also supplies `PORT` at runtime).
5. Configure an HTTP health check with path `/actuator/health` and expect status `200`.
6. Add the environment variables below. Store values marked secret in Koyeb Secrets.
7. Deploy, wait for Flyway and Spring startup to complete, then verify `/`, `/login`, a direct `/trees/<UUID>` route, and `/actuator/health` on the assigned domain.

Required production configuration:

| Variable | Production value |
| --- | --- |
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `SPRING_DATASOURCE_URL` | Neon JDBC URL ending in `sslmode=require` |
| `SPRING_DATASOURCE_USERNAME` | Neon role/user; secret |
| `SPRING_DATASOURCE_PASSWORD` | Neon password; secret |
| `JWT_SECRET` | unique random secret of at least 32 bytes; secret |
| `JWT_ISSUER` | `family-tree-api` or a stable custom issuer |
| `JWT_AUDIENCE` | `family-tree-web` or a stable custom audience |
| `JWT_ACCESS_TOKEN_TTL` | `10m` |
| `REFRESH_TOKEN_TTL` | `30d` |
| `REFRESH_COOKIE_SECURE` | `true` |
| `FRONTEND_URL` | `https://<KOYEB_DOMAIN>` |
| `ALLOWED_ORIGINS` | `https://<KOYEB_DOMAIN>` |
| `MAIL_ENABLED` | `true` when SMTP is configured |
| `SMTP_HOST`, `SMTP_PORT` | SMTP provider connection |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | SMTP credentials; secrets |
| `SMTP_AUTH`, `SMTP_STARTTLS` | normally `true` for hosted SMTP |
| `MAIL_FROM` | verified sender address |

Optional values are `DB_MAX_POOL_SIZE` (default `5`), `DB_MIN_IDLE` (default `1`), Google/Facebook credentials, and email token TTL overrides. Do not set `VITE_API_URL`; production always calls the same origin.

### 3. Configure social callbacks

OAuth providers are independent and remain disabled when their credentials are absent. To enable one, add its client ID and client secret to Koyeb and register its production callback:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
https://<KOYEB_DOMAIN>/login/oauth2/code/google
```

```text
FACEBOOK_CLIENT_ID
FACEBOOK_CLIENT_SECRET
https://<KOYEB_DOMAIN>/login/oauth2/code/facebook
```

Keep `FRONTEND_URL=https://<KOYEB_DOMAIN>` so successful OAuth login returns to `/auth/callback` on the same host. Never place access or refresh tokens in redirect URLs.

### Production limitations

Koyeb's container filesystem is ephemeral. The existing upload implementation stores image files locally, so the `prod` profile disables new photo uploads rather than pretending those files are durable. Existing externally hosted photo URLs in PostgreSQL still render. Add S3-compatible external object storage before enabling production uploads; do not point `PHOTO_STORAGE_PATH` at the Koyeb filesystem.

Transactional email also requires an SMTP provider configured through the variables above; Koyeb and Neon do not supply an email relay. Without it, registration verification and password reset email cannot be delivered. Login rate limiting is not yet implemented and should be added before exposing the application to sustained hostile traffic.

### Build and inspect the production image locally

```bash
docker build -t family-tree .
docker run --rm -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e SPRING_DATASOURCE_URL='jdbc:postgresql://host.docker.internal:5432/family_tree?sslmode=disable' \
  -e SPRING_DATASOURCE_USERNAME=family_tree \
  -e SPRING_DATASOURCE_PASSWORD=family_tree \
  -e JWT_SECRET='replace-with-at-least-32-random-bytes' \
  -e FRONTEND_URL='http://localhost:8080' \
  -e ALLOWED_ORIGINS='http://localhost:8080' \
  -e REFRESH_COOKIE_SECURE=false \
  -e MAIL_ENABLED=false \
  family-tree
```
