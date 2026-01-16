'use client';

import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  hint,
  icon,
  size = 'md',
  type,
  style,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: 'var(--space-2)', fontSize: 'var(--text-xs)' },
    md: { padding: 'var(--space-3)', fontSize: 'var(--text-sm)' },
    lg: { padding: 'var(--space-4)', fontSize: 'var(--text-base)' },
  };

  const inputStyles: React.CSSProperties = {
    width: '100%',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-base)',
    border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    paddingLeft: icon ? 'calc(var(--space-4) + 20px)' : undefined,
    paddingRight: isPassword ? 'calc(var(--space-4) + 20px)' : undefined,
    ...sizeStyles[size],
    ...style,
  };

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: 'var(--space-2)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          color: 'var(--text-primary)',
        }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {icon && (
          <div style={{
            position: 'absolute',
            left: 'var(--space-3)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)',
            pointerEvents: 'none',
          }}>
            {icon}
          </div>
        )}
        <input
          ref={ref}
          type={isPassword && showPassword ? 'text' : type}
          style={inputStyles}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: 'var(--space-3)',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && (
        <p style={{
          marginTop: 'var(--space-1)',
          fontSize: 'var(--text-xs)',
          color: 'var(--error)',
        }}>
          {error}
        </p>
      )}
      {hint && !error && (
        <p style={{
          marginTop: 'var(--space-1)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
        }}>
          {hint}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  hint,
  style,
  ...props
}, ref) => {
  const textareaStyles: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-3)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-base)',
    border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    resize: 'vertical',
    minHeight: '100px',
    fontFamily: 'inherit',
    ...style,
  };

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: 'var(--space-2)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          color: 'var(--text-primary)',
        }}>
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        style={textareaStyles}
        {...props}
      />
      {error && (
        <p style={{
          marginTop: 'var(--space-1)',
          fontSize: 'var(--text-xs)',
          color: 'var(--error)',
        }}>
          {error}
        </p>
      )}
      {hint && !error && (
        <p style={{
          marginTop: 'var(--space-1)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
        }}>
          {hint}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Input;
