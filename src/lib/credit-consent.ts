// ═══════════════════════════════════════════════════════════════════════════
// Print credit consent — the machinery behind the contributor confirmation
// flow. One person, one token, one page: read the agreement, confirm the
// credit, grant or decline consent.
//
// THE SAFETY RULE, before anything else: no email leaves this module for a real
// recipient until CREDIT_SEND_LIVE=true is set in the environment. Until then
// every send — single or bulk — is redirected to the test inbox with the
// intended recipient named in the subject. This is deliberately not a UI
// toggle: a checkbox can be unticked by accident at 11pm; a missing environment
// variable cannot.
// ═══════════════════════════════════════════════════════════════════════════

import { randomBytes } from 'crypto'
import { sendMail, isMailConfigured } from '@/lib/mailer'

export const TEST_INBOX = 'silver@outlandermag.com'

export const isSendingLive = () => process.env.CREDIT_SEND_LIVE === 'true'

export const newCreditToken = () => randomBytes(32).toString('hex')

// Bumped whenever the agreement copy materially changes. Stored on the request
// at acceptance, so we always know which text each person actually signed.
export const AGREEMENT_VERSION = '2026-08-v2'

const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const isValidEmail = (v: string | null | undefined): boolean =>
  !!v && emailRe.test(v.trim())

// ── The agreement ───────────────────────────────────────────────────────────
//
// Two layers, mirroring how the page reveals it: the short version everyone
// reads, and the full terms behind it. Written in plain English on purpose —
// the people signing this are photographers and stylists, not lawyers, and an
// agreement nobody understands protects nobody.
//
// NOTE FOR THE TEAM: this is carefully written but it is not legal advice. Have
// a lawyer read it once before the real sendout.

export const AGREEMENT_SUMMARY = [
  'Outlander Magazine is building something new for Issue 02: a printed Directory, a curated index of the people who actually make this culture. Photographers, stylists, producers, directors. You are one of them.',
  'Before we print anything, we confirm every credit with the person it belongs to. This page does three things: it tells you what the Directory is, it asks you to confirm exactly how your name should appear, and it asks your permission to print it.',
].join('\n\n')

export const AGREEMENT_TERMS: { heading: string; body: string }[] = [
  {
    heading: 'What you are agreeing to see',
    body: 'The Directory is part of Outlander Magazine Issue 02, which has not been announced. By continuing past this page you agree to keep what you learn about the issue, including its contents, contributors and timing, confidential until Outlander publicly announces it or it goes on sale, whichever comes first.',
  },
  {
    heading: 'What we will print',
    body: 'With your consent, Issue 02 will credit you by the name, Instagram handle and discipline you confirm on the next page: in the printed magazine, in all print runs and reprints of Issue 02, and in faithful digital reproductions of its pages. Nothing else about you is printed.',
  },
  {
    heading: 'What stays private',
    body: 'Your email and postal address are never printed and never shared. The address is requested for one reason: so we can send you something. It is stored securely, used for that delivery, and removed afterwards.',
  },
  {
    heading: 'No fee, no exclusivity',
    body: 'A Directory credit is recognition, not a commercial engagement. No payment is due in either direction, and nothing here limits who you work with or how you describe your own work.',
  },
  {
    heading: 'Changing your mind',
    body: `You can withdraw or amend your credit any time before the issue goes to print by emailing ${TEST_INBOX}. After print, changes apply to reprints and digital editions only, as we cannot recall paper.`,
  },
]

/**
 * The agreement as one written document. Snapshotted onto the row at
 * acceptance, so every signature is attached to the exact words it agreed to,
 * independent of what this file says next year.
 */
export function agreementFullText(): string {
  return [
    `THE OUTLANDER DIRECTORY, CONTRIBUTOR AGREEMENT (${AGREEMENT_VERSION})`,
    '',
    AGREEMENT_SUMMARY,
    '',
    ...AGREEMENT_TERMS.map((t) => `${t.heading.toUpperCase()}\n${t.body}`),
  ].join('\n\n')
}

// ── Email ───────────────────────────────────────────────────────────────────

