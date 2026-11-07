export type Phase =
  | "WAITING"
  | "QUESTION"
  | "ANSWER"
  | "ELABORATION"
  | "RESULT"
  | "TEXT"
  | "DIVIDER"
  /** switches quiz settings for what follows; preview holds "shuffle=on, points=2" */
  | "SETTING"
  /** who's coming: preview holds {"names": [...], "unique": true}; never played */
  | "ROSTER";

export type ImageVisibility = "PUBLIC" | "PRIVATE" | "SEMI_PRIVATE";

export type EditorMode = "visual" | "text";
export type RightTab = "context" | "users";

export interface Answer {
  id: number;
  text: string;
  value: number;
  imageUrl?: string;
  userId?: string;
  /** the other half of a pair, for "match" questions */
  match?: string;
}

export interface Question {
  id: number;
  text: string;
  imageUrl?: string;
  elaborationText?: string;
  elaborationImageUrl?: string;
  /** the server's stored name for its mode: the preset's, or the nearest one (questionTypes: typeIdOf) */
  type: string;
  /** what players do and how it scores, "draw/votes" (questionTypes: modeOf); without it, the type says */
  mode?: string | null;
  userId?: string;
  answers: Answer[];
  /** extra fields, "unit=m, min=0, max=100" (questionTypes: parseOptions) */
  options?: string;
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
  /** from the list: steps and question texts only; the whole quiz loads when it's opened */
  summary?: boolean;
}

export interface User {
  id: string;
  handle: string;
  name: string;
  password?: string;
  email?: string;
  profilePictureUrl?: string;
  online: boolean;
  /** tied to a Google account: it can be signed into anywhere, not just this browser */
  googleLinked?: boolean;
  /** only ever sent to the account itself: what logs it in */
  loginKey?: string;
  /** the admin account, which can open #/admin */
  admin?: boolean;
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
  | { kind: "setting"; action: Action }
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
  /** the account's login key */
  key?: string;
  /** an account from before login keys, once: it's given one */
  id?: string;
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
