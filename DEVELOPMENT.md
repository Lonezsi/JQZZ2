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

# Run with dev profile (uses H2 in-memory database)
./mvnw spring-boot:run

# Or build and run
./mvnw clean package -DskipTests
java -jar target/jqzz-0.0.1-SNAPSHOT.jar
```

The backend starts on **http://localhost:8080** with:
- REST API at `/quizzes`, `/users`, `/lobbies`, `/images`
- WebSocket at `/ws` (STOMP)
- Swagger UI at `/swagger-ui.html`

**Database**: By default connects to MySQL (`localhost:3306/jqzzdb`). For local dev without MySQL, you can switch to H2 by adding to `application.properties`:
```properties
spring.datasource.url=jdbc:h2:mem:testdb
spring.datasource.driverClassName=org.h2.Driver
spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
```

### 2. Frontend

```bash
cd frontend

npm install
npm run dev
```

The dev server starts on **http://localhost:5173** with hot reload.

**API Proxy**: The frontend calls `http://127.0.0.1:8080` by default. Override with:
```bash
VITE_API_BASE_URL=http://localhost:8080 npm run dev
```

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
The backend allows `localhost:5173`, `localhost:3000`, and `127.0.0.1:5173`. If you use a different port, update `CorsConfig.java`.

### WebSocket Connection Fails
- Ensure backend is running on port 8080
- Check `WebSocketContext.tsx` — it hardcodes `http://127.0.0.1:8080/ws`
- SockJS falls back to HTTP long-polling if WebSocket is blocked

### Database Connection Refused
- Ensure MySQL is running with a `jqzzdb` database
- Or switch to H2 in-memory by modifying `application.properties`

### Build Fails
- Frontend: Run `npm install` first, check Node.js version (22+)
- Backend: Ensure Java 17+, run `./mvnw clean install`

---

## Environment Variables

| Variable              | Default                          | Description          |
|-----------------------|----------------------------------|----------------------|
| `VITE_API_BASE_URL`   | `http://127.0.0.1:8080`         | Backend API URL      |
| `SPRING_DATASOURCE_URL` | `jdbc:mysql://localhost:3306/jqzzdb` | Database URL    |

---

## Git Workflow

- `main` — stable, production-ready
- Feature branches from `main`
- Conventional commits preferred
- No auto-deploys — manual `docker-compose up` for production
