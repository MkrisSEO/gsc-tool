// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { siteUrl, conditions } = body;

  console.log('🧪 [Test Fetch] Starting...', {
    siteUrl,
    conditionCount: conditions?.length,
    hasAccessToken: !!(session as any).accessToken,
  });

  try {
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: (session as any).accessToken });
    const webmasters = google.webmasters({ version: 'v3', auth: oauth2 });

    console.log('🧪 [Test Fetch] OAuth2 configured');

    // Fetch pages from Search Analytics
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 180);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log('🧪 [Test Fetch] Fetching GSC data...', {
      startDate: startDateStr,
      endDate: endDateStr,
    });

    const response = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: startDateStr,
        endDate: endDateStr,
        dimensions: ['page'],
        rowLimit: 25000,
      },
    });

    const allPages = (response.data.rows || []).map((row) => row.keys?.[0] || '');

    console.log('✅ [Test Fetch] Success!', {
      totalPages: allPages.length,
      samplePages: allPages.slice(0, 5),
    });

    return NextResponse.json({
      success: true,
      totalPages: allPages.length,
      samplePages: allPages.slice(0, 10),
    });
  } catch (error: any) {
    console.error('❌ [Test Fetch] Error:', {
      name: error.name,
      message: error.message,
      code: error.code,
      errors: error.errors,
      stack: error.stack,
    });

    return NextResponse.json({
      success: false,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        errors: error.errors,
      },
    }, { status: 500 });
  }
}

