import { google } from 'googleapis'

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/google/callback`
  )
}

export function getAuthUrl(accountLabel: string) {
  const client = createOAuth2Client()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    state: accountLabel,
  })
}

export async function getGmailMessages(refreshToken: string, maxResults = 20) {
  const client = createOAuth2Client()
  client.setCredentials({ refresh_token: refreshToken })
  const gmail = google.gmail({ version: 'v1', auth: client })
  const res = await gmail.users.messages.list({ userId: 'me', maxResults })
  return res.data.messages || []
}

export async function getCalendarEvents(refreshToken: string, timeMin: string, timeMax: string) {
  const client = createOAuth2Client()
  client.setCredentials({ refresh_token: refreshToken })
  const calendar = google.calendar({ version: 'v3', auth: client })
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  })
  return res.data.items || []
}

export async function getDriveFiles(refreshToken: string, query?: string) {
  const client = createOAuth2Client()
  client.setCredentials({ refresh_token: refreshToken })
  const drive = google.drive({ version: 'v3', auth: client })
  const res = await drive.files.list({
    q: query || undefined,
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
    pageSize: 20,
  })
  return res.data.files || []
}

export async function getSheetData(refreshToken: string, spreadsheetId: string, range: string) {
  const client = createOAuth2Client()
  client.setCredentials({ refresh_token: refreshToken })
  const sheets = google.sheets({ version: 'v4', auth: client })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  return res.data.values || []
}
