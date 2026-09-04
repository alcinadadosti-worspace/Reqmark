/**
 * Cliente HTTP das rotas privilegiadas do backend (`/admin/*`).
 *
 * Tudo que muda `status` ou mexe no catalogo passa por aqui — as
 * `firestore.rules` proibem o cliente de fazer isso direto. O token vem do
 * `POST /admin/login` (PIN) e vive no `sessionStorage`.
 */
import { API_URL } from './env';
import type { AdminLoginResponse, DecisionPayload, ItemInput } from '@/shared/types';

const TOKEN_KEY = 'am:admin-token';
const EXPIRY_KEY = 'am:admin-token-expiry';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// --- Token ----------------------------------------------------------------

export function getAdminToken(): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const expiry = Number(sessionStorage.getItem(EXPIRY_KEY) ?? 0);
    if (!token || !expiry || Date.now() >= expiry) {
      clearAdminToken();
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function storeAdminToken(token: string, expiresAt: number): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(EXPIRY_KEY, String(expiresAt));
  } catch {
    /* sessionStorage bloqueado: a sessao dura enquanto a aba viver. */
  }
}

export function clearAdminToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXPIRY_KEY);
  } catch {
    /* ignora */
  }
}

// --- Requisicao base ------------------------------------------------------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = options;

  if (!API_URL) {
    throw new ApiError(0, 'no_api_url', 'VITE_API_URL não está configurada.');
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = getAdminToken();
    if (!token) {
      throw new ApiError(401, 'no_token', 'Sessão de administradora expirada. Informe o PIN de novo.');
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    // Causa mais comum: o servico gratuito do Render acordando (cold start).
    throw new ApiError(
      0,
      'network',
      'Não consegui falar com o servidor. Ele pode estar acordando — tente de novo em alguns segundos.'
    );
  }

  if (response.status === 401 || response.status === 403) {
    clearAdminToken();
  }

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    const error = payload as { error?: string; message?: string; details?: unknown } | null;
    throw new ApiError(
      response.status,
      error?.error ?? 'http_error',
      error?.message ?? `O servidor respondeu ${response.status}.`,
      error?.details
    );
  }

  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// --- Endpoints ------------------------------------------------------------

export const api = {
  /** Acorda o backend sem bloquear a interface (mitiga o cold start). */
  ping(): void {
    if (!API_URL) return;
    void fetch(`${API_URL}/health`, { method: 'GET', cache: 'no-store' }).catch(() => {});
  },

  login(pin: string): Promise<AdminLoginResponse> {
    return request<AdminLoginResponse>('/admin/login', {
      method: 'POST',
      body: { pin },
      auth: false,
    });
  },

  /** Confere se o token guardado ainda vale. */
  session(): Promise<{ ok: true; slackId: string; name: string }> {
    return request('/admin/session');
  },

  decide(requestId: string, payload: DecisionPayload): Promise<{ ok: true; status: string }> {
    return request(`/admin/requests/${requestId}/decision`, { method: 'POST', body: payload });
  },

  markReturned(requestId: string): Promise<{ ok: true }> {
    return request(`/admin/requests/${requestId}/return`, { method: 'POST' });
  },

  sendAdminMessage(requestId: string, text: string): Promise<{ ok: true }> {
    return request(`/admin/requests/${requestId}/messages`, { method: 'POST', body: { text } });
  },

  createItem(input: ItemInput): Promise<{ ok: true; id: string }> {
    return request('/admin/items', { method: 'POST', body: input });
  },

  updateItem(itemId: string, input: ItemInput): Promise<{ ok: true }> {
    return request(`/admin/items/${itemId}`, { method: 'PATCH', body: input });
  },

  deleteItem(itemId: string): Promise<{ ok: true }> {
    return request(`/admin/items/${itemId}`, { method: 'DELETE' });
  },

  updateSettings(input: {
    cities?: { name: string; state: string; lat: number; lng: number }[];
    purposeTypes?: string[];
    appUrl?: string;
  }): Promise<{ ok: true }> {
    return request('/admin/settings', { method: 'PATCH', body: input });
  },
};
