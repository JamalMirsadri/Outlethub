import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  getCurrentUser,
  getAccessToken,
  logout as logoutRequest,
  refreshSession,
  setAccessToken,
  touchSessionActivity,
} from "@/services/auth.service";
import { HttpError } from "@/services/http";
import { AUTH_ACTIVITY_PING_INTERVAL_MS, AUTH_INACTIVITY_TIMEOUT_MS } from "@/config/session";
import type { AuthErrorState, AuthUser } from "@/types/auth";

interface LogoutOptions {
  shouldRedirect?: boolean;
  redirectTo?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  authError: AuthErrorState | null;
  appPublicSettings: null;
  authChecked: boolean;
  logout: (options?: LogoutOptions) => Promise<void>;
  navigateToLogin: (redirectTo?: string) => void;
  checkUserAuth: () => Promise<void>;
  checkAppState: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

const LAST_ACTIVITY_KEY = "outlethub_last_activity_at";
const LOGOUT_BROADCAST_KEY = "outlethub_logout_broadcast";

function mapHttpError(error: unknown): AuthErrorState {
  if (error instanceof HttpError) {
    if (error.status === 401) {
      return { type: "auth_required", message: error.message };
    }

    if (error.status === 403) {
      return { type: "forbidden", message: error.message };
    }

    return { type: "unknown", message: error.message };
  }

  return {
    type: "unknown",
    message: error instanceof Error ? error.message : "Unexpected authentication error.",
  };
}

function readLastActivityAt(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(LAST_ACTIVITY_KEY);
  if (!rawValue) {
    return null;
  }

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function persistLastActivityAt(timestamp: number): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
}

function clearLastActivityAt(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LAST_ACTIVITY_KEY);
}

function broadcastLogout(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOGOUT_BROADCAST_KEY, String(Date.now()));
}

