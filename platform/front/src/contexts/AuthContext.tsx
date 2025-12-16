'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for stored token and validate
    const token = localStorage.getItem('token');
    if (token) {
      fetchProfile(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchProfile = async (token: string) => {
    try {
      // For now, we'll skip token validation since user service doesn't support JWT
      // Just mark as authenticated if token exists
      setUser({ id: 'temp', email: 'user@example.com' });
      return;
      /*
      const response = await fetch('http://localhost:8006/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem('token');
      }
      */
    } catch (error) {
      console.error('Error fetching profile:', error);
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for CSRF
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();

    // Store both JWT token and CSRF token
    if (data.token) {
      localStorage.setItem('token', data.token);
    }
    if (data.csrfToken) {
      localStorage.setItem('csrfToken', data.csrfToken);
    }

    setUser({
      id: data.user?.id?.toString() || 'unknown',
      email: data.user?.email || email,
      firstName: data.user?.display_name?.split(' ')[0],
      lastName: data.user?.display_name?.split(' ')[1]
    });
    router.push('/dashboard');
  };

  const register = async (email: string, password: string, firstName?: string, lastName?: string) => {
    const response = await fetch('http://localhost:8000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for CSRF
      body: JSON.stringify({
        email,
        password,
        first_name: firstName,
        last_name: lastName
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    const data = await response.json();

    // Store both JWT token and CSRF token
    if (data.token) {
      localStorage.setItem('token', data.token);
    }
    if (data.csrfToken) {
      localStorage.setItem('csrfToken', data.csrfToken);
    }

    setUser({
      id: data.user?.id?.toString() || 'unknown',
      email: data.user?.email || email,
      firstName: firstName,
      lastName: lastName
    });
    router.push('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('csrfToken');
    setUser(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
