import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';

/**
 * Extracts the domain from a URL or sc-domain: format
 */
function extractDomain(url: string): string {
  try {
    const cleaned = url.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '');
    return cleaned.split('/')[0].toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Detects GA4 property that matches the Search Console site URL
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).accessToken) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteUrl } = await request.json();
    
    if (!siteUrl) {
      return Response.json({ error: 'siteUrl is required' }, { status: 400 });
    }

    // Extract domain from GSC site URL
    const domain = extractDomain(siteUrl);
    
    console.log(`[GA4 Detection] Searching for GA4 property matching domain: ${domain}`);
    console.log(`[GA4 Detection] Access token present: ${!!(session as any).accessToken}`);
    console.log(`[GA4 Detection] Access token length: ${(session as any).accessToken?.length || 0}`);

    // Set up Google Analytics Admin API
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: (session as any).accessToken });
    
    const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth: oauth2Client });
    
    try {
      // List all GA4 accounts the user has access to
      console.log('[GA4 Detection] Calling analyticsAdmin.accounts.list()...');
      const accountsResponse = await analyticsAdmin.accounts.list();
      console.log('[GA4 Detection] Response status:', accountsResponse.status);
      console.log('[GA4 Detection] Response received:', JSON.stringify(accountsResponse.data, null, 2));
      const accounts = accountsResponse.data.accounts || [];  // ✅ FIXED: accounts (plural) not account
      console.log('[GA4 Detection] Accounts array:', accounts);
      
      console.log(`[GA4 Detection] Found ${accounts.length} GA4 accounts`);
      
      let matchedProperty = null;
      
      // Loop through accounts and properties to find a match
      for (const account of accounts) {
        try {
          const propertiesResponse = await analyticsAdmin.properties.list({
            filter: `parent:${account.name}`,
          });
          
          const properties = propertiesResponse.data.properties || [];
          
          console.log(`[GA4 Detection] Account ${account.displayName}: ${properties.length} properties`);
          
          // Try to match by domain in property metadata
          for (const property of properties) {
            const propertyWebsite = (property as any).websiteUrl || '';
            const propertyDomain = extractDomain(propertyWebsite);
            const propertyName = (property.displayName || '').toLowerCase();
            
            console.log(`[GA4 Detection] Checking property: ${property.displayName} (${propertyWebsite}) -> domain: ${propertyDomain}`);
            
            // Strategy 1: Match by website URL domain
            if (propertyDomain && propertyDomain === domain) {
              matchedProperty = {
                propertyId: property.name?.split('/').pop() || '', // Extract numeric ID
                propertyName: property.displayName,
                websiteUrl: (property as any).websiteUrl,
                matchMethod: 'website_url',
              };
              console.log(`[GA4 Detection] ✅ Match found by website URL: ${property.displayName}`);
              break;
            }
            
            // Strategy 2: Match by property name (fuzzy match with domain)
            // Check if domain contains property name or vice versa
            const domainParts = domain.split('.');
            const mainDomain = domainParts[0]; // e.g., "omregne" from "omregne.dk"
            
            if (mainDomain && propertyName && (
              propertyName.includes(mainDomain) || 
              mainDomain.includes(propertyName)
            )) {
              matchedProperty = {
                propertyId: property.name?.split('/').pop() || '',
                propertyName: property.displayName,
                websiteUrl: (property as any).websiteUrl || '(not set)',
                matchMethod: 'property_name',
              };
              console.log(`[GA4 Detection] ✅ Match found by property name: ${property.displayName}`);
              break;
            }
          }
          
          if (matchedProperty) break;
        } catch (propError: any) {
          console.error(`[GA4 Detection] Error listing properties for account ${account.name}:`, propError.message);
          continue;
        }
      }
      
      if (matchedProperty) {
        return Response.json({ 
          matched: true,
          property: matchedProperty,
        });
      } else {
        // If no match found, return all available properties for debugging
        const allProperties: any[] = [];
        const allAccounts = accountsResponse.data.accounts || [];
        for (const account of allAccounts) {
          try {
            const propertiesResponse = await analyticsAdmin.properties.list({
              filter: `parent:${account.name}`,
            });
            const properties = propertiesResponse.data.properties || [];
            properties.forEach(prop => {
              allProperties.push({
                propertyId: prop.name?.split('/').pop() || '',
                propertyName: prop.displayName,
                websiteUrl: (prop as any).websiteUrl || '(not set)',
                accountName: account.displayName,
              });
            });
          } catch (err) {
            // Skip accounts we can't access
          }
        }
        
        console.log(`[GA4 Detection] ❌ No matching GA4 property found for domain: ${domain}`);
        console.log(`[GA4 Detection] Available properties:`, allProperties);
        
        return Response.json({ 
          matched: false,
          property: null,
          searchedDomain: domain,
          availableProperties: allProperties,
        });
      }
      
    } catch (analyticsError: any) {
      // User might not have access to Analytics API
      console.error('[GA4 Detection] Analytics Admin API Error:', {
        message: analyticsError.message,
        code: analyticsError.code,
        details: analyticsError.details,
        stack: analyticsError.stack?.split('\n').slice(0, 3).join('\n'),
      });
      return Response.json({ 
        matched: false,
        property: null,
        reason: 'No Analytics access or no properties found',
        errorDetails: analyticsError.message,
        errorCode: analyticsError.code,
      });
    }
    
  } catch (error: any) {
    console.error('[GA4 Detection] Error:', error);
    return Response.json({ 
      error: 'Failed to detect GA4 property',
      details: error.message,
      matched: false 
    }, { status: 500 });
  }
}

