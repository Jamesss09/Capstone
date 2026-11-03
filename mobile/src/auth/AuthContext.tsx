import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { apiRequest } from '@/lib/api';

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
  user: AuthUser;
};

type LoginResponse = {
  token: string;
  expires_at: string | null;
  user: AuthUser;
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

async function loadStoredSession(): Promise<Session | null> {
  if (!(await secureStorageAvailable())) {
    return null;
  }

  const value = await SecureStore.getItemAsync(SESSION_KEY);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Session;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

async function storeSession(session: Session | null): Promise<void> {
  if (!(await secureStorageAvailable())) {
    return;
  }

  if (session) {
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

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    let active = true;

    async function restore() {
      try {
        const stored = await loadStoredSession();
        if (!stored || hasExpired(stored.expiresAt)) {
          await storeSession(null);
          return;
        }

        const user = await apiRequest<AuthUser>('/me', { token: stored.token });
        if (user.role !== 'Staff') {
          await storeSession(null);
          return;
        }

        if (active) {
          setSession({ ...stored, user });
        }
      } catch {
        await storeSession(null).catch(() => undefined);
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
  }, []);

  const signIn = useCallback(async (login: string, password: string, remember: boolean) => {
    const response = await apiRequest<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ login, password, remember }),
    });

    if (response.user.role !== 'Staff') {
      await apiRequest('/logout', {
        method: 'POST',
        token: response.token,
      }).catch(() => undefined);

      throw new Error('Administrator accounts sign in through the web portal.');
    }

    const nextSession: Session = {
      token: response.token,
      expiresAt: response.expires_at,
      user: response.user,
    };

    if (remember) {
      await storeSession(nextSession);
    } else {
      await storeSession(null);
    }

    setSession(nextSession);
  }, []);

  const signOut = useCallback(async () => {
    const currentToken = session?.token;
    setSession(null);
    await storeSession(null).catch(() => undefined);

    if (currentToken) {
      await apiRequest('/logout', {
        method: 'POST',
        token: currentToken,
      }).catch(() => undefined);
    }
  }, [session?.token]);

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
