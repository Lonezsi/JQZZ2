import { api } from "./api";

export interface CreateLobbyRequest {
  name: string;
  adminId: string;
}

export interface JoinLobbyRequest {
  userId: string;
}

export const lobbyService = {
  getAll: () => api.get("/lobbies"),
  getOne: (lobbyId: number) => api.get(`/lobbies/${lobbyId}`),
  create: (data: CreateLobbyRequest) => api.post("/lobbies", data),
  join: (lobbyId: number, userId: string) =>
    api.post(`/lobbies/${lobbyId}/join`, { userId }),
  leave: (lobbyId: number, userId: string) =>
    api.post(`/lobbies/${lobbyId}/leave`, { userId }),
  delete: (lobbyId: number) => api.delete(`/lobbies/${lobbyId}`),
};

// Game controller endpoints
export const gameService = {
  start: (lobbyId: number) => api.post(`/game/${lobbyId}/start`),
  next: (lobbyId: number) => api.post(`/game/${lobbyId}/next`),
};
