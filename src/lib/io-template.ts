// ─────────────────────────────────────────────────────────────────────────────
// Insertion Order template constants — the FIXED parts of every IO.
// The variable fields (advertiser, line items, PO number…) live on the
// InsertionOrder row; everything here is identical on every document.
// T&Cs transcribed from the standard "OUTLANDER MAGAZINE ADVERTISING TERMS
// AGREEMENT" (IO PDF pages 2–5).
// ─────────────────────────────────────────────────────────────────────────────

export const IO_COMPANY = {
  name: "Outlander Magazine Ltd",
  legalName: "OUTLANDER MAGAZINE LTD",
  companyNumber: "13257633",
  vatNumber: "GB 483323490",
  address:
    "Unit 12a 31 East Business Park, Kingfisher Way, Dinnington, Rotherham, United Kingdom, S25 3AF",
} as const;

export const IO_SIGNATORY = {
  name: "Shreeya Patel",
  title: "Commercial Director",
  email: "shreeya@outlandermag.com",
} as const;

// One media line item on the IO. Dates are free-text (the PDF uses "Feb 2026"),
// rate/subtotal are net GBP amounts.
export interface IOLineItem {
  startDate: string;
  endDate: string;
  description: string;
  quantity: number;
  rate: number;
  subtotal: number;
}

export type IOStatus = "DRAFT" | "SENT" | "SIGNED" | "VOID";

// OM-{YEAR}-{SEQ} — the caller supplies the next sequence number for the year
// (found in a transaction against existing ioNumbers).
export function formatIoNumber(year: number, seq: number): string {
  return `OM-${year}-${String(seq).padStart(3, "0")}`;
}

export function sumLineItems(items: IOLineItem[]): number {
  return items.reduce((t, li) => t + (Number(li.subtotal) || 0), 0);
}

// ── Terms & Conditions ────────────────────────────────────────────────────────
// Rendered on pages 2+ of the printed IO. Structured as sections so the
// document component controls typography/page breaks; the text itself is the
// agreement verbatim. `{advertiser}` in the preamble is replaced with the
// advertiser's name at render time.

export interface IOTermsSection {
  heading: string;
  paragraphs: string[];
}

export const IO_TERMS_TITLE = "OUTLANDER MAGAZINE ADVERTISING TERMS AGREEMENT";

export const IO_TERMS_PREAMBLE: string[] = [
  "(a) {advertiser} (“Retailer” or “you”, “your”).",
  "(b) OUTLANDER MAGAZINE LTD, a company incorporated and registered in England and Wales with company number 13257633 whose registered office is at Unit 12a 31 East Business Park, Kingfisher Way, Dinnington, Rotherham, United Kingdom, S25 3AF (“Outlander” or “we”, “our”, “us”).",
  "The insertion order (the “Order”) and the terms detailed herein together comprise the Contract between Outlander Magazine Ltd. (\"we\" and \"us\") and you.",
];

