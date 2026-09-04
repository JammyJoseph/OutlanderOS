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

// The ONLY addresses a test-mode email may actually reach. Everyone else's
// sends redirect to the test inbox. All three are Outlander staff, testing the
// flow end to end while the system is not yet live; widening this list is a
// code change, on purpose, so it shows up in review like any other.
export const TEST_ALLOWED_RECIPIENTS = [
  'silver@outlandermag.com',
  'q@outlandermag.com',
  'luke@outlandermag.com',
]

export const isSendingLive = () => process.env.CREDIT_SEND_LIVE === 'true'

export const newCreditToken = () => randomBytes(32).toString('hex')

// Bumped whenever the agreement copy materially changes. Stored on the request
// at acceptance, so we always know which text each person actually signed.
export const AGREEMENT_VERSION = '2026-08-v3'

// ── The description, and why its length is a rule and not a suggestion ──────
//
// Tier 1 and tier 2 entries carry a one-line description of the person beside
// their credit. Tier 1 gets 90 characters, tier 2 gets 75. These are not
// arbitrary: the printed entry is a fixed measure on the page, and a line that
// overruns doesn't get smaller type, it gets cut — so the cut has to happen
// here, while the person writing it can still choose which words survive.
//
// Tier 3 and untiered people are not asked at all. Their entry is name, handle
// and discipline, so a description would be collected and never printed, and
// asking for something we won't use is the one thing this flow must never do.
//
// The limit is derived from the row's tier server-side, never from the request.
// A public endpoint that took the client's word for its own character budget
// would be no limit at all.
export const BIO_LIMIT_BY_TIER: Record<number, number> = { 1: 90, 2: 75 }

export function bioLimitForTier(tier: number | null | undefined): number | null {
  return (tier != null && BIO_LIMIT_BY_TIER[tier]) || null
}

// Counted in code points, not UTF-16 units, so an emoji or an accented
// character costs one — the same count the contributor sees on the page.
export const charCount = (v: string): number => [...v].length

// ── Disciplines ─────────────────────────────────────────────────────────────
//
// The credit line is theirs to pick, not the spreadsheet's to guess: exactly
// one choice, from a closed list. Closed because this is a consent record and
// free text would make "what did they agree to be printed as" unanswerable.
//
// Twenty options, set by the print team on 2026-09-03, replacing an earlier
// 125-role list that spanned the whole industry. The Directory's pages are laid
// out by discipline, so the list has to match the sections that exist on paper —
// an option nobody can print is a promise we can't keep. Adding one is a code
// change on purpose: it shows up in review, and it makes somebody check the
// layout has room for it.
export const CREDIT_ROLE_GROUPS: { label: string; roles: string[] }[] = [
  {
    // One unlabelled group: twenty options render as a plain list, and an
    // <optgroup> around all of them would be a heading with nothing to head.
    label: '',
    roles: [
      'Director',
      'Photographer',
      'Videographer',
      'DOP',
      'Camera Department',
      'Gaffer / Lighting',
      'Graphic Designer',
      'Illustrator',
      'Motion Designer',
      '3D / CGI Artist',
      'Makeup Artist',
      'Hair Stylist',
      'HMUA',
      'Stylist',
      'Art Department',
      'Producer',
      'Movement Director',
      'Creative Agency',
      'Production Agency',
      'Florist',
      'Content Creator',
    ],
  },
]

export const CREDIT_ROLES: string[] = CREDIT_ROLE_GROUPS.flatMap((g) => g.roles)

export const isCreditRole = (v: string | null | undefined): boolean =>
  !!v && CREDIT_ROLES.includes(v)

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
  'Before we print anything, we confirm every credit with the person it belongs to. There are three parts to this: what the Directory is, how your name should appear, and your permission to print it.',
].join('\n\n')

