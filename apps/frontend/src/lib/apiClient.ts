/**
 * Thin fetch wrapper for the backend-api service.
 *
 * TODO(M2): replace ad-hoc callers with real typed endpoints (products,
 * cart, orders, auth) as those pages get built out.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API request to ${path} failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}
