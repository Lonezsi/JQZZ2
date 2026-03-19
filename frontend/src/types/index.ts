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
  userId?: string; // for user‑generated answers
}

export interface Question {
  id: number;
  text: string;
  imageUrl?: string;
  elaborationText?: string;
  elaborationImageUrl?: string;
  type: string; // matches QuestionType enum
  userId?: string;
  answers: Answer[];
}

export interface Action {
  id: number;
  phase: Phase;
  time: number;
  questionId: number;
  preview: string;
  orderIndex?: number;
}

export interface Quiz {
  id: number;
  name: string;
  authorId: string; // references user id
  actions: Action[];
  questions: Question[]; // derived or provided by backend
}

// Backend User model
export interface User {
  id: string;
  handle: string;
  name: string;
  password?: string;
  email?: string;
  profilePictureUrl?: string;
  online: boolean;
}

// For sidebar identity display (subset)
export type Identity = Pick<User, "id" | "name" | "handle">;

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
  | { kind: "group"; questionId: number; actions: Action[] }
  | { kind: "divider"; action: Action }
  | { kind: "text"; action: Action };

// API request/response types
export interface CreateQuizRequest {
  name: string;
}

export interface UpdateQuizRequest {
  name?: string;
  actions?: Action[];
  questions?: Question[];
}

export interface RegisterRequest {
  name: string;
}

export interface RegisterResponse {
  userId: string;
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