function buildLoginUrl(redirectTo?: string): string {
  if (!redirectTo || redirectTo === "/login") {
    return "/login";
  }

  return `/login?redirect=${encodeURIComponent(redirectTo)}`;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<AuthErrorState | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const logoutTimerRef = useRef<number | null>(null);
  const lastServerActivityRef = useRef<number>(0);
  const activityPingPromiseRef = useRef<Promise<void> | null>(null);
  const isLoggingOutRef = useRef(false);

  const getActivePath = useCallback((): string => {
    const target = `${location.pathname}${location.search}${location.hash}`;
    return target === "/login" ? "/" : target;
  }, [location.hash, location.pathname, location.search]);

  const clearLogoutTimer = useCallback(() => {
    if (logoutTimerRef.current !== null) {
      window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  const resetAuthState = useCallback((broadcast = false) => {
    setAccessToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    setAuthChecked(true);
    clearLogoutTimer();
    clearLastActivityAt();
    lastServerActivityRef.current = 0;

    if (broadcast) {
      broadcastLogout();
    }
  }, [clearLogoutTimer]);

  const navigateToLogin = useCallback(
    (redirectTo?: string) => {
      const target = buildLoginUrl(redirectTo ?? getActivePath());
      navigate(target, { replace: true });
    },
    [getActivePath, navigate],
  );

  const logout = useCallback(
    async (options?: LogoutOptions): Promise<void> => {
      const shouldRedirect = options?.shouldRedirect ?? true;
      const redirectTo = options?.redirectTo ?? getActivePath();

      if (isLoggingOutRef.current) {
        return;
      }

      isLoggingOutRef.current = true;

      try {
        await logoutRequest();
      } finally {
        resetAuthState(true);
        isLoggingOutRef.current = false;

        if (shouldRedirect) {
          navigateToLogin(redirectTo);
        }
      }
    },
    [getActivePath, navigateToLogin, resetAuthState],
  );

  const scheduleAutoLogout = useCallback(
    (activityTimestamp?: number) => {
      clearLogoutTimer();

      if (!isAuthenticated) {
        return;
      }

      const lastActivityAt = activityTimestamp ?? readLastActivityAt() ?? Date.now();
      const remainingMs = AUTH_INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityAt);

      if (remainingMs <= 0) {
        void logout({ redirectTo: getActivePath() });
        return;
      }

      logoutTimerRef.current = window.setTimeout(() => {
        void logout({ redirectTo: getActivePath() });
      }, remainingMs);
    },
    [clearLogoutTimer, getActivePath, isAuthenticated, logout],
  );

  const syncServerActivity = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || isLoggingOutRef.current) {
      return;
    }

    const now = Date.now();
    if (activityPingPromiseRef.current || now - lastServerActivityRef.current < AUTH_ACTIVITY_PING_INTERVAL_MS) {
      return;
    }

    const redirectTo = getActivePath();
    activityPingPromiseRef.current = (async () => {
      try {
        await touchSessionActivity();
        lastServerActivityRef.current = Date.now();
      } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 401) {
          return;
        }

        try {
          const refreshed = await refreshSession();
          setUser(refreshed.user);
          setIsAuthenticated(true);
          setAuthChecked(true);
          setAuthError(null);
          lastServerActivityRef.current = Date.now();
        } catch {
          await logout({ redirectTo });
        }
      } finally {
        activityPingPromiseRef.current = null;
      }
    })();

    await activityPingPromiseRef.current;
  }, [getActivePath, isAuthenticated, logout]);

  const registerActivity = useCallback(
    (shouldSyncServer: boolean) => {
      if (!isAuthenticated || isLoggingOutRef.current) {
        return;
      }

      const timestamp = Date.now();
      persistLastActivityAt(timestamp);
      scheduleAutoLogout(timestamp);

      if (shouldSyncServer) {
        void syncServerActivity();
      }
    },
    [isAuthenticated, scheduleAutoLogout, syncServerActivity],
  );

  const checkUserAuth = useCallback(async (): Promise<void> => {
    setIsLoadingAuth(true);
    setAuthError(null);

    const lastActivityAt = readLastActivityAt();
    if (lastActivityAt && Date.now() - lastActivityAt >= AUTH_INACTIVITY_TIMEOUT_MS) {
      await logout({ shouldRedirect: false });
      setIsLoadingAuth(false);
      return;
    }

    try {
      let accessToken = getAccessToken();

      if (!accessToken) {
        const refreshed = await refreshSession();
        accessToken = refreshed.accessToken;
        setUser(refreshed.user);
        setIsAuthenticated(true);
        setAuthChecked(true);
        const now = Date.now();
        persistLastActivityAt(now);
        scheduleAutoLogout(now);
        lastServerActivityRef.current = now;
        return;
      }

      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthChecked(true);
      const now = Date.now();
      persistLastActivityAt(now);
      scheduleAutoLogout(now);
      lastServerActivityRef.current = now;
    } catch (initialError: unknown) {
      try {
        const refreshed = await refreshSession();
        setUser(refreshed.user);
        setIsAuthenticated(true);
        setAuthChecked(true);
        setAuthError(null);
        const now = Date.now();
        persistLastActivityAt(now);
        scheduleAutoLogout(now);
        lastServerActivityRef.current = now;
      } catch (refreshError: unknown) {
        resetAuthState(false);
        setAuthError(mapHttpError(refreshError ?? initialError));
      }
    } finally {
      setIsLoadingAuth(false);
    }
  }, [logout, resetAuthState, scheduleAutoLogout]);

  const checkAppState = useCallback(async (): Promise<void> => {
    await checkUserAuth();
  }, [checkUserAuth]);

  useEffect(() => {
    void checkAppState();
  }, [checkAppState]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearLogoutTimer();
      return;
    }

    scheduleAutoLogout();
  }, [clearLogoutTimer, isAuthenticated, scheduleAutoLogout]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    registerActivity(true);
  }, [isAuthenticated, location.pathname, location.search, registerActivity]);

  useEffect(() => {
    const handleBrowserActivity = () => {
      registerActivity(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        registerActivity(true);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_KEY && event.newValue) {
        const parsedValue = Number(event.newValue);
        if (Number.isFinite(parsedValue)) {
          scheduleAutoLogout(parsedValue);
        }
      }

      if (event.key === LOGOUT_BROADCAST_KEY && event.newValue) {
        resetAuthState(false);
        navigateToLogin();
      }
    };

    window.addEventListener("click", handleBrowserActivity);
    window.addEventListener("keydown", handleBrowserActivity);
    window.addEventListener("pointerdown", handleBrowserActivity);
    window.addEventListener("touchstart", handleBrowserActivity);
    window.addEventListener("outlethub:auth-activity", handleBrowserActivity as EventListener);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("click", handleBrowserActivity);
      window.removeEventListener("keydown", handleBrowserActivity);
      window.removeEventListener("pointerdown", handleBrowserActivity);
      window.removeEventListener("touchstart", handleBrowserActivity);
      window.removeEventListener("outlethub:auth-activity", handleBrowserActivity as EventListener);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [navigateToLogin, registerActivity, resetAuthState, scheduleAutoLogout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
    }),
    [
      user,
      isAuthenticated,
      isLoadingAuth,
      authError,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
