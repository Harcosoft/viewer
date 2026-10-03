'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Send, Music } from 'lucide-react';
import styles from './StoryViewer.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { startConversation, sendMessage } from '@/app/actions';
import { useToast } from '@/contexts/ToastContext';

const QUICK_REACTIONS = ['🔥', '❤️', '😂', '😮', '👏'];

interface StoryViewerProps {
    stories: any[];
    initialStoryIndex: number;
    isOpen: boolean;
    onClose: () => void;
}

const StoryViewer: React.FC<StoryViewerProps> = ({ stories, initialStoryIndex, isOpen, onClose }) => {
    const [storyIndex, setStoryIndex] = useState(initialStoryIndex);
    const [slideIndex, setSlideIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [floatingReaction, setFloatingReaction] = useState<string | null>(null);
    const { showToast } = useToast();

    // Local poll vote records (storyId -> votedOptionIndex)
    const [pollVotes, setPollVotes] = useState<Record<string, number>>({});

    const currentStory = stories[storyIndex];
    const slides = React.useMemo(() => currentStory?.slides || currentStory?.stories || [], [currentStory]);
    const currentSlide = slides[slideIndex];

    const nextSlide = useCallback(() => {
        const slidesCount = slides.length;
        if (slideIndex < slidesCount - 1) {
            setSlideIndex(prev => prev + 1);
            setProgress(0);
        } else if (storyIndex < stories.length - 1) {
            setStoryIndex(prev => prev + 1);
            setSlideIndex(0);
            setProgress(0);
        } else {
            onClose();
        }
    }, [slideIndex, slides.length, storyIndex, stories.length, onClose]);

    const prevSlide = useCallback(() => {
        if (slideIndex > 0) {
            setSlideIndex(slideIndex - 1);
            setProgress(0);
        } else if (storyIndex > 0) {
            const prevStory = stories[storyIndex - 1];
            const prevSlides = prevStory.slides || prevStory.stories || [];
            setStoryIndex(storyIndex - 1);
            setSlideIndex(prevSlides.length - 1);
            setProgress(0);
        }
    }, [slideIndex, storyIndex, stories]);

    // Keyboard navigation (Arrow keys, Space to pause, Esc to close)
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.key === 'ArrowRight') {
                nextSlide();
            } else if (e.key === 'ArrowLeft') {
                prevSlide();
            } else if (e.key === ' ') {
                e.preventDefault();
                setIsPaused(p => !p);
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, nextSlide, prevSlide, onClose]);

    // Timer & Auto Progression
    useEffect(() => {
        if (!isOpen || !currentSlide || isPaused) return;

        const duration = 5000;
        const interval = 50;
        const step = (interval / duration) * 100;

        const timer = setInterval(() => {
            setProgress(prev => Math.min(prev + step, 100));
        }, interval);

        return () => clearInterval(timer);
    }, [isOpen, slideIndex, storyIndex, currentSlide, isPaused]);

    useEffect(() => {
        if (!isOpen || progress < 100) return;

        setProgress(0);
        nextSlide();
    }, [isOpen, progress, nextSlide]);

    if (!isOpen || !currentStory || !currentSlide) return null;

    // Parse image & metadata
    const rawImage = currentSlide.image || currentSlide.url || '';
    let meta: { filter?: string; music?: string; poll?: { question: string; opt1: string; opt2: string } } | null = null;
    let finalImageUrl = rawImage;

    if (rawImage.startsWith('[STORY_META:')) {
        const match = rawImage.match(/^\[STORY_META:([\s\S]+?)\]:([\s\S]*)$/);
        if (match) {
            try {
                meta = JSON.parse(match[1]);
                finalImageUrl = match[2];
            } catch (e) {
                console.warn('Failed to parse story meta', e);
            }
        }
    }

    const filterStyle = meta?.filter === 'cyberpunk'
        ? 'contrast(130%) saturate(160%) hue-rotate(290deg)'
        : meta?.filter === 'vintage'
        ? 'sepia(45%) contrast(115%) brightness(95%)'
        : meta?.filter === 'sunset'
        ? 'sepia(20%) saturate(150%) brightness(105%) hue-rotate(-15deg)'
        : meta?.filter === 'noir'
        ? 'grayscale(100%) contrast(140%)'
        : meta?.filter === 'vibrant'
        ? 'saturate(180%) contrast(110%)'
        : 'none';

    const slideKey = `${currentStory.id || storyIndex}-${slideIndex}`;
    const userVote = pollVotes[slideKey];

    const handleVote = (optionIndex: number) => {
        setPollVotes(prev => ({ ...prev, [slideKey]: optionIndex }));
    };

    const handleSendReaction = async (emoji: string) => {
        setFloatingReaction(emoji);
        setTimeout(() => setFloatingReaction(null), 1200);

        if (currentStory.user?.username) {
            showToast(`Reacted ${emoji} to story! ✨`, 'success');
            try {
                const conv = await startConversation(currentStory.user.username);
                await sendMessage(conv.id, `Reacted ${emoji} to your story! ✨`);
            } catch (err) {
                console.warn('Reaction send error', err);
            }
        }
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || !currentStory.user?.username) return;
        const text = replyText.trim();
        setReplyText('');
        showToast('Reply sent! 💬', 'success');

        try {
            const conv = await startConversation(currentStory.user.username);
            await sendMessage(conv.id, `Replied to your story: "${text}"`);
        } catch (err) {
            console.error('Reply send error', err);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <button className={styles.closeBtn} onClick={onClose}>
                <X size={22} />
            </button>

            <div
                className={styles.viewerContainer}
                onClick={e => e.stopPropagation()}
                onMouseDown={() => setIsPaused(true)}
                onMouseUp={() => setIsPaused(false)}
                onTouchStart={() => setIsPaused(true)}
                onTouchEnd={() => setIsPaused(false)}
            >
                {/* Progress Bars */}
                <div className={styles.progressContainer}>
                    {slides.map((_: any, idx: number) => (
                        <div key={idx} className={styles.progressBar}>
                            <div
                                className={styles.progressFill}
                                style={{
                                    width: idx < slideIndex ? '100%' : idx === slideIndex ? `${progress}%` : '0%'
                                }}
                            />
                        </div>
                    ))}
                </div>

                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.userInfo}>
                        <Image
                            src={currentStory.user?.avatar || 'https://i.pravatar.cc/150'}
                            alt={currentStory.user?.username || 'User'}
                            width={38}
                            height={38}
                            className={styles.avatar}
                        />
                        <div className={styles.userMeta}>
                            <span className={styles.username}>{currentStory.user?.username || 'Creator'}</span>
                            <span className={styles.time}>
                                {currentSlide.createdAt
                                    ? formatDistanceToNow(new Date(currentSlide.createdAt), { addSuffix: true })
                                    : 'Just now'}
                            </span>
                        </div>
                    </div>

                    {/* Music Badge */}
                    {meta?.music && (
                        <div className={styles.musicBadge}>
                            <Music size={13} color="#6366f1" />
                            <span>{meta.music.split('•')[0]}</span>
                            <div className={styles.equalizerWaves}>
                                <div className={styles.equalizerBar} style={{ animationDelay: '0s' }} />
                                <div className={styles.equalizerBar} style={{ animationDelay: '0.2s' }} />
                                <div className={styles.equalizerBar} style={{ animationDelay: '0.4s' }} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Story Image */}
                <div className={styles.storyContent}>
                    {/* Navigation Tap Zones */}
                    <div className={styles.navZoneLeft} onClick={prevSlide} />
                    <div className={styles.navZoneRight} onClick={nextSlide} />

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={finalImageUrl || '/icons/icon-192.png'}
                        alt="Story"
                        className={styles.storyImage}
                        style={{ filter: filterStyle }}
                        onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = '/icons/icon-192.png';
                        }}
                    />

                    {/* Interactive Poll Sticker */}
                    {meta?.poll && (
                        <div className={styles.pollSticker} onClick={e => e.stopPropagation()}>
                            <div className={styles.pollQuestion}>{meta.poll.question}</div>
                            <div className={styles.pollOptionsList}>
                                {[meta.poll.opt1, meta.poll.opt2].map((opt, optIdx) => {
                                    const hasVoted = userVote !== undefined;
                                    const isSelected = userVote === optIdx;
                                    // Animated mock percentages
                                    const pct = userVote === 0 ? (optIdx === 0 ? 68 : 32) : (optIdx === 0 ? 38 : 62);

                                    return (
                                        <button
                                            key={optIdx}
                                            className={styles.pollOptionBtn}
                                            onClick={() => handleVote(optIdx)}
                                        >
                                            {hasVoted && (
                                                <div
                                                    className={styles.pollOptionFill}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            )}
                                            <span className={styles.pollOptionLabel}>{opt}</span>
                                            {hasVoted && (
                                                <span className={styles.pollOptionPct}>{pct}%</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Floating Reaction Burst */}
                    <AnimatePresence>
                        {floatingReaction && (
                            <motion.div
                                className={styles.floatingReactionBurst}
                                initial={{ scale: 0, y: 0, opacity: 1 }}
                                animate={{ scale: [0, 1.4, 1.2], y: -80, opacity: [1, 1, 0] }}
                                transition={{ duration: 1 }}
                            >
                                {floatingReaction}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Bottom Quick Reactions & Reply Bar */}
                <div className={styles.controls} onClick={e => e.stopPropagation()}>
                    <div className={styles.quickReactionRow}>
                        {QUICK_REACTIONS.map(emoji => (
                            <button
                                key={emoji}
                                className={styles.quickReactionBtn}
                                onClick={() => handleSendReaction(emoji)}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>

                    <div className={styles.inputRow}>
                        <input
                            type="text"
                            placeholder={`Reply to ${currentStory.user?.username || 'story'}...`}
                            className={styles.replyInput}
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleSendReply();
                            }}
                        />
                        <button className={styles.sendReplyBtn} onClick={handleSendReply}>
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StoryViewer;
