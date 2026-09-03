// Transactional mail for getting into the system: password resets.
//
// This is deliberately not gated behind CREDIT_SEND_LIVE. That gate exists to
// stop a 239-person contributor sendout escaping before anyone means it; a
// reset link goes to one member of staff who is standing at a login screen
// right now, and a test-redirect would mean they never receive it.

import { sendMail, isMailConfigured } from '@/lib/mailer'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function passwordResetEmail(opts: {
  name: string | null
  link: string
  expiresInMinutes: number
}): { subject: string; text: string; html: string } {
  const first = (opts.name ?? '').trim().split(/\s+/)[0] || 'there'
  const subject = 'Reset your OutlanderOS password'

  const text = [
    `Hi ${first},`,
    '',
    'Someone asked to reset the password on your OutlanderOS account. If that was you, open this link and choose a new one:',
    '',
    opts.link,
    '',
    `The link works once and expires in ${opts.expiresInMinutes} minutes.`,
    '',
    "If it wasn't you, ignore this email — nothing has changed, and your current password still works.",
    '',
    'OutlanderOS',
  ].join('\n')

  const html = `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#141414;font-size:15px;line-height:1.6">
    <p style="margin:28px 0 0;letter-spacing:.14em;font-size:11px;font-weight:700;color:#9a9a9a">OUTLANDEROS</p>
    <p style="margin:22px 0 0">Hi ${escapeHtml(first)},</p>
    <p style="margin:14px 0 0">Someone asked to reset the password on your OutlanderOS account. If that was you, choose a new one:</p>
    <p style="margin:22px 0 0">
      <a href="${opts.link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:500">Set a new password</a>
    </p>
    <p style="margin:20px 0 0;font-size:13px;color:#6b6b6b">The link works once and expires in ${opts.expiresInMinutes} minutes.</p>
    <p style="margin:14px 0 0;font-size:13px;color:#6b6b6b">If it wasn&rsquo;t you, ignore this email &mdash; nothing has changed and your current password still works.</p>
    <p style="margin:26px 0 40px;font-size:13px;color:#9a9a9a">OutlanderOS</p>
  </div>`

  return { subject, text, html }
}

/**
 * Sends the reset link. Returns whether it actually went, rather than throwing,
 * because the caller must answer the same way whether or not the address
 * exists — a route that 500s on an unknown address is an account-enumeration
 * oracle.
 */
export async function sendPasswordReset(opts: {
  to: string
  name: string | null
  link: string
  expiresInMinutes: number
}): Promise<{ sent: boolean; error?: string }> {
  if (!isMailConfigured()) {
    return { sent: false, error: 'Mail is not configured on this server (SMTP_* variables).' }
  }
  try {
    const mail = passwordResetEmail(opts)
    await sendMail({ to: opts.to, subject: mail.subject, text: mail.text, html: mail.html })
    return { sent: true }
  } catch (err) {
    return { sent: false, error: String((err as Error).message) }
  }
}
