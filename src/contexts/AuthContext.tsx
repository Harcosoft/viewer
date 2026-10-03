'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
    id: string;
    username: string;
    avatar: string;
    coverPhoto?: string | null;
    fullName?: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isInitialized: boolean;
    login: (userData: User) => void;
    logout: () => void;
    refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const router = useRouter();

    const fetchSession = async () => {
        console.log('fetchSession start');
        try {
            const res = await fetch('/api/auth');
            console.log('fetchSession response', res.status, res.headers.get('content-type'));
            const contentType = res.headers.get('content-type');

            if (res.status === 401) {
                setUser(null);
                localStorage.removeItem('viewer_demo_auth');
                return;
            }

            if (res.ok && contentType && contentType.includes('application/json')) {
                const data = await res.json();
                if (data.authenticated) {
                    setUser(data.user);
                    localStorage.setItem('viewer_demo_auth', 'true');
                } else {
                    setUser(null);
                    localStorage.removeItem('viewer_demo_auth');
                }
            } else {
                setUser(null);
                localStorage.removeItem('viewer_demo_auth');
            }
        } catch (err) {
            setUser(null);
            localStorage.removeItem('viewer_demo_auth');
        } finally {
            setIsLoading(false);
            setIsInitialized(true);
        }
    };

    useEffect(() => {
        console.log('AuthProvider effect running');
        let isMounted = true;

        const safeSetInitialized = () => {
            console.log('safeSetInitialized called', { isMounted, user });
            if (isMounted) {
                setIsLoading(false);
                setIsInitialized(true);
            }
        };

        const fallbackTimer = window.setTimeout(() => {
            safeSetInitialized();
        }, 1500);

        // Fast path: check localStorage hint to show shell immediately
        const hasAuthHint = localStorage.getItem('viewer_demo_auth') === 'true';
        if (!hasAuthHint) {
            // If No hint, we still need to wait for the first check to decide if we show Landing
            fetchSession().finally(() => {
                window.clearTimeout(fallbackTimer);
                safeSetInitialized();
            });
        } else {
            // If hint exists, assume logged in for shell, but verify in background
            setIsLoading(false);
            fetchSession().finally(() => {
                window.clearTimeout(fallbackTimer);
                safeSetInitialized();
            });
        }

        return () => {
            isMounted = false;
            window.clearTimeout(fallbackTimer);
        };
    }, []);

    const login = (userData: User) => {
        setUser(userData);
        localStorage.setItem('viewer_demo_auth', 'true');
        // Force sync with server-side cookies/session state
        window.location.reload(); 
    };

    const logout = async () => {
        await fetch('/api/auth', { method: 'DELETE' });
        setUser(null);
        localStorage.removeItem('viewer_demo_auth');
        router.push('/');
        window.location.reload();
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, isInitialized, login, logout, refreshSession: fetchSession }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('App Critical Error: useAuth must be used within an AuthProvider [ID: AUTH_PROVIDER_MISSING]');
    }
    return context;
};
