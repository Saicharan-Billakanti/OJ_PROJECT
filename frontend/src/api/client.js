import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("oj_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on session expiry. Only applies to requests that were actually
// authenticated (carried a token) — a 401 from /auth/login on a wrong
// password is a normal validation error, not a session expiry, and must not
// trigger this (that page shows the error inline instead).
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const hadToken = Boolean(error.config?.headers?.Authorization);
    if (error.response?.status === 401 && hadToken) {
      localStorage.removeItem("oj_token");
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

export default client;
