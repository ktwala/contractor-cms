'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { Permission } from './permissions.generated';
import { TenantAuthorityProfile } from './tenant-authority';

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
  /** PR-HCM-SPONSOR-USERS-1 — HCM employee ref; enables sponsor row scope when sponsor reads are granted */
  externalId?: string | null;
  /** PR-SPONSOR-REFERENCE-ONLY-1 — Platform sponsor inbox + row scope (default off in production) */
  responsibleManagerAccountabilityInboxEnabled?: boolean;
  /** PR-CMS-AUTHORITY-1 — tenant upstream authority modes */
  tenantAuthority?: TenantAuthorityProfile;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  canAll: (permissions: Permission[]) => boolean;
  hasRole: (roleName: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapProfileToUser(profile: Record<string, unknown>): User {
  const roles = profile.roles as User['roles'];
  const roleNames = Array.isArray(roles)
    ? roles.map((r) => (typeof r === 'string' ? r : r.name))
    : [];

  return {
    id: profile.id as string,
    email: profile.email as string,
    firstName: profile.firstName as string,
    lastName: profile.lastName as string,
    organizationId: (profile.organizationId as string) || '',
    supplierId: (profile.supplierId as string | null) ?? null,
    externalId: (profile.externalId as string | null) ?? null,
    responsibleManagerAccountabilityInboxEnabled:
      profile.responsibleManagerAccountabilityInboxEnabled === true,
    tenantAuthority: profile.tenantAuthority as TenantAuthorityProfile | undefined,
    roles: roleNames.length > 0 ? roleNames : roles,
    effectivePermissions: (profile.effectivePermissions as string[]) || [],
  };
}

function persistUser(user: User) {
  localStorage.setItem('user', JSON.stringify(user));
}

function mapAuthResponseToUser(response: {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    organizationId: string | null;
    supplierId?: string | null;
    externalId?: string | null;
    roles: string[];
    effectivePermissions: string[];
    tenantAuthority?: TenantAuthorityProfile;
    responsibleManagerAccountabilityInboxEnabled?: boolean;
  };
}): User {
  return {
    id: response.user.id,
    email: response.user.email,
    firstName: response.user.firstName,
    lastName: response.user.lastName,
    organizationId: response.user.organizationId || '',
    supplierId: response.user.supplierId ?? null,
    externalId: response.user.externalId ?? null,
    responsibleManagerAccountabilityInboxEnabled:
      response.user.responsibleManagerAccountabilityInboxEnabled === true,
    tenantAuthority: response.user.tenantAuthority,
    roles: response.user.roles,
    effectivePermissions: response.user.effectivePermissions,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setUser(null);
      return;
    }
    const profile = await api.getProfile();
    const hydrated = mapProfileToUser(profile);
    setUser(hydrated);
    persistUser(hydrated);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          localStorage.removeItem('user');
        }
      }

      try {
        await refreshProfile();
      } catch {
        // Stale token — keep saved user for display; API calls will 401
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [refreshProfile]);

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    localStorage.setItem('auth_token', response.accessToken);
    const nextUser = mapAuthResponseToUser(response);
    persistUser(nextUser);
    setUser(nextUser);
  };

  const register = async (data: any) => {
    const response = await api.register(data);
    localStorage.setItem('auth_token', response.accessToken);
    const nextUser = mapAuthResponseToUser(response);
    persistUser(nextUser);
    setUser(nextUser);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

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

  const hasRole = (roleName: string): boolean => {
    if (!user || !user.roles) return false;
    return user.roles.some((r) => {
      if (typeof r === 'string') return r === roleName;
      return r.name === roleName;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshProfile,
        can,
        canAny,
        canAll,
        hasRole,
      }}
    >
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
