'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Activity, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface ActivityItem {
  id: string;
  label: string;
  status: 'running' | 'success' | 'error';
  progress?: number;
}

interface GlobalActivityContextType {
  activities: ActivityItem[];
  addActivity: (id: string, label: string) => void;
  updateActivity: (id: string, updates: Partial<ActivityItem>) => void;
  removeActivity: (id: string) => void;
  clearAll: () => void;
}

const GlobalActivityContext = createContext<GlobalActivityContextType | null>(null);

export function useGlobalActivity() {
  const context = useContext(GlobalActivityContext);
  if (!context) {
    throw new Error('useGlobalActivity must be used within GlobalActivityProvider');
  }
  return context;
}

export function GlobalActivityProvider({ children }: { children: React.ReactNode }) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const addActivity = useCallback((id: string, label: string) => {
    setActivities(prev => {
      if (prev.find(a => a.id === id)) return prev;
      return [...prev, { id, label, status: 'running' }];
    });
  }, []);

  const updateActivity = useCallback((id: string, updates: Partial<ActivityItem>) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, []);

  const removeActivity = useCallback((id: string) => {
    setActivities(prev => prev.filter(a => a.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setActivities([]);
  }, []);

  return (
    <GlobalActivityContext.Provider value={{ activities, addActivity, updateActivity, removeActivity, clearAll }}>
      {children}
    </GlobalActivityContext.Provider>
  );
}

export function GlobalActivityBar() {
  const { activities } = useGlobalActivity();

  const runningCount = activities.filter(a => a.status === 'running').length;

  if (activities.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 320,
      }}
    >
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="activity-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            borderRadius: 12,
            border: activity.status === 'running'
              ? '1px solid rgba(139, 92, 246, 0.4)'
              : activity.status === 'success'
                ? '1px solid rgba(34, 197, 94, 0.4)'
                : '1px solid rgba(239, 68, 68, 0.4)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          <div style={{ flexShrink: 0 }}>
            {activity.status === 'running' ? (
              <Loader2
                size={18}
                color="var(--accent-primary)"
                style={{ animation: 'spin 1s linear infinite' }}
              />
            ) : activity.status === 'success' ? (
              <CheckCircle size={18} color="#22c55e" />
            ) : (
              <XCircle size={18} color="#ef4444" />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '0.8rem',
              color: 'white',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {activity.label}
            </div>
            {activity.progress !== undefined && activity.status === 'running' && (
              <div style={{
                marginTop: 4,
                height: 3,
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div
                  style={{
                    height: '100%',
                    width: `${activity.progress}%`,
                    background: 'var(--gradient-main)',
                    borderRadius: 2,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      ))}

      {runningCount > 0 && (
        <div
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'var(--gradient-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.65rem',
            fontWeight: 'bold',
            color: 'white',
            boxShadow: '0 2px 8px rgba(139, 92, 246, 0.5)',
          }}
        >
          {runningCount}
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

// シンプルなステータスドット（サイドバーなどに使用）
export function ActivityDot() {
  const { activities } = useGlobalActivity();
  const runningCount = activities.filter(a => a.status === 'running').length;

  if (runningCount === 0) return null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span
        className="activity-dot"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--accent-primary)',
        }}
      />
      <style jsx>{`
        .activity-dot {
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.2);
          }
        }
      `}</style>
    </span>
  );
}
