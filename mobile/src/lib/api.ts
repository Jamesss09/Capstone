const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_URL = (configuredUrl || 'http://10.0.2.2:8000/api').replace(/\/$/, '');

type ValidationErrors = Record<string, string[] | string>;

type ErrorPayload = {
  message?: string;
  errors?: ValidationErrors;
};

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

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...requestOptions } = options;

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...requestOptions,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError(
      'Unable to reach the server. Check your Wi-Fi and mobile API address.',
      0,
    );
  }

  const payload = (await response.json().catch(() => ({}))) as T & ErrorPayload;

  if (!response.ok) {
    throw new ApiError(
      firstValidationMessage(payload.errors) || payload.message || 'The request could not be completed.',
      response.status,
    );
  }

  return payload;
}
