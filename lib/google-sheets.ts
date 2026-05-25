import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

let cachedAuth: any = null;

export async function getGoogleSheetsClient() {
    if (cachedAuth) {
        return google.sheets({ version: 'v4', auth: cachedAuth });
    }

    let client_email = '';
    let private_key = '';

    // In production (Vercel), use direct environment variables for credentials
    if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        client_email = process.env.GOOGLE_CLIENT_EMAIL;
        private_key = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    } else {
        // Explicitly load the service account JSON to avoid ADC path resolution issues
        // on Windows with spaces in the path (used for local development).
        const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
        if (!credPath) {
            throw new Error('Missing Google Service Account credentials. Set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY (for Vercel), or GOOGLE_APPLICATION_CREDENTIALS (for local).')
        }

        const resolvedPath = path.resolve(credPath)
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`Google credentials file not found at: ${resolvedPath}`)
        }

        const keyFile = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'))
        client_email = keyFile.client_email
        private_key = keyFile.private_key
    }

    const auth = new google.auth.JWT({
        email: client_email,
        key: private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })

    await auth.authorize()
    cachedAuth = auth
    return google.sheets({ version: 'v4', auth: cachedAuth });
}
