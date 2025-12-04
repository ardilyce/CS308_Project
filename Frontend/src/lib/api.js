export const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "http://127.0.0.1:8000";

export const apiUrl = (path = "") =>
  `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

/**
 * Resolve media/image URLs to absolute paths.
 * If the URL is relative (starts with /), prepend the API_BASE.
 * If it's already absolute (http/https) or null, return as-is.
 */
export const mediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
};