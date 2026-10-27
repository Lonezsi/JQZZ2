import { api } from "./api";
import type { Quiz, CreateQuizRequest, UpdateQuizRequest } from "../types";

export const quizService = {
  getAll: () => api.get<Quiz[]>("/quizzes"),
  getOne: (id: number) => api.get<Quiz>(`/quizzes/${id}`),
  create: (data: CreateQuizRequest) => api.post<Quiz>("/quizzes", data),
  update: (id: number, data: UpdateQuizRequest) =>
    api.put<Quiz>(`/quizzes/${id}`, data),
  /** only its author may: the server checks */
  delete: (id: number, userId: string) => api.delete(`/quizzes/${id}`, { headers: { "X-User-Id": userId } }),
};
