import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Pressable, Text } from 'react-native';

import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { apiRequest, configureApiAuth } from '@/lib/api';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  isAvailableAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');

  return {
    ...actual,
    apiRequest: jest.fn(),
    configureApiAuth: jest.fn(),
  };
});

const user = {
  id: 5,
  username: 'staff-user',
  email: 'staff@example.com',
  full_name: 'Staff User',
  role: 'Staff' as const,
  is_active: true,
  last_login: null,
};

const tokens = {
  token: 'access-token',
  expires_at: '2099-01-01T00:15:00Z',
  refresh_token: 'refresh-token',
  refresh_expires_at: '2099-01-08T00:00:00Z',
  user,
};

function AuthProbe() {
  const { isRestoring, signIn, signOut, token, user: currentUser } = useAuth();

  return (
    <>
      <Text testID="state">
        {isRestoring ? 'restoring' : currentUser ? `${currentUser.username}:${token}` : 'signed-out'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remember sign in"
        onPress={() => void signIn('staff-user', 'password', true)}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Session sign in"
        onPress={() => void signIn('staff-user', 'password', false)}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={() => void signOut()}
      />
    </>
  );
}

describe('<AuthProvider />', () => {
  let authHandlers: {
    getAccessToken: () => string | null;
    refreshAccessToken: () => Promise<string | null>;
    onSessionExpired: () => Promise<void> | void;
  } | null = null;

  beforeEach(() => {
    authHandlers = null;
    jest.mocked(apiRequest).mockReset();
    jest.mocked(configureApiAuth).mockReset();
    jest.mocked(configureApiAuth).mockImplementation((handlers) => {
      authHandlers = handlers;
      return jest.fn();
    });
    jest.mocked(SecureStore.isAvailableAsync).mockResolvedValue(true);
    jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue(null);
    jest.mocked(SecureStore.setItemAsync).mockReset().mockResolvedValue(undefined);
    jest.mocked(SecureStore.deleteItemAsync).mockReset().mockResolvedValue(undefined);
  });

  test('persists a rotating mobile session when Remember Me is enabled', async () => {
    jest.mocked(apiRequest).mockResolvedValue(tokens);
    await render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    expect(await screen.findByText('signed-out')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Remember sign in' }));

    expect(await screen.findByText('staff-user:access-token')).toBeTruthy();
    expect(apiRequest).toHaveBeenCalledWith('/login', {
      method: 'POST',
      body: JSON.stringify({
        login: 'staff-user',
        password: 'password',
        remember: true,
        client: 'mobile',
      }),
    });
    const storedValue = jest.mocked(SecureStore.setItemAsync).mock.calls.at(-1)?.[1];
    expect(JSON.parse(storedValue ?? '{}')).toEqual(
      expect.objectContaining({
        token: 'access-token',
        refreshToken: 'refresh-token',
        remember: true,
      }),
    );
  });

  test('keeps a non-remembered refresh token in memory only', async () => {
    jest.mocked(apiRequest).mockResolvedValue(tokens);
    await render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    expect(await screen.findByText('signed-out')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Session sign in' }));

    expect(await screen.findByText('staff-user:access-token')).toBeTruthy();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });

  test('refreshes and restores a remembered session after its access token expires', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({
        token: 'expired-access',
        expiresAt: '2000-01-01T00:00:00Z',
        refreshToken: 'stored-refresh',
        refreshExpiresAt: '2099-01-08T00:00:00Z',
        user,
        remember: true,
      }),
    );
    jest.mocked(apiRequest).mockResolvedValue(tokens);

    await render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('staff-user:access-token')).toBeTruthy();
    expect(apiRequest).toHaveBeenCalledWith('/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: 'stored-refresh' }),
    });
    expect(authHandlers?.getAccessToken()).toBe('access-token');
  });

  test('centrally clears an invalid session and revokes tokens on logout', async () => {
    jest.mocked(apiRequest).mockResolvedValue(tokens);
    await render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    expect(await screen.findByText('signed-out')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Remember sign in' }));
    expect(await screen.findByText('staff-user:access-token')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText('signed-out')).toBeTruthy();
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/mobile/logout', {
        method: 'POST',
        body: JSON.stringify({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
        }),
      });
    });

    await authHandlers?.onSessionExpired();
    expect(screen.getByText('signed-out')).toBeTruthy();
  });
});
