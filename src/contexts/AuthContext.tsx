import { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { User } from '@/types';
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_BASE_URL; // Replace with your actual base URL
const ADMIN_EMAIL = 'admin@evgeny.com';
const USER_STORAGE_KEY = 'user';
const LAST_ACTIVITY_KEY = 'lastActivityTimestamp';
const INACTIVITY_TIMEOUT_MINUTES = Number(import.meta.env.VITE_INACTIVITY_TIMEOUT_MINUTES ?? 30);
const INACTIVITY_TIMEOUT_MS = INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const recordActivity = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    setUser(null);
    setIsAuthenticated(false);
    setIsAdmin(false);
  }, []);

  const handleSessionExpiration = useCallback(() => {
    clearSession();
    window.location.replace('/login');
  }, [clearSession]);

  const restoreSession = useCallback(() => {
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    if (!storedUser) {
      return false;
    }

    const sessionExpired = !lastActivity || Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS;
    if (sessionExpired) {
      clearSession();
      return false;
    }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser['user']);
    setIsAuthenticated(true);
    setIsAdmin(parsedUser['user']?.email === ADMIN_EMAIL);
    return true;
  }, [clearSession]);

  const isSessionExpired = useCallback(() => {
    const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    if (!lastActivity) return false;
    return Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS;
  }, []);

  useEffect(() => {
    restoreSession();
    setLoading(false);
  }, [restoreSession]);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);

      // Send login request to the server
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email,
        password,
      });

      const loggedInUser = response.data;

      // Save the user to localStorage and update the state
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInUser));
      recordActivity();
      setUser(loggedInUser['user']);
      setIsAuthenticated(true);
      setIsAdmin(loggedInUser['user']?.email === ADMIN_EMAIL);

      return loggedInUser['user']?.email === 'admin@evgeny.com';
    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      setLoading(true);

      const response = await axios.post(`${BASE_URL}/customers/register`, {
        email,
        password,
        name,
      });

      const registeredUser = response.data;

      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(registeredUser));
      recordActivity();
      setUser(registeredUser['user'] ?? registeredUser);
      setIsAuthenticated(true);
      setIsAdmin(registeredUser['user']?.email === ADMIN_EMAIL);
    } catch (error) {
      console.error('Registration error:', error);
      throw new Error('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearSession();
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    recordActivity();

    const activityEvents = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    const activityHandler = () => recordActivity();
    activityEvents.forEach((event) => window.addEventListener(event, activityHandler));

    const inactivityCheck = window.setInterval(() => {
      if (isSessionExpired()) {
        handleSessionExpiration();
      }
    }, 60 * 1000);

    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, activityHandler));
      window.clearInterval(inactivityCheck);
    };
  }, [isAuthenticated, recordActivity, handleSessionExpiration, isSessionExpired]);

  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const storedUser = localStorage.getItem(USER_STORAGE_KEY);
        const parsedUser = storedUser ? JSON.parse(storedUser) : null;
        const token = parsedUser?.token;

        if (token) {
          config.headers = config.headers ?? {};
          config.headers.Authorization = `Bearer ${token}`;
        }

        if (isSessionExpired()) {
          handleSessionExpiration();
          return Promise.reject(new axios.Cancel('Session expired'));
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          handleSessionExpiration();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [handleSessionExpiration, isSessionExpired]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      register, 
      logout, 
      isAuthenticated,
      isAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};