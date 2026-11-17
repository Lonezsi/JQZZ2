import { api } from "./api";
import type {
  User,
  RegisterRequest,
  LoginRequest,
  UpdateHandleRequest,
  UpdateNameRequest,
} from "../types";

export const userService = {
  register: (data: RegisterRequest) => api.post<User>("/users/register", data),
  login: (data: LoginRequest) => api.post<User>("/users/login", data),
  logout: (id: string) => api.post("/users/logout", { id }),
  updateHandle: (id: string, data: UpdateHandleRequest) =>
    api.post<User>(`/users/${id}/handle`, data),
  updateName: (id: string, data: UpdateNameRequest) =>
    api.post<User>(`/users/${id}/name`, data),
  update: (id: string, data: Partial<User>) =>
    api.post<User>(`/users/${id}/update`, data),
  /** only the account itself may: the server checks */
  delete: (id: string) => api.delete(`/users/${id}`, { headers: { "X-User-Id": id } }),
  getAll: () => api.get<User[]>("/users"),
  getOne: (id: string) => api.get<User>(`/users/${id}`),
  /** the account tied to that Google sign-in, or a new one made from it */
  googleLogin: (credential: string) => api.post<User>("/users/google/login", { credential }),
  /** tie this account to the Google account that just signed in */
  googleLink: (id: string, credential: string) => api.post<User>(`/users/${id}/google`, { credential }),
  googleUnlink: (id: string) => api.delete<User>(`/users/${id}/google`),
  /** who Foyer says this browser is, or null */
  foyerWho: () => api.get<{ foyer: { handle: string; name: string } | null }>("/users/foyer"),
  /** the account tied to whoever is signed in on Foyer, or a new one made from it (401: nobody) */
  foyerLogin: () => api.post<User>("/users/foyer/login"),
  /** tie this account to whoever is signed in on Foyer */
  foyerLink: (id: string) => api.post<User>(`/users/${id}/foyer`),
  foyerUnlink: (id: string) => api.delete<User>(`/users/${id}/foyer`),
};
