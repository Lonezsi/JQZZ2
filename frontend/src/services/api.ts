import axios from "axios";

// Empty by default: requests go to the page's own origin, where the Vite dev
// proxy (or nginx in Docker) forwards them to the backend.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

/** Best human-readable message from an axios/network error. */
export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (typeof data === "string" && data.trim()) return data;
    if (data && typeof data === "object" && "message" in data && data.message) {
      return String(data.message);
    }
    if (!err.response) return "Can't reach the server";
    return `${err.response.status} ${err.response.statusText || "error"}`;
  }
  return err instanceof Error ? err.message : String(err);
}
