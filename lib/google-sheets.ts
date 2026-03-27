import { google } from 'googleapis';
import path from 'path';

let cachedAuth: any = null;

export async function getGoogleSheetsClient() {
    if (cachedAuth) {
        return google.sheets({ version: 'v4', auth: cachedAuth });
    }

    const auth = new google.auth.GoogleAuth({
        // GOOGLE_APPLICATION_CREDENTIALS should point to the JSON file
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    cachedAuth = await auth.getClient();
    return google.sheets({ version: 'v4', auth: cachedAuth });
}
