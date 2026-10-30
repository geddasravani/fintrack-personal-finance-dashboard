import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // Restore the session on first load.
  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  // The API layer fires this when a token is rejected.
  useEffect(() => {
    window.addEventListener("fintrack:logout", logout);
    return () => window.removeEventListener("fintrack:logout", logout);
  }, [logout]);

  const authenticate = async (fn, payload) => {
    const data = await fn(payload);
    setToken(data.access_token);
    setUser(data.user);
  };

  const value = {
    user,
    loading,
    login: (p) => authenticate(api.login, p),
    register: (p) => authenticate(api.register, p),
    logout,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
