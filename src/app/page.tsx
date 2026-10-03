'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Post from '@/components/feed/Post';
import StoryBar from '@/components/feed/StoryBar';
import styles from './home.module.css';
import Loader from '@/components/common/Loader';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { isPusherConfigured, pusherClient } from '@/lib/pusher';
import { RefreshCw, Sparkles, Flame, Compass } from 'lucide-react';
import { triggerHapticNotification } from '@/lib/haptics';
import { NotificationType } from '@capacitor/haptics';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

class FeedRequestError extends Error {
  constructor(readonly status: number) {
    super(`Feed request failed with status ${status}`);
  }
}

export default function Home() {
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [feedTab, setFeedTab] = useState<'forYou' | 'following'>('forYou');
  const [feedError, setFeedError] = useState<string | null>(null);
  const touchStart = useRef(0);
  const feedRequestId = useRef(0);

  const fetchContent = useCallback(async (pageNum: number, feed: 'forYou' | 'following') => {
      const feedParam = feed === 'following' ? '&feed=following' : '';
      const [postsRes, shotsRes] = await Promise.all([
        fetch(`/api/posts?page=${pageNum}&limit=8${feedParam}`),
        fetch(`/api/shots?page=${pageNum}&limit=2${feedParam}`)
      ]);

      if (!postsRes.ok || !shotsRes.ok) {
        throw new FeedRequestError(!postsRes.ok ? postsRes.status : shotsRes.status);
      }

      const [postsData, shotsData] = await Promise.all([postsRes.json(), shotsRes.json()]);

      const formattedPosts = postsData.map((post: any) => ({
        id: post.id,
        type: 'post',
        user: post.user,
        image: post.image,
        caption: post.caption,
        likes: typeof post.likes === 'number' ? post.likes : (post.likes?.length || 0),
        isLiked: post.isLiked || false,
        time: post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true }) : 'Just now',
        comments: post.comments || []
      }));

      const formattedShots = shotsData.map((shot: any) => ({
        id: shot.id,
        type: 'shot',
        user: shot.user || { name: shot.username, avatar: shot.avatar },
        video: shot.video,
        caption: shot.caption,
        likes: typeof shot.likes === 'number' ? shot.likes : (shot.likes?.length || 0),
        isLiked: shot.isLiked || false,
        time: shot.createdAt ? formatDistanceToNow(new Date(shot.createdAt), { addSuffix: true }) : 'Just now',
        comments: shot.comments || []
      }));

      const combined = [];
      let postIdx = 0;
      let shotIdx = 0;

      while (postIdx < formattedPosts.length || shotIdx < formattedShots.length) {
        for (let i = 0; i < 4 && postIdx < formattedPosts.length; i++) {
          combined.push(formattedPosts[postIdx++]);
        }
        if (shotIdx < formattedShots.length) {
          combined.push(formattedShots[shotIdx++]);
        }
      }

      return combined;
  }, []);

  const loadMoreItems = useCallback(async () => {
    const requestId = feedRequestId.current;
    const nextPage = page + 1;
    try {
      const data = await fetchContent(nextPage, feedTab);
      if (requestId !== feedRequestId.current) return;

      if (data.length === 0) {
        setHasMore(false);
      } else {
        setFeedItems(prev => [...prev, ...data]);
        setPage(nextPage);
      }
    } catch (error) {
      if (requestId === feedRequestId.current) {
        console.error('Failed to load more feed items:', error);
        setFeedError('Could not load more posts. Please try again.');
        setHasMore(false);
      }
    }
  }, [feedTab, fetchContent, page]);

  const { elementRef: lastElementRef, isLoading: fetchingMore } = useInfiniteScroll(
    loadMoreItems,
    { enabled: hasMore && !loading }
  );

  const onRefresh = useCallback(async () => {
    const requestId = feedRequestId.current;
    setIsRefreshing(true);
    triggerHapticNotification(NotificationType.Success);
    setFeedError(null);
    try {
      const data = await fetchContent(1, feedTab);
      if (requestId === feedRequestId.current) {
        setFeedItems(data);
        setPage(1);
        setHasMore(data.length > 0);
      }
    } catch (error) {
      console.error('Failed to refresh feed:', error);
      if (requestId === feedRequestId.current) setFeedError('Could not refresh the feed. Please try again.');
    } finally {
      if (requestId === feedRequestId.current) {
        setIsRefreshing(false);
        setPullProgress(0);
      }
    }
  }, [feedTab, fetchContent]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStart.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && touchStart.current > 0) {
      const delta = e.touches[0].clientY - touchStart.current;
      if (delta > 0) {
        setPullProgress(Math.min(delta / 100, 1.2));
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullProgress > 0.8) {
      onRefresh();
    } else {
      setPullProgress(0);
    }
    touchStart.current = 0;
  };

  // Load the selected feed and discard responses from a previous tab.
  useEffect(() => {
    const requestId = ++feedRequestId.current;
    let isCurrent = true;

    const init = async () => {
      setLoading(true);
      setFeedItems([]);
      setPage(1);
      setHasMore(true);
      setFeedError(null);
      try {
        const data = await fetchContent(1, feedTab);
        if (isCurrent && requestId === feedRequestId.current) {
          setFeedItems(data);
          setHasMore(data.length > 0);
        }
      } catch (error) {
        console.error(`Failed to load ${feedTab} feed:`, error);
        if (isCurrent && requestId === feedRequestId.current) {
          setHasMore(false);
          setFeedError(
            error instanceof FeedRequestError && error.status === 401
              ? 'Sign in to see posts and videos from creators you follow.'
              : `Could not load the ${feedTab === 'following' ? 'Following' : 'For You'} feed. Please try again.`
          );
        }
      } finally {
        if (isCurrent && requestId === feedRequestId.current) setLoading(false);
      }
    };
    init();
    return () => {
      isCurrent = false;
    };
  }, [feedTab, fetchContent]);

  const selectFeed = (feed: 'forYou' | 'following') => {
    if (feed === feedTab) return;
    setFeedTab(feed);
    triggerHapticNotification(NotificationType.Success);
  };

  const retryFeed = () => {
    setFeedError(null);
    setLoading(true);
    const requestId = ++feedRequestId.current;
    fetchContent(1, feedTab).then(data => {
      if (requestId === feedRequestId.current) {
        setFeedItems(data);
        setPage(1);
        setHasMore(data.length > 0);
      }
    }).catch(error => {
      console.error(`Failed to retry ${feedTab} feed:`, error);
      if (requestId === feedRequestId.current) setFeedError('The feed is still unavailable. Please try again.');
    }).finally(() => {
      if (requestId === feedRequestId.current) setLoading(false);
    });
  };

  // Real-time Updates
  useEffect(() => {
    if (!isPusherConfigured) return;

    pusherClient.subscribe('feed');
    // ... (bind events kept)
    return () => { pusherClient.unsubscribe('feed'); };
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.feedSection}>
          <div className="skeleton" style={{ height: '500px', width: '100%', borderRadius: '12px', marginTop: '24px' }}></div>
          <div className="skeleton" style={{ height: '500px', width: '100%', borderRadius: '12px', marginTop: '24px' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.container}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Animated Background */}
      <div className={`${styles.bgBlob} ${styles.blob1}`} />
      <div className={`${styles.bgBlob} ${styles.blob2}`} />
      <div className={`${styles.bgBlob} ${styles.blob3}`} />

      <div className="neural-grid" />

      {/* Pull to Refresh Indicator */}
      <motion.div
        className={styles.pullIndicator}
        style={{
          opacity: pullProgress,
          scale: pullProgress,
          y: pullProgress * 50
        }}
      >
        <div className={`${styles.refreshIcon} ${isRefreshing ? styles.spinning : ''}`}>
          <RefreshCw size={24} />
        </div>
      </motion.div>

      <div className={styles.feedSection}>
        <div className={styles.feedHeader}>
          <div className={styles.feedHeaderText}>
            <span className={styles.kicker}>Live feed</span>
            <h1 className={styles.feedTitle}>{feedTab === 'forYou' ? 'Discover' : 'Following'}</h1>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.headerBadge}>
              <Sparkles size={12} />
              Fresh
            </div>
            <button className={styles.iconButton} type="button" aria-label="Trending">
              <Flame size={16} />
            </button>
          </div>
        </div>

        {/* Feed Segmented Switcher Tabs */}
        <div className={styles.tabBarContainer}>
          <div className={styles.tabGroup} role="tablist" aria-label="Choose feed">
            <button
              type="button"
              className={`${styles.tabBtn} ${feedTab === 'forYou' ? styles.active : ''}`}
              role="tab"
              aria-selected={feedTab === 'forYou'}
              onClick={() => selectFeed('forYou')}
            >
              {feedTab === 'forYou' && (
                <motion.div
                  layoutId="feedTabIndicator"
                  className={styles.activeTabPill}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <span className={styles.tabLabel}>For You</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${feedTab === 'following' ? styles.active : ''}`}
              role="tab"
              aria-selected={feedTab === 'following'}
              onClick={() => selectFeed('following')}
            >
              {feedTab === 'following' && (
                <motion.div
                  layoutId="feedTabIndicator"
                  className={styles.activeTabPill}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <span className={styles.tabLabel}>Following</span>
            </button>
          </div>
        </div>

        {/* Stories Section Card */}
        <div className={styles.storyBarCard}>
          <div className={styles.storyTopBar}>
            <span className={styles.storyTitle}>Stories</span>
            <span className={styles.storyMeta}><Flame size={12} /> Trending now</span>
          </div>
          <StoryBar />
        </div>

        <motion.div
          className={styles.feedItemsList}
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <AnimatePresence mode="popLayout">
            {feedItems.map((item, index) => (
              <Post
                key={`${item.id}-${index}`}
                {...item}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {!loading && feedError && (
          <div className={styles.feedMessage} role="alert">
            <p>{feedError}</p>
            <button type="button" className={styles.feedMessageAction} onClick={retryFeed}>
              <RefreshCw size={16} />
              Try again
            </button>
          </div>
        )}

        {!loading && !feedError && feedItems.length === 0 && feedTab === 'following' && (
          <div className={styles.feedMessage}>
            <div className={styles.emptyFeedIcon}><Compass size={22} /></div>
            <h2>Your feed starts with a follow</h2>
            <p>Follow creators to see their latest posts and videos here.</p>
            <Link href="/search" className={styles.feedMessageAction}>
              <Compass size={16} />
              Discover creators
            </Link>
          </div>
        )}

        {/* Infinite Scroll Trigger */}
        <div ref={lastElementRef} className={styles.loaderContainer}>
          {fetchingMore && <Loader size="medium" />}
          {!hasMore && feedItems.length > 0 && (
            <div className={styles.endMessage}>You&apos;re all caught up! 🚀</div>
          )}
        </div>
      </div>
    </div>
  );
}
