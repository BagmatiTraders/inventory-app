import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

let cachedAuth: any = null;

export async function getGoogleSheetsClient() {
    if (cachedAuth) {
        return google.sheets({ version: 'v4', auth: cachedAuth });
    }

    // Explicitly load the service account JSON to avoid ADC path resolution issues
    // on Windows with spaces in the path.
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (!credPath) {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.')
    }

    const resolvedPath = path.resolve(credPath)
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Google credentials file not found at: ${resolvedPath}`)
    }

    const keyFile = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'))

    const auth = new google.auth.JWT({
        email: keyFile.client_email,
        key: keyFile.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })

    await auth.authorize()
    cachedAuth = auth
    return google.sheets({ version: 'v4', auth: cachedAuth });
}
