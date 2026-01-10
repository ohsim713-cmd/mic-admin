'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // エラーをコンソールに出力
        console.error('Instagram Page Error:', error);
    }, [error]);

    return (
        <div style={{
            padding: '3rem',
            textAlign: 'center',
            color: 'var(--text-main)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh'
        }}>
            <h2 style={{
                fontSize: '1.5rem',
                marginBottom: '1rem',
                color: 'var(--accent-primary)'
            }}>
                エラーが発生しました
            </h2>
            <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '1rem',
                borderRadius: '8px',
                maxWidth: '600px',
                width: '100%',
                marginBottom: '2rem',
                overflow: 'auto'
            }}>
                <p style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                    {error.message || '不明なエラー'}
                </p>
            </div>
            <button
                onClick={() => reset()}
                style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    background: 'var(--gradient-main)',
                    border: 'none',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                }}
            >
                もう一度試す
            </button>
        </div>
    );
}
