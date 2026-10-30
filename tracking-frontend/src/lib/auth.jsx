import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, onUnauthorized, setAuthToken } from './api.js';

// sessionStorage keeps the session to this tab and ends it when the tab closes.
const TOKEN_KEY = 'campus.session.token';

const AuthContext = createContext(null);

function readStoredToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token) {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode); the session lasts until reload.
  }
}

export function isAdmin(user) {
  return user?.role === 'ADMIN';
}

export function isFaculty(user) {
  return user?.role === 'FACULTY';
}

export function homePathFor(user) {
  return isAdmin(user) ? '/admin' : '/app';
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => {
    const token = readStoredToken();
    setAuthToken(token);
    return { status: token ? 'loading' : 'anonymous', user: null, token, notice: null };
  });

  const clearSession = useCallback((notice = null) => {
    storeToken(null);
    setAuthToken(null);
    setState({ status: 'anonymous', user: null, token: null, notice });
  }, []);

  useEffect(() => {
    onUnauthorized(() => clearSession('Your session has ended. Please sign in again.'));
    return () => onUnauthorized(null);
  }, [clearSession]);

  // The role shown in the UI always comes from the server's /me response, never from the token.
  useEffect(() => {
    if (state.status !== 'loading') return;
    let cancelled = false;
    api.me()
      .then((user) => {
        if (!cancelled) setState((s) => ({ ...s, status: 'authenticated', user }));
      })
      .catch((error) => {
        if (cancelled) return;
        if (error.status === 401 || error.status === 403) clearSession();
        else setState((s) => ({ ...s, status: 'error', notice: error.message }));
      });
    return () => {
      cancelled = true;
    };
  }, [state.status, clearSession]);

  const startSession = useCallback((response) => {
    storeToken(response.token);
    setAuthToken(response.token);
    setState({ status: 'authenticated', user: response.user, token: response.token, notice: null });
    return response.user;
  }, []);

  const login = useCallback(async (email, password) => startSession(await api.login(email, password)), [startSession]);

  const register = useCallback(async (details) => startSession(await api.register(details)), [startSession]);

  const logout = useCallback(() => clearSession(), [clearSession]);

  const retry = useCallback(() => setState((s) => ({ ...s, status: 'loading', notice: null })), []);

  const setUser = useCallback((user) => setState((s) => ({ ...s, user })), []);

  const value = useMemo(() => ({
    ...state,
    login,
    register,
    logout,
    retry,
    setUser,
  }), [state, login, register, logout, retry, setUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
