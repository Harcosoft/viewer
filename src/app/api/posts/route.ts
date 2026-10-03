import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { FeedService } from '@/services/feed-service';
import { getSession } from '@/lib/auth';
import { MOCK_POSTS } from '@/constants/mockData';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const skip = (page - 1) * limit;
        const followingOnly = searchParams.get('feed') === 'following';

        const session = await getSession();

        if (!session) {
            if (followingOnly) {
                return NextResponse.json({ error: 'Sign in to view posts from creators you follow' }, { status: 401 });
            }

            const posts = await prisma.post.findMany({
                include: {
                    user: { select: { username: true, avatar: true, fullName: true } },
                    likes: true,
                    comments: { include: { user: { select: { username: true } } } },
                    media: { orderBy: { order: 'asc' } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            });

            const mappedPosts = posts.map(p => ({
                ...p,
                image: p.media?.[0]?.url || ''
            }));

            return NextResponse.json(mappedPosts);
        }

        const rankedFeed = await FeedService.generateFeed(session.id, page, limit, followingOnly);
        if (followingOnly) return NextResponse.json(rankedFeed);

        if (rankedFeed.length === 0 && page === 1) {
            const fallback = MOCK_POSTS.slice(0, limit).map(post => ({
                id: post.id,
                user: {
                    id: post.user.id,
                    username: post.user.username,
                    avatar: post.user.avatar,
                    fullName: post.user.name,
                },
                image: post.image,
                caption: post.caption,
                likes: post.likes,
                createdAt: new Date(post.createdAt).toISOString(),
                comments: [],
                media: [{ url: post.image, type: 'IMAGE', order: 0 }],
                isLiked: post.isLiked,
                isSaved: post.isSaved,
            }));
            return NextResponse.json(fallback);
        }

        return NextResponse.json(rankedFeed);
    } catch (error) {
        console.warn('Database unavailable for /api/posts, using mock data fallback:', error instanceof Error ? error.message : String(error));

        if (new URL(request.url).searchParams.get('feed') === 'following') {
            return NextResponse.json({ error: 'Following feed is temporarily unavailable' }, { status: 503 });
        }

        const start = ((parseInt(new URL(request.url).searchParams.get('page') || '1') - 1) * parseInt(new URL(request.url).searchParams.get('limit') || '10'));
        const pageSize = parseInt(new URL(request.url).searchParams.get('limit') || '10');

        const fallback = MOCK_POSTS.slice(start, start + pageSize).map(post => ({
            id: post.id,
            user: {
                id: post.user.id,
                username: post.user.username,
                avatar: post.user.avatar,
                fullName: post.user.name,
            },
            image: post.image,
            caption: post.caption,
            likes: post.likes,
            createdAt: new Date(post.createdAt).toISOString(),
            comments: [],
            media: [{ url: post.image, type: 'IMAGE', order: 0 }],
            isLiked: post.isLiked,
            isSaved: post.isSaved,
        }));

        return NextResponse.json(fallback);
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { caption, media, location } = body;

        if (!media || media.length === 0) {
            return NextResponse.json({ error: 'At least one media item is required' }, { status: 400 });
        }

        const newPost = await prisma.post.create({
            data: {
                caption: caption ? caption.trim() : '',
                location: location ? location.trim() : '',
                userId: session.id,
                media: {
                    create: media.map((m: any, idx: number) => ({
                        url: m.url,
                        type: m.type || 'IMAGE',
                        order: idx
                    }))
                }
            },
            include: {
                user: true,
                media: true
            }
        });

        return NextResponse.json(newPost, { status: 201 });
    } catch (error) {
        console.error('API Error (POST /api/posts):', error);
        return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
    }
}
