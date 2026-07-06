import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on app load
  useEffect(() => {
    let cancelled = false;
    const initAuth = async () => {
      try {
        // Fetch CSRF token cookie first (if not already set)
        await api.get('/auth/csrf-token');

        // Fetch current user details (cookies sent automatically).
        // Disable the 401-refresh interceptor for this call so that an
        // unauthenticated visit does not cause a refresh-fail-retry loop.
        const res = await api.get('/auth/me', { _skipAuthRefresh: true });
        if (!cancelled) setUser(res.data);
      } catch (error) {
        if (!cancelled) {
          console.warn('No active session found on load.');
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initAuth();
    return () => { cancelled = true; };
  }, []);

  // Listen to global force-logout events from API interceptor
  useEffect(() => {
    const handleForceLogout = () => {
      setUser(null);
    };
    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, []);

  const loginUser = (userData) => {
    setUser(userData);
  };

  const login = (userData) => {
    loginUser(userData);
  };

  const logoutUser = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      setUser(null);
    }
  };

  const logout = async () => {
    await logoutUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLoading: loading,
        loginUser,
        login,
        logoutUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);