#!/usr/bin/env node
/*
 * Importer v2: Google Sheet CSV export -> Contact table.
 * The master CSV concatenates several source sheets with DIFFERENT layouts:
 *   - "Standard" talent sheets: name,based,type,freelance/agency,IG,email,phone,web,rate
 *   - "Brands & PR": heterogeneous — brand+email-list rows, brand+person rows,
 *     and person rows where the name lives in column 2 with affiliation in col 3.
 * Maps source sheet -> canonical CONTACT_CATEGORIES (src/lib/directory.ts).
 * Dedups by name (case-insensitive) within CSV and against DB.
 * Parameterized INSERTs in ONE transaction; ROLLBACK on any error.
 * Re-runnable: existing names skipped; nothing updated/deleted.
 */
const fs = require("fs");
const crypto = require("crypto");
const { Client } = require("pg");

const CSV_PATH = process.argv[2] || "/tmp/contacts.csv";
const CONN = "postgresql://outlanderos:test123@127.0.0.1:5432/outlanderos";
const CREATED_BY = "cmo8i597y0001zxy8bpfxt1l1"; // silver@outlandermag.com (ADMIN)
const DRY_RUN = process.argv.includes("--dry-run");

const CATEGORY_MAP = {
  "photographers": "Photographer",
  "hair & makeup": "MUA",
  "casting": "Casting Director",
  "stylists": "Stylist",
  "set / prop designers": "Set Designer",
  "videographers": "Videographer",
  "graphic design": "Other",
  "editors": "Editor",
  "directors": "Creative Director",
  "producers": "Producer",
  "communities": "Other",
  "brand": "Brand Contact",
  "dj's": "Talent",
  "agencies": "Other",
  "venues": "Other",
  "influencers": "Talent",
  "hotels&airbnb's": "Other",
  // "brands & pr" handled specially below
};

function parseCSV(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else { if (c === '"') q = true; else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\r") {} else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; } else field += c; }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const clean = (v) => { const t = (v || "").trim(); return t.length ? t : null; };
const hasAt = (s) => /@/.test(s || "");
const cuid = () => "c" + crypto.randomUUID().replace(/-/g, "");
const mapCategory = (raw) => CATEGORY_MAP[(raw || "").trim().toLowerCase()] || "Other";

function buildNotes(parts) { const p = parts.filter(Boolean); return p.length ? p.join(" | ") : null; }

// Returns a contact object, or {nameless:true, raw} if no usable name.
function buildContact(r) {
  const src = (r[0] || "").trim();
  const cols = r.map((x) => (x || "").trim());

  if (src === "Brands & PR") {
    const c1 = cols[1], c2 = cols[2], c3 = cols[3];
    const emails = cols.slice(2).filter(hasAt);
    // brand + email-list row
    if (c1 && hasAt(c2)) {
      return {
        category: "Brand Contact", name: c1, company: c1,
        email: emails[0] || null,
        notes: buildNotes([emails.length > 1 ? "Other contacts: " + emails.slice(1).join(", ") : null]),
      };
    }
    // person-bearing row: name is col2 (if not an email) else col1
    const name = (c2 && !hasAt(c2)) ? c2 : c1;
    if (!name) return { nameless: true, raw: cols };
    const company = [c1, c3].find((x) => x && x !== name && !hasAt(x)) || null;
    const extraAffil = c3 && c3 !== company && c3 !== name ? "Affiliation: " + c3 : null;
    return {
      category: "PR", name, company,
      email: emails[0] || null,
      notes: buildNotes([extraAffil, emails.length > 1 ? "Other emails: " + emails.slice(1).join(", ") : null]),
    };
  }

  // Standard layout for all other sheets
  const name = cols[1];
  if (!name) return { nameless: true, raw: cols };
  let company = clean(cols[4]);
  let email = clean(cols[6]);
  // Some sheets (e.g. "BRAND") carry the contact email in the company slot.
  if (!email && company && hasAt(company)) { email = company; company = null; }
  return {
    category: mapCategory(src), name,
    location: clean(cols[2]), role: clean(cols[3]), company,
    instagram: clean(cols[5]), email, phone: clean(cols[7]),
    website: clean(cols[8]),
    notes: buildNotes([cols[8] ? "Web: " + cols[8] : null, cols[9] ? "Rate: " + cols[9] : null]),
  };
}

(async () => {
  const rows = parseCSV(fs.readFileSync(CSV_PATH, "utf8"));
  const header = rows.shift();
  if (!header || !/source sheet/i.test(header[0] || "")) throw new Error("Bad header: " + JSON.stringify(header));

  const client = new Client({ connectionString: CONN });
  await client.connect();
  const existing = new Set((await client.query('SELECT lower(trim(name)) AS n FROM "Contact"')).rows.map((r) => r.n));

  const seen = new Set();
  const toInsert = [];
  const nameless = [];
  const skipped = { dupInCsv: 0, dupInDb: 0 };

  for (const r of rows) {
    if (!r || r.every((c) => (c || "").trim() === "")) continue;
    const c = buildContact(r);
    if (c.nameless) { nameless.push(c.raw); continue; }
    const key = c.name.toLowerCase();
    if (existing.has(key)) { skipped.dupInDb++; continue; }
    if (seen.has(key)) { skipped.dupInCsv++; continue; }
    seen.add(key);
    toInsert.push({
      id: cuid(), name: c.name, category: c.category,
      location: c.location || null, role: c.role || null, company: c.company || null,
      instagram: c.instagram || null, email: c.email || null, phone: c.phone || null,
      website: c.website || null, notes: c.notes || null,
    });
  }

  const breakdown = {};
  for (const c of toInsert) breakdown[c.category] = (breakdown[c.category] || 0) + 1;
  console.log("To insert:", toInsert.length);
  console.log("Skipped:", JSON.stringify(skipped));
  console.log("Nameless (skipped, need manual review):", nameless.length);
  nameless.forEach((r) => console.log("  ", JSON.stringify(r)));
  console.log("Category breakdown:", JSON.stringify(breakdown, null, 2));
  console.log("--- samples ---");
  ["Photographer", "PR", "Brand Contact", "MUA", "Other"].forEach((cat) => {
    const ex = toInsert.filter((c) => c.category === cat).slice(0, 2);
    ex.forEach((c) => console.log(cat, "::", JSON.stringify({ name: c.name, company: c.company, email: c.email, instagram: c.instagram, notes: c.notes })));
  });

  if (DRY_RUN) { console.log("\nDRY RUN — no writes."); await client.end(); return; }

  let inserted = 0;
  try {
    await client.query("BEGIN");
    for (const c of toInsert) {
      await client.query(
        `INSERT INTO "Contact" (id,name,category,location,role,company,instagram,email,phone,website,notes,"createdBy","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())`,
        [c.id, c.name, c.category, c.location, c.role, c.company, c.instagram, c.email, c.phone, c.website, c.notes, CREATED_BY]
      );
      inserted++;
    }
    await client.query("COMMIT");
    console.log("\nCOMMITTED. Inserted:", inserted);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("ROLLED BACK:", e.message);
    process.exitCode = 1;
  } finally { await client.end(); }
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
