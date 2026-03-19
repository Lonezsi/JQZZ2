import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// TODO evaluate to add auth token interceptor or not
