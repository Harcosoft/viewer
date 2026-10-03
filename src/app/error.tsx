'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Home } from 'lucide-react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();

    useEffect(() => {
        const isStaleChunkError = /module factory is not available|chunkloaderror|failed to load (?:a )?chunk|loading chunk \d+ failed/i
            .test(error.message);

        if (isStaleChunkError) {
            try {
                const recoveryKey = 'viewer:chunk-load-recovery';
                const lastRecoveryAttempt = Number(sessionStorage.getItem(recoveryKey));
                if (!lastRecoveryAttempt || Date.now() - lastRecoveryAttempt > 60_000) {
                    sessionStorage.setItem(recoveryKey, String(Date.now()));
                    window.location.reload();
                    return;
                }
            } catch (recoveryError) {
                console.warn('Automatic recovery from a stale app bundle failed:', recoveryError);
            }
        }

        console.error('App Critical Error:', error);
    }, [error]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            background: 'var(--background)'
        }}>
            <div style={{
                background: 'var(--background-card)',
                padding: '40px',
                borderRadius: '24px',
                boxShadow: 'var(--card-shadow)',
                backdropFilter: 'blur(20px)',
                maxWidth: '400px',
                width: '100%'
            }}>
                <div style={{
                    width: '64px', height: '64px', borderRadius: '50%',
                    background: 'rgba(255,0,85,0.1)', color: 'var(--danger)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 24px'
                }}>
                    <RefreshCw size={32} />
                </div>

                <h2 style={{ marginBottom: '16px', fontSize: '24px', fontWeight: 'bold' }}>Something went wrong!</h2>
                <p style={{ color: 'var(--foreground-muted)', marginBottom: '32px', fontSize: '15px' }}>
                    We encountered an unexpected error while preparing this page.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        onClick={() => reset()}
                        style={{
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            padding: '14px 24px',
                            borderRadius: '12px',
                            fontWeight: '600',
                            fontSize: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <RefreshCw size={18} />
                        Try Again
                    </button>
                    <button
                        onClick={() => router.push('/')}
                        style={{
                            background: 'transparent',
                            color: 'var(--foreground)',
                            border: '1px solid var(--border)',
                            padding: '14px 24px',
                            borderRadius: '12px',
                            fontWeight: '600',
                            fontSize: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Home size={18} />
                        Go to Home
                    </button>
                </div>
            </div>
        </div>
    );
}
