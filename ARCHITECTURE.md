# JQZZ Architecture

Technical deep-dive into the JQZZ system.

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React)                      │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ AuthCtx   │  │ QuizCtx  │  │ WebSocketCtx         │  │
│  │ (user)    │  │ (quizzes │  │ (STOMP/SockJS)       │  │
│  │           │  │  + CRUD) │  │                      │  │
│  └─────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │
│        │              │                   │              │
│  ┌─────┴──────────────┴───────────────────┴───────────┐  │
│  │                Dashboard Layout                     │  │
│  │  ┌─────────┐  ┌──────────┐  ┌───────────────────┐  │  │
│  │  │ Sidebar │  │   Main   │  │    Right Panel     │  │  │
│  │  │ (nav,   │  │ (visual/ │  │ (context editor,  │  │  │
│  │  │  quiz   │  │  text    │  │  users tab)       │  │  │
│  │  │  list)  │  │  mode)   │  │                   │  │  │
│  │  └─────────┘  └──────────┘  └───────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          │ HTTP/REST   │ STOMP/WS    │
          │ (Axios)     │ (SockJS)    │
          └──────┬──────┘──────┬──────┘
                 │             │
┌────────────────┴─────────────┴───────────────────────────┐
│                   Backend (Spring Boot)                    │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │ REST Controllers│  │ WS Handler   │  │ Image Service │  │
│  │ Quiz, User,   │  │ (STOMP       │  │ (upload,      │  │
│  │ Lobby, Image  │  │  messages)   │  │  resolve)     │  │
│  └──────┬───────┘  └───────┬───────┘  └───────┬───────┘  │
│         │                  │                   │          │
│  ┌──────┴──────────────────┴───────────────────┴───────┐  │
│  │              Spring Data JPA (Hibernate)             │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │                                 │
│  ┌──────────────────────┴──────────────────────────────┐  │
│  │                    MySQL / H2                         │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

---

## Backend Architecture

### Entity Model

```
Quiz (1) ──── (*) Action
                │
                ├─── (1) Question (*)
                │              │
                │              └── (*) Answer
                │
                └── Phase enum: WAITING | QUESTION | ANSWER | ELABORATION | RESULT

User (1) ──── (*) Quiz        (via authorId string)
Lobby (*) ── (1) Quiz         (via quiz_id FK)
Lobby (1) ── (*) Player       (Embeddable record)
Image        (standalone)     (public/private/semi-private)
```

### REST API Endpoints

| Method | Path                   | Description              |
|--------|------------------------|--------------------------|
| GET    | `/quizzes`             | List all quizzes         |
| GET    | `/quizzes/{id}`        | Get quiz by ID           |
| POST   | `/quizzes`             | Create quiz              |
| PUT    | `/quizzes/{id}`        | Update quiz              |
| DELETE | `/quizzes/{id}`        | Delete quiz              |
| POST   | `/users/register`      | Register user            |
| POST   | `/users/login`         | Login (set online)       |
| POST   | `/users/logout`        | Logout (set offline)     |
| GET    | `/users`               | List all users           |
| GET    | `/users/{id}`          | Get user by ID           |
| PATCH  | `/users/{id}`          | Update user profile      |
| DELETE | `/users/{id}`          | Delete user              |
| GET    | `/lobbies`             | List all lobbies         |
| POST   | `/lobbies`             | Create lobby             |
| POST   | `/lobbies/{id}/join`   | Join lobby               |
| POST   | `/lobbies/{id}/leave`  | Leave lobby              |
| DELETE | `/lobbies/{id}`        | Delete lobby             |
| POST   | `/game/{id}/start`     | Start game               |
| POST   | `/game/{id}/next`      | Next action              |
| POST   | `/images/upload`       | Upload image             |
| GET    | `/images/resolve`      | Resolve image reference  |
| GET    | `/images/{id}`         | Get image data           |
| GET    | `/images`              | List accessible images   |
| DELETE | `/images/{id}`         | Delete image             |

### WebSocket Topics

| Topic                  | Events                          |
|------------------------|---------------------------------|
| `/topic/users`         | `user_registered`, `user_logged_in`, `user_logged_out`, `user_updated` |
| `/topic/lobbies`       | `lobby_created`, `lobby_deleted` |
| `/topic/lobby/{id}`    | `players_update`, `quiz_started`, `action`, `timer_update` |

### Message Mapping

| Destination              | Handler                  |
|--------------------------|--------------------------|
| `/app/lobby/{id}/timer`  | `GameController.timerUpdate` |

---

## Frontend Architecture

### Context Hierarchy

