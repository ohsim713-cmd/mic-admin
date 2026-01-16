'use client';

import { useEffect } from 'react';
import { useTenant } from '@/lib/tenant';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { cssVariables, isLoading } = useTenant();

  useEffect(() => {
    // CSS変数をルート要素に適用
    const root = document.documentElement;
    Object.entries(cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [cssVariables]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white/60 text-sm">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
