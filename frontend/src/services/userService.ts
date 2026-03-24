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
  delete: (id: string) => api.delete(`/users/${id}`),
  getAll: () => api.get<User[]>("/users"),
  getOne: (id: string) => api.get<User>(`/users/${id}`),
};
