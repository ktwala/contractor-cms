'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';
import { Permission } from './permissions.generated';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[] | Array<{ name: string; permissions: string[]; organizationId: string | null }>;
  effectivePermissions: string[];
  organizationId: string;
  /** PR-SUPPLIER-SCOPING-1 — set when user has an active SupplierMembership */
  supplierId?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  canAll: (permissions: Permission[]) => boolean;
  hasRole: (roleName: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const token = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    localStorage.setItem('auth_token', response.accessToken);
    localStorage.setItem('user', JSON.stringify(response.user));
    setUser(response.user);
  };

  const register = async (data: any) => {
    const response = await api.register(data);
    localStorage.setItem('auth_token', response.accessToken);
    localStorage.setItem('user', JSON.stringify(response.user));
    setUser(response.user);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  // Authorization Helpers
  const can = (permission: Permission): boolean => {
    if (!user || !user.effectivePermissions) return false;
    return user.effectivePermissions.includes(permission);
  };

  const canAny = (permissions: Permission[]): boolean => {
    if (!user || !user.effectivePermissions) return false;
    return permissions.some((p) => user.effectivePermissions.includes(p));
  };

  const canAll = (permissions: Permission[]): boolean => {
    if (!user || !user.effectivePermissions) return false;
    return permissions.every((p) => user.effectivePermissions.includes(p));
  };

  // For display/diagnostics only - NOT for authorization
  const hasRole = (roleName: string): boolean => {
    if (!user || !user.roles) return false;
    return user.roles.some((r) => {
      if (typeof r === 'string') return r === roleName;
      return r.name === roleName;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, can, canAny, canAll, hasRole }}>
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
