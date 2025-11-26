import axios from "axios";

export const ACCESS_TOKEN_KEY = "accessToken";
export const REFRESH_TOKEN_KEY = "refreshToken";
export const USER_KEY = "authUser";

export function setAuthHeader(accessToken) {
  if (accessToken) {
    axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }
}

export function persistTokens({ access, refresh } = {}) {
  if (access) {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    setAuthHeader(access);
  }
  if (refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
}

export function persistUser(user) {
  if (!user) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("Failed to parse stored user", err);
    return null;
  }
}

export function hydrateAuthFromStorage() {
  const access = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  const user = getStoredUser();
  
  // Always call setAuthHeader to ensure proper initialization
  // This clears any stale headers when there's no token
  setAuthHeader(access || null);
  
  return { access, refresh, user };
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  setAuthHeader(null);
}

// Setup axios interceptor to handle 401 errors (expired/invalid tokens)
// This ensures the app recovers gracefully when tokens become invalid
export function setupAxiosInterceptors() {
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      
      // If we get a 401 Unauthorized and haven't retried yet
      if (error.response && error.response.status === 401 && !originalRequest._retry) {
        const hadToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        
        if (hadToken) {
          // Mark this request as retried to prevent infinite loops
          originalRequest._retry = true;
          
          // Clear the invalid session
          clearSession();
          console.warn("Session cleared due to invalid/expired token, retrying request...");
          
          // Remove the Authorization header from the original request
          delete originalRequest.headers.Authorization;
          
          // Retry the request without the invalid token
          return axios(originalRequest);
        }
      }
      return Promise.reject(error);
    }
  );
}
