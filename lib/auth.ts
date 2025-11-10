import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { google } from 'googleapis';

/**
 * Refreshes the access token using the refresh token
 */
async function refreshAccessToken(token: any) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: token.refresh_token,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    return {
      ...token,
      access_token: credentials.access_token,
      expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : token.expires_at,
      refresh_token: credentials.refresh_token ?? token.refresh_token, // Fall back to old refresh token
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly',
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    })
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ account }) {
      try {
        if (!account?.access_token) {
          console.error('No access token in account');
          return false;
        }
        const oauth2 = new google.auth.OAuth2();
        oauth2.setCredentials({ access_token: account.access_token });
        const webmasters = google.webmasters({ version: 'v3', auth: oauth2 });
        const res = await webmasters.sites.list();
        const sites = res.data.siteEntry ?? [];
        console.log('Search Console sites found:', sites.length);
        if (sites.length === 0) {
          console.warn('User has no Search Console properties');
        }
        // Allow sign-in even if no properties (user can add them later)
        return true;
      } catch (err: any) {
        console.error('SignIn callback error:', err.message || err);
        console.error('Error details:', err);
        // Allow sign-in anyway - we'll handle Search Console access later
        return true;
      }
    },
    async jwt({ token, account }) {
      // Initial sign in
      if (account) {
        token.access_token = account.access_token;
        token.expires_at = account.expires_at;
        token.refresh_token = account.refresh_token;
        return token;
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < (token.expires_at as number) * 1000) {
        return token;
      }

      // Access token has expired, try to refresh it
      console.log('Access token expired, refreshing...');
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      (session as any).accessToken = token.access_token;
      (session as any).error = token.error;
      return session;
    }
  },
  pages: {
    // Default pages; AccessDenied will redirect with error=AccessDenied
  }
};
