"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import { ApiError } from "@/lib/api-client";
import { authService } from "@/services/auth.service";
import type { AuthenticatedUser, LoginRequest } from "@/types/auth";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthState {
  user: AuthenticatedUser | null;
  status: AuthStatus;
  error: string | null;
  isLoggingOut: boolean;
}

export type AuthAction =
  | { type: "INITIALIZED"; user: AuthenticatedUser | null }
  | { type: "AUTHENTICATED"; user: AuthenticatedUser }
  | { type: "ERROR"; message: string }
  | { type: "LOGOUT_STARTED" }
  | { type: "LOGGED_OUT" };

export const initialAuthState: AuthState = {
  user: null,
  status: "loading",
  error: null,
  isLoggingOut: false,
};

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "INITIALIZED":
      return {
        ...state,
        user: action.user,
        status: action.user ? "authenticated" : "unauthenticated",
        error: null,
      };
    case "AUTHENTICATED":
      return {
        ...state,
        user: action.user,
        status: "authenticated",
        error: null,
      };
    case "ERROR":
      return { ...state, error: action.message };
    case "LOGOUT_STARTED":
      return { ...state, isLoggingOut: true };
    case "LOGGED_OUT":
      return {
        user: null,
        status: "unauthenticated",
        error: null,
        isLoggingOut: false,
      };
  }
}

interface AuthContextValue extends AuthState {
  login: (payload: LoginRequest) => Promise<AuthenticatedUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function messageFrom(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "NexaPOS could not complete the request.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);
  const initializationStarted = useRef(false);

  const refreshUser = useCallback(async () => {
    try {
      const response = await authService.me();
      dispatch({ type: "INITIALIZED", user: response.data.user });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        dispatch({ type: "INITIALIZED", user: null });
        return;
      }
      dispatch({ type: "INITIALIZED", user: null });
      dispatch({ type: "ERROR", message: messageFrom(error) });
    }
  }, []);

  useEffect(() => {
    if (initializationStarted.current) return;
    initializationStarted.current = true;
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (payload: LoginRequest) => {
    try {
      const response = await authService.login(payload);
      dispatch({ type: "AUTHENTICATED", user: response.data.user });
      return response.data.user;
    } catch (error) {
      dispatch({ type: "ERROR", message: messageFrom(error) });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    dispatch({ type: "LOGOUT_STARTED" });
    try {
      await authService.logout();
    } finally {
      dispatch({ type: "LOGGED_OUT" });
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      refreshUser,
      clearError: () => dispatch({ type: "ERROR", message: "" }),
    }),
    [login, logout, refreshUser, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
