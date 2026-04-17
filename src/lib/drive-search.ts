import { google } from 'googleapis'
import { getToken } from './token-store'

export async function searchDriveForIO(clientName: string, ioNumber?: string) {
  const primaryToken = getToken('google_primary')
  if (!primaryToken) return []

  try {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
    auth.setCredentials(primaryToken)
    const drive = google.drive({ version: 'v3', auth })

    const queries = []
    if (ioNumber) queries.push(`name contains '${ioNumber}'`)
    queries.push(`name contains '${clientName}' and (name contains 'IO' or name contains 'insertion order' or name contains 'contract')`)

    const results = []
    for (const q of queries) {
      try {
        const res = await drive.files.list({
          q: `${q} and trashed = false`,
          fields: 'files(id,name,mimeType,webViewLink,modifiedTime)',
          pageSize: 5,
          orderBy: 'modifiedTime desc',
        })
        if (res.data.files) results.push(...res.data.files)
      } catch { /* skip query if it fails */ }
    }

    const seen = new Set<string>()
    return results.filter(f => {
      if (!f.id || seen.has(f.id)) return false
      seen.add(f.id)
      return true
    }).slice(0, 5)
  } catch (e) {
    console.error('Drive search error:', e)
    return []
  }
}
