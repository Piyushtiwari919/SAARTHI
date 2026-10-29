import type { ApiError } from '../types/common.ts';

// Configurable base URL: defaults to empty (uses Vite dev proxy / reverse proxy) or environment variable
export const API_BASE_URL =
  (import.meta.env?.VITE_API_BASE_URL as string) ||
  (import.meta.env?.VITE_API_URL as string) ||
  '';

// Explicit development-only mock mode switch.
// Real API mode is the strict default; mock fixtures are used ONLY when explicitly enabled.
export const USE_MOCKS =
  import.meta.env?.VITE_USE_MOCKS === 'true' ||
  import.meta.env?.VITE_ENABLE_MOCK_FALLBACK === 'true';

/**
 * Artificial latency simulation for realistic UI testing of loading/async states in mock mode.
 */
export async function simulateLatency(ms: number = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TOKEN_STORAGE_KEY = 'saarthi_auth_token';

export class ApiService {
  private static token: string | null =
    typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_STORAGE_KEY) : null;

  public static setAuthToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
  }

  public static getAuthToken(): string | null {
    return this.token;
  }

  private static getHeaders(body?: BodyInit | null, customHeaders?: HeadersInit): Headers {
    const headers = new Headers(customHeaders);

    // Only set Content-Type to application/json if body is NOT FormData.
    // The browser must automatically set Content-Type with boundary for FormData.
    if (!(body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (this.token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    return headers;
  }

  public static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include', // Sends HttpOnly cookie cross-origin and locally
        headers: this.getHeaders(options.body, options.headers),
      });

      if (!response.ok) {
        let errorBody: Record<string, unknown> = {};
        try {
          errorBody = await response.json();
        } catch {
          // Fallback to status text
        }

        if (response.status === 401) {
          // If unauthenticated or token expired, clear cached token
          this.setAuthToken(null);
        }

        const apiError: ApiError = {
          message:
            (errorBody.message as string) ||
            response.statusText ||
            'An error occurred while communicating with the server',
          statusCode: response.status,
          details: (errorBody.details || errorBody.errors || errorBody) as Record<string, unknown>,
        };
        throw apiError;
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null as unknown as T;
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if ((err as ApiError)?.message) {
        throw err;
      }
      const genericError: ApiError = {
        message: err instanceof Error ? err.message : 'Network request failed. Is the server running?',
      };
      throw genericError;
    }
  }
}
