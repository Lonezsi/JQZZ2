# JQZZ - Interactive Quiz Platform

## Philosophy

JQZZ is built around a simple idea: give people freedom to create quizzes without boxing them into rigid systems, while still keeping things stable under the hood.

---

## Core Values

1. **Source of Truth**
   Text is the source of truth. Everything should work in both visual and text mode, but text is the final version. Parsing should never delete or corrupt data.

2. **Progressive Enhancement**
   You should be able to start simple and add complexity later. Basic quizzes work out of the box, advanced stuff is optional.

3. **Real-time by Default**
   Multiplayer should feel immediate. WebSockets aren’t an extra, they’re part of the core.

4. **User Ownership**
   Users own what they make. Quizzes, images, snippets — all tied to them and saved across sessions.

5. **Graceful Failure**
   When something breaks, show it clearly, but don’t lose data. Errors shouldn’t block progress.

6. **Context-Aware Interactions**
   Shortcuts, drag-and-drop, and UI behavior should only trigger when they actually make sense.

7. **Minimal Prop Drilling**
   Share state through context when needed. Keep components simple and focused.

8. **Users Are Optional**
   No forced accounts, no required passwords. Users can be anonymous, temporary, or persistent.
   Less friction → more interaction.

9. **Flexibility Over Safety**
   The system isn’t overly strict. It allows loose structures and flexible formats. That makes it more powerful, even if it’s a bit less controlled.

10. **Simple Backend, Complex Behavior**
    The backend stays simple: basic models, direct logic, event broadcasting.
    More complex behavior comes from how things are combined, not from heavy backend logic.

---

## Development Roadmap

### Phase 1: Foundation & Architecture ✓

- [x] Backend Spring Boot setup with JPA
- [x] WebSocket configuration for real-time updates
- [x] Basic user authentication/registration
- [x] Quiz CRUD operations
- [x] Lobby creation and joining
- [x] Basic action phases (WAITING, QUESTION, ANSWER, ELABORATION, RESULT)
- [x] Visual mode with drag-and-drop
- [x] Text mode with script editor
- [x] Basic right panel with Context/Users tabs
- [x] Navigation panel with Home button

### Phase 2: Context & State Management (Current)

- [ ] **Use context to reduce prop drilling**
  - [ ] Create QuizEditorContext for editor-specific state
  - [ ] Create SelectionContext for multi-selection logic
  - [ ] Create DragAndDropContext for drag operations
  - [ ] Refactor Dashboard to use contexts instead of prop drilling
- [ ] **Make users persistent**
  - [ ] Implement proper localStorage sync with backend
  - [ ] Handle session restoration on page reload
  - [ ] Auto-login for returning users
  - [ ] Guest user cleanup after inactivity
- [ ] **Make quizzes persistent**
  - [ ] Auto-save on every change (debounced)
  - [ ] Prevent data loss on accidental navigation
  - [ ] Version history or undo/redo?
  - [ ] Sync between tabs/windows
- [ ] **Make user online/offline update properly**
  - [ ] WebSocket presence events
  - [ ] Heartbeat mechanism
  - [ ] Clean disconnect handling
  - [ ] Show online status in Users tab
- [ ] **Make quizzes treat text as source of truth**
  - [ ] Bidirectional sync between visual and text modes
  - [ ] Never lose data on parse errors (keep raw text)
  - [ ] Highlight parse errors in editor
  - [ ] Allow editing even with errors
- [ ] **Make an error layer for UI visibility**
  - [ ] Global error boundary component
  - [ ] Toast notification system
  - [ ] Error context for component-level errors
  - [ ] Non-blocking error display
  - [ ] Error recovery suggestions

### Phase 3: Image System