export const AGREEMENT_TERMS: { heading: string; body: string }[] = [
  {
    heading: 'What you are agreeing to see',
    body: 'The Directory is part of Outlander Magazine Issue 02, which has not been announced. By continuing you agree to keep what you learn about the issue, including its contents, contributors and timing, confidential until Outlander publicly announces it or it goes on sale, whichever comes first.',
  },
  {
    heading: 'What we will print',
    body: 'With your consent, Issue 02 will credit you by the name, Instagram handle and discipline you confirm when you continue, and — where you are asked for one — the short description of your work that you write in your own words. That is what appears in the printed magazine, in all print runs and reprints of Issue 02, and in faithful digital reproductions of its pages. Nothing else about you is printed.',
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

// ── Two hostnames, one app ────────────────────────────────────────────────────
//
// outlanderdirectory.com serves the contributor pages and nothing else; the
// system itself answers on os.outlanderdirectory.com. That split is enforced in
// nginx, not here — but the invite has to carry the public hostname, because a
// link built from the staff host would drop 239 photographers on a login
// screen. NEXTAUTH_URL stays pointed at the staff host: it drives the auth
// cookie's Secure flag and the OAuth redirect URIs.
//
// Unset, links fall back to whatever host generated them, which is what keeps
// local testing working.
export function creditPublicBase(): string | null {
  const v = (process.env.CREDIT_PUBLIC_URL ?? '').trim()
  return v ? v.replace(/\/+$/, '') : null
}

export function creditLink(opts: { fallbackBase: string; token: string }): string {
  return `${creditPublicBase() ?? opts.fallbackBase}/credit/${opts.token}`
}

// ── The deadline ─────────────────────────────────────────────────────────────
//
// Issue 02 goes to print, so confirmations have an end. After it passes the
// public page closes itself and the endpoint refuses a submission — a credit
// that arrives after the pages are laid out cannot be honoured, and accepting
// it silently would be a promise we can't keep.
//
// Overridable with CREDIT_DEADLINE (an ISO timestamp) so an extension is a
// restart rather than a deploy.
const DEADLINE_DEFAULT = '2026-09-06T23:59:59+01:00' // Sunday, end of day, London

export function submissionDeadline(): Date {
  const raw = (process.env.CREDIT_DEADLINE ?? '').trim()
  if (raw) {
    const d = new Date(raw)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date(DEADLINE_DEFAULT)
}

export function isSubmissionOpen(at: Date = new Date()): boolean {
  return at.getTime() <= submissionDeadline().getTime()
}

/** "Sunday 6 September at 23:59" — London, for the page and the staff panel. */
/**
 * The same moment written without a colon, for email.
 *
 * "23:59" reads as machine output in a sentence, and the whole point of the
 * invite is that it sounds like a person wrote it. A deadline at the very end
 * of a day is described as the end of that day; any other time gets a spoken
 * clock ("9pm", "5.30pm").
 */
export function deadlineLabelSpoken(): string {
  const d = submissionDeadline()
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const date = `${get('weekday')} ${get('day')} ${get('month')}`
  const hour = Number(get('hour'))
  const minute = Number(get('minute'))

  if (hour === 23 && minute >= 55) return `the end of ${date}`

  const suffix = hour >= 12 ? 'pm' : 'am'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  const clock = minute === 0 ? `${h12}${suffix}` : `${h12}.${String(minute).padStart(2, '0')}${suffix}`
  return `${date} at ${clock}`
}

export function deadlineLabel(): string {
  const d = submissionDeadline()
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d)
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
  return `${day} at ${time}`
}

// ── Pacing the sendout ──────────────────────────────────────────────────────
//
// Gmail will take 2,000 recipients a day, so 239 is nowhere near the ceiling.
// The ceiling is not the problem: 239 near-identical messages leaving one
// mailbox inside a few minutes is what gets the sender filtered, and a filtered
// invite is a contributor who never appears in the Directory. So invites are
// spread across a rate the receiving end reads as a person sending email.
//
// Slots also stay inside working hours. A 3am invite from a magazine you have
// not heard from before is read as spam by humans as well as filters.
export const SEND_WINDOW = { startHour: 9, endHour: 19 } // Europe/London
export const DEFAULT_PER_HOUR = 20

/**
 * Even slots at `perHour`, skipping to the next window when a day fills up.
 * Returns one Date per index, in order.
 */
export function sendSlots(count: number, perHour: number, from = new Date()): Date[] {
  const gapMs = Math.round(3_600_000 / Math.max(1, Math.min(120, perHour)))
  const out: Date[] = []
  let cursor = new Date(Math.max(from.getTime(), Date.now()))
  cursor = nextOpenMoment(cursor)
  for (let i = 0; i < count; i++) {
    out.push(new Date(cursor))
    cursor = nextOpenMoment(new Date(cursor.getTime() + gapMs))
  }
  return out
}

// London hours from a UTC clock without pulling in a date library: the offset
// is read back off the formatted local hour, so BST and GMT both land right.
function londonHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      hour12: false,
    }).format(d)
  )
}