export function creditInviteEmail(opts: {
  name: string
  role: string | null
  link: string
}): { subject: string; text: string; html: string } {
  const first = opts.name.trim().split(/\s+/)[0] || 'there'
  const roleLine = opts.role ? ` as ${/^[aeiou]/i.test(opts.role) ? 'an' : 'a'} ${opts.role}` : ''

  const subject = `${first}, Outlander invites you to The Outlander Directory`

  const text = [
    `Hi ${first},`,
    '',
    `We're crediting you${roleLine} in something we're building for the next issue of Outlander Magazine. We'd like to get your name exactly right, and we need your sign-off to print it.`,
    '',
    'It takes about two minutes:',
    opts.link,
    '',
    'The link is personal to you, so please don’t forward it. What we’re building is under wraps until the issue is announced; the page explains everything once you’re in.',
    '',
    'If anything looks wrong, just reply to this email.',
    '',
    'Outlander Magazine',
  ].join('\n')

  const html = `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#141414;font-size:15px;line-height:1.6">
    <p style="margin:28px 0 0;letter-spacing:.14em;font-size:11px;font-weight:700;color:#9a9a9a">OUTLANDER MAGAZINE</p>
    <p style="margin:22px 0 0">Hi ${escapeHtml(first)},</p>
    <p style="margin:14px 0 0">We&rsquo;re crediting you${escapeHtml(roleLine)} in something we&rsquo;re building for the next issue of Outlander Magazine. We&rsquo;d like to get your name exactly right, and we need your sign-off to print it.</p>
    <p style="margin:22px 0 0">
      <a href="${opts.link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:500">Confirm your credit</a>
    </p>
    <p style="margin:20px 0 0;font-size:13px;color:#6b6b6b">Takes about two minutes. The link is personal to you, so please don&rsquo;t forward it. What we&rsquo;re building is under wraps until the issue is announced; the page explains everything once you&rsquo;re in.</p>
    <p style="margin:14px 0 0;font-size:13px;color:#6b6b6b">If anything looks wrong, just reply to this email.</p>
    <p style="margin:26px 0 40px;font-size:13px;color:#9a9a9a">Outlander Magazine</p>
  </div>`

  return { subject, text, html }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function creditOutcomeEmail(opts: {
  name: string
  confirmed: boolean
  creditAs?: string | null
}): { subject: string; text: string; html: string } {
  const first = opts.name.trim().split(/\s+/)[0] || 'there'

  if (opts.confirmed) {
    const subject = `${first}, your place in The Outlander Directory is confirmed`
    const credit = opts.creditAs?.trim()
    const text = [
      `Hi ${first},`,
      '',
      `That's it. Your credit is signed and locked${credit ? ` as ${credit}` : ''}, and you'll appear in The Outlander Directory in Issue 02 of Outlander Magazine.`,
      '',
      'Until the issue is announced, everything you read stays between us, as agreed.',
      '',
      'If anything needs changing before we go to print, reply to this email.',
      '',
      'Outlander Magazine',
    ].join('\n')
    const html = `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#141414;font-size:15px;line-height:1.6">
    <p style="margin:28px 0 0;letter-spacing:.14em;font-size:11px;font-weight:700;color:#9a9a9a">OUTLANDER MAGAZINE</p>
    <p style="margin:22px 0 0">Hi ${escapeHtml(first)},</p>
    <p style="margin:14px 0 0">That&rsquo;s it. Your credit is signed and locked${credit ? ` as <strong>${escapeHtml(credit)}</strong>` : ''}, and you&rsquo;ll appear in The Outlander Directory in Issue 02 of Outlander Magazine.</p>
    <p style="margin:14px 0 0;font-size:13px;color:#6b6b6b">Until the issue is announced, everything you read stays between us, as agreed. If anything needs changing before we go to print, reply to this email.</p>
    <p style="margin:26px 0 40px;font-size:13px;color:#9a9a9a">Outlander Magazine</p>
  </div>`
    return { subject, text, html }
  }

  const subject = `${first}, we won't print your name, as requested`
  const text = [
    `Hi ${first},`,
    '',
    'Confirming your choice: you will not appear in The Outlander Directory, and we will not print your name in Issue 02.',
    '',
    'If you change your mind before we go to print, reply to this email and we will put you back in.',
    '',
    'Outlander Magazine',
  ].join('\n')
  const html = `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#141414;font-size:15px;line-height:1.6">
    <p style="margin:28px 0 0;letter-spacing:.14em;font-size:11px;font-weight:700;color:#9a9a9a">OUTLANDER MAGAZINE</p>
    <p style="margin:22px 0 0">Hi ${escapeHtml(first)},</p>
    <p style="margin:14px 0 0">Confirming your choice: you will not appear in The Outlander Directory, and we will not print your name in Issue 02.</p>
    <p style="margin:14px 0 0;font-size:13px;color:#6b6b6b">If you change your mind before we go to print, reply to this email and we will put you back in.</p>
    <p style="margin:26px 0 40px;font-size:13px;color:#9a9a9a">Outlander Magazine</p>
  </div>`
  return { subject, text, html }
}

// ── Sending, behind the safety gate ─────────────────────────────────────────

export interface CreditSendResult {
  sentTo: string
  isTest: boolean
}

/**
 * Sends the invite. In test mode (the default, and the only mode until
 * CREDIT_SEND_LIVE=true exists in the environment) the message goes to the test
 * inbox instead of the real recipient, with the intended address in the subject
 * so a test run reads as exactly what it is.
 */
export async function sendCreditInvite(opts: {
  to: string
  name: string
  role: string | null
  link: string
}): Promise<CreditSendResult> {
  if (!isMailConfigured()) {
    throw new Error('Mail is not configured on this server (SMTP_* variables).')
  }
  if (!isValidEmail(opts.to)) {
    throw new Error(`"${opts.to}" is not a valid email address.`)
  }

  const live = isSendingLive()
  const recipient = live ? opts.to.trim() : TEST_INBOX
  const mail = creditInviteEmail(opts)
  const subject = live ? mail.subject : `[TEST — would go to ${opts.to.trim()}] ${mail.subject}`

  await sendMail({
    to: recipient,
    subject,
    text: mail.text,
    html: mail.html,
  })

  return { sentTo: recipient, isTest: !live }
}

/**
 * Confirmation after they respond, in either direction. Same gate as the
 * invite: test mode redirects to the test inbox with the real recipient in the
 * subject. Callers treat this as best effort, because the signed response is
 * already recorded and failing it because a receipt didn't send would be worse
 * than the receipt missing.
 */
export async function sendCreditOutcome(opts: {
  to: string
  name: string
  confirmed: boolean
  creditAs?: string | null
}): Promise<CreditSendResult> {
  if (!isMailConfigured()) throw new Error('Mail is not configured.')
  if (!isValidEmail(opts.to)) throw new Error(`"${opts.to}" is not a valid email address.`)

  const live = isSendingLive()
  const recipient = live ? opts.to.trim() : TEST_INBOX
  const mail = creditOutcomeEmail(opts)
  const subject = live ? mail.subject : `[TEST — would go to ${opts.to.trim()}] ${mail.subject}`

  await sendMail({ to: recipient, subject, text: mail.text, html: mail.html })
  return { sentTo: recipient, isTest: !live }
}
