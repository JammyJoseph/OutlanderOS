// ═══════════════════════════════════════════════════════════════════════════
// Transactional email.
//
// Until now the app had no mail library at all — every "email" was a mailto:
// link, and "Send" buttons only ever stamped a status. This is the first thing
// that actually leaves the building.
//
// SMTP rather than a mail SaaS, deliberately: invoices@outlandermag.com is a
// mailbox you already own, so sending through it works today with an app
// password and no DNS changes. A provider like Resend or Postmark would give
// better deliverability and bounce handling, but needs SPF/DKIM records on
// outlandermag.com first — worth doing later, and this abstraction is the only
// thing that would change.
//
// Everything here fails loudly. A mail service that silently swallows errors is
// worse than none: you believe the crew were asked to invoice, and they weren't.
// ═══════════════════════════════════════════════════════════════════════════

import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

export class MailNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(
      `Email is not configured — missing ${missing.join(', ')}. See docs/EMAIL.md.`
    )
    this.name = 'MailNotConfiguredError'
  }
}

interface MailConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
  replyTo: string
}

function config(): MailConfig {
  const missing: string[] = []
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host) missing.push('SMTP_HOST')
  if (!user) missing.push('SMTP_USER')
  if (!pass) missing.push('SMTP_PASS')
  if (missing.length > 0) throw new MailNotConfiguredError(missing)

  // Default to the mailbox we send as. Replies from crew about an invoice
  // request should land somewhere a human reads, not bounce into the void.
  const from = process.env.MAIL_FROM ?? `Outlander Magazine <${user}>`
  return {
    host: host!,
    port: Number(process.env.SMTP_PORT ?? 465),
    user: user!,
    pass: pass!,
    from,
    replyTo: process.env.MAIL_REPLY_TO ?? user!,
  }
}

export function isMailConfigured(): boolean {
  try {
    config()
    return true
  } catch {
    return false
  }
}

let cached: Transporter | null = null

function transporter(): Transporter {
  if (cached) return cached
  const c = config()
  cached = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    // 465 is implicit TLS; 587 upgrades via STARTTLS.
    secure: c.port === 465,
    auth: { user: c.user, pass: c.pass },
  })
  return cached
}

export interface SendMailInput {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}

export interface SendResult {
  messageId: string
  accepted: string[]
  rejected: string[]
}

export async function sendMail(input: SendMailInput): Promise<SendResult> {
  const c = config()
  const info = await transporter().sendMail({
    from: c.from,
    to: input.to,
    replyTo: input.replyTo ?? c.replyTo,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })

  // A message the server accepted for *nobody* is a failure, even though
  // nodemailer resolves. Without this it looks like it sent.
  const accepted = (info.accepted ?? []).map(String)
  const rejected = (info.rejected ?? []).map(String)
  if (accepted.length === 0) {
    throw new Error(`Mail server accepted no recipients (rejected: ${rejected.join(', ') || 'none reported'})`)
  }

  return { messageId: info.messageId ?? '', accepted, rejected }
}

// Confirms the credentials and that the host is reachable, without sending.
// Used by the settings check so a misconfiguration surfaces before someone
// wraps a shoot and expects fifteen emails to go out.
export async function verifyMail(): Promise<true> {
  await transporter().verify()
  return true
}

// ── Templates ───────────────────────────────────────────────────────────────
//
// Plain text alongside HTML on every send. Some crew read mail in clients that
// strip HTML, and an invoice request that arrives blank is worse than useless.

const WRAP = (body: string) => `
<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#141414;max-width:560px">
${body}
<hr style="border:none;border-top:1px solid #e7e7e7;margin:28px 0 14px">
<p style="font-size:12px;color:#6b6b6b;margin:0">
  Outlander Magazine Ltd · Company 13257633 · VAT GB 483323490<br>
  Unit 12a 31 East Business Park, Kingfisher Way, Dinnington, Rotherham, S25 3AF
</p>
</div>`

export function invoiceRequestEmail(opts: {
  name: string
  productionTitle: string
  ioNumber: string | null
  link: string
  expectedAmount: number | null
  deadline: Date
}) {
  const deadline = opts.deadline.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const amount =
    opts.expectedAmount != null
      ? `£${opts.expectedAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : null

  const ref = opts.ioNumber ? `Reference <strong>${opts.ioNumber}</strong>` : 'Reference the production name'

  const html = WRAP(`
<p>Hi ${opts.name},</p>
<p>That's a wrap on <strong>${opts.productionTitle}</strong> — thank you.</p>
<p>When you're ready, submit your invoice here:</p>
<p style="margin:20px 0">
  <a href="${opts.link}" style="background:#111;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;display:inline-block;font-weight:600">Submit your invoice</a>
</p>
<p style="font-size:14px;color:#444">
  ${ref} on your invoice.${amount ? ` We have <strong>${amount}</strong> agreed for your role — let us know if that doesn't match your records.` : ''}
</p>
<p style="font-size:14px;color:#444">We aim to pay within 30 days, so by <strong>${deadline}</strong>.</p>
<p style="font-size:13px;color:#6b6b6b">The link is personal to you — please don't forward it.</p>`)

  const text = `Hi ${opts.name},

That's a wrap on ${opts.productionTitle} — thank you.

Submit your invoice here:
${opts.link}

${opts.ioNumber ? `Reference ${opts.ioNumber} on your invoice.` : 'Reference the production name on your invoice.'}${amount ? ` We have ${amount} agreed for your role — let us know if that doesn't match your records.` : ''}

We aim to pay within 30 days, so by ${deadline}.

The link is personal to you — please don't forward it.

Outlander Magazine Ltd · Company 13257633 · VAT GB 483323490`

  return {
    subject: `Invoice request — ${opts.productionTitle}${opts.ioNumber ? ` (${opts.ioNumber})` : ''}`,
    html,
    text,
  }
}

export function invoiceReceivedEmail(opts: {
  name: string
  productionTitle: string
  amount: number
  currency: string
  deadline: Date
}) {
  const symbol = opts.currency === 'USD' ? '$' : opts.currency === 'EUR' ? '€' : '£'
  const amount = `${symbol}${opts.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const deadline = opts.deadline.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const html = WRAP(`
<p>Hi ${opts.name},</p>
<p>We've received your invoice for <strong>${opts.productionTitle}</strong> — <strong>${amount}</strong>.</p>
<p>It's with our finance team now. We aim to pay by <strong>${deadline}</strong>.</p>
<p style="font-size:14px;color:#444">No action needed from you. Just reply to this email if anything looks wrong.</p>`)

  const text = `Hi ${opts.name},

We've received your invoice for ${opts.productionTitle} — ${amount}.

It's with our finance team now. We aim to pay by ${deadline}.

No action needed from you. Just reply to this email if anything looks wrong.`

  return { subject: `Invoice received — ${opts.productionTitle}`, html, text }
}
