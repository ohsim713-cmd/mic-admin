'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type BusinessType = 'chat-lady' | 'liver-agency' | 'nail-salon';

interface BusinessTypeContextType {
  businessType: BusinessType;
  setBusinessType: (type: BusinessType) => void;
  businessLabel: string;
}

const BusinessTypeContext = createContext<BusinessTypeContextType | undefined>(undefined);

export function BusinessTypeProvider({ children }: { children: ReactNode }) {
  const [businessType, setBusinessTypeState] = useState<BusinessType>('chat-lady');

  // ローカルストレージから読み込み
  useEffect(() => {
    const saved = localStorage.getItem('businessType');
    if (saved === 'chat-lady' || saved === 'liver-agency' || saved === 'nail-salon') {
      setBusinessTypeState(saved);
    }
  }, []);

  // ローカルストレージに保存
  const setBusinessType = (type: BusinessType) => {
    setBusinessTypeState(type);
    localStorage.setItem('businessType', type);
  };

  const getBusinessLabel = (type: BusinessType): string => {
    switch (type) {
      case 'chat-lady':
        return 'タイプA';
      case 'liver-agency':
        return 'タイプB';
      case 'nail-salon':
        return 'タイプC';
      default:
        return 'タイプA';
    }
  };

  const businessLabel = getBusinessLabel(businessType);

  return (
    <BusinessTypeContext.Provider value={{ businessType, setBusinessType, businessLabel }}>
      {children}
    </BusinessTypeContext.Provider>
  );
}

export function useBusinessType() {
  const context = useContext(BusinessTypeContext);
  if (context === undefined) {
    throw new Error('useBusinessType must be used within a BusinessTypeProvider');
  }
  return context;
}