function nextOpenMoment(d: Date): Date {
  let cur = new Date(d)
  for (let guard = 0; guard < 48; guard++) {
    const h = londonHour(cur)
    if (h >= SEND_WINDOW.startHour && h < SEND_WINDOW.endHour) return cur
    // Before the window opens, wait for it; after it closes, wait for tomorrow.
    cur = new Date(cur.getTime() + 60 * 60 * 1000)
    cur.setUTCMinutes(0, 0, 0)
  }
  return cur
}

// ── Email ───────────────────────────────────────────────────────────────────

export function creditInviteEmail(opts: {
  name: string
  role: string | null
  link: string
}): { subject: string; text: string; html: string } {
  const first = opts.name.trim().split(/\s+/)[0] || 'there'

  const subject = `${first}, Outlander invites you to The Outlander Directory`

  // Deliberately role-free. Naming a discipline in the outreach guesses at how
  // someone defines their own work, and the guess comes from a spreadsheet.
  // The page is where they tell us how the credit should read.
  const text = [
    `Hi ${first},`,
    '',
    `We're reaching out because we would love to feature you in the next issue of Outlander Magazine, in something we're building called The Outlander Directory. It's a printed, curated index of the people shaping this culture.`,
    '',
    `Before it goes to print, we'd like to get a few details exactly right, and we need your sign-off.`,
    '',
    `It takes about two minutes, and we need it back by ${deadlineLabelSpoken()}. After that the pages are laid out and we can't add anyone.`,
    '',
    opts.link,
    '',
    'The link is personal to you, so please don’t forward it. The page explains everything once you’re in.',
    '',
    'If anything looks wrong, just reply to this email.',
    '',
    'Outlander Magazine',
  ].join('\n')

  const html = `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#141414;font-size:15px;line-height:1.6">
    <p style="margin:28px 0 0;letter-spacing:.14em;font-size:11px;font-weight:700;color:#9a9a9a">OUTLANDER MAGAZINE</p>
    <p style="margin:22px 0 0">Hi ${escapeHtml(first)},</p>
    <p style="margin:14px 0 0">We&rsquo;re reaching out because we would love to feature you in the next issue of Outlander Magazine, in something we&rsquo;re building called The Outlander Directory. It&rsquo;s a printed, curated index of the people shaping this culture.</p>
    <p style="margin:14px 0 0">Before it goes to print, we&rsquo;d like to get a few details exactly right, and we need your sign-off.</p>
    <p style="margin:22px 0 0">
      <a href="${opts.link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:500">Confirm your credit</a>
    </p>
    <p style="margin:20px 0 0;font-size:13px;color:#6b6b6b">Takes about two minutes, and we need it back by <strong style="color:#141414">${deadlineLabelSpoken()}</strong>. After that the pages are laid out and we can&rsquo;t add anyone. The link is personal to you, so please don&rsquo;t forward it.</p>
    <p style="margin:14px 0 0;font-size:13px;color:#6b6b6b">If anything looks wrong, just reply to this email.</p>
    <p style="margin:26px 0 40px;font-size:13px;color:#9a9a9a">Outlander Magazine</p>
  </div>`

  return { subject, text, html }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * The nudge, for people who were invited and haven't answered.
 *
 * Written short on purpose. A second email that re-explains the whole thing
 * reads as a mailshot; one that assumes they remember reads as a person
 * following up. It also names the way out, because someone who does not want to
 * be in the Directory should be able to say so in one click rather than by
 * ignoring us twice.
 *
 * No em dashes and no colons, same as the invite.
 */
export function creditReminderEmail(opts: {
  name: string
  link: string
}): { subject: string; text: string; html: string } {
  const first = opts.name.trim().split(/\s+/)[0] || 'there'
  const subject = `${first}, still time to confirm your Outlander Directory credit`

  const text = [
    `Hi ${first},`,
    '',
    `A quick nudge on the email we sent about The Outlander Directory in Issue 02 of Outlander Magazine. We still have a place for you and we have not heard back yet.`,
    '',
    `It takes about two minutes and we need it by ${deadlineLabelSpoken()}, after which the pages are laid out.`,
    '',
    opts.link,
    '',
    `If you would rather not be included, there is a button on that page to tell us so, and that is completely fine.`,
    '',
    'Outlander Magazine',
  ].join('\n')

  const html = `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#141414;font-size:15px;line-height:1.6">
    <p style="margin:28px 0 0;letter-spacing:.14em;font-size:11px;font-weight:700;color:#9a9a9a">OUTLANDER MAGAZINE</p>
    <p style="margin:22px 0 0">Hi ${escapeHtml(first)},</p>
    <p style="margin:14px 0 0">A quick nudge on the email we sent about The Outlander Directory in Issue 02 of Outlander Magazine. We still have a place for you and we have not heard back yet.</p>
    <p style="margin:22px 0 0">
      <a href="${opts.link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:500">Confirm your credit</a>
    </p>
    <p style="margin:20px 0 0;font-size:13px;color:#6b6b6b">It takes about two minutes and we need it by <strong style="color:#141414">${deadlineLabelSpoken()}</strong>, after which the pages are laid out.</p>
    <p style="margin:14px 0 0;font-size:13px;color:#6b6b6b">If you would rather not be included, there is a button on that page to tell us so, and that is completely fine.</p>
    <p style="margin:26px 0 40px;font-size:13px;color:#9a9a9a">Outlander Magazine</p>
  </div>`

  return { subject, text, html }
}

export function creditOutcomeEmail(opts: {
  name: string
  confirmed: boolean
  creditAs?: string | null
  discipline?: string | null
}): { subject: string; text: string; html: string } {
  const first = opts.name.trim().split(/\s+/)[0] || 'there'

  if (opts.confirmed) {
    const subject = `${first}, your place in The Outlander Directory is confirmed`
    const credit = [opts.creditAs?.trim(), opts.discipline?.trim()].filter(Boolean).join(', ')
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
    'Confirming your choice. You will not appear in The Outlander Directory, and we will not print your name in Issue 02.',
    '',
    'If you change your mind before we go to print, reply to this email and we will put you back in.',
    '',
    'Outlander Magazine',
  ].join('\n')
  const html = `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#141414;font-size:15px;line-height:1.6">
    <p style="margin:28px 0 0;letter-spacing:.14em;font-size:11px;font-weight:700;color:#9a9a9a">OUTLANDER MAGAZINE</p>
    <p style="margin:22px 0 0">Hi ${escapeHtml(first)},</p>
    <p style="margin:14px 0 0">Confirming your choice. You will not appear in The Outlander Directory, and we will not print your name in Issue 02.</p>
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
  const intended = opts.to.trim()
  // In test mode, an allowlisted address gets the real email exactly as a
  // contributor would, so the flow can be experienced, not just inspected.
  // Everyone else redirects to the test inbox with the intent in the subject.
  const passthrough = TEST_ALLOWED_RECIPIENTS.includes(intended.toLowerCase())
  const recipient = live || passthrough ? intended : TEST_INBOX
  const mail = creditInviteEmail(opts)
  const subject =
    live || passthrough ? mail.subject : `[TEST — would go to ${intended}] ${mail.subject}`

  await sendMail({
    to: recipient,
    subject,
    text: mail.text,
    html: mail.html,
  })

  return { sentTo: recipient, isTest: !live }
}

/**
 * Sends the reminder, behind the same live/test gate as the invite so a
 * reminder can never escape a test environment either.
 */
export async function sendCreditReminder(opts: {
  to: string
  name: string
  link: string
}): Promise<CreditSendResult> {
  if (!isMailConfigured()) {
    throw new Error('Mail is not configured on this server (SMTP_* variables).')
  }
  if (!isValidEmail(opts.to)) {
    throw new Error(`"${opts.to}" is not a valid email address.`)
  }

  const live = isSendingLive()
  const intended = opts.to.trim()
  const passthrough = TEST_ALLOWED_RECIPIENTS.includes(intended.toLowerCase())
  const recipient = live || passthrough ? intended : TEST_INBOX
  const mail = creditReminderEmail(opts)
  const subject =
    live || passthrough ? mail.subject : `[TEST — would go to ${intended}] ${mail.subject}`

  await sendMail({ to: recipient, subject, text: mail.text, html: mail.html })
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
  discipline?: string | null
}): Promise<CreditSendResult> {
  if (!isMailConfigured()) throw new Error('Mail is not configured.')
  if (!isValidEmail(opts.to)) throw new Error(`"${opts.to}" is not a valid email address.`)

  const live = isSendingLive()
  const intended = opts.to.trim()
  const passthrough = TEST_ALLOWED_RECIPIENTS.includes(intended.toLowerCase())
  const recipient = live || passthrough ? intended : TEST_INBOX
  const mail = creditOutcomeEmail(opts)
  const subject =
    live || passthrough ? mail.subject : `[TEST — would go to ${intended}] ${mail.subject}`

  await sendMail({ to: recipient, subject, text: mail.text, html: mail.html })
  return { sentTo: recipient, isTest: !live }
}