export const IO_TERMS_SECTIONS: IOTermsSection[] = [
  {
    heading: "1. DEFINITIONS",
    paragraphs: [
      "1.1. In this Contract the following words shall have the following meanings:",
      "“Advertisement(s)” means any digital display advertising material intended for publication by us on the E-Platforms and in the case of financial advertising complies with the Financial Services and Markets Act 2000 and other relevant statutes and regulations issued pursuant to statute or by any regulatory body;",
      "“ASA” means Advertising Standards Authority or any replacement body;",
      "“Bespoke Project(s)” means any paid-for partnership between us and you where commercial content is collaboratively produced and in some cases, disseminated according to a brief set by you;",
      "“Contract” means the agreement between us and you comprising the terms hereof and the Order (which contains the charges);",
      "“Cookie” means a packet or piece of data of other information sent by a web server to a client device, to be stored on that client device and which is sent back to that web server each time the client device makes additional requests from that web server;",
      "“Defaulting Party” has the meaning given in clause 11.1;",
      "“Digital Display Advertisements” means content that is assembled by you or your nominated third party that contains graphics such as text (i.e. copy), logos, photographs, interactive elements, and/or similar items. Digital display advertisements are typically displayed within a web page but may appear in any of the following environments; web pages, apps, mobile web pages and others;",
      "“Intellectual Property” means all vested contingent and future intellectual property rights including but not limited to copyright, trademarks, service marks, logos, design rights (whether registered or unregistered), patents, know-how, trade secrets, inventions, get-up, database rights, domain names and any applications for the protection or registration of these rights and all renewals and extensions thereof existing in any part of the world whether now known or in the future created;",
      "“Law” means any law, statute, statutory provision, subordinate legislation, rule, regulation, direction, guideline, code (whether having the force of law or not) of any governmental or regulatory authority or agency (including without limitation the British Code of Advertising, Sales Promotion and Direct Marketing and other codes of practice written by the Committee of Advertising Practice and enforced by the ASA);",
      "“Non-Defaulting Party” has the meaning given in clause 11.1;",
      "“Order” has the meaning given in the Introduction;",
      "“Publication Date” means the date on which the Advertisement/Bespoke Project(s) is intended to be published for the first time on the E-Platforms;",
    ],
  },
  {
    heading: "2. PUBLICATION OF ADVERTISEMENTS/BESPOKE PROJECT(S)",
    paragraphs: [
      "2.1. We will make reasonable efforts to ensure that the agreed Publication Dates, positions, and Impressions for Advertisements/Bespoke Project(s) are met. If these criteria are not fulfilled, you waive any claims against us and remain liable for the charges specified in this Contract.",
      "2.2. If an accepted Advertisement/Bespoke Project(s) is not published due to our fault, we will endeavor to offer an alternative publication date. If this date is not accepted, the booking will be cancelled, and you waive any claims against us for non-publication.",
      "2.3. If the parties agree that a specific number of Impressions will be achieved, publication of the Advertisement/Bespoke Project(s) will cease once this target is reached.",
      "2.4. If the agreed number of Impressions is not achieved within the specified time, you may extend the publication period on the relevant Platforms until the target is reached, but not exceeding one month.",
      "2.5. If circumstances beyond our control prevent publication on the E-Platforms due to laws or other unforeseen acts, we reserve the right to terminate the Contract without prejudice to any outstanding payments.",
      "2.6. If your public activities are deemed detrimental to our brand, we reserve the right to terminate the Contract or remove the publication of the Advertisement/Bespoke Project(s) from the E-Platforms.",
      "2.7. You grant us a royalty-free, non-exclusive license to use specified names, trademarks, logos, and Bespoke Project(s) Material to fulfill our obligations under this Contract.",
    ],
  },
  {
    heading: "3. MISTAKES, AMENDMENTS, AND CANCELLATION",
    paragraphs: [
      "3.1. You must ensure the accuracy of each Advertisement and Bespoke Project(s) Material.",
      "3.2. We are not responsible for errors in Advertisements/Bespoke Project(s) displayed unless notified before the Publication Date.",
      "3.3. Once approved and finalized, we are not obligated to make amendments or accept new versions of Advertisements/Bespoke Project(s).",
      "3.4. Written notice of stop orders, cancellations, or postponements must be provided at least 30 days before the Publication Date.",
      "3.5. You are fully liable for charges if cancellation occurs less than 30 days before the Publication Date.",
      "3.6. For Bespoke Project(s), you are responsible for production costs if cancellation occurs less than 30 days before the Publication Date.",
      "3.7. We may cancel or amend your Order within 21 days of receiving it, with reimbursement limited to costs reasonably incurred unless non-compliance with your obligations leads to cancellation.",
    ],
  },
  {
    heading: "4. CHARGES",
    paragraphs: [
      "4.1. Payment Terms: 100% of the payment is due in 30 days net terms from the invoice date.",
      "4.2. Additional advance payments may be necessary as specified in the Order. Invoice queries must be raised within 7 working days of the invoice date.",
    ],
  },
  {
    heading: "5. LIMITATION OF LIABILITY",
    paragraphs: [
      "5.1. We'll take reasonable care in publishing Advertisement/Bespoke Project(s) Material. If not published as agreed, our maximum liability is to either publish it promptly or refund the payment.",
      "5.2. We're not liable for indirect or consequential loss from failure to publish as agreed unless notified within 1 calendar month of the publication date. Unpublished material may be destroyed after 3 months unless instructed otherwise.",
      "5.3. We're not liable for loss of goodwill or reputation.",
      "5.4. Advertisements and Bespoke Project(s) Material you provide are at your own risk.",
      "5.5. We're not obligated to publish any Advertisement or Bespoke Project(s) submitted.",
      "5.6. Our total liability to you under this Contract is limited to the charges paid.",
      "5.7. Our liability for death or personal injury resulting from negligence or fraud is not limited.",
    ],
  },
  {
    heading: "6. INTELLECTUAL PROPERTY",
    paragraphs: [
      "6.1. All Intellectual Property in \"Outlander Magazine\" trademarks and products created for Bespoke Project(s) are exclusively owned by us.",
      "6.2. You agree not to use our Intellectual Property without prior written consent.",
      "6.3. Any use of Advertisements/Bespoke Project(s) beyond this Contract requires prior written agreement on remuneration and licensing.",
      "6.3.1. Notify us promptly of any suspected unauthorized use of our Intellectual Property.",
      "6.3.2. We have sole discretion in addressing unauthorized use and retain control over proceedings at our expense, with your cooperation if needed.",
    ],
  },
  {
    heading: "6.4. ADVERTISER'S REPRESENTATIONS; INDEMNIFICATION",
    paragraphs: [
      "6.4.1. You represent and warrant to us that:",
      "• you have the authority to enter into and fulfill all obligations under the Contract;",
      "• neither the Advertisement(s)/Bespoke Project(s) Material, nor any website linked to the Platforms, will breach contracts, infringe third-party rights, be defamatory, or harm our reputation;",
      "• all Advertisements/Bespoke Project(s) Material comply with applicable laws, regulations, and industry codes;",
      "• online Advertisements/Bespoke Project(s) Material do not contain harmful content or affect the operation of the E-Platforms;",
      "• you have obtained all necessary rights, consents, and permissions for publication, and you are solely responsible for payments to third parties;",
      "• you comply with data protection laws and regulations, including obtaining and using personal data appropriately.",
      "6.4.2. You indemnify and hold us harmless from losses, claims, damages, and expenses arising from any breach of your obligations or the use of Advertisement(s)/Bespoke Project(s).",
    ],
  },
  {
    heading: "6.5. CONFIDENTIALITY",
    paragraphs: [
      "6.5.1. Both parties agree to treat confidential information with confidentiality unless permitted otherwise.",
      "6.5.2. Confidential information may be disclosed to authorized personnel or as required by law.",
      "6.5.3. Confidential information shall only be used for the purpose of fulfilling obligations under the Contract.",
    ],
  },
  {
    heading: "6.6. TERMINATION",
    paragraphs: [
      "6.6.1. Either party (the “Non-Defaulting Party”) may terminate this Contract (without prejudice to its other rights and remedies) with immediate effect by written notice to the other party (the “Defaulting Party”) if:",
      "• the Defaulting Party commits a material breach of any obligations under this Contract and fails to remedy it within 7 days of receiving notice from the Non-Defaulting party;",
      "• the Defaulting Party becomes insolvent, proposes a voluntary arrangement, or faces receivership, administration, or liquidation;",
      "• the Defaulting Party breaches a warranty given in this Contract or provides materially incorrect information.",
      "6.6.2. Upon termination, you are liable for all Charges as outlined in clause 4, as if cancellation had occurred.",
    ],
  },
  {
    heading: "6.7. MISCELLANEOUS",
    paragraphs: [
      "6.7.1. You acknowledge that you haven't relied on any representation made by or on behalf of us in agreeing to these terms.",
      "6.7.2. Without our prior written consent, you shall not claim any association with us, use our name, mark, or logo, or reference us or our services in connection with any Advertisement/Bespoke Project(s).",
      "6.7.3. We bear no liability for any delay or failure to perform our obligations under this Contract due to events beyond our reasonable control.",
      "6.7.4. You are not permitted to resell, assign, sublicense, or deal with this Contract or its rights without our consent, and any such attempt will result in immediate termination.",
      "6.7.5. This Contract does not establish a partnership, joint venture, or principal-agent relationship between the parties.",
      "6.7.6. This Contract constitutes the entire agreement between the parties, superseding any previous agreements or understandings.",
      "6.7.7. Both parties warrant compliance with obligations under the Data Protection Act 1998.",
      "6.7.8. Confidential information exchanged shall be treated as such and not disclosed without prior written consent.",
      "6.7.9. In case of inconsistency between the Order and these terms, these terms shall prevail unless agreed otherwise in writing.",
      "6.7.10. This Contract is governed by the laws of England and Wales, with exclusive jurisdiction of the English courts. By signing this document, both parties confirm acceptance of its terms.",
    ],
  },
];

export const IO_TERMS_WITNESS =
  "IN WITNESS of the above the parties have entered into, and delivered, this agreement as a deed from the Effective Date as stated in this Agreement.";
