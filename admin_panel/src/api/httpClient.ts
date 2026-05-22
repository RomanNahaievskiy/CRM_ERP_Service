const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api";

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;

export async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${apiBaseUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status} ${response.statusText}: ${body}`);
  }

  return response.json() as Promise<T>;
}
