import { api } from "./api";
import type { Quiz, CreateQuizRequest, UpdateQuizRequest } from "../types";

export const quizService = {
  getAll: () => api.get<Quiz[]>("/quizzes"),
  getOne: (id: number) => api.get<Quiz>(`/quizzes/${id}`),
  create: (data: CreateQuizRequest) => api.post<Quiz>("/quizzes", data),
  update: (id: number, data: UpdateQuizRequest) =>
    api.put<Quiz>(`/quizzes/${id}`, data),
  delete: (id: number) => api.delete(`/quizzes/${id}`),
};
