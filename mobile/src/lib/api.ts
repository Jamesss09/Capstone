import { fetch as expoFetch } from 'expo/fetch';
import { type File, UploadType } from 'expo-file-system';

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

  const payload = (await response.json().catch(() => ({}))) as T & ErrorPayload;

  if (!response.ok) {
    throw new ApiError(
      firstValidationMessage(payload.errors) || payload.message || 'The request could not be completed.',
      response.status,
    );
  }

  return payload;
}

export async function apiUploadFile<T>(
  path: string,
  file: File,
  options: FileUploadOptions,
): Promise<T> {
  let result;

  try {
    result = await file.upload(`${API_URL}${path}`, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: options.fieldName,
      mimeType: options.mimeType,
      parameters: options.parameters,
      sessionType: 'foreground',
      headers: {
        Accept: 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
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
    payload = JSON.parse(result.body) as T & ErrorPayload;
  } catch {
    payload = {} as T & ErrorPayload;
  }

  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(
      firstValidationMessage(payload.errors) || payload.message || 'The upload could not be completed.',
      result.status,
    );
  }

  return payload;
}
