# JQZZ Development Guide

How to set up, develop, and contribute to JQZZ.

---

## Prerequisites

| Tool      | Version | Purpose                    |
|-----------|---------|----------------------------|
| Java      | 17+     | Backend runtime            |
| Maven     | 3.9+    | Backend build (or use `mvnw`) |
| Node.js   | 22+     | Frontend runtime           |
| npm       | 10+     | Package manager            |
| MySQL     | 8.0+    | Production database        |
| Docker    | 24+     | Containerized deployment   |

> **Tip**: Use `nvm` for Node and `sdkman` for Java version management.

---

## Local Development Setup

### 1. Backend

```bash
cd backend/jqzz

# First time: make mvnw executable (Linux/Mac)
chmod +x mvnw

# Run (uses a file-based H2 database in ./data, no setup needed)
./mvnw spring-boot:run

# Or build and run
./mvnw clean package -DskipTests
java -jar target/jqzz-0.0.1-SNAPSHOT.jar
```

The backend starts on **http://localhost:8080** with:
- REST API at `/quizzes`, `/users`, `/lobbies`, `/images`
- WebSocket at `/ws` (STOMP)
- Swagger UI at `/swagger-ui.html`

**Database**: By default the backend stores everything in a file-based H2 database at `backend/jqzz/data/` (git-ignored), so it runs with no database server and keeps data across restarts. Delete that folder to start fresh.

To use a local MySQL/MariaDB instead (`root` with no password on `localhost:3306/jqzzdb`, e.g. XAMPP), run with the `mysql` profile:
```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=mysql
```
Any other database can be set with `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME` and `SPRING_DATASOURCE_PASSWORD`.

### 2. Frontend

```bash
cd frontend

npm install
npm run dev
```

The dev server starts on **http://localhost:5173** with hot reload.

**API Proxy**: The frontend calls the API with relative paths and the Vite dev server proxies `/quizzes`, `/users`, `/lobbies`, `/game`, `/images` and `/ws` to `http://127.0.0.1:8080`. To proxy to another backend:
```bash
JQZZ_BACKEND_URL=http://localhost:9090 npm run dev
```
`VITE_API_BASE_URL` still exists to call a backend directly instead of through the proxy.

### 3. Running Both Together

```bash
# Terminal 1 — Backend
cd backend/jqzz && ./mvnw spring-boot:run

# Terminal 2 — Frontend
cd frontend && npm run dev
```

---

## Docker Development

```bash
# Build and run everything
docker-compose up --build

# Detached mode
docker-compose up -d --build

# Stop
docker-compose down

# Rebuild a single service
docker-compose build backend
docker-compose build frontend
```

---

## Available Scripts

### Frontend

| Command              | Description                          |
|----------------------|--------------------------------------|
| `npm run dev`        | Start Vite dev server with HMR       |
| `npm run build`      | Type-check + production build        |
| `npm run preview`    | Preview production build locally     |
| `npm run lint`       | Run ESLint                           |

### Backend

| Command                       | Description                    |
|-------------------------------|--------------------------------|
| `./mvnw spring-boot:run`      | Run in dev mode                |
| `./mvnw clean package`        | Build JAR                      |
| `./mvnw test`                 | Run unit/integration tests     |
| `./mvnw clean package -DskipTests` | Build without tests        |

---

## Code Conventions

### Frontend (TypeScript/React)

- **Functional components only** — No class components
- **Contexts for global state** — `AuthContext`, `QuizContext`, `WebSocketContext`
- **Hooks for reusable logic** — `useQuizzes`, `useQuizMutations`, `useDragAndDrop`, `useKeyboardShortcuts`
- **Services for API calls** — `quizService`, `userService`, `lobbyService`
- **CSS class naming** — Prefixed with `jqzz-` (e.g., `jqzz-dash`, `jqzz-sidebar`, `jqzz-main`)
- **TypeScript strict** — Use explicit types, avoid `any`
- **File naming** — PascalCase for components (`Dashboard.tsx`), camelCase for hooks/utils (`useQuizzes.ts`)

### Backend (Java/Spring Boot)

- **Lombok for boilerplate** — `@Entity` with manual getters/setters (Lombok available but not used everywhere)
- **Constructor injection** — No `@Autowired` on fields
- **Repository pattern** — Spring Data JPA repositories
- **Controller per resource** — `QuizController`, `UserController`, `LobbyController`, `GameController`, `ImageController`
- **Cascading** — `Quiz → Action → Question → Answer` with `CascadeType.ALL`

---

## Key Workflows

### Adding a New Quiz Phase

1. Add enum value to `Phase.java` (backend) and `types/index.ts` (frontend)
2. Add to `PHASE_FN_MAP` / `FN_PHASE_MAP` in `constants/phaseMaps.ts`
3. Add to `SNIPPETS` in `constants/snippets.ts` if applicable
4. Update `scriptParser.ts` and `scriptSerializer.ts` for text mode support
5. Add rendering in `VisualMode` / `ActionCard` components

### Adding a New API Endpoint

1. Create repository method in `src/main/java/.../repository/`
2. Add endpoint in appropriate `*Controller.java`
3. Add frontend service method in `src/services/*.ts`
4. Add TypeScript types in `src/types/index.ts` if needed

### Modifying WebSocket Behavior

1. Backend: Update controller or add `@MessageMapping` handler
2. Publish to topic via `SimpMessagingTemplate.convertAndSend()`
3. Frontend: Subscribe in `WebSocketContext` or component hooks
4. Handle message in subscription callback

---

## Testing

### Backend Tests

```bash
cd backend/jqzz
./mvnw test
```

Tests are in `src/test/java/com/lonezsi/jqzz/`. The project uses Spring Boot Test with `@SpringBootTest` and MockMvc.

### Frontend Tests

Currently no test runner is configured. To add Vitest:

```bash
cd frontend
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

Then add test scripts to `package.json`.

---

## Common Issues

### CORS Errors
In dev and Docker the API is same-origin through a proxy, so CORS doesn't apply. For direct calls the backend allows any `localhost` / `127.0.0.1` port; other origins need `CorsConfig.java`.

### WebSocket Connection Fails
- Ensure backend is running on port 8080
- Through the dev server it goes via the Vite proxy at `/ws`; check `vite.config.ts`
- SockJS falls back to HTTP long-polling if WebSocket is blocked

### Database Connection Refused
- Only happens with the `mysql` profile or a custom `SPRING_DATASOURCE_URL`: ensure that server is running
- Without either, the backend uses its built-in H2 file database

### Build Fails
- Frontend: Run `npm install` first, check Node.js version (22+)
- Backend: Ensure Java 17+, run `./mvnw clean install`

---

## Environment Variables

| Variable              | Default                          | Description          |
|-----------------------|----------------------------------|----------------------|
| `VITE_API_BASE_URL`   | *(empty: same origin)*           | Backend API URL      |
| `JQZZ_BACKEND_URL`    | `http://127.0.0.1:8080`          | Vite dev proxy target |
| `SPRING_DATASOURCE_URL` | `jdbc:h2:file:./data/jqzzdb`   | Database URL    |

---

## Git Workflow

- `main` — stable, production-ready
- Feature branches from `main`
- Conventional commits preferred
- No auto-deploys — manual `docker-compose up` for production
