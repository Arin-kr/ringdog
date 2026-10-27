import { setRumUserFromToken } from "./datadogRum";

const TOKEN_KEY = "ringdog_token";

export function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  setRumUserFromToken(token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  setRumUserFromToken(null);
}

export function isLoggedIn(): boolean {
  return Boolean(getToken());
}
