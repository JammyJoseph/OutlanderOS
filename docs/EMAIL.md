# Email — invoices@outlandermag.com

The app sends transactional email over SMTP. Before this there was no mail
library at all: every "email" was a `mailto:` link and every Send button only
stamped a status.

## Configuration

Four variables in prod `.env.local`. Until they're set, anything that would send
refuses with a clear message rather than half-running.

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=invoices@outlandermag.com
SMTP_PASS=<16-character app password>
MAIL_FROM="Outlander Magazine <invoices@outlandermag.com>"
MAIL_REPLY_TO=invoices@outlandermag.com   # optional; defaults to SMTP_USER
```

### Getting the app password (Google Workspace)

`invoices@outlandermag.com` needs 2-step verification enabled, then:
Google Account → Security → 2-Step Verification → App passwords → generate one
for "Mail". It's shown once. It is **not** the mailbox password, and the mailbox
password will not work — Google blocks basic auth.

Port 465 uses implicit TLS; 587 upgrades via STARTTLS. Both work.

## Why SMTP and not Resend/Postmark

`invoices@outlandermag.com` is a mailbox you already own, so SMTP works today
with no DNS changes. A dedicated provider gives better deliverability, bounce
handling and open tracking — but needs SPF and DKIM records on
`outlandermag.com` first.

Worth doing once volume justifies it. `src/lib/mailer.ts` is the only file that
would change; nothing else knows how mail is sent.

**Gmail sending limits apply**: roughly 2,000 recipients/day on Workspace. Fine
for wrapping shoots; not fine if this ever sends to the 53 stockists plus a
mailing list.

## What sends today

| Trigger | To | Template |
|---|---|---|
| Wrap a shoot (`POST /api/productions/[id]/wrap`) | Every crew member with an email | Invoice request, with their own link |
| Crew submits an invoice | That crew member | Invoice received confirmation |

## Failure behaviour

Deliberate, and worth knowing:

- **Wrap refuses entirely if mail isn't configured.** It does not create invoice
  requests nobody will hear about.
- **A send failure doesn't abort the batch.** One bad address must not stop the
  other fourteen people being asked. The failed row is flagged with the error, so
  it shows in the finance tab rather than a log nobody reads.
- **Requests are created before sending**, so a retry can be built without
  duplicating the ones that already went.
- **A message accepted for zero recipients throws.** nodemailer resolves happily
  in that case, and it would otherwise look like it sent.
- **The submission confirmation is best-effort.** The invoice is recorded either
  way — failing a submission because a receipt didn't send is worse than the
  supplier not getting one.

## Testing without sending real mail

`prisma/` has no mail fixtures, but any SMTP catcher works — point `SMTP_HOST` at
it. During development this flow was verified against a throwaway SMTP server on
port 2599, confirming real delivery, per-recipient tokens and the confirmation
email.

## Security notes on the public page

`/invoice/[token]` and `/api/invoice/[token]` are unauthenticated — crew are not
OutlanderOS users, so **the token is the credential**. Consequences:

- Tokens are 32 random bytes, not derived from any id.
- The page returns only that supplier's own data — no other crew, no project
  economics, no rates but their own.
- `attachmentUrl` is restricted to `http(s)`. A `javascript:` or `data:` URL
  stored here would be handed straight to whoever clicks it in finance.
- One submission per link; re-submitting is refused so a reviewed figure can't be
  overwritten.
- Both paths are allowlisted in `src/proxy.ts`. Without that they'd redirect crew
  to a login they don't have.
