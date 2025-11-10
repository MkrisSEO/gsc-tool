import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const siteUrl = searchParams.get('siteUrl');
    const keyword = searchParams.get('keyword');

    if (!siteUrl || !keyword) {
      return NextResponse.json({ error: 'Missing siteUrl or keyword' }, { status: 400 });
    }

    const site = await prisma.site.findUnique({
      where: { siteUrl },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const rankKeyword = await prisma.rankKeyword.findUnique({
      where: {
        siteId_keyword: {
          siteId: site.id,
          keyword,
        },
      },
      include: {
        history: {
          orderBy: {
            date: 'desc',
          },
          take: 10,
        },
      },
    });

    return NextResponse.json({
      keyword: rankKeyword,
      historyCount: rankKeyword?.history.length || 0,
      latestHistory: rankKeyword?.history[0] || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

