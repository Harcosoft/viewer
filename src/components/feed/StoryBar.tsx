'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './StoryBar.module.css';
import { Plus, Loader2, Image as LucideImage, Music, BarChart2, X, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import StoryViewer from '../modals/StoryViewer';
import Image from 'next/image';
import { isPusherConfigured, pusherClient } from '@/lib/pusher';
import { createStory } from '@/app/actions';

const FILTER_PRESETS = [
    { id: 'none', name: 'Normal', filter: 'none' },
    { id: 'cyberpunk', name: 'Cyberpunk', filter: 'contrast(130%) saturate(160%) hue-rotate(290deg)' },
    { id: 'vintage', name: 'Vintage', filter: 'sepia(45%) contrast(115%) brightness(95%)' },
    { id: 'sunset', name: 'Sunset', filter: 'sepia(20%) saturate(150%) brightness(105%) hue-rotate(-15deg)' },
    { id: 'noir', name: 'Noir', filter: 'grayscale(100%) contrast(140%)' },
    { id: 'vibrant', name: 'Vibrant', filter: 'saturate(180%) contrast(110%)' }
];

const SOUNDTRACKS = [
    'None',
    'Chill Lofi Beat • Lofi Dreamer',
    'Cyberpunk Synth • Neon Nights',
    'Sunset Acoustic • Summer Glow',
    'Deep Bass House • Wave Rider'
];

const StoryBar = () => {
    const [stories, setStories] = useState<any[]>([]);
    const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
    
    // Story Creator Studio Modal state
    const [isCreatorOpen, setIsCreatorOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [selectedFilter, setSelectedFilter] = useState('none');
    const [hasPoll, setHasPoll] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('Which vibe today? ✨');
    const [pollOption1, setPollOption1] = useState('Option 1 🔥');
    const [pollOption2, setPollOption2] = useState('Option 2 💫');
    const [selectedMusic, setSelectedMusic] = useState('None');
    const [isUploading, setIsUploading] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const storyTrackRef = useRef<HTMLDivElement>(null);
    const creatorCardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const track = storyTrackRef.current;
        if (!track) return;

        const updateScrollControls = () => {
            setCanScrollLeft(track.scrollLeft > 0);
            setCanScrollRight(track.scrollLeft + track.clientWidth < track.scrollWidth - 1);
        };

        updateScrollControls();
        track.addEventListener('scroll', updateScrollControls, { passive: true });
        window.addEventListener('resize', updateScrollControls);
        const resizeObserver = new ResizeObserver(updateScrollControls);
        resizeObserver.observe(track);

        return () => {
            track.removeEventListener('scroll', updateScrollControls);
            window.removeEventListener('resize', updateScrollControls);
            resizeObserver.disconnect();
        };
    }, [stories.length]);

    useEffect(() => {
        if (!isCreatorOpen) return;

        const previousActiveElement = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const card = creatorCardRef.current;
        const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        card?.querySelector<HTMLElement>(focusableSelector)?.focus();

        const handleDialogKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsCreatorOpen(false);
                return;
            }

            if (event.key !== 'Tab' || !card) return;
            const focusableElements = Array.from(card.querySelectorAll<HTMLElement>(focusableSelector));
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (!firstElement || !lastElement) {
                event.preventDefault();
            } else if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        window.addEventListener('keydown', handleDialogKeyDown);
        return () => {
            window.removeEventListener('keydown', handleDialogKeyDown);
            previousActiveElement?.focus();
        };
    }, [isCreatorOpen]);

    const scrollStories = (direction: -1 | 1) => {
        const track = storyTrackRef.current;
        if (!track) return;

        track.scrollBy({
            left: direction * track.clientWidth * 0.75,
            behavior: 'smooth'
        });
    };

    useEffect(() => {
        const fetchStories = async () => {
            try {
                const res = await fetch('/api/stories');
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        const normalizedStories = data.map((group: any) => ({
                            ...group,
                            slides: group.slides || group.stories || (group.image ? [group] : [])
                        }));
                        setStories(normalizedStories);
                        return;
                    }
                }
            } catch (err) {
                console.error('Failed to fetch stories, falling back to mock data', err);
            }
            try {
                const { MOCK_STORIES } = await import('@/constants/mockData');
                setStories(MOCK_STORIES);
            } catch (e) {
                console.error('Failed to load mock stories', e);
            }
        };
        fetchStories();
    }, []);

    // Real-time Stories
    useEffect(() => {
        if (!isPusherConfigured) return;

        const channel = pusherClient.subscribe('stories');

        channel.bind('new-story', (data: any) => {
            setStories(prev => {
                const existingGroupIndex = prev.findIndex(g => g.user?.username === data.user?.username);

                if (existingGroupIndex >= 0) {
                    const newGroups = [...prev];
                    const group = { ...newGroups[existingGroupIndex] };
                    group.stories = [data, ...(group.stories || [])];
                    group.latestAt = data.createdAt;
                    newGroups.splice(existingGroupIndex, 1);
                    return [group, ...newGroups];
                }

                const newGroup = {
                    id: data.userId || String(Date.now()),
                    user: data.user,
                    stories: [data],
                    hasViewed: false,
                    latestAt: data.createdAt
                };
                return [newGroup, ...prev];
            });
        });

        return () => {
            pusherClient.unsubscribe('stories');
        };
    }, []);

    const handleStoryClick = (userIndex: number) => {
        setSelectedStoryIndex(userIndex);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handlePublishStory = async () => {
        if (!previewImage) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            
            // Build rich metadata string prefix if poll or music attached
            let finalPayload = previewImage;
            if (hasPoll || selectedMusic !== 'None' || selectedFilter !== 'none') {
                const meta = {
                    filter: selectedFilter,
                    music: selectedMusic !== 'None' ? selectedMusic : undefined,
                    poll: hasPoll ? { question: pollQuestion, opt1: pollOption1, opt2: pollOption2 } : undefined
                };
                finalPayload = `[STORY_META:${JSON.stringify(meta)}]:${previewImage}`;
            }

            formData.append('image', finalPayload);
            await createStory(formData);

            setIsUploading(false);
            setIsCreatorOpen(false);
            setPreviewImage(null);
            setHasPoll(false);
            setSelectedFilter('none');
            setSelectedMusic('None');
        } catch (error) {
            console.error('Failed to upload story', error);
            setIsUploading(false);
        }
    };

    const activeFilterObj = FILTER_PRESETS.find(f => f.id === selectedFilter) || FILTER_PRESETS[0];

    return (
        <>
            <div className={styles.storyTrackWrapper}>
                <div
                    className={styles.storyBar}
                    ref={storyTrackRef}
                    aria-label="Stories"
                    role="group"
                >
                {/* Your Story button */}
                <motion.button
                    type="button"
                    className={styles.storyContainer}
                    aria-label="Add a story"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsCreatorOpen(true)}
                >
                    <div className={`${styles.storyCircle} ${styles.yourStory}`}>
                        <Image
                            src="https://i.pravatar.cc/150?u=antigravity"
                            alt="Your Story"
                            className={styles.avatar}
                            width={72}
                            height={72}
                        />
                        <div className={styles.plusBadge}>
                            <Plus size={14} />
                        </div>
                    </div>
                    <span className={styles.username}>Your Story</span>
                </motion.button>

                {/* Other User Stories */}
                {stories.map((storyGroup, index) => (
                    <motion.button
                        type="button"
                        key={storyGroup.id || index}
                        className={styles.storyContainer}
                        aria-label={`View ${storyGroup.user?.username || 'Creator'}'s story${storyGroup.hasViewed ? '' : ', new'}`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleStoryClick(index)}
                    >
                        <div className={`${styles.storyCircle} ${storyGroup.hasViewed ? styles.seen : styles.hasNew}`}>
                            <Image
                                src={storyGroup.user?.avatar || `https://i.pravatar.cc/150?u=${index}`}
                                alt={storyGroup.user?.username || 'User'}
                                className={styles.avatar}
                                width={72}
                                height={72}
                            />
                        </div>
                        <span className={styles.username}>{storyGroup.user?.username || 'Creator'}</span>
                    </motion.button>
                ))}
                </div>
                {canScrollLeft && (
                    <button
                        type="button"
                        className={`${styles.scrollButton} ${styles.scrollButtonLeft}`}
                        onClick={() => scrollStories(-1)}
                        aria-label="Scroll to earlier stories"
                    >
                        <ChevronLeft size={18} />
                    </button>
                )}
                {canScrollRight && (
                    <button
                        type="button"
                        className={`${styles.scrollButton} ${styles.scrollButtonRight}`}
                        onClick={() => scrollStories(1)}
                        aria-label="Scroll to more stories"
                    >
                        <ChevronRight size={18} />
                    </button>
                )}
            </div>

            {/* Story Viewer Modal */}
            {selectedStoryIndex !== null && (
                <StoryViewer
                    stories={stories}
                    initialStoryIndex={selectedStoryIndex}
                    isOpen={selectedStoryIndex !== null}
                    onClose={() => setSelectedStoryIndex(null)}
                />
            )}

            {/* Story Creator Studio Modal */}
            <AnimatePresence>
                {isCreatorOpen && (
                    <motion.div
                        className={styles.creatorOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsCreatorOpen(false)}
                    >
                        <motion.div
                            className={styles.creatorCard}
                            ref={creatorCardRef}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="story-creator-title"
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className={styles.creatorHeader}>
                                <h3 id="story-creator-title" className={styles.creatorTitle}>Create Story</h3>
                                <button
                                    type="button"
                                    className={styles.closeCreatorBtn}
                                    onClick={() => setIsCreatorOpen(false)}
                                    aria-label="Close story creator"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Image Preview / Upload Area */}
                            <div className={styles.previewContainer}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    onChange={handleImageSelect}
                                    aria-label="Choose a photo for your story"
                                />

                                {previewImage ? (
                                    <>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={previewImage}
                                            alt="Story preview"
                                            className={styles.previewImage}
                                            style={{ filter: activeFilterObj.filter }}
                                        />

                                        {/* Music Badge Overlay */}
                                        {selectedMusic !== 'None' && (
                                            <div className={styles.floatingMusicBadge}>
                                                <Music size={14} color="#6366f1" />
                                                <span>{selectedMusic.split('•')[0]}</span>
                                            </div>
                                        )}

                                        {/* Poll Sticker Overlay */}
                                        {hasPoll && (
                                            <div className={styles.floatingPollSticker}>
                                                <div className={styles.pollQuestionText}>{pollQuestion}</div>
                                                <div className={styles.pollOptionsRow}>
                                                    <div className={styles.pollOptionBtn}>{pollOption1}</div>
                                                    <div className={styles.pollOptionBtn}>{pollOption2}</div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        className={styles.emptyUploadState}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <div className={styles.emptyUploadIcon}>
                                            <LucideImage size={32} />
                                        </div>
                                        <span style={{ fontWeight: 700 }}>Choose a photo for your Story</span>
                                        <span style={{ fontSize: 12, opacity: 0.8 }}>JPG, PNG or WEBP</span>
                                    </button>
                                )}
                            </div>

                            {/* Creator Controls */}
                            {previewImage && (
                                <div className={styles.creatorControls}>
                                    {/* Filters Bar */}
                                    <div>
                                        <div className={styles.controlSectionTitle}>Aesthetic Filters</div>
                                        <div className={styles.filtersScroll}>
                                            {FILTER_PRESETS.map(f => (
                                                <button
                                                    type="button"
                                                    key={f.id}
                                                    className={`${styles.filterPill} ${selectedFilter === f.id ? styles.filterPillActive : ''}`}
                                                    aria-pressed={selectedFilter === f.id}
                                                    onClick={() => setSelectedFilter(f.id)}
                                                >
                                                    {f.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Interactive Tools (Poll & Music) */}
                                    <div>
                                        <div className={styles.controlSectionTitle}>Interactive Stickers</div>
                                        <div className={styles.stickerToolsRow}>
                                            <button
                                                type="button"
                                                className={`${styles.toolBtn} ${hasPoll ? styles.toolBtnActive : ''}`}
                                                aria-pressed={hasPoll}
                                                onClick={() => setHasPoll(!hasPoll)}
                                            >
                                                <BarChart2 size={16} />
                                                {hasPoll ? 'Remove Poll' : 'Add Poll Sticker'}
                                            </button>

                                            <select
                                                className={styles.toolBtn}
                                                value={selectedMusic}
                                                aria-label="Choose story music"
                                                onChange={e => setSelectedMusic(e.target.value)}
                                                style={{ outline: 'none' }}
                                            >
                                                {SOUNDTRACKS.map(s => (
                                                    <option key={s} value={s} style={{ background: '#121220' }}>
                                                        🎵 {s}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Poll Customization Inputs */}
                                    {hasPoll && (
                                        <div className={styles.pollInputsWrapper}>
                                            <input
                                                type="text"
                                                className={styles.pollInput}
                                                placeholder="Poll Question..."
                                                aria-label="Poll question"
                                                value={pollQuestion}
                                                onChange={e => setPollQuestion(e.target.value)}
                                            />
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <input
                                                    type="text"
                                                    className={styles.pollInput}
                                                    placeholder="Option 1"
                                                    aria-label="Poll option one"
                                                    value={pollOption1}
                                                    onChange={e => setPollOption1(e.target.value)}
                                                />
                                                <input
                                                    type="text"
                                                    className={styles.pollInput}
                                                    placeholder="Option 2"
                                                    aria-label="Poll option two"
                                                    value={pollOption2}
                                                    onChange={e => setPollOption2(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Publish Button */}
                                    <button
                                        type="button"
                                        className={styles.publishStoryBtn}
                                        onClick={handlePublishStory}
                                        disabled={isUploading}
                                    >
                                        {isUploading ? (
                                            <Loader2 size={20} className={styles.spinner} />
                                        ) : (
                                            <>
                                                <Send size={16} />
                                                Share to Your Story
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default StoryBar;
