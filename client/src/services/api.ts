import type { ApiError } from '../types/common.ts';

// Configurable base URL: defaults to empty which triggers mock fallback mode
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || '';
export const USE_MOCKS = (import.meta.env.VITE_USE_MOCKS ?? 'true') === 'true' || !API_BASE_URL;

/**
 * Artificial latency simulation for realistic UI testing of loading/async states in mock mode.
 */
export async function simulateLatency(ms: number = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ApiService {
  private static token: string | null = null;

  public static setAuthToken(token: string | null): void {
    this.token = token;
  }

  public static getAuthToken(): string | null {
    return this.token;
  }

  private static getHeaders(customHeaders?: HeadersInit): Headers {
    const headers = new Headers(customHeaders);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.token) {
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
        headers: this.getHeaders(options.headers),
      });

      if (!response.ok) {
        let errorBody: Record<string, unknown> = {};
        try {
          errorBody = await response.json();
        } catch {
          // fallback to status text
        }

        const apiError: ApiError = {
          message: (errorBody.message as string) || response.statusText || 'An API error occurred',
          statusCode: response.status,
          details: errorBody,
        };
        throw apiError;
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if ((err as ApiError)?.message) {
        throw err;
      }
      const genericError: ApiError = {
        message: err instanceof Error ? err.message : 'Network request failed',
      };
      throw genericError;
    }
  }
}
