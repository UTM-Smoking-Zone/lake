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
      const response = await fetch('http://localhost:8006/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser({
          id: userData.id?.toString() || 'unknown',
          email: userData.email || 'unknown',
          firstName: userData.display_name?.split(' ')[0] || 'User',
          lastName: userData.display_name?.split(' ')[1] || ''
        });
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch('http://localhost:8006/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const userData = await response.json();
    
    // Store real JWT token if available, otherwise use simple token
    const token = userData.token || 'authenticated';
    localStorage.setItem('token', token);
    
    setUser({
      id: userData.id?.toString() || 'unknown',
      email: userData.email || email,
      firstName: userData.display_name?.split(' ')[0] || 'User',
      lastName: userData.display_name?.split(' ')[1] || ''
    });
    router.push('/dashboard');
  };

  const register = async (email: string, password: string, firstName?: string, lastName?: string) => {
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];
    const response = await fetch('http://localhost:8006/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, display_name: displayName }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    const userData = await response.json();
    localStorage.setItem('token', 'authenticated'); // Simple token since no JWT
    setUser({
      id: userData.id?.toString() || 'unknown',
      email: userData.email,
      firstName: firstName,
      lastName: lastName
    });
    router.push('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('token');
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
