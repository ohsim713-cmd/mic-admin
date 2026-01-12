import NextAuth from 'next-auth';
import TwitterProvider from 'next-auth/providers/twitter';
import GoogleProvider from 'next-auth/providers/google';
import * as fs from 'fs';
import * as path from 'path';

const CREDENTIALS_PATH = path.join(process.cwd(), 'knowledge', 'sns_credentials.json');

function loadCredentials() {
    try {
        if (fs.existsSync(CREDENTIALS_PATH)) {
            const data = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Failed to load credentials:', error);
    }
    return {
        twitter: {},
        youtube: {}
    };
}

function saveTokens(provider: string, accessToken: string, refreshToken?: string) {
    try {
        const credentials = loadCredentials();

        if (provider === 'twitter') {
            credentials.twitter = {
                ...credentials.twitter,
                oauthAccessToken: accessToken,
                oauthRefreshToken: refreshToken || ''
            };
        } else if (provider === 'google') {
            credentials.youtube = {
                ...credentials.youtube,
                oauthAccessToken: accessToken,
                oauthRefreshToken: refreshToken || ''
            };
        }

        const dir = path.dirname(CREDENTIALS_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2));
        return true;
    } catch (error) {
        console.error('Failed to save tokens:', error);
        return false;
    }
}

const handler = NextAuth({
    providers: [
        TwitterProvider({
            clientId: process.env.TWITTER_CLIENT_ID || '',
            clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
            version: '2.0',
        }),
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
            authorization: {
                params: {
                    scope: 'openid email profile https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube',
                    access_type: 'offline',
                    prompt: 'consent',
                }
            }
        }),
    ],
    callbacks: {
        async jwt({ token, account }) {
            if (account) {
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.provider = account.provider;

                if (account.access_token) {
                    saveTokens(account.provider, account.access_token, account.refresh_token);
                }
            }
            return token;
        },
        async session({ session, token }) {
            // @ts-ignore
            session.accessToken = token.accessToken;
            // @ts-ignore
            session.provider = token.provider;
            return session;
        },
        async redirect({ url, baseUrl }) {
            return `${baseUrl}/settings?oauth=success`;
        }
    },
    pages: {
        signIn: '/settings',
        error: '/settings?oauth=error',
    }
});

export { handler as GET, handler as POST };
