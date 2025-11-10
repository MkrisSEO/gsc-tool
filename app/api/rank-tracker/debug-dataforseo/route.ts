import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { checkKeywordPosition } from '@/lib/dataforseo';

/**
 * Debug endpoint to test DataForSEO with verbose logging
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { keyword, siteUrl } = body;

    if (!keyword || !siteUrl) {
      return NextResponse.json(
        { error: 'Missing required parameters: keyword, siteUrl' },
        { status: 400 }
      );
    }

    const targetDomain = siteUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '');

    console.log('\n========================================');
    console.log('[DataForSEO Debug] Testing single keyword');
    console.log('Keyword:', keyword);
    console.log('Target Domain:', targetDomain);
    console.log('Login:', process.env.DATAFORSEO_LOGIN || 'NOT SET');
    console.log('Password:', process.env.DATAFORSEO_PASSWORD ? '***SET***' : 'NOT SET');
    console.log('========================================\n');

    const result = await checkKeywordPosition(keyword, targetDomain);

    console.log('\n========================================');
    console.log('[DataForSEO Debug] Result:');
    console.log('Position:', result.position);
    console.log('URL:', result.url);
    console.log('Title:', result.title);
    console.log('Cost:', result.cost);
    console.log('SERP Features:', result.serpFeatures);
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      keyword,
      targetDomain,
      result,
      env: {
        loginSet: !!process.env.DATAFORSEO_LOGIN,
        passwordSet: !!process.env.DATAFORSEO_PASSWORD,
      },
    });
  } catch (error: any) {
    console.error('\n========================================');
    console.error('[DataForSEO Debug] ERROR:', error.message);
    console.error('Stack:', error.stack);
    console.error('========================================\n');
    
    return NextResponse.json(
      { 
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

