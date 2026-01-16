'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Tenant, User, ThemeConfig, TenantSession, INDUSTRY_THEMES } from './types';

interface TenantContextType {
  session: TenantSession | null;
  isLoading: boolean;
  setTenant: (tenant: Tenant) => void;
  setUser: (user: User) => void;
  getKnowledgePath: () => string;
  getDataPath: () => string;
  theme: ThemeConfig;
  cssVariables: Record<string, string>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// デフォルトテナント（開発用）
const DEFAULT_TENANT: Tenant = {
  id: 'default',
  name: 'Default Tenant',
  slug: 'default',
  industry: 'liver',
  theme: INDUSTRY_THEMES.liver,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const DEFAULT_USER: User = {
  id: 'dev-user',
  tenantId: 'default',
  email: 'dev@example.com',
  name: '開発ユーザー',
  role: 'admin',
  createdAt: new Date().toISOString(),
};

export function TenantProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<TenantSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // セッションの読み込み
    const loadSession = async () => {
      try {
        // ローカルストレージからテナント情報を取得
        const savedTenant = localStorage.getItem('mic_tenant');
        const savedUser = localStorage.getItem('mic_user');

        if (savedTenant && savedUser) {
          const tenant = JSON.parse(savedTenant) as Tenant;
          const user = JSON.parse(savedUser) as User;
          setSession({
            tenant,
            user,
            theme: tenant.theme,
          });
        } else {
          // デフォルトセッション
          setSession({
            tenant: DEFAULT_TENANT,
            user: DEFAULT_USER,
            theme: DEFAULT_TENANT.theme,
          });
        }
      } catch (error) {
        console.error('Failed to load session:', error);
        setSession({
          tenant: DEFAULT_TENANT,
          user: DEFAULT_USER,
          theme: DEFAULT_TENANT.theme,
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  const setTenant = (tenant: Tenant) => {
    localStorage.setItem('mic_tenant', JSON.stringify(tenant));
    setSession(prev => prev ? {
      ...prev,
      tenant,
      theme: tenant.theme,
    } : null);
  };

  const setUser = (user: User) => {
    localStorage.setItem('mic_user', JSON.stringify(user));
    setSession(prev => prev ? { ...prev, user } : null);
  };

  // テナント別ナレッジパス
  const getKnowledgePath = () => {
    if (!session) return 'knowledge';
    return `tenants/${session.tenant.id}/knowledge`;
  };

  // テナント別データパス
  const getDataPath = () => {
    if (!session) return 'data';
    return `tenants/${session.tenant.id}/data`;
  };

  // テーマをCSS変数に変換
  const cssVariables: Record<string, string> = session ? {
    '--theme-primary': session.theme.primaryColor,
    '--theme-secondary': session.theme.secondaryColor,
    '--theme-accent': session.theme.accentColor,
    '--theme-background': session.theme.backgroundColor,
    '--theme-text': session.theme.textColor,
    '--gradient-main': `linear-gradient(135deg, ${session.theme.primaryColor}, ${session.theme.secondaryColor})`,
  } : {};

  return (
    <TenantContext.Provider
      value={{
        session,
        isLoading,
        setTenant,
        setUser,
        getKnowledgePath,
        getDataPath,
        theme: session?.theme || INDUSTRY_THEMES.liver,
        cssVariables,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
