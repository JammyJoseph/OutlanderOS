// ─────────────────────────────────────────────────────────────────────────────
// DocuSign eSignature — JWT Grant integration.
//
// Deliberately written against the REST API with `fetch` rather than pulling in
// the DocuSign SDK: the whole surface we need is four calls, and this project
// already carries more dependency CVE exposure than it should.
//
// AUTH — JWT Grant (server-to-server, no user present):
//   1. Sign a JWT with the integration key's RSA private key.
//   2. Exchange it for an access token at the account server.
//   3. Look up the account id + base URI from /oauth/userinfo.
// The impersonated user must have granted consent once, interactively. There is
// no way around that step — see consentUrl() below, which builds the link.
//
// ENVIRONMENTS — demo (sandbox) is the default and the only one usable until
// DocuSign certifies the integration for production. Set DOCUSIGN_ENV=production
// once go-live is granted; nothing else changes.
//
// ⚠️ UNVERIFIED AGAINST A LIVE ACCOUNT. Every call below is written to the
// documented v2.1 contract, but no request has been made against real DocuSign
// credentials — there are none yet. Treat first run as the real test.

import jwt from 'jsonwebtoken'

const ENV = process.env.DOCUSIGN_ENV === 'production' ? 'production' : 'demo'

const ACCOUNT_HOST = ENV === 'production' ? 'account.docusign.com' : 'account-d.docusign.com'

export interface DocuSignConfig {
  integrationKey: string
  userId: string
  privateKey: string
  templateId: string
  accountId?: string
}

export class DocuSignNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(
      `DocuSign is not configured — missing ${missing.join(', ')}. ` +
        `See docs/DOCUSIGN.md for how to obtain them.`
    )
    this.name = 'DocuSignNotConfiguredError'
  }
}

export class DocuSignConsentRequiredError extends Error {
  constructor(public readonly url: string) {
    super(
      'DocuSign has not been granted consent for this integration. ' +
        'Open the consent URL once, signed in as the impersonated user, then retry.'
    )
    this.name = 'DocuSignConsentRequiredError'
  }
}

export function docusignConfig(): DocuSignConfig {
  const missing: string[] = []
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY
  const userId = process.env.DOCUSIGN_USER_ID
  // Private keys are commonly pasted with literal \n — normalise so both forms work.
  const privateKey = process.env.DOCUSIGN_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const templateId = process.env.DOCUSIGN_TEMPLATE_ID

  if (!integrationKey) missing.push('DOCUSIGN_INTEGRATION_KEY')
  if (!userId) missing.push('DOCUSIGN_USER_ID')
  if (!privateKey) missing.push('DOCUSIGN_PRIVATE_KEY')
  if (!templateId) missing.push('DOCUSIGN_TEMPLATE_ID')
  if (missing.length > 0) throw new DocuSignNotConfiguredError(missing)

  return {
    integrationKey: integrationKey!,
    userId: userId!,
    privateKey: privateKey!,
    templateId: templateId!,
    accountId: process.env.DOCUSIGN_ACCOUNT_ID,
  }
}

export function isDocuSignConfigured(): boolean {
  try {
    docusignConfig()
    return true
  } catch {
    return false
  }
}

// One-time consent link. The impersonated user opens this, signs in and approves;
// after that JWT Grant works unattended forever.
export function consentUrl(redirectUri: string): string {
  const cfg = docusignConfig()
  const params = new URLSearchParams({
    response_type: 'code',
    scope: 'signature impersonation',
    client_id: cfg.integrationKey,
    redirect_uri: redirectUri,
  })
  return `https://${ACCOUNT_HOST}/oauth/auth?${params}`
}

// ── Auth ───────────────────────────────────────────────────────────────────

let cached: { token: string; accountId: string; baseUri: string; expiresAt: number } | null = null

