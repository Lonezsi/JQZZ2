import { create } from "zustand";

export type Phase =
  | "WAITING"
  | "QUESTION"
  | "ANSWER"
  | "ELABORATION"
  | "RESULT";

export type QuestionType =
  | "PREWRITTEN_SINGLE"
  | "PREWRITTEN_MULTIPLE"
  | "USER_GENERATED"
  | "USER_GENERATED_VOTE"
  | "USER_GENERATED_IDENTIFY"
  | "TIERLIST"
  | "KNOCKOUT_BATTLE";

export interface Player {
  userId: string;
  name?: string;
  score: number;
}

export interface AnswerOption {
  id: number;
  text: string;
  value: number;
  imageUrl?: string;
  userId?: string;
}

export interface Question {
  id: number;
  text: string;
  imageUrl?: string | null;
  elaborationText?: string | null;
  elaborationImageUrl?: string | null;
  type?: QuestionType;
  userId?: string;
  answers?: AnswerOption[];
}

export interface Action {
  id?: number;
  orderIndex?: number;
  phase: Phase;
  time: number;
  question?: Question;
}

interface GameState {
  lobbyId?: string;
  lobbyAdminId?: number;
  userId?: number;
  userName?: string;
  players: Player[];
  currentAction?: Action | null;
  timer: number;
  errorMessage?: string;
  setLobbyId: (id?: string) => void;
  setLobbyAdminId: (adminId?: number) => void;
  setUserId: (id?: number) => void;
  setUserName: (name?: string) => void;
  setPlayers: (p: Player[]) => void;
  setAction: (a?: Action | null) => void;
  setTimer: (t: number) => void;
  setErrorMessage: (message?: string) => void;
}

export const useGameStore = create<GameState>((set) => ({
  lobbyId: undefined,
  lobbyAdminId: undefined,
  userId: undefined,
  userName: undefined,
  players: [],
  currentAction: null,
  timer: 0,
  errorMessage: undefined,
  setLobbyId: (id) => set({ lobbyId: id }),
  setLobbyAdminId: (adminId) => set({ lobbyAdminId: adminId }),
  setUserId: (id) => set({ userId: id }),
  setUserName: (name) => set({ userName: name }),
  setPlayers: (p) => set({ players: p }),
  setAction: (a) => set({ currentAction: a, timer: a?.time ?? 0 }),
  setTimer: (t) => set({ timer: t }),
  setErrorMessage: (message) => set({ errorMessage: message }),
}));

export default useGameStore;
