'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, PlusSquare, Film, User } from 'lucide-react';
import { motion } from 'framer-motion';
import styles from './MobileNav.module.css';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const MobileNav = () => {
    const pathname = usePathname();

    const navItems = [
        { icon: Home, label: 'Home', href: '/' },
        { icon: Search, label: 'Search', href: '/search' },
        { icon: PlusSquare, label: 'Create', href: '/create' },
        { icon: Film, label: 'Reels', href: '/reels' },
        { icon: User, label: 'Profile', href: '/profile' },
    ];

    const handleHaptic = async () => {
        try {
            await Haptics.impact({ style: ImpactStyle.Light });
        } catch {
            // Capacitor not available
        }
    };

    return (
        <nav className={styles.mobileNav} aria-label="Mobile navigation">
            <div className={styles.navContainer}>
                {navItems.map((item) => {
                    const isActive = item.href === '/'
                        ? pathname === '/'
                        : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={`${styles.navItem} ${item.label === 'Create' ? styles.createItem : ''} ${isActive ? styles.active : ''}`}
                            onClick={handleHaptic}
                            aria-label={item.label}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <motion.div
                                className={styles.iconWrap}
                                initial={false}
                                animate={isActive ? { y: -2, scale: 1.06 } : { y: 0, scale: 1 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            >
                                <Icon
                                    size={24}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    color={item.label === 'Create' ? '#ffffff' : isActive ? 'var(--primary)' : 'var(--foreground-muted)'}
                                />
                                {isActive && (
                                    <motion.div
                                        layoutId="activeIndicator"
                                        className={styles.activeIndicator}
                                    />
                                )}
                            </motion.div>
                            <span className={styles.navLabel}>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
            {/* Safe area spacer for modern Android/iOS bottom gesture bars */}
            <div className={styles.safeAreaSpacer} />
        </nav>
    );
};

export default MobileNav;
