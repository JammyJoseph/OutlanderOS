# DocuSign — insertion order signatures

Sends an IO to the client for signature from the Commercial portal and tracks it
back to signed. Built against the eSignature REST API v2.1 with JWT Grant.

**Status: built, not yet proven against a live account.** Every call follows the
documented contract but none has run against real credentials. Treat the first
sandbox send as the real test.

---

## What you need to provide

All four go in prod `.env.local`. Until they're set, the Send button returns a
clear "DocuSign isn't connected" message rather than failing oddly.

| Variable | Where it comes from |
|---|---|
| `DOCUSIGN_INTEGRATION_KEY` | Apps & Keys → your app → Integration Key (a GUID) |
| `DOCUSIGN_USER_ID` | Apps & Keys → the user to impersonate → User ID (a GUID, **not** the email) |
| `DOCUSIGN_PRIVATE_KEY` | Apps & Keys → RSA keypair → generate, copy the **private** key |
| `DOCUSIGN_TEMPLATE_ID` | Templates → your IO template → Template ID |

Optional: `DOCUSIGN_ACCOUNT_ID` (picks a specific account when the user has
several), and `DOCUSIGN_ENV=production` once go-live is granted. Default is the
demo/sandbox environment.

The private key is multi-line. Either paste it with real newlines inside quotes,
or with `\n` escapes — both are handled.

## Setup, in order

1. **Create a developer account** at developers.docusign.com. Free, and separate
   from any paid production account.
2. **Create an app** under Apps & Keys. Note the Integration Key.
3. **Generate an RSA keypair** on that app. The private key is shown **once** —
   copy it then.
4. **Add a redirect URI** on the app: `<your-url>/api/docusign/callback`. It's
   only used for the one-time consent step.
5. **Build the IO template** in DocuSign (see the tab labels below).
6. **Grant consent once.** JWT Grant impersonates a user, and that user must
   approve it once interactively. The first send returns a `CONSENT_REQUIRED`
   error with the exact URL to open — sign in as the impersonated user, approve,
   and retry. There is no way to skip this.

## Template tab labels

The document lives in DocuSign, not in this codebase — we only send values. Every
tab below must exist on the template with **exactly** this `tabLabel`, or the
value silently lands nowhere.

```
io_number        advertiser       campaign        po_number
contact_name     total_net        company_name    company_number
vat_number
```

Plus, for each line row `n` from 1 to 10:

```
line{n}_description   line{n}_dates   line{n}_qty   line{n}_rate   line{n}_subtotal
```

The signer role must be named **`Client`**.

⚠️ **The template's line count is a hard limit.** DocuSign drops values for tabs
that don't exist, so an IO with more lines than the template would send as a
contract that doesn't say what was agreed. The send route refuses rather than
truncating — if you extend the template, update `MAX_TEMPLATE_LINES` in
`src/app/api/insertion-orders/[ioId]/send-for-signature/route.ts` to match.

## Status: polled, not pushed

DocuSign Connect pushes envelope events to an HTTPS callback. **Production has no
443 listener**, so webhooks cannot reach us. Status is therefore pulled by the
"Refresh status" button on the IO page, which calls
`POST /api/insertion-orders/[ioId]/sync-signature`.

When TLS lands, add a Connect subscription pointing at a webhook route that
writes the same fields; the polling button then becomes a manual fallback rather
than the only path. Nothing else needs to change.

## Going live

Production access needs **API certification**: make ~20 successful calls in the
demo environment, then submit the integration for review. DocuSign checks things
like polling frequency and correct error handling. Expect days, not hours. Until
then `DOCUSIGN_ENV` stays on demo and envelopes are sandbox-only — they carry a
watermark and are not legally binding.

## Design notes

- **The IO's own status and the envelope's status are stored separately.**
  `status` (DRAFT/SENT/SIGNED/VOID) is the business fact; `signatureStatus` is
  DocuSign's raw value, stored verbatim. Mapping happens on read, so a state we
  don't recognise can never mislabel the business status — and an IO signed on
  paper still works with every DocuSign column null.
- **No SDK.** The whole surface is four calls, and `jsonwebtoken` (already a
  dependency) signs the RS256 assertion. Avoids adding to this project's
  dependency CVE exposure.
- **Tokens are cached** until a minute before expiry — DocuSign issues 1h tokens
  and re-signing per call would be wasteful and rate-limited.
- **"Mark as sent manually" is deliberately kept** for IOs handled outside the
  platform.
