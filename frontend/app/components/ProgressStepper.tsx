'use client';

import React from 'react';
import { Check, Loader2, Circle, AlertCircle } from 'lucide-react';

export interface Step {
  id: string;
  label: string;
  description?: string;
}

interface ProgressStepperProps {
  steps: Step[];
  currentStep: number; // 0-indexed, -1 means not started
  status?: 'idle' | 'running' | 'success' | 'error';
  errorMessage?: string;
  vertical?: boolean;
}

export function ProgressStepper({
  steps,
  currentStep,
  status = 'idle',
  errorMessage,
  vertical = false
}: ProgressStepperProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        gap: vertical ? 0 : 8,
        width: '100%',
      }}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStep || (index === currentStep && status === 'success');
        const isCurrent = index === currentStep && status !== 'success';
        const isError = isCurrent && status === 'error';
        const isRunning = isCurrent && status === 'running';
        const isPending = index > currentStep || currentStep === -1;

        return (
          <div
            key={step.id}
            style={{
              display: 'flex',
              flexDirection: vertical ? 'row' : 'column',
              alignItems: vertical ? 'flex-start' : 'center',
              flex: vertical ? undefined : 1,
              position: 'relative',
            }}
          >
            {/* コネクターライン */}
            {index > 0 && (
              <div
                style={{
                  position: 'absolute',
                  ...(vertical
                    ? {
                        top: -24,
                        left: 15,
                        width: 2,
                        height: 24,
                      }
                    : {
                        top: 15,
                        left: 0,
                        right: '50%',
                        height: 2,
                        transform: 'translateX(-50%)',
                      }),
                  backgroundColor: isCompleted || isCurrent
                    ? 'var(--accent-primary)'
                    : 'rgba(255,255,255,0.1)',
                  transition: 'background-color 0.3s',
                }}
              />
            )}

            {/* ステップサークル */}
            <div
              className={isRunning ? 'step-running' : ''}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isCompleted
                  ? 'var(--accent-primary)'
                  : isError
                    ? '#ef4444'
                    : isCurrent
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(255,255,255,0.1)',
                border: isCurrent && !isError
                  ? '2px solid var(--accent-primary)'
                  : isError
                    ? '2px solid #ef4444'
                    : '2px solid transparent',
                transition: 'all 0.3s',
                flexShrink: 0,
                zIndex: 1,
              }}
            >
              {isCompleted ? (
                <Check size={16} color="white" />
              ) : isError ? (
                <AlertCircle size={16} color="white" />
              ) : isRunning ? (
                <Loader2 size={16} color="var(--accent-primary)" className="animate-spin" />
              ) : (
                <Circle
                  size={8}
                  fill={isCurrent ? 'var(--accent-primary)' : 'rgba(255,255,255,0.3)'}
                  color="transparent"
                />
              )}
            </div>

            {/* ラベル */}
            <div
              style={{
                marginTop: vertical ? 0 : 8,
                marginLeft: vertical ? 12 : 0,
                textAlign: vertical ? 'left' : 'center',
                paddingBottom: vertical ? 24 : 0,
              }}
            >
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: isCurrent ? 600 : 400,
                  color: isCompleted || isCurrent
                    ? 'white'
                    : 'var(--text-muted)',
                  transition: 'color 0.3s',
                }}
              >
                {step.label}
              </div>
              {step.description && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginTop: 2,
                  }}
                >
                  {step.description}
                </div>
              )}
              {isError && errorMessage && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#ef4444',
                    marginTop: 4,
                  }}
                >
                  {errorMessage}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <style jsx>{`
        .step-running {
          animation: pulse-border 1.5s ease-in-out infinite;
        }
        @keyframes pulse-border {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
          }
        }
        :global(.animate-spin) {
          animation: spin 1s linear infinite;
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

// コンパクトなインラインプログレス
interface InlineProgressProps {
  steps: string[];
  currentStep: number;
  showLabels?: boolean;
}

export function InlineProgress({ steps, currentStep, showLabels = true }: InlineProgressProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <React.Fragment key={index}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isCompleted
                    ? 'var(--accent-primary)'
                    : isCurrent
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(255,255,255,0.1)',
                  border: isCurrent ? '2px solid var(--accent-primary)' : 'none',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: isCompleted || isCurrent ? 'white' : 'var(--text-muted)',
                }}
              >
                {isCompleted ? <Check size={12} /> : index + 1}
              </div>
              {showLabels && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: isCurrent ? 'white' : 'var(--text-muted)',
                    fontWeight: isCurrent ? 500 : 400,
                  }}
                >
                  {step}
                </span>
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                style={{
                  width: 20,
                  height: 2,
                  backgroundColor: isCompleted
                    ? 'var(--accent-primary)'
                    : 'rgba(255,255,255,0.1)',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// タスクリスト形式のプログレス
interface TaskListProgressProps {
  tasks: Array<{
    id: string;
    label: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    message?: string;
  }>;
}

export function TaskListProgress({ tasks }: TaskListProgressProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tasks.map((task) => (
        <div
          key={task.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            backgroundColor: task.status === 'running'
              ? 'rgba(239, 68, 68, 0.1)'
              : 'rgba(255,255,255,0.03)',
            borderRadius: 8,
            border: task.status === 'running'
              ? '1px solid rgba(239, 68, 68, 0.3)'
              : '1px solid rgba(255,255,255,0.05)',
            transition: 'all 0.3s',
          }}
        >
          <div style={{ flexShrink: 0 }}>
            {task.status === 'completed' ? (
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={12} color="white" />
              </div>
            ) : task.status === 'running' ? (
              <Loader2 size={20} color="var(--accent-primary)" className="animate-spin" />
            ) : task.status === 'error' ? (
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertCircle size={12} color="white" />
              </div>
            ) : (
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.2)',
                }}
              />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.85rem',
                color: task.status === 'running' ? 'white' : 'var(--text-muted)',
                fontWeight: task.status === 'running' ? 500 : 400,
              }}
            >
              {task.label}
            </div>
            {task.message && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: task.status === 'error' ? '#ef4444' : 'var(--text-muted)',
                  marginTop: 2,
                }}
              >
                {task.message}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
