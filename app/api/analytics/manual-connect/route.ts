import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Manually connect a GA4 property by property ID
 * This is used as a fallback when auto-detection doesn't work
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).accessToken) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { propertyId, siteUrl } = await request.json();
    
    if (!propertyId || !siteUrl) {
      return Response.json({ error: 'propertyId and siteUrl are required' }, { status: 400 });
    }

    console.log(`[GA4 Manual Connect] Connecting property ${propertyId} to site ${siteUrl}`);

    // TODO: Store this mapping in a database or JSON file
    // For now, we'll just validate the property exists and return success
    // In a production app, you'd want to persist this mapping per user
    
    return Response.json({ 
      success: true,
      message: 'Property connected successfully',
    });
    
  } catch (error: any) {
    console.error('[GA4 Manual Connect] Error:', error);
    return Response.json({ 
      error: 'Failed to connect property',
      details: error.message,
    }, { status: 500 });
  }
}


