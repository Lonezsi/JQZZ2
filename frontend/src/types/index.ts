export type Phase =
  | "WAITING"
  | "QUESTION"
  | "ANSWER"
  | "ELABORATION"
  | "RESULT"
  | "TEXT"
  | "DIVIDER";

export type EditorMode = "visual" | "text";
export type RightTab = "context" | "users";

export interface Answer {
  id: number;
  text: string;
  value: number;
  imageUrl?: string;
  userId?: string;
}

export interface Question {
  id: number;
  text: string;
  imageUrl?: string;
  elaborationText?: string;
  elaborationImageUrl?: string;
  type: string;
  userId?: string;
  answers: Answer[];
}

export interface Action {
  id: number;
  phase: Phase;
  time: number;
  question: Question | null; // null for TEXT/DIVIDER actions
  preview: string; // derived in UI
  orderIndex?: number;
}

export interface Quiz {
  id: number;
  name: string;
  authorId: string;
  actions: Action[];
}

export interface User {
  id: string;
  handle: string;
  name: string;
  password?: string;
  email?: string;
  profilePictureUrl?: string;
  online: boolean;
}

export interface SnippetStep {
  phase: Phase;
  time: number;
  preview: string;
}

export interface Snippet {
  id: string;
  name: string;
  color: string;
  steps: SnippetStep[];
}

export interface Command {
  icon: string;
  label: string;
  sub: string;
}

export type RenderItem =
  | { kind: "group"; question: Question; actions: Action[] }
  | { kind: "divider"; action: Action }
  | { kind: "text"; action: Action };

// API request/response types
export interface CreateQuizRequest {
  name: string;
  authorId: string;
  actions?: Action[];
}

export interface UpdateQuizRequest {
  name?: string;
  actions?: Action[];
  questions?: Question[];
}

export interface RegisterRequest {
  name: string;
}

export interface LoginRequest {
  id: string;
}

export interface LogoutRequest {
  id: string;
}

export interface UpdateHandleRequest {
  handle: string;
}

export interface UpdateNameRequest {
  name: string;
}
