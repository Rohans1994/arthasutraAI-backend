import crypto from 'crypto';

const KITE_API_KEY = process.env.KITE_API_KEY || 'z61wefwhpdnnxoou';
const KITE_API_SECRET = process.env.KITE_API_SECRET || '';

// In-memory token storage (UID -> access_token)
// For a production app, this should be in Redis or Firebase
const tokenStore: Record<string, string> = {};

export function getLoginUrl(): string {
    return `https://kite.zerodha.com/connect/login?v=3&api_key=${KITE_API_KEY}`;
}

export async function generateSession(requestToken: string, uid: string): Promise<boolean> {
    const checksum = crypto.createHash('sha256').update(`${KITE_API_KEY}${requestToken}${KITE_API_SECRET}`).digest('hex');

    const params = new URLSearchParams({
        api_key: KITE_API_KEY,
        request_token: requestToken,
        checksum: checksum
    });

    try {
        const response = await fetch('https://api.kite.trade/session/token', {
            method: 'POST',
            body: params,
            headers: {
                'X-Kite-Version': '3'
            }
        });

        const data = await response.json();
        console.log(`data from zerodha =========${data}`)
        if (data.status === 'success') {
            tokenStore[uid] = data.data.access_token;
            return true;
        }
        console.error('Zerodha session error:', data);
        return false;
    } catch (error) {
        console.error('Zerodha session request failed:', error);
        return false;
    }
}

export async function getHoldings(uid: string): Promise<any> {
    const token = tokenStore[uid];
    if (!token) throw new Error('Not connected to Zerodha');

    const response = await fetch('https://api.kite.trade/portfolio/holdings', {
        headers: {
            'X-Kite-Version': '3',
            'Authorization': `token ${KITE_API_KEY}:${token}`
        }
    });

    const data = await response.json();
    if (data.status === 'success') {
        return data.data;
    }
    throw new Error(data.message || 'Failed to fetch holdings');
}
