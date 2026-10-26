# JQZZ — Interactive Quiz Platform

**Joe Quizz with all the juestions for your janswers.**

JQZZ is a real-time, multiplayer quiz platform built for flexibility and speed. Create quizzes visually or via a text-based script language, host lobbies, and play with friends — all backed by WebSockets for immediate updates.

---

## Features

### Quiz Editor
- **Visual Mode** — Drag-and-drop action cards, snippet templates, multi-select with Ctrl/Shift
- **Text Mode** — A custom script language (`JQzz Script v1`) for authoring quizzes as plain text
- **Bidirectional** — Switch modes freely; text is the source of truth, visual is a live preview
- **Snippets** — Pre-built question templates (MC, True/False, Tier List, Lightning Round, etc.)

### Real-Time Multiplayer
- **Lobbies** — Create, join, and leave lobbies with real-time player lists
- **Game Flow** — Phased question delivery: Waiting → Question → Answer → Elaboration → Result
- **Timer Sync** — Admin-controlled timer broadcast via WebSocket
- **Scoring** — Live leaderboard updates

### Image System
- **Upload & Gallery** — Public, private, and semi-private image visibility
- **Reference Resolution** — Reference images as `handle` (public), `:handle` (self), or `user:handle` (other)

### User System
- **Anonymous by Default** — Auto-generated guest accounts, no forced registration
- **Persistent Sessions** — LocalStorage-based session restoration
- **Online Presence** — Real-time online/offline status via WebSocket

---

## Tech Stack

| Layer     | Technology                                      |
|-----------|------------------------------------------------|
| Frontend  | React 19, TypeScript, Vite 7, Zustand, STOMP   |
| Backend   | Spring Boot 4, Spring Data JPA, Lombok          |
| Database  | H2 file database (default), MySQL (Docker)      |
| Real-Time | STOMP over SockJS (WebSocket)                   |
| Deploy    | Docker, Docker Compose                          |

---

## Quick Start

### With Docker Compose (Production)

```bash
docker-compose up --build
```

Runs MySQL, the backend and the frontend (nginx proxies the API).

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:8080](http://localhost:8080)
- Swagger UI: [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)

### Without Docker (Development)

```bash
# Backend (requires Java 17+; no database server needed)
cd backend/jqzz
./mvnw spring-boot:run

# Frontend (requires Node.js 22+)
cd frontend
npm install
npm run dev
```

- Frontend dev server: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:8080](http://localhost:8080)

---

## Project Structure

```
JQZZ/
├── backend/jqzz/          # Spring Boot backend
│   ├── src/main/java/     # Java source
│   │   └── com/lonezsi/jqzz/
│   │       ├── config/    # CORS, WebSocket config
│   │       ├── controller/# REST + WS controllers
│   │       ├── model/     # JPA entities
│   │       ├── repository/# Spring Data repos
│   │       ├── service/   # Business logic
│   │       └── util/      # ID generation
│   ├── src/test/          # Backend tests
│   └── pom.xml            # Maven config
│
├── frontend/              # React + Vite app
│   ├── src/
│   │   ├── components/    # UI components
│   │   │   ├── Dashboard/ # Main layout (Sidebar, Main, RightPanel)
│   │   │   ├── Modals/    # Command palette, identity, images
│   │   │   └── common/    # Shared components
│   │   ├── contexts/      # Auth, Quiz, WebSocket contexts
│   │   ├── hooks/         # Custom hooks (DnD, shortcuts, quizzes)
│   │   ├── services/      # API clients, WebSocket service
│   │   ├── utils/         # Script parser, serializer, converters
│   │   ├── constants/     # Snippets, phase maps, commands
│   │   └── types/         # TypeScript type definitions
│   └── package.json
│
├── docker-compose.yml     # Multi-service orchestration
└── Makefile               # Build/dev shortcuts
```

---

## Keyboard Shortcuts

| Shortcut       | Action               |
|----------------|----------------------|
| `Ctrl/⌘ + K`  | Command Palette      |
| `Ctrl/⌘ + N`  | New Quiz             |
| `Ctrl/⌘ + E`  | Export Quiz (.txt)   |
| `Ctrl/⌘ + `` ` | Toggle Visual/Text  |
| `Ctrl/⌘ + A`  | Select All Actions   |
| `Escape`       | Close Modal/Palette  |
| `Click`        | Toggle action select |
| `Ctrl + Click` | Multi-select action  |
| `Shift + Click`| Range-select actions |

---

## License

Private project — see repository for details.
