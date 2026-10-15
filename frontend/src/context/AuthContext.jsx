import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On page load ask the server "who am I?" (the cookie is sent automatically)
  useEffect(() => {
    api.get('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setLoading(false));
    const expired = () => setUser(null);
    window.addEventListener('smartq-auth-expired', expired);
    return () => window.removeEventListener('smartq-auth-expired', expired);
  }, []);

  const login = useCallback(async (email, password, role) => {
    const r = await api.post('/auth/login', { email, password, role });
    setUser(r.user);
    return r.user;
  }, []);
  const register = useCallback(async (form) => {
    const r = await api.post('/auth/register', form);
    setUser(r.user);
    return r.user;
  }, []);
  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}