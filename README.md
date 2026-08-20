# Family Tree

A full-stack family-tree editor built around a graph data model. People are independent nodes; parent/child and partnership records are edges. This supports multiple parents, remarriage, adoption, half-siblings, pedigree collapse, and arbitrarily deep ancestry without recursive persistence objects.

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

Open <http://localhost:5173>. Vite proxies `/api` to the backend at `http://localhost:8080`; same-origin requests through the Vite proxy also work when the app is opened from a mobile device over the local network. Direct cross-origin API access must still be explicitly permitted with `ALLOWED_ORIGINS`.

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
- `parent_child_relationships`: directed edges with biological, adoptive, step, or other type.
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

Partnerships are explicit and never inferred from shared children. Selecting a current partner transactionally clears conflicting current partnerships for both people; sending a null partner clears the selection without removing historical relationships. Parent-child links are rejected if they cross trees, duplicate an existing edge, self-link, or introduce an ancestry cycle.

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

Social buttons remain hidden unless both values for that provider are present. Social success sets only the refresh cookie and redirects to `/auth/callback`; no token is placed in a URL. If a provider returns an email already belonging to another account, automatic linking is refused and the user must first authenticate the existing account. A complete account-linking UI, email verification/password recovery, and infrastructure-backed login rate limiting remain production-hardening work.

Authentication configuration is listed in `.env.example`: `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `REFRESH_COOKIE_SECURE`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, and `FACEBOOK_CLIENT_SECRET`. Set a strong unique `JWT_SECRET` and `REFRESH_COOKIE_SECURE=true` in production. No social secrets have development defaults.