- [ ] **Make image pickers and image upload things**
  - [ ] ImageUploadModal with URL and file upload tabs
  - [ ] ImagePicker component for selecting existing images
  - [ ] Image preview in question/answer editors
  - [ ] Gallery of accessible images (public + user's)
  - [ ] Reference resolution (public:, private:, username:)
  - [ ] Image deletion with confirmation

### Phase 4: Multiplayer & Lobbies

- [ ] **Make lobbies**
  - [ ] Lobby list in sidebar with real-time updates
  - [ ] Create lobby with quiz selection
  - [ ] Join lobby by code
  - [ ] Lobby waiting room with player list
  - [ ] Admin controls (kick, start game)
  - [ ] Real-time player join/leave notifications
- [ ] **Make run quiz actually work**
  - [ ] Game controller integration
  - [ ] Timer synchronization
  - [ ] Question display for players
  - [ ] Answer submission
  - [ ] Scoring system
  - [ ] Leaderboard updates
  - [ ] Quiz completion flow
- [ ] **Make questions appear for non-admin users**
  - [ ] Separate admin view from player view
  - [ ] Real-time question distribution
  - [ ] Answer locking after timeout
  - [ ] Different UI for players vs admin

### Phase 5: Snippets & Shortcuts

- [ ] **Make snippets user-specific**
  - [ ] Save custom snippets to backend
  - [ ] Load user snippets on login
  - [ ] Share snippets (public/private)
  - [ ] Snippet categories/tags
- [ ] **Make users able to save quizzes as snippets**
  - [ ] Extract quiz sections as reusable snippets
  - [ ] Save selected actions as snippet
  - [ ] Snippet library management
  - [ ] Drag snippets from library to editor
- [ ] **Make key shortcuts actually work contextually**
  - [ ] Command palette (Cmd/Ctrl+K)
  - [ ] New quiz (Cmd/Ctrl+N)
  - [ ] Toggle mode (Cmd/Ctrl+`)
  - [ ] Export (Cmd/Ctrl+E)
  - [ ] Select all (Cmd/Ctrl+A)
  - [ ] Escape to close modals
  - [ ] Prevent shortcuts in text inputs
  - [ ] Show shortcut hints in tooltips

### Phase 6: Polish & Optimization

- [ ] Performance optimization
  - [ ] Virtual scrolling for long action lists
  - [ ] Lazy loading for images
  - [ ] Debounced saves
  - [ ] Memoized components
- [ ] Accessibility
  - [ ] ARIA labels
  - [ ] Keyboard navigation
  - [ ] Screen reader support
  - [ ] Focus management
- [ ] Mobile responsiveness
  - [ ] Collapsible sidebars
  - [ ] Touch-friendly drag-and-drop
  - [ ] Responsive layouts
- [ ] Testing
  - [ ] Unit tests for utilities
  - [ ] Component tests with Vitest
  - [ ] Integration tests for flows
  - [ ] E2E tests with Playwright

## Completed Features

### Backend

- ✅ User registration and login
- ✅ Quiz CRUD operations
- ✅ Lobby management
- ✅ WebSocket real-time updates
- ✅ Image system with public/private/semi-private visibility
- ✅ Image reference resolution (public, :handle, username:handle)
- ✅ Comprehensive test coverage (55+ tests)

### Frontend

- ✅ Dashboard layout with three-column design
- ✅ Sidebar with identity, quizzes, and snippets
- ✅ Visual mode with action cards and drag-and-drop
- ✅ Text mode with script editor and syntax highlighting
- ✅ Right panel with context editor and users tab
- ✅ Auto-switch to Users tab when no action selected
- ✅ Home button navigation
- ✅ Keyboard shortcuts (Cmd+K, Cmd+N, Cmd+`, Cmd+E)
- ✅ Image upload modal
- ✅ Identity modal with profile picture upload
- ✅ WebSocket connection with error handling

## Development Guidelines

### Code Organization

1. **Components**: Keep components focused and under 300 lines
2. **Contexts**: Use for global state, avoid for UI-only state
3. **Hooks**: Extract reusable logic, testable independently
4. **Services**: API calls, WebSocket, localStorage

### State Management Philosophy

- Local UI state → useState
- Shared component state → lifted to nearest parent
- Global app state → Context
- Server state → React Query (or similar) - not implemented yet

### Error Handling

1. Catch at service level, display at UI level
2. Never silently fail
3. Provide recovery options when possible
4. Log errors for debugging

### Testing

- Test business logic, not implementation details
- Mock external dependencies
- Test error cases as much as success cases
- Keep tests independent and fast

## Next Priority Tasks

1. **Implement QuizEditorContext** to eliminate prop drilling in Dashboard
2. **Add auto-save** for quizzes with debounced saves
3. **Improve error handling** with toast notifications
4. **Complete image picker** integration in question/answer editors
5. **Implement lobby list** in sidebar with WebSocket updates

---

**Last Updated**: March 26, 2026
**Current Phase**: Phase 2 - Context & State Management