async function authenticate(): Promise<{ token: string; accountId: string; baseUri: string }> {
  // Re-use the token until a minute before expiry — DocuSign issues 1h tokens and
  // re-signing on every call would be wasteful and rate-limited.
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return { token: cached.token, accountId: cached.accountId, baseUri: cached.baseUri }
  }

  const cfg = docusignConfig()
  const now = Math.floor(Date.now() / 1000)
  const assertion = jwt.sign(
    {
      iss: cfg.integrationKey,
      sub: cfg.userId,
      aud: ACCOUNT_HOST,
      scope: 'signature impersonation',
      iat: now,
      exp: now + 3600,
    },
    cfg.privateKey,
    { algorithm: 'RS256' }
  )

  const res = await fetch(`https://${ACCOUNT_HOST}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    // consent_required is the single most common first-run failure, and the
    // generic message ("invalid_grant") gives no clue what to do about it.
    if (body.includes('consent_required')) {
      throw new DocuSignConsentRequiredError(
        consentUrl(`${process.env.NEXTAUTH_URL ?? ''}/api/docusign/callback`)
      )
    }
    throw new Error(`DocuSign auth failed (${res.status}): ${body.slice(0, 300)}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }

  // The account id and base URI are per-account and must come from userinfo —
  // hardcoding the demo host breaks the moment go-live moves the account.
  const infoRes = await fetch(`https://${ACCOUNT_HOST}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  })
  if (!infoRes.ok) {
    throw new Error(`DocuSign userinfo failed (${infoRes.status})`)
  }
  const info = (await infoRes.json()) as {
    accounts: { account_id: string; base_uri: string; is_default: boolean }[]
  }
  const account =
    (cfg.accountId && info.accounts.find((a) => a.account_id === cfg.accountId)) ||
    info.accounts.find((a) => a.is_default) ||
    info.accounts[0]
  if (!account) throw new Error('DocuSign returned no accounts for this user')

  cached = {
    token: data.access_token,
    accountId: account.account_id,
    baseUri: account.base_uri,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return { token: cached.token, accountId: cached.accountId, baseUri: cached.baseUri }
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  const { token, accountId, baseUri } = await authenticate()
  return fetch(`${baseUri}/restapi/v2.1/accounts/${accountId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

// ── Envelopes ──────────────────────────────────────────────────────────────

export interface SendEnvelopeInput {
  /** Signer on the client side. */
  signerName: string
  signerEmail: string
  /** Values for the template's named text tabs, keyed by tabLabel. */
  fields: Record<string, string>
  /** Shown in the DocuSign email subject. */
  subject: string
}

export interface EnvelopeResult {
  envelopeId: string
  status: string
}

// Creates an envelope from the configured template and sends it. The template
// carries the document and the tab positions; we only supply values and the
// recipient, which is why the IO's fixed T&Cs live in DocuSign rather than here.
export async function sendEnvelope(input: SendEnvelopeInput): Promise<EnvelopeResult> {
  const cfg = docusignConfig()

  const res = await api('/envelopes', {
    method: 'POST',
    body: JSON.stringify({
      templateId: cfg.templateId,
      status: 'sent', // "created" would leave it as a draft in DocuSign
      emailSubject: input.subject,
      templateRoles: [
        {
          // roleName must match the role defined on the DocuSign template
          // exactly, or the tabs land on nobody and the envelope sends blank.
          roleName: 'Client',
          name: input.signerName,
          email: input.signerEmail,
          tabs: {
            textTabs: Object.entries(input.fields).map(([tabLabel, value]) => ({
              tabLabel,
              value,
              locked: 'true', // figures we computed must not be edited in DocuSign
            })),
          },
        },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`DocuSign send failed (${res.status}): ${body.slice(0, 400)}`)
  }
  const data = (await res.json()) as { envelopeId: string; status: string }
  return { envelopeId: data.envelopeId, status: data.status }
}

export interface EnvelopeStatus {
  status: string // created | sent | delivered | signed | completed | declined | voided
  sentAt: string | null
  deliveredAt: string | null
  completedAt: string | null
  declinedReason: string | null
}

export async function getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatus> {
  const res = await api(`/envelopes/${envelopeId}?include=recipients`)
  if (!res.ok) {
    throw new Error(`DocuSign status failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
  }
  const data = (await res.json()) as {
    status: string
    sentDateTime?: string
    deliveredDateTime?: string
    completedDateTime?: string
    recipients?: { signers?: { declinedReason?: string }[] }
  }
  return {
    status: data.status,
    sentAt: data.sentDateTime ?? null,
    deliveredAt: data.deliveredDateTime ?? null,
    completedAt: data.completedDateTime ?? null,
    declinedReason: data.recipients?.signers?.find((s) => s.declinedReason)?.declinedReason ?? null,
  }
}

// The completed envelope as a single PDF, including the signature certificate.
export async function downloadSignedPdf(envelopeId: string): Promise<Buffer> {
  const res = await api(`/envelopes/${envelopeId}/documents/combined`, {
    headers: { Accept: 'application/pdf' },
  })
  if (!res.ok) {
    throw new Error(`DocuSign download failed (${res.status})`)
  }
  return Buffer.from(await res.arrayBuffer())
}

export async function voidEnvelope(envelopeId: string, reason: string): Promise<void> {
  const res = await api(`/envelopes/${envelopeId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'voided', voidedReason: reason }),
  })
  if (!res.ok) {
    throw new Error(`DocuSign void failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
  }
}

// Maps DocuSign's envelope status onto the IO's business status. Mapped on read
// rather than stored, so a provider state we don't recognise can never overwrite
// a business status with something wrong — unknown states simply don't move it.
export function businessStatusFor(envelopeStatus: string): 'SENT' | 'SIGNED' | 'VOID' | null {
  switch (envelopeStatus) {
    case 'sent':
    case 'delivered':
      return 'SENT'
    case 'completed':
      return 'SIGNED'
    case 'declined':
    case 'voided':
      return 'VOID'
    default:
      return null
  }
}
