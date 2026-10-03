import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { MOCK_SHOTS } from '@/constants/mockData';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const skip = (page - 1) * limit;
        const followingOnly = searchParams.get('feed') === 'following';
        const session = followingOnly ? await getSession() : null;

        if (followingOnly && !session) {
            return NextResponse.json({ error: 'Sign in to view videos from creators you follow' }, { status: 401 });
        }

        const following = session
            ? await prisma.follows.findMany({
                where: { followerId: session.id },
                select: { followingId: true }
            })
            : [];
        const followedUserIds = session
            ? [...following.map(follow => follow.followingId), session.id]
            : undefined;

        const shots = await prisma.shot.findMany({
            where: followedUserIds ? { userId: { in: followedUserIds } } : undefined,
            include: {
                user: {
                    select: {
                        username: true,
                        avatar: true,
                    }
                },
                likes: true,
                comments: {
                    include: {
                        user: {
                            select: {
                                username: true,
                                avatar: true,
                            }
                        }
                    }
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            skip,
            take: limit
        });
        // Use sample reels when no database videos exist in the public feed.
        if ((!shots || shots.length === 0) && !followingOnly && page === 1) {
            const fallback = MOCK_SHOTS.slice(skip, skip + limit).map(s => ({
                id: String(s.id),
                video: s.video,
                caption: s.caption,
                createdAt: new Date().toISOString(),
                user: {
                    username: s.username,
                    avatar: s.avatar,
                },
                likes: [],
                comments: [],
            }));
            return NextResponse.json(fallback);
        }

        return NextResponse.json(shots);
    } catch (error) {
        console.error('API Error (GET /api/shots):', error);
        if (new URL(request.url).searchParams.get('feed') === 'following') {
            return NextResponse.json({ error: 'Following videos are temporarily unavailable' }, { status: 503 });
        }
        // Keep the public feed available when the database cannot be reached.
        try {
            const { searchParams } = new URL(request.url);
            const page = parseInt(searchParams.get('page') || '1');
            const limit = parseInt(searchParams.get('limit') || '10');
            const skip = (page - 1) * limit;
            if (page !== 1) {
                return NextResponse.json([]);
            }

            const fallback = MOCK_SHOTS.slice(skip, skip + limit).map(s => ({
                id: String(s.id),
                video: s.video,
                caption: s.caption,
                createdAt: new Date().toISOString(),
                user: {
                    username: s.username,
                    avatar: s.avatar,
                },
                likes: [],
                comments: [],
            }));
            return NextResponse.json(fallback);
        } catch (fallbackError) {
            console.error('Critical Fail (GET /api/shots fallback):', fallbackError);
            return NextResponse.json({ error: 'Failed to fetch shots' }, { status: 500 });
        }
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { video, caption } = body;

        if (!video) {
            return NextResponse.json({ error: 'Video URL is required' }, { status: 400 });
        }

        const shot = await prisma.shot.create({
            data: {
                video,
                caption,
                userId: session.id,
            }
        });

        return NextResponse.json(shot, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Failed to create shot' }, { status: 500 });
    }
}
