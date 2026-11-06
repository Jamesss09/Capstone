import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';

import {
  ApiError,
  apiRequest,
  configureApiAuth,
  type MobileTokenResponse,
} from '@/lib/api';

const SESSION_KEY = 'code-nexus.staff-session';

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'Administrator' | 'Staff';
  is_active: boolean;
  last_login: string | null;
};

type Session = {
  token: string;
  expiresAt: string | null;
  refreshToken: string;
  refreshExpiresAt: string;
  user: AuthUser;
  remember: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isRestoring: boolean;
  signIn: (login: string, password: string, remember: boolean) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function secureStorageAvailable(): Promise<boolean> {
  return Platform.OS !== 'web' && SecureStore.isAvailableAsync();
}

function isStoredSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<Session>;

  return (
    typeof session.token === 'string' &&
    (session.expiresAt === null || typeof session.expiresAt === 'string') &&
    typeof session.refreshToken === 'string' &&
    typeof session.refreshExpiresAt === 'string' &&
    session.user?.role === 'Staff' &&
    session.remember === true
  );
}

async function loadStoredSession(): Promise<Session | null> {
  if (!(await secureStorageAvailable())) {
    return null;
  }

  const value = await SecureStore.getItemAsync(SESSION_KEY);
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (isStoredSession(parsed)) {
      return parsed;
    }
  } catch {
    // Invalid or legacy session data is removed below.
  }

  await SecureStore.deleteItemAsync(SESSION_KEY);
  return null;
}

async function storeSession(session: Session | null): Promise<void> {
  if (!(await secureStorageAvailable())) {
    return;
  }

  if (session?.remember) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return;
  }

  await SecureStore.deleteItemAsync(SESSION_KEY);
}

function hasExpired(expiresAt: string | null): boolean {
  return expiresAt !== null && Date.parse(expiresAt) <= Date.now();
}

function sessionFromResponse(
  response: MobileTokenResponse<AuthUser>,
  remember: boolean,
): Session {
  return {
    token: response.token,
    expiresAt: response.expires_at,
    refreshToken: response.refresh_token,
    refreshExpiresAt: response.refresh_expires_at,
    user: response.user,
    remember,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const sessionRef = useRef<Session | null>(null);

  const commitSession = useCallback(async (nextSession: Session | null) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
    await storeSession(nextSession);
  }, []);

  const refreshCurrentSession = useCallback(async (): Promise<string | null> => {
    const current = sessionRef.current;
    if (!current || hasExpired(current.refreshExpiresAt)) {
      return null;
    }

    const response = await apiRequest<MobileTokenResponse<AuthUser>>('/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: current.refreshToken }),
    });

    if (response.user.role !== 'Staff') {
      return null;
    }

    const nextSession = sessionFromResponse(response, current.remember);
    await commitSession(nextSession);
    return nextSession.token;
  }, [commitSession]);

  useEffect(() => {
    return configureApiAuth({
      getAccessToken: () => sessionRef.current?.token ?? null,
      refreshAccessToken: refreshCurrentSession,
      onSessionExpired: () => commitSession(null).catch(() => undefined),
    });
  }, [commitSession, refreshCurrentSession]);

  useEffect(() => {
    let active = true;

    async function restore() {
      try {
        const stored = await loadStoredSession();
        if (!stored || hasExpired(stored.refreshExpiresAt)) {
          await commitSession(null);
          return;
        }

        sessionRef.current = stored;
        if (active) {
          setSession(stored);
        }

        if (hasExpired(stored.expiresAt)) {
          await refreshCurrentSession();
          return;
        }

        const user = await apiRequest<AuthUser>('/me', { token: stored.token });
        const current = sessionRef.current;
        if (user.role !== 'Staff' || !current) {
          await commitSession(null);
          return;
        }

        await commitSession({ ...current, user });
      } catch (error) {
        // Keep a remembered session during temporary network outages. A
        // definitive 401 is cleared centrally by the API session handler.
        if (error instanceof ApiError && error.status === 401) {
          await commitSession(null).catch(() => undefined);
        }
      } finally {
        if (active) {
          setIsRestoring(false);
        }
      }
    }

    void restore();

    return () => {
      active = false;
    };
  }, [commitSession, refreshCurrentSession]);

  const signIn = useCallback(
    async (login: string, password: string, remember: boolean) => {
      const response = await apiRequest<MobileTokenResponse<AuthUser>>('/login', {
        method: 'POST',
        body: JSON.stringify({ login, password, remember, client: 'mobile' }),
      });

      if (response.user.role !== 'Staff') {
        await apiRequest('/mobile/logout', {
          method: 'POST',
          body: JSON.stringify({
            access_token: response.token,
            refresh_token: response.refresh_token,
          }),
        }).catch(() => undefined);

        throw new Error('Administrator accounts sign in through the web portal.');
      }

      await commitSession(sessionFromResponse(response, remember));
    },
    [commitSession],
  );

  const signOut = useCallback(async () => {
    const current = sessionRef.current;
    await commitSession(null).catch(() => undefined);

    if (current) {
      await apiRequest('/mobile/logout', {
        method: 'POST',
        body: JSON.stringify({
          access_token: current.token,
          refresh_token: current.refreshToken,
        }),
      }).catch(() => undefined);
    }
  }, [commitSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isRestoring,
      signIn,
      signOut,
    }),
    [isRestoring, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return value;
}
