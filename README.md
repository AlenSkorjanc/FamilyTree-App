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

Open <http://localhost:5173>. Vite proxies `/api` to the backend at `http://localhost:8080`. Development CORS permits `http://localhost:5173`; override it with `CORS_ALLOWED_ORIGIN` when necessary.

Local database defaults are `localhost:5432`, database `family_tree`, and user/password `family_tree`. Override them with `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`. Compose variables are documented in `.env.example`; production deployments should supply secrets externally.

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
npm test
npm run build
```

## Architecture

- `backend/`: Kotlin, Spring Boot, Spring Web MVC, Bean Validation, Spring Data JPA, Flyway, and PostgreSQL.
- `frontend/`: React, strict TypeScript, Vite, React Flow, ELK.js, TanStack Query, and React Hook Form.
- `docker-compose.yml`: persistent local PostgreSQL service.

The backend follows controller → service → repository layers. Controllers exchange immutable DTOs and never expose JPA entities. Transactional services enforce tree membership, self-link, duplicate, date, and ancestry-cycle rules. Centralized exception handling returns structured errors. Flyway owns the database schema; Hibernate only validates it.

The frontend obtains a flat graph in one request, lays it out with ELK, and displays it as draggable React Flow nodes and edges. Search results center and select a node. The details panel derives relatives from edge records and supports editing, linking existing people, creating relatives, and removing links.

### Database model

- `family_trees`: independent tree roots and metadata.
- `people`: one row per person, keyed to exactly one tree. Only `first_name` is required.
- `parent_child_relationships`: directed edges with biological, adoptive, step, or other type.
- `partnerships`: logical undirected edges stored in canonical UUID order.

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
| `GET` | `/api/trees/{treeId}/graph` | Fetch people and all edges in one flat response |

Partnerships are explicit and never inferred from shared children. Parent-child links are rejected if they cross trees, duplicate an existing edge, self-link, or introduce an ancestry cycle.
