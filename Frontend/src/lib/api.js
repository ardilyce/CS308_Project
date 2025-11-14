export const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "http://127.0.0.1:8000";

export const apiUrl = (path = "") =>
  `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
