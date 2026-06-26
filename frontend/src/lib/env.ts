// Centralized resolution of the API base URL.
//
// - In Docker, VITE_API_URL is empty → use relative paths so requests go
//   through the same-origin nginx gateway (REST at /api, socket at /socket.io).
// - For local `npm run dev`, default to the gateway at http://localhost:8080.

const rawEnv = (import.meta.env.VITE_API_URL ?? '').trim();

function resolveBaseUrl(): string {
  if (rawEnv) return rawEnv.replace(/\/+$/, '');
  // Empty env: in dev default to the gateway; in a built app use same origin.
  if (import.meta.env.DEV) return 'http://localhost:8080';
  return '';
}

// Base URL used for REST + socket. Empty string means "same origin".
export const API_BASE_URL = resolveBaseUrl();

// Origin the socket connects to. Empty string lets socket.io-client use the
// current page origin (correct behind the same-origin nginx gateway).
export const SOCKET_URL = API_BASE_URL;
