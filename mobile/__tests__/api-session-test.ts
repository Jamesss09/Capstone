import { fetch as expoFetch } from 'expo/fetch';
import { type File } from 'expo-file-system';
import { waitFor } from '@testing-library/react-native';

import { ApiError, apiRequest, apiUploadFile, configureApiAuth } from '@/lib/api';

jest.mock('expo/fetch', () => ({
  fetch: jest.fn(),
}));

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Awaited<ReturnType<typeof expoFetch>>;
}

describe('mobile API session handling', () => {
  let cleanupAuth: (() => void) | null = null;

  beforeEach(() => {
    jest.mocked(expoFetch).mockReset();
  });

  afterEach(() => {
    cleanupAuth?.();
    cleanupAuth = null;
  });

  test('refreshes an expired access token and retries the request once', async () => {
    const refreshAccessToken = jest.fn().mockResolvedValue('fresh-token');
    const onSessionExpired = jest.fn();
    cleanupAuth = configureApiAuth({
      getAccessToken: () => 'expired-token',
      refreshAccessToken,
      onSessionExpired,
    });
    jest.mocked(expoFetch)
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthenticated.' }))
      .mockResolvedValueOnce(jsonResponse(200, { job: { id: 7, status: 'Completed' } }));

    await expect(apiRequest('/omr-jobs/7', { token: 'expired-token' })).resolves.toEqual({
      job: { id: 7, status: 'Completed' },
    });

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(jest.mocked(expoFetch).mock.calls[1]?.[1]?.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer fresh-token' }),
    );
  });

  test('deduplicates refresh across concurrent requests', async () => {
    let finishRefresh: (token: string) => void = () => undefined;
    const refreshAccessToken = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          finishRefresh = resolve;
        }),
    );
    cleanupAuth = configureApiAuth({
      getAccessToken: () => 'expired-token',
      refreshAccessToken,
      onSessionExpired: jest.fn(),
    });
    jest.mocked(expoFetch).mockImplementation(async (_url, options) => {
      const headers = options?.headers as Record<string, string>;
      return headers.Authorization === 'Bearer fresh-token'
        ? jsonResponse(200, { ok: true })
        : jsonResponse(401, { message: 'Unauthenticated.' });
    });

    const first = apiRequest('/me', { token: 'expired-token' });
    const second = apiRequest('/folders', { token: 'expired-token' });

    await waitFor(() => {
      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    });
    finishRefresh('fresh-token');

    await expect(Promise.all([first, second])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  test('clears the session when the refresh token is invalid', async () => {
    const onSessionExpired = jest.fn();
    cleanupAuth = configureApiAuth({
      getAccessToken: () => 'expired-token',
      refreshAccessToken: jest.fn().mockRejectedValue(new ApiError('Invalid refresh token.', 401)),
      onSessionExpired,
    });
    jest.mocked(expoFetch).mockResolvedValue(
      jsonResponse(401, { message: 'Unauthenticated.' }),
    );

    await expect(apiRequest('/me', { token: 'expired-token' })).rejects.toMatchObject({
      status: 401,
      message: 'Your session has expired. Please sign in again.',
    });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  test('retries a multipart upload with the refreshed token and unchanged idempotency data', async () => {
    const refreshAccessToken = jest.fn().mockResolvedValue('fresh-token');
    cleanupAuth = configureApiAuth({
      getAccessToken: () => 'expired-token',
      refreshAccessToken,
      onSessionExpired: jest.fn(),
    });
    jest.mocked(expoFetch)
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthenticated.' }))
      .mockResolvedValueOnce(jsonResponse(201, { job: { id: 9 } }));
    const file = new Blob(['image-bytes'], { type: 'image/jpeg' }) as unknown as File;
    Object.defineProperty(file, 'name', { value: 'answer-sheet.jpg' });
    const parameters = { submission_uuid: 'd8bf7409-4b34-4459-a0c8-a37c6260a953' };

    await expect(
      apiUploadFile('/sheets/upload', file, {
        token: 'expired-token',
        fieldName: 'image',
        mimeType: 'image/jpeg',
        parameters,
      }),
    ).resolves.toEqual({ job: { id: 9 } });

    expect(expoFetch).toHaveBeenCalledTimes(2);

    const firstRequest = jest.mocked(expoFetch).mock.calls[0]?.[1];
    const firstBody = firstRequest?.body as FormData;
    expect(firstBody.get('submission_uuid')).toBe(parameters.submission_uuid);
    expect(firstBody.get('image')).toEqual(
      expect.objectContaining({ name: 'answer-sheet.jpg', type: 'image/jpeg', size: 11 }),
    );
    expect(firstRequest?.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer expired-token' }),
    );

    const secondRequest = jest.mocked(expoFetch).mock.calls[1]?.[1];
    const secondBody = secondRequest?.body as FormData;
    expect(secondBody.get('submission_uuid')).toBe(parameters.submission_uuid);
    expect(secondBody.get('image')).toEqual(
      expect.objectContaining({ name: 'answer-sheet.jpg', type: 'image/jpeg', size: 11 }),
    );
    expect(secondRequest?.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer fresh-token' }),
    );
  });
});
