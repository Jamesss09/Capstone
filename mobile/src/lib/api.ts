import { fetch as expoFetch } from 'expo/fetch';
import { type File } from 'expo-file-system';

const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_URL = (configuredUrl || 'http://10.0.2.2:8000/api').replace(/\/$/, '');

type ValidationErrors = Record<string, string[] | string>;

type ErrorPayload = {
  message?: string;
  errors?: ValidationErrors;
};

type FileUploadOptions = {
  token?: string;
  fieldName: string;
  mimeType: string;
  parameters?: Record<string, string>;
};

type ApiRequestOptions = RequestInit & {
  token?: string;
};

type ApiAuthHandlers = {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  onSessionExpired: () => Promise<void> | void;
};

export type MobileTokenResponse<TUser> = {
  token: string;
  expires_at: string | null;
  refresh_token: string;
  refresh_expires_at: string;
  user: TUser;
};

let authHandlers: ApiAuthHandlers | null = null;
let refreshInFlight: Promise<string> | null = null;
let expirationInFlight: Promise<void> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function firstValidationMessage(errors?: ValidationErrors): string | null {
  if (!errors) {
    return null;
  }

  for (const value of Object.values(errors)) {
    if (Array.isArray(value) && value[0]) {
      return value[0];
    }

    if (typeof value === 'string' && value) {
      return value;
    }
  }

  return null;
}

function responseError(payload: ErrorPayload, status: number, fallback: string): ApiError {
  return new ApiError(
    firstValidationMessage(payload.errors) || payload.message || fallback,
    status,
  );
}

function currentToken(fallback?: string): string | undefined {
  if (!fallback) {
    return undefined;
  }

  return authHandlers?.getAccessToken() ?? fallback;
}

async function expireSession(): Promise<void> {
  if (!authHandlers) {
    return;
  }

  expirationInFlight ??= Promise.resolve(authHandlers.onSessionExpired()).finally(() => {
    expirationInFlight = null;
  });

  await expirationInFlight;
}

async function refreshAccessToken(): Promise<string> {
  if (!authHandlers) {
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }

  refreshInFlight ??= authHandlers
    .refreshAccessToken()
    .then((token) => {
      if (!token) {
        throw new ApiError('Your session has expired. Please sign in again.', 401);
      }

      return token;
    })
    .catch(async (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        await expireSession();
        throw new ApiError('Your session has expired. Please sign in again.', 401);
      }

      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export function configureApiAuth(handlers: ApiAuthHandlers): () => void {
  authHandlers = handlers;

  return () => {
    if (authHandlers === handlers) {
      authHandlers = null;
    }
  };
}

async function fetchJson<T>(
  path: string,
  options: ApiRequestOptions,
  token?: string,
): Promise<{ payload: T & ErrorPayload; status: number; ok: boolean }> {
  const { token: _ignoredToken, headers, ...requestOptions } = options;
  const isMultipart =
    typeof FormData !== 'undefined' && requestOptions.body instanceof FormData;

  let response: Response;

  try {
    response = await expoFetch(`${API_URL}${path}`, {
      ...requestOptions,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(isMultipart ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch (error) {
    const reason = error instanceof Error && error.message ? ` (${error.message})` : '';

    throw new ApiError(
      `Unable to reach ${path}. Check your Wi-Fi and mobile API address${reason}`,
      0,
    );
  }

  return {
    payload: (await response.json().catch(() => ({}))) as T & ErrorPayload,
    status: response.status,
    ok: response.ok,
  };
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const bearer = currentToken(options.token);
  let response = await fetchJson<T>(path, options, bearer);

  if (response.status === 401 && bearer && authHandlers) {
    const refreshedToken = await refreshAccessToken();
    response = await fetchJson<T>(path, options, refreshedToken);

    if (response.status === 401) {
      await expireSession();
    }
  }

  if (!response.ok) {
    throw responseError(response.payload, response.status, 'The request could not be completed.');
  }

  return response.payload;
}

async function uploadFile<T>(
  path: string,
  file: File,
  options: FileUploadOptions,
  token?: string,
): Promise<{ payload: T & ErrorPayload; status: number }> {
  const formData = new FormData();

  for (const [key, value] of Object.entries(options.parameters ?? {})) {
    formData.append(key, value);
  }

  formData.append(options.fieldName, file, file.name || 'answer-sheet');

  let response: Response;

  try {
    // FileSystemUploadTask.start can be rejected by Expo Go before the
    // request reaches Laravel. Expo SDK 58 documents File as a Blob, so use
    // expo/fetch + FormData for a normal multipart request instead.
    response = await expoFetch(`${API_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
  } catch (error) {
    const reason = error instanceof Error && error.message ? ` (${error.message})` : '';

    throw new ApiError(
      `Unable to reach ${path}. Check your Wi-Fi and mobile API address${reason}`,
      0,
    );
  }

  let payload: T & ErrorPayload;

  try {
    payload = (await response.json()) as T & ErrorPayload;
  } catch {
    payload = {} as T & ErrorPayload;
  }

  return { payload, status: response.status };
}

export async function apiUploadFile<T>(
  path: string,
  file: File,
  options: FileUploadOptions,
): Promise<T> {
  const bearer = currentToken(options.token);
  let result = await uploadFile<T>(path, file, options, bearer);

  if (result.status === 401 && bearer && authHandlers) {
    const refreshedToken = await refreshAccessToken();
    result = await uploadFile<T>(path, file, options, refreshedToken);

    if (result.status === 401) {
      await expireSession();
    }
  }

  if (result.status < 200 || result.status >= 300) {
    throw responseError(result.payload, result.status, 'The upload could not be completed.');
  }

  return result.payload;
}