```
<AuthProvider>                    — User state, login/register/logout
  <WebSocketProvider>             — STOMP client, subscribe()
    <QuizProvider>                — Quiz CRUD, selection, mode, rendering
      <App />                    — <Dashboard /> → Sidebar | Main | RightPanel
    </QuizProvider>
  </WebSocketProvider>
</AuthProvider>
```

### Data Flow

1. **On Load**: `AuthContext` restores user from `localStorage`, or auto-registers a guest
2. **Quiz Fetch**: `QuizContext` → `useQuizzes` hook → `quizService.getAll()` → populates state
3. **Edits**: UI actions → `useQuizMutations` → local state update → debounced auto-save (1s) → `quizService.update()`
4. **Real-Time**: WebSocket subscriptions → context listeners → state updates → re-render

### Script Language (JQzz Script v1)

The text mode uses a custom DSL for quiz authoring:

```
# Questions are defined first
NewQuestion Q1 (
  prompt: "What is the capital of France?",
  type: "prewritten-single",
  elaboration: "Paris has been the capital since the 10th century.",
  answers: [
    { text: "Paris", value: 100 },
    { text: "London", value: 0 },
  ],
)

# Actions reference questions
ShowWaiting(Q1, time: 10)
ShowQuestion(Q1, time: 30)
ShowAnswers(Q1, time: 15)
ShowResult(Q1, time: 10)

# Dividers and text blocks
---
Any line becomes a text note block
```

**Parser**: `scriptParser.ts` — parses text → `{ questions, actions, errors }`
**Serializer**: `scriptSerializer.ts` — serializes `Quiz` → text script
**Bidirectional sync**: Edit in text → see in visual; edit in visual → save triggers debounce

---

## State Management

### Frontend State

| State                 | Location          | Storage     |
|-----------------------|-------------------|-------------|
| Current user          | `AuthContext`      | localStorage (userId only) |
| Active quiz ID        | `QuizContext`      | React state |
| All quizzes           | `QuizContext`      | React state + auto-save to API |
| Selection             | `QuizContext`      | React state (Set\<number\>)  |
| Editor mode           | `QuizContext`      | React state (visual/text)  |
| WebSocket connection  | `WebSocketContext` | React state |
| Command palette open  | `Dashboard`        | Local useState |
| Identity modal open   | `Dashboard`        | Local useState |

### Backend State

- **Stateless REST** — Every request is independent
- **WebSocket presence** — `User.online` flag persisted to DB on login/logout
- **Lobby state** — `Lobby.currentActionIndex`, `Lobby.time`, `Lobby.players` persisted to DB

---

## Key Design Decisions

### 1. Text as Source of Truth
The `scriptSerializer.ts` generates the canonical quiz representation. Visual mode is a derived view. This means:
- Parse errors in text mode are surfaced but don't lose data
- Visual edits are serializable back to text

### 2. Optimistic Local State
Quiz mutations update React state immediately, then debounce-save to the backend. This gives instant UI feedback but means:
- Unsaved changes exist briefly in memory
- Browser refresh loses changes made in the last ~1 second

### 3. ID Generation
- **Backend IDs**: MySQL auto-increment (Long) for Quiz, Action, Question, Answer
- **Frontend IDs**: `Date.now() * 1000 + counter` for new client-side entities
- **User IDs**: 10-char random alphanumeric string from `IdGenerator.generateId()`

### 4. No Authentication
Users are identified by string ID, not by session tokens. The `beforeunload` beacon calls `/users/logout` to set `online: false`. This is intentional for zero-friction usage but means:
- No CSRF protection
- Any client can modify any user/quiz

### 5. Cascading Deletes
`Quiz → Action → Question → Answer` uses `CascadeType.ALL`, so deleting a quiz removes all children. The `Question.quiz` back-reference has `@JsonIgnore` to prevent infinite recursion.

---

## Database Schema (Key Tables)

```sql
-- Core quiz data
Quiz        (id: Long PK, name, author_id: String)
Action      (id: Long PK, quiz_id: FK, question_id: FK, phase: Enum, time: Int, order_index: Int)
Question    (id: Long PK, quiz_id: FK, text, image_url, type: Enum, user_id: String, ...)
Answer      (id: Long PK, question_id: FK, text, answer_value: Int, image_url, user_id: String)

-- Users
app_user    (id: String PK, handle: Unique, name, password, email, profile_picture_url, online: Boolean)

-- Multiplayer
Lobby       (id: Long PK, name, admin_id: Long, quiz_id: FK, current_action_index: Int, time: Int)
Player      (Embeddable: user_id, score) → lobby_players

-- Images
app_image   (id: Long PK, handle, owner_id: String, visibility: Enum, data: BLOB, mime_type, created_at)
```
