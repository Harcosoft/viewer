import prisma from '@/lib/prisma';

export type FeedItem = {
    id: string;
    type: 'post' | 'shot';
    caption: string | null;
    image: string; // compatibility field
    media: { url: string; type: string; order: number }[];
    createdAt: Date;
    user: {
        username: string;
        avatar: string | null;
        fullName: string | null;
    };
    likesCount: number;
    commentsCount: number;
    isLiked?: boolean;
    location?: string | null;
};

export const FeedService = {
    // Public: Get Feed
    async generateFeed(userId: string, page = 1, limit = 20, followingOnly = false): Promise<any[]> {
        return await FeedService._generateRun(userId, page, limit, followingOnly);
    },

    // Public: Trigger Pre-computation (e.g. from Cron) - simplified
    async precomputeFeed(userId: string) {
        await FeedService.generateFeed(userId, 1, 20);
        return { success: true };
    },

    // Internal: Actual generation logic
    async _generateRun(userId: string, page = 1, limit = 20, followingOnly = false): Promise<any[]> {
        const offset = (page - 1) * limit;

        // 1. Get User's Social Graph (Who they follow)
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            include: { following: true }
        });

        if (!currentUser) return [];

        const followingIds = currentUser.following.map(f => f.followingId);
        const userIdsToFetch = [...followingIds, userId]; // Include self

        // 2. Fetch Personal Content (Following + Self) via Prisma
        const personalPosts = await prisma.post.findMany({
            where: { userId: { in: followingOnly ? followingIds : userIdsToFetch } },
            include: {
                user: { select: { username: true, avatar: true, fullName: true } },
                likes: true,
                comments: { include: { user: { select: { username: true } } } },
                media: { orderBy: { order: 'asc' } },
            },
            orderBy: { createdAt: 'desc' },
            skip: followingOnly ? offset : 0,
            take: followingOnly ? limit : 50 // Fetch recent pool
        });

        if (followingOnly) {
            return personalPosts.map(p => ({
                ...p,
                type: 'post',
                image: p.media?.[0]?.url || '',
                likesCount: p.likes?.length || 0,
                commentsCount: p.comments?.length || 0,
                isLiked: p.likes?.some((like: any) => like.userId === userId)
            }));
        }

        // 3. Fetch Suggested Content (Global Hot Pool) via Prisma
        const suggestedPool = await prisma.post.findMany({
            include: {
                user: { select: { username: true, avatar: true, fullName: true } },
                likes: true,
                comments: { include: { user: { select: { username: true } } } },
                media: { orderBy: { order: 'asc' } },
            },
            orderBy: { createdAt: 'desc' }, // Recent first
            take: 100
        });

        // Filter suggested (remove followed users)
        const suggestedPosts = suggestedPool
            .filter((p: any) => !userIdsToFetch.includes(p.userId))
            .slice(0, 20); // Take top 20 candidates

        // 4. Ranking & Interleaving
        const allContent = [...personalPosts, ...suggestedPosts];

        // Remove duplicates
        const uniqueContent = Array.from(new Map(allContent.map(p => [p.id, p])).values());

        // Score Function
        const now = new Date().getTime();
        const scoreItem = (item: any) => {
            const created = new Date(item.createdAt).getTime();
            const hoursAgo = Math.max(0.1, (now - created) / (1000 * 60 * 60));

            // Engagement
            const likes = item.likes ? item.likes.length : 0;
            const comments = item.comments ? item.comments.length : 0;
            const engagement = likes + (comments * 2);

            // Gravity Decay
            // (Engagement + 1) / (Time + 2)^1.8
            const score = (engagement + 1) / Math.pow(hoursAgo + 2, 1.8);

            // Relationship Boost (1.5x for following)
            const isFollowing = userIdsToFetch.includes(item.userId);
            return score * (isFollowing ? 1.5 : 1.0);
        };

        // Sort by Score
        const rankedFeed = uniqueContent.sort((a, b) => scoreItem(b) - scoreItem(a));

        // Pagination
        const pagedFeed = rankedFeed.slice(offset, offset + limit);

        return pagedFeed.map(p => ({
            ...p,
            type: 'post',
            image: p.media?.[0]?.url || '', // Support legacy 'image' prop in components
            likesCount: p.likes?.length || 0,
            commentsCount: p.comments?.length || 0,
            isLiked: p.likes?.some((l: any) => l.userId === userId)
        }));
    }
};
