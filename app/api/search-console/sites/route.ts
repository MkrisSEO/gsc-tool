import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: (session as any).accessToken });
    const webmasters = google.webmasters({ version: 'v3', auth: oauth2 });

    const res = await webmasters.sites.list();
    const sites = res.data.siteEntry ?? [];

    return NextResponse.json({ sites });
  } catch (error: any) {
    console.error('Error fetching sites:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sites' },
      { status: 500 }
    );
  }
}

