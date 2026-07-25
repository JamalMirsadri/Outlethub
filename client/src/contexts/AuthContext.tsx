import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  getCurrentUser,
  getAccessToken,
  logout as logoutRequest,
  refreshSession,
  setAccessToken,
} from "@/services/auth.service";
import { HttpError } from "@/services/http";
import type { AuthErrorState, AuthUser } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  authError: AuthErrorState | null;
  appPublicSettings: null;
  authChecked: boolean;
  logout: (shouldRedirect?: boolean) => Promise<void>;
  navigateToLogin: () => void;
  checkUserAuth: () => Promise<void>;
  checkAppState: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

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

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<AuthErrorState | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const checkUserAuth = useCallback(async (): Promise<void> => {
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      let accessToken = getAccessToken();

      if (!accessToken) {
        const refreshed = await refreshSession();
        accessToken = refreshed.accessToken;
        setUser(refreshed.user);
        setIsAuthenticated(true);
        setAuthChecked(true);
        return;
      }

      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthChecked(true);
    } catch (initialError: unknown) {
      try {
        const refreshed = await refreshSession();
        setUser(refreshed.user);
        setIsAuthenticated(true);
        setAuthChecked(true);
        setAuthError(null);
      } catch (refreshError: unknown) {
        setAccessToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        setAuthError(mapHttpError(refreshError ?? initialError));
      }
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const checkAppState = useCallback(async (): Promise<void> => {
    await checkUserAuth();
  }, [checkUserAuth]);

  const logout = useCallback(
    async (shouldRedirect = true): Promise<void> => {
      await logoutRequest();
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      setAuthChecked(true);

      if (shouldRedirect) {
        navigate("/login");
      }
    },
    [navigate],
  );

  const navigateToLogin = useCallback(() => {
    navigate("/login");
  }, [navigate]);

  useEffect(() => {
    void checkAppState();
  }, [checkAppState]);

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
