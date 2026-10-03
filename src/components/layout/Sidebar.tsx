'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
    Home,
    Search,
    Film,
    MessageCircle,
    PlusSquare,
    User,
    Settings,
    Sparkles,
    Camera
} from 'lucide-react';
import styles from './Sidebar.module.css';
import { motion } from 'framer-motion';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { useAuth } from '@/contexts/AuthContext';

const Sidebar = () => {
    const pathname = usePathname();
    const { user } = useAuth();

    const navGroups = [
        {
            label: 'Explore',
            items: [
                { icon: Home, label: 'Home', href: '/' },
                { icon: Search, label: 'Search', href: '/search' },
                { icon: Film, label: 'Reels', href: '/reels' },
            ]
        },
        {
            label: 'Create',
            items: [
                { icon: MessageCircle, label: 'Messages', href: '/messages' },
                { icon: PlusSquare, label: 'Create', href: '/create' },
            ]
        },
        {
            label: 'Account',
            items: [
                { icon: User, label: 'Profile', href: '/profile' },
                { icon: Settings, label: 'Settings', href: '/settings' },
            ]
        }
    ];

    return (
        <aside className={styles.sidebar}>
            {/* Brand Logo Header */}
            <div className={styles.logoSection}>
                <Link href="/" className={styles.logoLink}>
                    <motion.div
                        className={styles.logoIcon}
                        whileHover={{ scale: 1.08, rotate: -4 }}
                        whileTap={{ scale: 0.94 }}
                    >
                        <Camera size={22} strokeWidth={2.5} color="#ffffff" />
                    </motion.div>
                    <span className={styles.brandTitle}>
                        Viewer<span className={styles.brandDot}>.</span>
                    </span>
                </Link>
            </div>

            {/* Navigation List */}
            <nav className={styles.navItems} aria-label="Primary navigation">
                {navGroups.map((group) => (
                    <div className={styles.navGroup} key={group.label}>
                        <span className={styles.groupLabel}>{group.label}</span>
                        {group.items.map((item) => {
                            const isActive = item.href === '/'
                                ? pathname === '/'
                                : pathname === item.href || pathname.startsWith(`${item.href}/`);
                            const Icon = item.icon;

                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className={`${styles.navItem} ${item.href === '/create' ? styles.createNavItem : ''} ${isActive ? styles.active : ''}`}
                                    aria-current={isActive ? 'page' : undefined}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="sidebarActivePill"
                                            className={styles.activePill}
                                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                        />
                                    )}
                                    <div className={styles.iconWrap}>
                                        <Icon
                                            size={21}
                                            strokeWidth={isActive ? 2.5 : 1.9}
                                            className={styles.navIcon}
                                        />
                                    </div>
                                    <span className={styles.label}>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Bottom Actions & User Profile Card */}
            <div className={styles.bottomSection}>
                <div className={styles.themeRow}>
                    <span className={styles.themeLabel}>
                        <Sparkles size={16} className={styles.sparkleIcon} />
                        Theme
                    </span>
                    <ThemeSwitcher />
                </div>

                {user && (
                    <Link href="/profile" className={styles.userProfileCard}>
                        <div className={styles.userAvatarRing}>
                            <Image
                                src={user.avatar || 'https://i.pravatar.cc/150'}
                                alt={user.username || 'User'}
                                width={36}
                                height={36}
                                className={styles.userAvatar}
                            />
                        </div>
                        <div className={styles.userInfo}>
                            <span className={styles.userFullName}>{user.fullName || user.username}</span>
                            <span className={styles.userHandle}>@{user.username}</span>
                        </div>
                    </Link>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
